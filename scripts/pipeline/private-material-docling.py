#!/usr/bin/env python3
"""Optional host worker: one private PDF page, pinned local models, no grading.

Its caller owns consent, the original, cancellation, the wall/RSS watchdog,
and the original page preview. Capability checks never load inference models.
"""

import base64
import contextlib
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

CONTRACT = "yozi-docling-page-v1"
MAX_PDF = 10 * 1024 * 1024
MAX_INPUT = 14 * 1024 * 1024
MAX_OUTPUT = 2 * 1024 * 1024
VERSIONS = {
    "docling-slim": "2.135.0",
    "docling-core": "2.101.1",
    "docling-parse": "7.22.2",
    "docling-ibm-models": "4.0.3",
    "rapidocr": "3.9.2",
    "omegaconf": "2.3.0",
    "antlr4-python3-runtime": "4.9.3",
}
MODEL_FILES = {
    "docling-project--docling-layout-heron/config.json": "fdea30805ce2f5666b147fca941dcdd27ad468e27d6ed21902207d3da056a97d",
    "docling-project--docling-layout-heron/preprocessor_config.json": "cd38cd59999e7a95d68e487fbe5132df3d4e5c32a0836add57e6126ba0c4eaf1",
    "docling-project--docling-layout-heron/model.safetensors": "00333a43451945aaf89db8ca9c0a17e75d1537c17db60fdb91aa95f4c7929e0c",
    "docling-project--docling-models/model_artifacts/tableformer/accurate/tm_config.json": "984e122ceb8ccf84d84c9d2882f6f2302a44b4f1e577babd6289892c36f3cffd",
    "docling-project--docling-models/model_artifacts/tableformer/accurate/tableformer_accurate.safetensors": "2a7d6c924b3cd12fb99a09280ca9c33a89c5d60b93253617d2e088c1a40374d9",
}
OCR_FILES = {
    "PP-OCRv6_det_small.onnx": "090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f",
    "PP-OCRv6_rec_small.onnx": "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884",
    "ch_ppocr_mobile_v2.0_cls_mobile.onnx": "e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c",
}


class DoclingError(ValueError):
    pass


def require(condition, code="DOCLING_INVALID_RESULT"):
    if not condition:
        raise DoclingError(code)


def number(value):
    require(type(value) in (int, float) and math.isfinite(value))
    return value


def text(value, maximum=20000):
    require(isinstance(value, str) and len(value) <= maximum)
    return value


def bbox(value, width, height):
    require(isinstance(value, dict))
    left, top, right, bottom = [number(value.get(k)) for k in ("l", "t", "r", "b")]
    origin = value.get("coord_origin")
    require(origin in ("TOPLEFT", "BOTTOMLEFT"))
    if origin == "BOTTOMLEFT":
        top, bottom = height - top, height - bottom
    require(0 <= left <= right <= width and 0 <= top <= bottom <= height)
    return [left, top, right, bottom]


def normalize_document(document, page, fingerprint, allow_ocr):
    """Keep JSON originals and picture children that Markdown export omits."""
    require(isinstance(document, dict) and document.get("schema_name") == "DoclingDocument")
    require(type(page) is int and 1 <= page <= 2048)
    require(type(allow_ocr) is bool and bool(re.fullmatch(r"[a-f0-9]{64}", fingerprint)))
    pages = document.get("pages")
    require(isinstance(pages, dict) and set(pages) == {str(page)})
    size = pages[str(page)].get("size", {})
    width, height = number(size.get("width")), number(size.get("height"))
    require(0 < width <= 14400 and 0 < height <= 14400)
    index = {}
    for collection in ("groups", "texts", "pictures", "tables"):
        values = document.get(collection, [])
        require(isinstance(values, list) and len(values) <= 3000)
        for item in values:
            require(isinstance(item, dict))
            ref = item.get("self_ref")
            require(isinstance(ref, str) and re.fullmatch(r"#/" + collection + r"/\d+", ref))
            require(ref not in index and len(index) < 4000)
            index[ref] = item
    blocks, words, contents, visited = [], [], [], set()

    def word(value, coordinates):
        if value:
            words.append(
                {"text": value, "bbox": coordinates, "role": "unassigned", "confidence": None}
            )
            require(len(words) <= 3000, "DOCLING_RESULT_LIMIT")

    def walk(ref, depth=0):
        require(depth <= 64 and ref in index and ref not in visited)
        visited.add(ref)
        item = index[ref]
        kind = item.get("label")
        require(isinstance(kind, str) and len(kind) <= 80)
        if not ref.startswith("#/groups/"):
            prov = item.get("prov")
            require(isinstance(prov, list) and len(prov) == 1 and prov[0].get("page_no") == page)
            coordinates = bbox(prov[0].get("bbox"), width, height)
            raw = text(item.get("orig", ""))
            value = text(item.get("text", ""))
            block = {
                "id": ref,
                "kind": kind,
                "page": page,
                "bbox": coordinates,
                "text": value,
                "rawText": raw,
                "reviewRequired": True,
            }
            if ref.startswith("#/tables/"):
                data = item.get("data", {})
                rows, cols = data.get("num_rows"), data.get("num_cols")
                require(
                    type(rows) is int
                    and type(cols) is int
                    and 0 <= rows <= 100
                    and 0 <= cols <= 100
                    and ((rows == cols == 0) or (rows > 0 and cols > 0))
                )
                require(rows * cols <= 400, "DOCLING_RESULT_LIMIT")
                cells = data.get("table_cells")
                require(
                    isinstance(cells, list)
                    and len(cells) <= 400
                    and (len(cells) > 0 or rows == cols == 0)
                )
                grid, occupied, normalized = [[""] * cols for _ in range(rows)], set(), []
                for cell in cells:
                    require(isinstance(cell, dict))
                    r0, r1, c0, c1 = [
                        cell.get(k)
                        for k in (
                            "start_row_offset_idx",
                            "end_row_offset_idx",
                            "start_col_offset_idx",
                            "end_col_offset_idx",
                        )
                    ]
                    require(all(type(x) is int for x in (r0, r1, c0, c1)))
                    require(0 <= r0 < r1 <= rows and 0 <= c0 < c1 <= cols)
                    require(cell.get("row_span") == r1 - r0 and cell.get("col_span") == c1 - c0)
                    occupied_here = {(r, c) for r in range(r0, r1) for c in range(c0, c1)}
                    require(not occupied.intersection(occupied_here))
                    occupied.update(occupied_here)
                    cell_text = text(cell.get("text"), 4000)
                    cell_bbox = (
                        bbox(cell["bbox"], width, height) if cell.get("bbox") is not None else None
                    )
                    grid[r0][c0] = cell_text
                    normalized.append(
                        {
                            "row": r0,
                            "rowSpan": r1 - r0,
                            "column": c0,
                            "columnSpan": c1 - c0,
                            "text": cell_text,
                            "bbox": cell_bbox,
                        }
                    )
                    if cell_bbox is not None:
                        word(cell_text, cell_bbox)
                require(len(occupied) == rows * cols)
                block.update(rows=rows, columns=cols, cells=normalized)
                contents.append("\n".join("\t".join(row) for row in grid))
            else:
                # Never turn an undecoded formula into an empty, apparently complete page.
                preserved = raw if kind == "formula" and raw else value or raw
                if preserved:
                    contents.append(preserved)
                    word(preserved, coordinates)
            blocks.append(block)
            require(len(blocks) <= 1000, "DOCLING_RESULT_LIMIT")
        children = item.get("children", [])
        require(isinstance(children, list) and len(children) <= 3000)
        for child in children:
            require(isinstance(child, dict) and isinstance(child.get("$ref"), str))
            walk(child["$ref"], depth + 1)

    for root in ("body", "furniture"):
        children = document.get(root, {}).get("children", [])
        require(isinstance(children, list) and len(children) <= 3000)
        for child in children:
            require(isinstance(child, dict) and isinstance(child.get("$ref"), str))
            walk(child["$ref"])
    require(set(index) == visited)  # Do not silently discard unreferenced source text.
    content = "\n".join(contents)
    require(len(content) <= 20000, "DOCLING_RESULT_LIMIT")
    result = {
        "contract": CONTRACT,
        "sourceSha256": fingerprint,
        "page": page,
        "segment": {
            "id": f"page-{page}",
            "page": page,
            "content": content,
            "words": words,
            "blocks": blocks,
            "role": "unassigned",
            "location": {"page": page},
            "dimensions": {"width": width, "height": height},
            "coordinateSpace": "pdf_points_top_left",
            "reviewRequired": True,
            "method": "docling_rapidocr" if allow_ocr else "docling_structure",
            "extractionVersion": CONTRACT,
            "recognitionStatus": "text_candidate" if content.strip() else "no_text",
            "uncertainties": ["版面与行列关系为候选；公式、上下标、单位和图形条件需按原页核对"],
        },
        "versions": VERSIONS,
        "gradingAuthority": False,
        "extraCloudCost": 0,
        "dataFlow": "authorized_local_connector",
        "allowOCR": allow_ocr,
    }
    require(
        len(json.dumps(result, ensure_ascii=False).encode()) <= MAX_OUTPUT, "DOCLING_RESULT_LIMIT"
    )
    return result


def decode_request(value):
    require(
        isinstance(value, dict) and set(value) == {"contentBase64", "sha256", "page", "allowOCR"},
        "DOCLING_INPUT_INVALID",
    )
    require(type(value["page"]) is int and 1 <= value["page"] <= 2048, "DOCLING_INPUT_INVALID")
    require(type(value["allowOCR"]) is bool, "DOCLING_CONSENT_INVALID")
    require(
        isinstance(value["sha256"], str) and bool(re.fullmatch(r"[a-f0-9]{64}", value["sha256"])),
        "DOCLING_INPUT_INVALID",
    )
    require(isinstance(value["contentBase64"], str), "DOCLING_INPUT_INVALID")
    try:
        data = base64.b64decode(value["contentBase64"], validate=True)
    except (ValueError, UnicodeError):
        raise DoclingError("DOCLING_INPUT_INVALID") from None
    require(0 < len(data) <= MAX_PDF and data.startswith(b"%PDF-"), "DOCLING_INPUT_INVALID")
    require(hashlib.sha256(data).hexdigest() == value["sha256"], "DOCLING_SOURCE_CHANGED")
    return data


def verify_models(root, files):
    for name, expected in files.items():
        path = root / name
        require(
            path.is_file()
            and not path.is_symlink()
            and path.resolve().is_relative_to(root.resolve()),
            "DOCLING_MODEL_UNAVAILABLE",
        )
        with path.open("rb") as handle:
            require(
                hashlib.file_digest(handle, "sha256").hexdigest() == expected,
                "DOCLING_MODEL_CHANGED",
            )


def verify_environment(runtime, models, allow_ocr):
    sys.path.insert(0, str(runtime))
    installed = {}
    for distribution in importlib.metadata.distributions(path=[str(runtime)]):
        name = re.sub(r"[-_.]+", "-", distribution.metadata["Name"]).lower()
        require(name not in installed, "DOCLING_VERSION_MISMATCH")
        installed[name] = distribution.version
    for name, expected in VERSIONS.items():
        require(installed.get(name) == expected, "DOCLING_VERSION_MISMATCH")
    verify_models(models, MODEL_FILES)
    ocr_models = runtime / "rapidocr" / "models"
    if allow_ocr:
        verify_models(ocr_models, OCR_FILES)
    return ocr_models


def convert(value, runtime, models):
    data = decode_request(value)
    ocr_models = verify_environment(runtime, models, value["allowOCR"])
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat, ConversionStatus
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice

    options = PdfPipelineOptions(
        artifacts_path=models,
        enable_remote_services=False,
        allow_external_plugins=False,
        do_ocr=value["allowOCR"],
        do_table_structure=True,
        do_code_enrichment=False,
        do_formula_enrichment=False,
        do_picture_classification=False,
        do_picture_description=False,
        document_timeout=60,
        accelerator_options=AcceleratorOptions(num_threads=2, device=AcceleratorDevice.CPU),
        ocr_options=RapidOcrOptions(
            lang=["ch"],
            backend="onnxruntime",
            force_full_page_ocr=True,
            det_model_path=str(ocr_models / "PP-OCRv6_det_small.onnx"),
            cls_model_path=str(ocr_models / "ch_ppocr_mobile_v2.0_cls_mobile.onnx"),
            rec_model_path=str(ocr_models / "PP-OCRv6_rec_small.onnx"),
        ),
        ocr_batch_size=1,
        layout_batch_size=1,
        table_batch_size=1,
        queue_max_size=2,
    )
    converter = DocumentConverter(
        allowed_formats=[InputFormat.PDF],
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)},
    )
    with tempfile.TemporaryDirectory(prefix="yozi-docling-") as directory:
        source = Path(directory) / "original.pdf"
        source.write_bytes(data)
        page = value["page"]
        result = converter.convert(
            source, max_file_size=MAX_PDF, max_num_pages=2048, page_range=(page, page)
        )
        require(
            result.status == ConversionStatus.SUCCESS and not result.errors, "DOCLING_PAGE_FAILED"
        )
        return normalize_document(
            result.document.export_to_dict(), page, value["sha256"], value["allowOCR"]
        )


def offline_guard(event, args):
    if event in (
        "socket.connect",
        "socket.getaddrinfo",
        "socket.sendto",
        "subprocess.Popen",
        "os.system",
    ):
        raise DoclingError("DOCLING_OFFLINE_REQUIRED")


def main():
    import platform
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (90, 95))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    # Cache Python's own fixed uname/file architecture probes before accepting any
    # document. Docling reads the same metadata during import; conversion may not
    # spawn children. The parent already applies the wall/RSS/output watchdog.
    platform.platform()
    # Python-level guard supplements explicit local model paths; not an OS sandbox.
    sys.addaudithook(offline_guard)
    try:
        capabilities = len(sys.argv) == 4 and sys.argv[3] == "--capabilities"
        require(len(sys.argv) == 3 or capabilities, "DOCLING_UNAVAILABLE")
        runtime, models = (Path(p) for p in sys.argv[1:3])
        require(
            all(p.is_absolute() and p.is_dir() for p in (runtime, models)), "DOCLING_UNAVAILABLE"
        )
        if capabilities:
            verify_environment(runtime, models, True)
            print(
                json.dumps(
                    {
                        "success": True,
                        "data": {
                            "contract": CONTRACT,
                            "status": "files_verified",
                            "runtime": "macos_connector",
                            "recognitionState": "not_tested",
                            "maxPagesPerRequest": 1,
                            "maxBytes": MAX_PDF,
                            "dataFlow": "authorized_local_connector",
                            "extraCloudCost": 0,
                        },
                    }
                )
            )
            return 0
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        require(len(raw) <= MAX_INPUT, "DOCLING_INPUT_LIMIT")
        with tempfile.TemporaryDirectory(prefix="yozi-docling-cache-") as cache:
            os.environ.update(
                HF_HOME=cache,
                XDG_CACHE_HOME=cache,
                MPLCONFIGDIR=cache,
                HF_HUB_DISABLE_IMPLICIT_TOKEN="1",
                HF_HUB_OFFLINE="1",
                TRANSFORMERS_OFFLINE="1",
                HF_HUB_DISABLE_TELEMETRY="1",
            )
            with contextlib.redirect_stdout(sys.stderr):
                result = convert(json.loads(raw), runtime, models)
        print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
    except Exception as error:
        code = str(error) if isinstance(error, DoclingError) else "DOCLING_FAILED"
        print(json.dumps({"success": False, "errorCode": code}))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
