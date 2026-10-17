#!/usr/bin/env python3
"""私人解析接口：Poppler 文本优先，扫描页可选 Tesseract/Apple Vision；不调用云模型。"""

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import time
import sys
import math
import struct
import signal
import selectors
import select
import socket
import xml.etree.ElementTree as ET

MAX_BYTES = 10 * 1024 * 1024
MAX_STORED = 50 * 1024 * 1024
VERSION = "poppler-tesseract-v2"
PDF_TEXT_VERSION = "poppler-pdf-text-v3"
LOCK = threading.RLock()
PARSER_SLOTS = threading.BoundedSemaphore(2)
DOCLING_CAP_SLOT = threading.BoundedSemaphore(1)
APPLE_CONTRACT = "wenli-apple-vision-v1"
APPLE_LANGUAGES = ["zh-Hans", "en-US"]
APPLE_READINESS_CONTRACT = "wenli-apple-readiness-v1"
APPLE_WARM_LOCK = threading.RLock()
APPLE_WARM_STATE = {
    "identity": None,
    "generation": 0,
    "status": "unavailable",
    "thread": None,
    "process": None,
}


class ParserError(Exception):
    pass


def docling_command(payload, *, deadline=None, cancelled=None):
    """Opt-in one-page adapter; None verifies files without model inference."""
    if os.environ.get("MATERIAL_DOCLING_ENABLED") != "1" or sys.platform != "darwin":
        raise ParserError("DOCLING_UNAVAILABLE")
    configured = [
        os.environ.get(key, "")
        for key in (
            "MATERIAL_DOCLING_PYTHON",
            "MATERIAL_DOCLING_RUNTIME",
            "MATERIAL_DOCLING_MODELS",
        )
    ]
    if not all(os.path.isabs(path) for path in configured):
        raise ParserError("DOCLING_UNAVAILABLE")
    python, runtime, models = configured
    if not (
        os.path.isfile(python)
        and os.access(python, os.X_OK)
        and os.path.isdir(runtime)
        and os.path.isdir(models)
    ):
        raise ParserError("DOCLING_UNAVAILABLE")
    capabilities = payload is None
    if not capabilities and (
        not isinstance(payload, dict)
        or set(payload) != {"contentBase64", "sha256", "page", "allowOCR"}
        or type(payload.get("allowOCR")) is not bool
        or type(payload.get("page")) is not int
        or not 1 <= payload["page"] <= 2048
        or not isinstance(payload.get("sha256"), str)
        or not re.fullmatch("[a-f0-9]{64}", payload["sha256"])
        or not isinstance(payload.get("contentBase64"), str)
    ):
        raise ParserError("DOCLING_INPUT_INVALID")
    try:
        encoded = b"" if capabilities else json.dumps(payload, ensure_ascii=False).encode()
        if len(encoded) > 14 * 1024 * 1024:
            raise ParserError("DOCLING_INPUT_LIMIT")
        if not capabilities:
            data = base64.b64decode(payload["contentBase64"], validate=True)
            if not 0 < len(data) <= MAX_BYTES or not data.startswith(b"%PDF-"):
                raise ParserError("DOCLING_INPUT_INVALID")
            if hashlib.sha256(data).hexdigest() != payload["sha256"]:
                raise ParserError("DOCLING_SOURCE_CHANGED")
    except (ValueError, UnicodeError) as error:
        raise ParserError("DOCLING_INPUT_INVALID") from error
    end = time.monotonic() + (4 if capabilities else 75)
    if deadline is not None:
        end = min(end, deadline)
    if time.monotonic() >= end:
        raise ParserError("DOCLING_TIMEOUT")
    if cancelled and cancelled():
        raise ParserError("DOCLING_CANCELLED")
    worker = Path(__file__).with_name("private-material-docling.py")
    # No shell or inherited credentials. All model loads use verified local paths.
    environment = {
        "PATH": "/usr/bin:/bin",
        "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
        "PYTHONDONTWRITEBYTECODE": "1",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "HF_HUB_DISABLE_TELEMETRY": "1",
        "DO_NOT_TRACK": "1",
        "OMP_NUM_THREADS": "2",
        "TOKENIZERS_PARALLELISM": "false",
    }
    process = None
    workspace = None
    output = bytearray()
    try:
        # The parent owns cleanup even if a timed-out worker cannot run finally.
        workspace = tempfile.TemporaryDirectory(prefix="yozi-docling-job-")
        environment["TMPDIR"] = workspace.name
        process = subprocess.Popen(
            [
                python,
                "-I",
                "-B",
                str(worker),
                runtime,
                models,
                *(["--capabilities"] if capabilities else []),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=environment,
        )
        sent, stderr_bytes, next_sample = 0, 0, 0
        with selectors.DefaultSelector() as selector:
            for pipe, mode in (
                (process.stdin, selectors.EVENT_WRITE),
                (process.stdout, selectors.EVENT_READ),
                (process.stderr, selectors.EVENT_READ),
            ):
                os.set_blocking(pipe.fileno(), False)
                selector.register(pipe, mode)
            while selector.get_map() or process.poll() is None:
                now = time.monotonic()
                if now >= end:
                    raise ParserError("DOCLING_TIMEOUT")
                if cancelled and cancelled():
                    raise ParserError("DOCLING_CANCELLED")
                if now >= next_sample and process.poll() is None:
                    sample = subprocess.run(
                        ["/bin/ps", "-o", "rss=", "-p", str(process.pid)],
                        capture_output=True,
                        timeout=1,
                    )
                    rss = sample.stdout.strip()
                    if rss.isdigit():
                        if int(rss) * 1024 > (
                            128 * 1024 * 1024 if capabilities else 2 * 1024 * 1024 * 1024
                        ):
                            raise ParserError("DOCLING_MEMORY_LIMIT")
                    elif process.poll() is None:
                        # Allow a normal-exit/ps race, without accepting a live unmonitored child.
                        try:
                            process.wait(timeout=0.025)
                        except subprocess.TimeoutExpired:
                            raise ParserError("DOCLING_MONITOR_FAILED") from None
                    next_sample = now + 0.25
                for key, _ in selector.select(timeout=min(0.1, max(0, end - time.monotonic()))):
                    pipe = key.fileobj
                    if pipe is process.stdin:
                        try:
                            sent += os.write(pipe.fileno(), encoded[sent : sent + 16384])
                        except BrokenPipeError:
                            sent = len(encoded)
                        if sent == len(encoded):
                            selector.unregister(pipe)
                            pipe.close()
                        continue
                    chunk = os.read(pipe.fileno(), 65536)
                    if not chunk:
                        selector.unregister(pipe)
                        pipe.close()
                    elif pipe is process.stdout:
                        output.extend(chunk)
                        if len(output) > (65536 if capabilities else 2 * 1024 * 1024):
                            raise ParserError("DOCLING_RESULT_LIMIT")
                    else:
                        stderr_bytes += len(
                            chunk
                        )  # Discard upstream logs; never persist private input.
                        if stderr_bytes > 256 * 1024:
                            raise ParserError("DOCLING_RESULT_LIMIT")
        process.wait(timeout=max(0.01, end - time.monotonic()))
        value = json.loads(output)
        if process.returncode or value.get("success") is not True:
            allowed = {
                "DOCLING_MODEL_UNAVAILABLE",
                "DOCLING_MODEL_CHANGED",
                "DOCLING_VERSION_MISMATCH",
                "DOCLING_RESULT_LIMIT",
                "DOCLING_PAGE_FAILED",
                "DOCLING_SOURCE_CHANGED",
                "DOCLING_OFFLINE_REQUIRED",
                "DOCLING_INVALID_RESULT",
            }
            code = value.get("errorCode")
            raise ParserError(code if code in allowed else "DOCLING_FAILED")
        result = value.get("data")
        if capabilities:
            if (
                not isinstance(result, dict)
                or result.get("contract") != "yozi-docling-page-v1"
                or result.get("status") != "files_verified"
                or result.get("runtime") != "macos_connector"
                or result.get("recognitionState") != "not_tested"
                or type(result.get("maxPagesPerRequest")) is not int
                or result["maxPagesPerRequest"] != 1
                or result.get("maxBytes") != MAX_BYTES
                or result.get("dataFlow") != "authorized_local_connector"
                or result.get("extraCloudCost") != 0
            ):
                raise ParserError("DOCLING_INVALID_RESULT")
            return result
        if (
            not isinstance(result, dict)
            or result.get("contract") != "yozi-docling-page-v1"
            or result.get("sourceSha256") != payload["sha256"]
            or result.get("page") != payload["page"]
            or result.get("allowOCR") is not payload["allowOCR"]
            or result.get("gradingAuthority") is not False
            or result.get("dataFlow") != "authorized_local_connector"
            or result.get("extraCloudCost") != 0
            or not isinstance(result.get("segment"), dict)
            or result["segment"].get("reviewRequired") is not True
            or result["segment"].get("role") != "unassigned"
            or result["segment"].get("page") != payload["page"]
            or result["segment"].get("extractionVersion") != "yozi-docling-page-v1"
            or result["segment"].get("coordinateSpace") != "pdf_points_top_left"
            or result["segment"].get("method")
            != ("docling_rapidocr" if payload["allowOCR"] else "docling_structure")
        ):
            raise ParserError("DOCLING_INVALID_RESULT")
        if cancelled and cancelled():
            raise ParserError("DOCLING_CANCELLED")
        if time.monotonic() >= end:
            raise ParserError("DOCLING_TIMEOUT")
        return result
    except subprocess.TimeoutExpired as error:
        raise ParserError("DOCLING_TIMEOUT") from error
    except (OSError, ValueError, TypeError, AttributeError) as error:
        raise ParserError("DOCLING_FAILED") from error
    finally:
        if process:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            for pipe in (process.stdin, process.stdout, process.stderr):
                if pipe and not pipe.closed:
                    pipe.close()
        if workspace:
            workspace.cleanup()


def docling_capabilities():
    empty = {
        "available": False,
        "contract": "yozi-docling-page-v1",
        "runtime": "macos_connector",
        "recognitionState": "not_tested",
    }
    if not DOCLING_CAP_SLOT.acquire(blocking=False):
        return empty
    try:
        if not all(shutil.which(tool) for tool in ("pdfinfo", "pdftoppm")):
            raise ParserError("DOCLING_UNAVAILABLE")
        return {**docling_command(None), "available": True}
    except ParserError:
        return empty
    finally:
        DOCLING_CAP_SLOT.release()


def docling_pdf_info(original, cancelled, deadline):
    executable = shutil.which("pdfinfo")
    if not executable:
        raise ParserError("TOOL_UNAVAILABLE:pdfinfo")
    process = subprocess.Popen(
        [executable, str(original)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    )
    try:
        end = min(deadline, time.monotonic() + 20)
        while True:
            if cancelled and cancelled():
                raise ParserError("DOCLING_CANCELLED")
            if time.monotonic() >= end:
                raise ParserError("DOCLING_TIMEOUT")
            try:
                output, _ = process.communicate(timeout=0.1)
                if process.returncode or len(output) > 256 * 1024:
                    raise ParserError("PDF_INFO_FAILED")
                return output.decode("utf8")
            except subprocess.TimeoutExpired:
                pass
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        process.stdout.close()


def docling_pdf_page(original, page, data, fingerprint, allow_ocr, cancelled, deadline):
    # A whole request, including preview, stays inside the client's 100-second deadline.
    def check():
        if cancelled and cancelled():
            raise ParserError("DOCLING_CANCELLED")
        if time.monotonic() >= deadline:
            raise ParserError("DOCLING_TIMEOUT")

    check()
    result = docling_command(
        {
            "contentBase64": base64.b64encode(data).decode(),
            "sha256": fingerprint,
            "page": page,
            "allowOCR": allow_ocr,
        },
        deadline=deadline,
        cancelled=cancelled,
    )
    segment = result["segment"]
    check()
    # A cancellable owned renderer; page images are receipts, not persistent cache files.
    executable = shutil.which("pdftoppm")
    if not executable:
        raise ParserError("PREVIEW_UNAVAILABLE")
    process = None
    with tempfile.TemporaryDirectory(prefix="yozi-docling-preview-") as directory:
        prefix = Path(directory) / "page"
        try:
            process = subprocess.Popen(
                [
                    executable,
                    "-f",
                    str(page),
                    "-l",
                    str(page),
                    "-singlefile",
                    "-scale-to",
                    "1200",
                    "-png",
                    str(original),
                    str(prefix),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            preview_deadline = min(deadline, time.monotonic() + 15)
            while process.poll() is None:
                check()
                if time.monotonic() >= preview_deadline:
                    raise ParserError("PREVIEW_TIMEOUT")
                try:
                    process.wait(timeout=0.1)
                except subprocess.TimeoutExpired:
                    pass
            image = prefix.with_suffix(".png")
            if process.returncode or not image.is_file() or image.stat().st_size > 1024 * 1024:
                raise ParserError("PREVIEW_LIMIT")
            raw = image.read_bytes()
            if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n":
                raise ParserError("PREVIEW_INVALID")
            width, height = struct.unpack(">II", raw[16:24])
            size = segment["dimensions"]
            if (
                not width
                or not height
                or abs(width / height - size["width"] / size["height"]) > 0.005
            ):
                raise ParserError("PREVIEW_COORDINATES_MISMATCH")
            segment["preview"] = "data:image/png;base64," + base64.b64encode(raw).decode()
        finally:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    check()
    segment.update(sourceSha256=fingerprint, gradingAuthority=False)
    if len(json.dumps(segment, ensure_ascii=False).encode()) > 1800000:
        raise ParserError("PAGE_RECEIPT_LIMIT")
    return segment


def apple_binary():
    value = os.environ.get("MATERIAL_APPLE_VISION_BIN", "")
    return (
        value
        if sys.platform == "darwin"
        and os.path.isabs(value)
        and os.path.isfile(value)
        and os.access(value, os.X_OK)
        else None
    )


def apple_command(mode, payload=None, timeout=12, *, warmup_generation=None):
    binary = apple_binary()
    if not binary:
        raise ParserError("APPLE_VISION_UNAVAILABLE")
    try:
        process = subprocess.Popen(
            [binary, mode],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={"PATH": os.environ.get("PATH", ""), "TMPDIR": os.environ.get("TMPDIR", "/tmp")},
        )
        if warmup_generation is not None:
            with APPLE_WARM_LOCK:
                if APPLE_WARM_STATE["generation"] != warmup_generation:
                    process.terminate()
                else:
                    APPLE_WARM_STATE["process"] = process
        try:
            stdout, _ = process.communicate(
                json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
            raise ParserError("APPLE_VISION_FAILED") from None
        finally:
            if warmup_generation is not None:
                with APPLE_WARM_LOCK:
                    if APPLE_WARM_STATE["process"] is process:
                        APPLE_WARM_STATE["process"] = None
        if process.returncode or len(stdout) > 2 * 1024 * 1024:
            raise ParserError("APPLE_VISION_FAILED")
        value = json.loads(stdout)
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        raise ParserError("APPLE_VISION_FAILED") from error
    if (
        not isinstance(value, dict)
        or value.get("success") is not True
        or not isinstance(value.get("data"), dict)
    ):
        raise ParserError("APPLE_VISION_FAILED")
    return value["data"]


def apple_binary_identity():
    binary = apple_binary()
    if not binary:
        return None
    try:
        info = os.stat(binary)
        return (os.path.realpath(binary), info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)
    except OSError:
        return None


def _warm_apple(identity, generation):
    status = "failed"
    try:
        value = apple_command("--warmup", timeout=45, warmup_generation=generation)
        if (
            set(value)
            == {
                "contract",
                "revision",
                "compute",
                "dataFlow",
                "readiness",
                "sampleKind",
                "privateInput",
                "recognitionState",
            }
            and value["contract"] == APPLE_CONTRACT
            and value["revision"] == 3
            and value["compute"] == "cpu"
            and value["dataFlow"] == "device_only"
            and value["readiness"] == "ready"
            and value["sampleKind"] == "project_synthetic_text"
            and value["privateInput"] is False
            and value["recognitionState"] == "not_tested"
        ):
            status = "ready"
    except ParserError:
        pass
    finally:
        with APPLE_WARM_LOCK:
            if (
                APPLE_WARM_STATE["generation"] == generation
                and APPLE_WARM_STATE["identity"] == identity
            ):
                APPLE_WARM_STATE["status"] = (
                    status if apple_binary_identity() == identity else "preparing"
                )
            APPLE_WARM_STATE["thread"] = None


def apple_readiness():
    identity = apple_binary_identity()
    with APPLE_WARM_LOCK:
        if APPLE_WARM_STATE["identity"] != identity:
            APPLE_WARM_STATE.update(
                identity=identity,
                generation=APPLE_WARM_STATE["generation"] + 1,
                status="preparing" if identity else "unavailable",
            )
        if (
            identity
            and APPLE_WARM_STATE["status"] == "preparing"
            and APPLE_WARM_STATE["thread"] is None
        ):
            worker = threading.Thread(
                target=_warm_apple, args=(identity, APPLE_WARM_STATE["generation"]), daemon=True
            )
            APPLE_WARM_STATE["thread"] = worker
            worker.start()
        return {"contract": APPLE_READINESS_CONTRACT, "status": APPLE_WARM_STATE["status"]}


def stop_apple_warmup():
    with APPLE_WARM_LOCK:
        process, worker = APPLE_WARM_STATE["process"], APPLE_WARM_STATE["thread"]
        APPLE_WARM_STATE.update(
            identity=None, generation=APPLE_WARM_STATE["generation"] + 1, status="unavailable"
        )
    if process and process.poll() is None:
        process.terminate()
    if worker:
        worker.join(timeout=4)
    if process and process.poll() is None:
        process.kill()
        process.wait()
        if worker:
            worker.join(timeout=3)


def apple_capabilities():
    configured = bool(os.environ.get("MATERIAL_APPLE_VISION_BIN"))
    try:
        value = apple_command("--capabilities", timeout=3)
        if (
            value.get("contract") != APPLE_CONTRACT
            or value.get("revision") != 3
            or value.get("compute") != "cpu"
            or value.get("maxBytes") != MAX_BYTES
            or value.get("maxPixels") != 24000000
            or value.get("dataFlow") != "device_only"
            or value.get("recognitionState") != "not_tested"
            or not isinstance(value.get("languages"), list)
            or len(value["languages"]) > 128
            or any(not isinstance(v, str) or len(v) > 40 for v in value["languages"])
            or not all(v in value["languages"] for v in APPLE_LANGUAGES)
        ):
            raise ParserError("APPLE_VISION_UNAVAILABLE")
        readiness = apple_readiness()
        return {
            "available": readiness["status"] == "ready",
            "contract": APPLE_CONTRACT,
            "languages": APPLE_LANGUAGES,
            "status": "capabilities_verified",
            "recognitionState": "not_tested",
            "runtime": "macos_connector",
            "readiness": readiness,
        }
    except ParserError:
        return {
            "available": False,
            "configured": configured,
            "recognitionState": "not_tested",
            "runtime": "macos_connector",
        }


def parse_apple_image(path, deadline=None):
    if not apple_capabilities()["available"]:
        raise ParserError("APPLE_VISION_UNAVAILABLE")
    timeout = min(12, deadline - time.monotonic()) if deadline else 12
    if timeout <= 0:
        raise ParserError("APPLE_VISION_DEADLINE")
    value = apple_command(
        "--recognize",
        {
            "consent": True,
            "contentBase64": base64.b64encode(path.read_bytes()).decode(),
            "languages": APPLE_LANGUAGES,
        },
        timeout=timeout,
    )
    if not isinstance(value, dict):
        raise ParserError("APPLE_VISION_INVALID_RESULT")
    content, words, dimensions, preview = (
        value.get("content"),
        value.get("words"),
        value.get("dimensions"),
        value.get("preview"),
    )
    if (
        value.get("contract") != APPLE_CONTRACT
        or value.get("revision") != 3
        or value.get("method") != "apple_vision"
        or value.get("compute") != "cpu"
        or value.get("dataFlow") != "device_only"
        or value.get("reviewRequired") is not True
        or value.get("languageCorrection") is not False
        or value.get("languages") != APPLE_LANGUAGES
        or value.get("coordinateSpace") != "preview_pixels_top_left"
        or not isinstance(content, str)
        or len(content) > 20000
        or not isinstance(words, list)
        or len(words) > 3000
        or not isinstance(dimensions, dict)
        or not all(
            type(dimensions.get(k)) is int and 0 < dimensions[k] <= 1200
            for k in ("width", "height")
        )
        or not isinstance(preview, str)
        or not preview.startswith("data:image/png;base64,")
        or len(preview) > 700000
    ):
        raise ParserError("APPLE_VISION_INVALID_RESULT")
    try:
        raw = base64.b64decode(preview.split(",", 1)[1], validate=True)
        if (
            len(raw) < 24
            or len(raw) > 512 * 1024
            or raw[:8] != b"\x89PNG\r\n\x1a\n"
            or struct.unpack(">II", raw[16:24]) != (dimensions["width"], dimensions["height"])
        ):
            raise ValueError()
    except (ValueError, struct.error) as error:
        raise ParserError("APPLE_VISION_INVALID_RESULT") from error
    for word in words:
        if (
            not isinstance(word, dict)
            or word.get("role") != "unassigned"
            or word.get("granularity") != "line"
            or not isinstance(word.get("text"), str)
            or not word["text"]
        ):
            raise ParserError("APPLE_VISION_INVALID_RESULT")
        box, confidence = word.get("bbox"), word.get("confidence")
        if (
            not isinstance(box, list)
            or len(box) != 4
            or any(type(v) not in (int, float) or not math.isfinite(v) for v in box)
            or not (
                0 <= box[0] < box[2] <= dimensions["width"]
                and 0 <= box[1] < box[3] <= dimensions["height"]
            )
            or type(confidence) not in (int, float)
            or not math.isfinite(confidence)
            or not 0 <= confidence <= 1
        ):
            raise ParserError("APPLE_VISION_INVALID_RESULT")
    if content != "\n".join(w["text"] for w in words):
        raise ParserError("APPLE_VISION_INVALID_RESULT")
    return content, words, preview, dimensions


def run_tool(name, args, timeout=20):
    executable = shutil.which(name)
    if not executable:
        raise ParserError(f"TOOL_UNAVAILABLE:{name}")
    result = subprocess.run(
        [executable, *map(str, args)],
        capture_output=True,
        timeout=timeout,
        check=False,
        env={**os.environ, "OMP_THREAD_LIMIT": "1"},
    )
    if result.returncode or len(result.stdout) > 3 * 1024 * 1024:
        raise ParserError(f"PARSER_FAILED:{name}")
    return result.stdout


def pdf_tsv_text(data, page):
    """Poppler 的坐标 TSV 兼容路径；只接受本页的有效字词坐标，不推定识别置信度。"""
    header = (
        "level page_num par_num block_num line_num word_num left top width height conf text".split()
    )
    try:
        rows = data.decode("utf8").splitlines()
        if not rows or rows[0].split("\t") != header:
            raise ValueError("columns")
        words = []
        lines = []
        previous_line = None
        has_page = False
        for row in rows[1:]:
            if not row:
                continue
            cols = row.split("\t", 11)
            if len(cols) != 12:
                raise ValueError("row")
            level, number, *indices = map(int, cols[:6])
            left, top, width, height, confidence = map(float, cols[6:11])
            if (
                level not in range(1, 6)
                or number != page
                or any(index < 0 for index in indices)
                or not all(
                    math.isfinite(value)
                    for value in (left, top, width, height, left + width, top + height, confidence)
                )
                or width < 0
                or height < 0
                or not -1 <= confidence <= 100
            ):
                raise ValueError("coordinates")
            if level == 1:
                if has_page or width <= 0 or height <= 0:
                    raise ValueError("page")
                has_page = True
            elif level == 5 and cols[11].strip():
                if not has_page or width <= 0 or height <= 0:
                    raise ValueError("word")
                words.append(
                    {
                        "text": cols[11],
                        "bbox": [left, top, left + width, top + height],
                        "role": "source_text",
                        "confidence": None,
                    }
                )
                line = tuple(indices[:3])
                if line != previous_line:
                    lines.append([])
                    previous_line = line
                lines[-1].append(cols[11])
        if not has_page:
            raise ValueError("missing page")
        return words, "\n".join(" ".join(line) for line in lines)
    except (UnicodeError, ValueError) as error:
        raise ParserError("PDF_TEXT_INVALID_RESULT") from error


def parse_pdf_page(path, page, directory, allow_ocr=False, ocr_engine="tesseract", deadline=None):
    def remaining(limit=None):
        value = min(20, deadline - time.monotonic()) if deadline else 20
        if limit is not None:
            value = min(value, limit - time.monotonic())
        if value <= 0:
            raise ParserError("PAGE_DEADLINE")
        return value

    text_deadline = time.monotonic() + 20
    try:
        xml = run_tool(
            "pdftotext",
            ["-f", page, "-l", page, "-bbox-layout", path, "-"],
            timeout=remaining(text_deadline),
        ).decode("utf8")
        tree = ET.fromstring(xml)
        words = []
        lines = []
        for line in tree.iter():
            if line.tag.split("}")[-1] != "line":
                continue
            line_words = []
            for element in line.iter():
                if element.tag.split("}")[-1] != "word":
                    continue
                bbox = [float(element.attrib[k]) for k in ("xMin", "yMin", "xMax", "yMax")]
                if (
                    not all(math.isfinite(value) for value in bbox)
                    or bbox[2] < bbox[0]
                    or bbox[3] < bbox[1]
                ):
                    raise ValueError("coordinates")
                word = {
                    "text": "".join(element.itertext()),
                    "bbox": bbox,
                    "role": "source_text",
                    "confidence": None,
                }
                line_words.append(word["text"])
                words.append(word)
            if line_words:
                lines.append(" ".join(line_words))
        if len(words) != sum(element.tag.split("}")[-1] == "word" for element in tree.iter()):
            raise ValueError("word without line")
        content = "\n".join(lines)
    except (ParserError, ET.ParseError, UnicodeError, ValueError, KeyError) as error:
        if isinstance(error, ParserError) and str(error) != "PARSER_FAILED:pdftotext":
            raise
        # 部分 Poppler 版本的 XHTML 元数据输出失败；同一工具的 TSV 仍提供原页字词与坐标。
        # 两次提取共用原有 20 秒预算，不改用无坐标正文或自动开启 OCR。
        words, content = pdf_tsv_text(
            run_tool(
                "pdftotext",
                ["-f", page, "-l", page, "-tsv", path, "-"],
                timeout=remaining(text_deadline),
            ),
            page,
        )
    # 即使文本可靠，也保留原始页图，供公式、图形与版面局部校对。
    preview = directory / f"page-{page}"
    run_tool(
        "pdftoppm",
        [
            "-f",
            page,
            "-l",
            page,
            "-singlefile",
            "-scale-to",
            "1200",
            "-png",
            path,
            preview,
        ],
        timeout=remaining(),
    )
    image = preview.with_suffix(".png")
    if not image.exists() or image.stat().st_size > 2 * 1024 * 1024:
        raise ParserError("PREVIEW_LIMIT")
    method = "pdf_text"
    apple_preview = None
    apple_dimensions = None
    if len(content.strip()) < 20 and allow_ocr:
        if ocr_engine == "apple-vision":
            content, words, apple_preview, apple_dimensions = parse_apple_image(image, deadline)
            method = "apple_vision"
        else:
            content, words = parse_image(image)
            method = "tesseract"
    return {
        "id": f"page-{page}",
        "page": page,
        "content": content[:20000],
        "words": words[:3000],
        "role": "source_text" if method == "pdf_text" else "unassigned",
        "location": {"page": page},
        "extractionVersion": "poppler-apple-vision-v1"
        if method == "apple_vision"
        else PDF_TEXT_VERSION
        if method == "pdf_text"
        else VERSION,
        "method": method,
        "reviewRequired": method != "pdf_text" or len(content.strip()) < 20,
        "uncertainties": ["公式、上下标、单位和图形条件需按原图核对"]
        if method != "pdf_text"
        else [],
        "preview": apple_preview
        or "data:image/png;base64," + base64.b64encode(image.read_bytes()).decode(),
        **(
            {
                "dimensions": apple_dimensions,
                "coordinateSpace": "preview_pixels_top_left",
                "recognitionStatus": "text_candidate" if content else "no_text",
            }
            if method == "apple_vision"
            else {}
        ),
    }


def parse_image(path):
    tsv = run_tool("tesseract", [path, "stdout", "-l", "chi_sim+eng", "tsv"], timeout=30).decode(
        "utf8"
    )
    words = []
    for row in tsv.splitlines()[1:]:
        cols = row.split("\t", 11)
        if len(cols) != 12 or not cols[11].strip():
            continue
        left, top, width, height = map(int, cols[6:10])
        words.append(
            {
                "text": cols[11],
                "bbox": [left, top, left + width, top + height],
                "confidence": float(cols[10]) / 100,
                "role": "unassigned",
            }
        )
    return " ".join(word["text"] for word in words), words


UPLOAD_CONTRACT = "wenli-upload-v1"
MAX_UPLOAD_RECEIPTS = 512


def _upload_id(value):
    if not isinstance(value, str) or not re.fullmatch("[a-zA-Z0-9_-]{8,80}", value):
        raise ParserError("UPLOAD_INVALID")
    return value


def _receipt_directory(root):
    directory = Path(root) / "upload-receipts"
    if directory.is_symlink() or (directory.exists() and not directory.is_dir()):
        raise ParserError("UPLOAD_INVALID")
    return directory


def storage_identity(root):
    directory = _receipt_directory(root)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = directory / "storage-id"
    if path.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    if not path.exists():
        try:
            descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(descriptor, "w") as handle:
                handle.write(os.urandom(16).hex())
                handle.flush()
                os.fsync(handle.fileno())
        except FileExistsError:
            pass
    if path.stat().st_size != 32:
        raise ParserError("UPLOAD_INVALID")
    value = path.read_text()
    if not re.fullmatch("[a-f0-9]{32}", value):
        raise ParserError("UPLOAD_INVALID")
    return value


def _receipt_path(root, request_id):
    request_id = _upload_id(request_id)
    return _receipt_directory(root) / (hashlib.sha256(request_id.encode()).hexdigest() + ".json")


def _read_receipt(root, request_id):
    path = _receipt_path(root, request_id)
    if path.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    if not path.exists():
        return None
    if path.stat().st_size > 2000:
        raise ParserError("UPLOAD_INVALID")
    try:
        value = json.loads(path.read_text())
    except (ValueError, OSError) as error:
        raise ParserError("UPLOAD_INVALID") from error
    if (
        not isinstance(value, dict)
        or value.get("requestId") != request_id
        or value.get("contract") != UPLOAD_CONTRACT
        or value.get("state") not in ("prepared", "receiving", "stored", "closing", "closed")
        or type(value.get("size")) is not int
        or not 0 <= value["size"] <= MAX_BYTES
        or (
            "fileId" in value
            and (
                not isinstance(value["fileId"], str)
                or not re.fullmatch("[a-f0-9]{64}", value["fileId"])
            )
        )
        or not set(value).issubset(
            {
                "contract",
                "requestId",
                "state",
                "size",
                "fileId",
                "owned",
                "bodyFingerprint",
                "originalDeleted",
                "sharedOriginalRetained",
            }
        )
    ):
        raise ParserError("UPLOAD_INVALID")
    if (
        any(
            key in value and type(value[key]) is not bool
            for key in ("owned", "originalDeleted", "sharedOriginalRetained")
        )
        or (
            "bodyFingerprint" in value
            and (
                not isinstance(value["bodyFingerprint"], str)
                or not re.fullmatch("[a-f0-9]{64}", value["bodyFingerprint"])
            )
        )
        or (
            value["state"] in ("receiving", "stored")
            and not all(key in value for key in ("fileId", "owned", "bodyFingerprint"))
        )
        or (value["state"] == "prepared" and (value["size"] == 0 or "fileId" in value))
        or (value["state"] == "closed" and "originalDeleted" not in value)
        or (value.get("originalDeleted") and value.get("sharedOriginalRetained"))
    ):
        raise ParserError("UPLOAD_INVALID")
    return value


def _write_receipt(root, value):
    directory = _receipt_directory(root)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = _receipt_path(root, value["requestId"])
    if path.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    if not path.exists() and len(list(directory.glob("*.json"))) >= MAX_UPLOAD_RECEIPTS:
        raise ParserError("UPLOAD_LIMIT")
    raw = json.dumps(value, ensure_ascii=False)
    if len(raw.encode()) > 2000:
        raise ParserError("UPLOAD_LIMIT")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf8", dir=directory, delete=False
        ) as handle:
            temporary = Path(handle.name)
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def _all_receipts(root):
    directory = _receipt_directory(root)
    paths = list(directory.glob("*.json"))
    if len(paths) > MAX_UPLOAD_RECEIPTS:
        raise ParserError("UPLOAD_LIMIT")
    result = []
    for path in paths:
        if path.is_symlink() or path.stat().st_size > 2000:
            raise ParserError("UPLOAD_INVALID")
        try:
            value = json.loads(path.read_text())
            request_id = _upload_id(value.get("requestId"))
        except (ValueError, AttributeError) as error:
            raise ParserError("UPLOAD_INVALID") from error
        if path != _receipt_path(root, request_id):
            raise ParserError("UPLOAD_INVALID")
        result.append(_read_receipt(root, request_id))
    return result


def _original_exists(root, file_id):
    directory = Path(root) / file_id
    if directory.is_symlink():
        raise ParserError("FILE_INVALID")
    originals = list(directory.glob("original.*"))
    if any(path.is_symlink() for path in originals):
        raise ParserError("FILE_INVALID")
    return len(originals) == 1 and originals[0].is_file()


def _original_complete(root, value):
    if not _original_exists(root, value["fileId"]):
        return False
    original = next((Path(root) / value["fileId"]).glob("original.*"))
    return (
        original.stat().st_size == value["size"]
        and hashlib.sha256(original.read_bytes()).hexdigest() == value["fileId"]
    )


def _store_original(original, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=original.parent, delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, original)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def _receipt_view(value):
    return {
        key: value[key]
        for key in (
            "contract",
            "requestId",
            "state",
            "size",
            "fileId",
            "originalDeleted",
            "sharedOriginalRetained",
        )
        if key in value
    }


UPLOAD_MAINTENANCE_CONTRACT = "wenli-upload-maintenance-v1"
UPLOAD_EPOCH_CONTRACT = "wenli-upload-epoch-v1"


def _write_upload_epoch(root, value):
    directory = _receipt_directory(root)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = directory / "epoch"
    if path.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    raw = json.dumps(value, ensure_ascii=False)
    if len(raw.encode()) > 70000:
        raise ParserError("UPLOAD_LIMIT")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf8", dir=directory, delete=False
        ) as handle:
            temporary = Path(handle.name)
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def _upload_epoch(root):
    directory = _receipt_directory(root)
    path, seal = directory / "epoch", directory / "epoch-required"
    if path.is_symlink() or seal.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    if seal.exists() and (
        not seal.is_file()
        or seal.stat().st_size != 22
        or seal.read_text() != UPLOAD_EPOCH_CONTRACT + "\n"
    ):
        raise ParserError("UPLOAD_INVALID")
    if not path.exists():
        if seal.exists():
            raise ParserError("UPLOAD_INVALID")
        _write_upload_epoch(
            root,
            {
                "contract": UPLOAD_EPOCH_CONTRACT,
                "generation": os.urandom(16).hex(),
                "legacyAccepted": True,
            },
        )
    if not path.is_file() or path.stat().st_size > 70000:
        raise ParserError("UPLOAD_INVALID")
    try:
        value = json.loads(path.read_text())
    except (ValueError, OSError) as error:
        raise ParserError("UPLOAD_INVALID") from error
    if (
        not isinstance(value, dict)
        or set(value)
        not in (
            {"contract", "generation", "legacyAccepted"},
            {"contract", "generation", "legacyAccepted", "latest"},
        )
        or value.get("contract") != UPLOAD_EPOCH_CONTRACT
        or not isinstance(value.get("generation"), str)
        or not re.fullmatch("[a-f0-9]{32}", value["generation"])
        or type(value.get("legacyAccepted")) is not bool
    ):
        raise ParserError("UPLOAD_INVALID")
    if not value["legacyAccepted"] and not seal.exists():
        raise ParserError("UPLOAD_INVALID")
    latest = value.get("latest")
    if latest is not None:
        if (
            not isinstance(latest, dict)
            or set(latest) != {"requestId", "fromGeneration", "previewFingerprint", "state", "plan"}
            or not isinstance(latest.get("fromGeneration"), str)
            or not re.fullmatch("[a-f0-9]{32}", latest["fromGeneration"])
            or not isinstance(latest.get("previewFingerprint"), str)
            or not re.fullmatch("[a-f0-9]{64}", latest["previewFingerprint"])
            or latest.get("state") not in ("pending", "completed")
            or not isinstance(latest.get("plan"), list)
            or len(latest["plan"]) > MAX_UPLOAD_RECEIPTS
            or any(not isinstance(item, str) for item in latest["plan"])
            or len(set(latest["plan"])) != len(latest["plan"])
            or value["legacyAccepted"]
            or latest["fromGeneration"] == value["generation"]
        ):
            raise ParserError("UPLOAD_INVALID")
        _upload_id(latest["requestId"])
        for request_id in latest["plan"]:
            _upload_id(request_id)
    return value


def _seal_upload_epoch(root):
    directory = _receipt_directory(root)
    path = directory / "epoch-required"
    if path.is_symlink():
        raise ParserError("UPLOAD_INVALID")
    if not path.exists():
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            handle.write(UPLOAD_EPOCH_CONTRACT + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    if path.read_text() != UPLOAD_EPOCH_CONTRACT + "\n":
        raise ParserError("UPLOAD_INVALID")


def _new_upload_allowed(root, request_id):
    epoch = _upload_epoch(root)
    return epoch["legacyAccepted"] or bool(
        re.fullmatch("upload_" + epoch["generation"] + "_[A-Za-z0-9_-]{8,40}", request_id)
    )


def _retired_upload(request_id):
    return {
        "contract": UPLOAD_CONTRACT,
        "requestId": request_id,
        "state": "retired",
        "uploadBlocked": True,
        "originalStatus": "unverified",
    }


def _maintenance_fingerprint(epoch, receipts):
    return hashlib.sha256(
        json.dumps(
            [epoch["generation"], sorted(receipts, key=lambda value: value["requestId"])],
            sort_keys=True,
        ).encode()
    ).hexdigest()


def _maintenance_result(root, epoch):
    latest = epoch["latest"]
    return {
        "contract": UPLOAD_MAINTENANCE_CONTRACT,
        "storageId": storage_identity(root),
        "requestId": latest["requestId"],
        "fromGeneration": latest["fromGeneration"],
        "generation": epoch["generation"],
        "state": "completed",
        "removedCount": len(latest["plan"]),
        "originalsDeleted": 0,
    }


def _finish_upload_maintenance(root, epoch):
    latest = epoch["latest"]
    for request_id in latest["plan"]:
        value = _read_receipt(root, request_id)
        if value is not None:
            if value["state"] != "closed":
                raise ParserError("MAINTENANCE_CHANGED")
            _receipt_path(root, request_id).unlink()
    latest["state"] = "completed"
    _write_upload_epoch(root, epoch)
    return _maintenance_result(root, epoch)


def upload_maintenance(payload, root):
    action = payload.get("action")
    allowed = (
        {"action", "storageId"}
        if action == "preview-upload-maintenance"
        else {"action", "storageId", "requestId", "generation", "previewFingerprint"}
    )
    if set(payload) != allowed or payload.get("storageId") != storage_identity(root):
        raise ParserError("UPLOAD_INVALID")
    if not LOCK.acquire(blocking=False):
        raise ParserError("FILE_BUSY")
    try:
        epoch = _upload_epoch(root)
        latest = epoch.get("latest")
        receipts = _all_receipts(root)
        if action == "preview-upload-maintenance":
            closed = sum(value["state"] == "closed" for value in receipts)
            result = {
                "contract": UPLOAD_MAINTENANCE_CONTRACT,
                "storageId": payload["storageId"],
                "generation": epoch["generation"],
                "previewFingerprint": _maintenance_fingerprint(epoch, receipts),
                "closedCount": closed,
                "openCount": len(receipts) - closed,
                "maxReceipts": MAX_UPLOAD_RECEIPTS,
                "originalsDeleted": 0,
                "pending": bool(latest and latest["state"] == "pending"),
            }
            if result["pending"]:
                result.update(
                    requestId=latest["requestId"],
                    fromGeneration=latest["fromGeneration"],
                    previewFingerprint=latest["previewFingerprint"],
                    plannedCount=len(latest["plan"]),
                )
            return result
        _upload_id(payload.get("requestId"))
        if (
            not isinstance(payload.get("generation"), str)
            or not re.fullmatch("[a-f0-9]{32}", payload["generation"])
            or not isinstance(payload.get("previewFingerprint"), str)
            or not re.fullmatch("[a-f0-9]{64}", payload["previewFingerprint"])
        ):
            raise ParserError("UPLOAD_INVALID")
        if latest and latest["requestId"] == payload["requestId"]:
            if (
                latest["fromGeneration"] != payload["generation"]
                or latest["previewFingerprint"] != payload["previewFingerprint"]
            ):
                raise ParserError("MAINTENANCE_CHANGED")
            return (
                _maintenance_result(root, epoch)
                if latest["state"] == "completed"
                else _finish_upload_maintenance(root, epoch)
            )
        if latest and latest["state"] == "pending":
            raise ParserError("MAINTENANCE_PENDING")
        if (
            epoch["generation"] != payload["generation"]
            or _maintenance_fingerprint(epoch, receipts) != payload["previewFingerprint"]
        ):
            raise ParserError("MAINTENANCE_CHANGED")
        plan = [value["requestId"] for value in receipts if value["state"] == "closed"]
        if not plan:
            raise ParserError("MAINTENANCE_EMPTY")
        _seal_upload_epoch(root)
        epoch.update(
            generation=os.urandom(16).hex(),
            legacyAccepted=False,
            latest={
                "requestId": payload["requestId"],
                "fromGeneration": epoch["generation"],
                "previewFingerprint": payload["previewFingerprint"],
                "state": "pending",
                "plan": plan,
            },
        )
        _write_upload_epoch(root, epoch)  # Revoke old unknown IDs before removing any tombstone.
        return _finish_upload_maintenance(root, epoch)
    finally:
        LOCK.release()


def upload_action(payload, storage_root):
    if not isinstance(payload, dict):
        raise ParserError("UPLOAD_INVALID")
    if payload.get("action") in ("preview-upload-maintenance", "compact-upload-receipts"):
        return upload_maintenance(payload, storage_root)
    action, request_id = payload.get("action"), _upload_id(payload.get("requestId"))
    allowed = (
        {"action", "requestId", "storageId", "size"}
        if action == "prepare-upload"
        else {"action", "requestId", "storageId"}
    )
    if set(payload) != allowed or action not in (
        "prepare-upload",
        "upload-receipt",
        "close-upload",
    ):
        raise ParserError("UPLOAD_INVALID")
    if payload.get("storageId") != storage_identity(storage_root):
        raise ParserError("STORAGE_TARGET_CHANGED")
    if not LOCK.acquire(blocking=False):
        raise ParserError("FILE_BUSY")
    try:
        value = _read_receipt(storage_root, request_id)
        if value is None and not _new_upload_allowed(storage_root, request_id):
            if action == "prepare-upload":
                raise ParserError("UPLOAD_RETIRED")
            return _retired_upload(request_id)
        if action == "prepare-upload":
            size = payload.get("size")
            if type(size) is not int or not 0 < size <= MAX_BYTES:
                raise ParserError("UPLOAD_INVALID")
            if value and value["state"] in ("closing", "closed"):
                raise ParserError("UPLOAD_CLOSED")
            if value and value["size"] != size:
                raise ParserError("UPLOAD_CONFLICT")
            if value is None:
                value = {
                    "contract": UPLOAD_CONTRACT,
                    "requestId": request_id,
                    "size": size,
                    "state": "prepared",
                }
                _write_receipt(storage_root, value)
            return _receipt_view(value)
        if action == "upload-receipt":
            if value is None:
                return {"contract": UPLOAD_CONTRACT, "requestId": request_id, "state": "absent"}
            result = _receipt_view(value)
            if value["state"] in ("stored", "receiving"):
                result["state"] = "stored" if _original_complete(storage_root, value) else "absent"
            return result
        if value is None:
            value = {
                "contract": UPLOAD_CONTRACT,
                "requestId": request_id,
                "state": "closed",
                "size": 0,
                "originalDeleted": True,
            }
            _write_receipt(storage_root, value)
        if value["state"] == "closed":
            return _receipt_view(value)
        file_id = value.get("fileId")
        retained = bool(
            file_id
            and (
                not value.get("owned")
                or any(
                    other.get("fileId") == file_id
                    and other["requestId"] != request_id
                    and other["state"] in ("receiving", "stored")
                    for other in _all_receipts(storage_root)
                )
            )
        )
        value["state"] = "closing"
        _write_receipt(
            storage_root, value
        )  # Persistent cancellation precedes deleting or accepting late bodies.
        deleted = not file_id or not _original_exists(storage_root, file_id)
        if file_id and not retained:
            directory = Path(storage_root) / file_id
            if directory.is_symlink():
                raise ParserError("FILE_INVALID")
            if directory.exists():
                shutil.rmtree(directory)
            if directory.exists():
                raise OSError("DELETE_UNCONFIRMED")
            deleted = True
        value.update(
            state="closed", originalDeleted=deleted, sharedOriginalRetained=retained and not deleted
        )
        _write_receipt(storage_root, value)
        return _receipt_view(value)
    finally:
        LOCK.release()


def parse_material(payload, storage_root, *, cancelled=None):
    # 解析子进程仍有原文件句柄；删除不能与页图写回同时发生。
    if isinstance(payload, dict) and payload.get("ocrEngine") == "docling":
        if not LOCK.acquire(blocking=False):
            raise ParserError("FILE_BUSY")
        try:
            if cancelled and cancelled():
                raise ParserError("DOCLING_CANCELLED")
            return _parse_material(payload, storage_root, cancelled=cancelled)
        finally:
            LOCK.release()
    with LOCK:
        return _parse_material(payload, storage_root)


def delete_material(file_id, storage_root):
    if not isinstance(file_id, str) or not re.fullmatch("[a-f0-9]{64}", file_id):
        raise ParserError("FILE_INVALID")
    if not LOCK.acquire(blocking=False):
        raise ParserError("FILE_BUSY")
    try:
        directory = Path(storage_root) / file_id
        if directory.is_symlink():
            raise ParserError("FILE_INVALID")
        claims = [value for value in _all_receipts(storage_root) if value.get("fileId") == file_id]
        for value in claims:
            value["state"] = "closing"
            _write_receipt(storage_root, value)
        absent = not directory.exists()
        if not absent:
            shutil.rmtree(directory)
        if directory.exists():
            raise OSError("DELETE_UNCONFIRMED")
        for value in claims:
            value.update(state="closed", originalDeleted=True, sharedOriginalRetained=False)
            _write_receipt(storage_root, value)
        return {"deleted": True, "fileId": file_id, "alreadyAbsent": absent}
    finally:
        LOCK.release()


def _parse_material(payload, storage_root, *, cancelled=None):
    if not isinstance(payload, dict):
        raise ParserError("REQUEST_INVALID")
    if "fileId" in payload and (
        not isinstance(payload["fileId"], str)
        or not re.fullmatch("[a-f0-9]{64}", payload["fileId"])
    ):
        raise ParserError("FILE_INVALID")
    request_id = payload.get("requestId")
    if "storageId" in payload and payload["storageId"] != storage_identity(storage_root):
        raise ParserError("STORAGE_TARGET_CHANGED")
    ticket = _read_receipt(storage_root, _upload_id(request_id)) if request_id is not None else None
    if request_id is not None:
        if ticket is None:
            if not _new_upload_allowed(storage_root, _upload_id(request_id)):
                raise ParserError("UPLOAD_RETIRED")
            raise ParserError("UPLOAD_NOT_PREPARED")
        if ticket["state"] in ("closing", "closed"):
            raise ParserError("UPLOAD_CLOSED")
        if payload.get("fileId") or payload.get("startPage", 1) != 1:
            raise ParserError("UPLOAD_INVALID")
    ocr_engine = payload.get("ocrEngine", "tesseract")
    if ocr_engine not in ("tesseract", "apple-vision", "docling"):
        raise ParserError("OCR_ENGINE_UNSUPPORTED")
    allow_ocr = payload.get("allowOCR") is True
    docling_deadline = time.monotonic() + 90 if ocr_engine == "docling" else None
    if ocr_engine == "docling":
        if type(payload.get("allowOCR")) is not bool:
            raise ParserError("DOCLING_CONSENT_INVALID")
        if not docling_capabilities()["available"]:
            raise ParserError("DOCLING_UNAVAILABLE")
        if cancelled and cancelled():
            raise ParserError("DOCLING_CANCELLED")
    if ocr_engine == "apple-vision":
        if not allow_ocr:
            raise ParserError("OCR_CONSENT_REQUIRED")
        if not apple_capabilities()["available"]:
            raise ParserError("APPLE_VISION_UNAVAILABLE")
    try:
        file_id = payload.get("fileId")
        if file_id and re.fullmatch("[a-f0-9]{64}", str(file_id)):
            if (Path(storage_root) / file_id).is_symlink():
                raise ParserError("FILE_INVALID")
            files = list((Path(storage_root) / file_id).glob("original.*"))
            if len(files) != 1:
                raise ParserError("FILE_NOT_FOUND")
            if (
                files[0].is_symlink()
                or not files[0].is_file()
                or files[0].stat().st_size > MAX_BYTES
            ):
                raise ParserError("FILE_INVALID")
            data = files[0].read_bytes()
        else:
            data = base64.b64decode(payload["contentBase64"], validate=True)
    except (KeyError, ValueError) as error:
        raise ParserError("FILE_INVALID") from error
    if not data or len(data) > MAX_BYTES:
        raise ParserError("FILE_LIMIT")
    fingerprint = hashlib.sha256(data).hexdigest()
    if file_id and file_id != fingerprint:
        raise ParserError("FILE_INVALID")
    body_fingerprint = hashlib.sha256(
        json.dumps(
            [fingerprint, ocr_engine, allow_ocr, str(payload.get("name", "私人资料"))[:160]],
            ensure_ascii=False,
        ).encode()
    ).hexdigest()
    if ticket and (
        ticket["size"] != len(data)
        or ticket.get("bodyFingerprint", body_fingerprint) != body_fingerprint
    ):
        raise ParserError("UPLOAD_CONFLICT")
    is_pdf = data.startswith(b"%PDF-")
    suffix = (
        ".pdf"
        if is_pdf
        else ".png"
        if data.startswith(b"\x89PNG\r\n\x1a\n")
        else ".jpg"
        if data.startswith(b"\xff\xd8\xff")
        else None
    )
    if not suffix:
        raise ParserError("FILE_TYPE_UNSUPPORTED")
    if ocr_engine == "docling" and not is_pdf:
        raise ParserError("DOCLING_PDF_REQUIRED")
    if not is_pdf and not allow_ocr:
        raise ParserError("OCR_CONSENT_REQUIRED")
    directory = Path(storage_root) / fingerprint
    if directory.is_symlink():
        raise ParserError("FILE_INVALID")
    with LOCK:
        original = directory / ("original" + suffix)
        if original.is_symlink():
            raise ParserError("FILE_INVALID")
        created = not original.exists()
        if ticket:
            ticket.update(
                state="receiving",
                fileId=fingerprint,
                owned=ticket.get("owned", created),
                bodyFingerprint=body_fingerprint,
            )
            _write_receipt(
                storage_root, ticket
            )  # The file remains locatable even if its write or parser response fails.
        if created:
            stored = sum(p.stat().st_size for p in Path(storage_root).glob("*/original.*"))
            if stored + len(data) > MAX_STORED:
                raise ParserError("STORAGE_LIMIT")
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            _store_original(original, data)
        if ticket:
            ticket["state"] = "stored"
            _write_receipt(storage_root, ticket)
    segments = []
    if is_pdf:
        deadline = time.monotonic() + 25 if ocr_engine == "apple-vision" else None
        info = (
            docling_pdf_info(original, cancelled, docling_deadline)
            if ocr_engine == "docling"
            else run_tool("pdfinfo", [original], timeout=20).decode("utf8")
        )
        match = re.search(r"^Pages:\s+(\d+)", info, re.M)
        if not match:
            raise ParserError("PDF_PAGE_COUNT_UNKNOWN")
        total = int(match[1])
        try:
            start = int(payload.get("startPage", 1))
        except (TypeError, ValueError) as error:
            raise ParserError("PAGE_RANGE_INVALID") from error
        if start < 1 or start > total:
            raise ParserError("PAGE_RANGE_INVALID")
        if ocr_engine == "docling" and (
            type(payload.get("startPage", 1)) is not int or total > 2048
        ):
            raise ParserError("PAGE_RANGE_INVALID")
        end = min(total, start if ocr_engine == "docling" else start + 4)
        started = time.monotonic()
        completed = start - 1
        for page in range(start, end + 1):
            if time.monotonic() - started > 60 or (deadline and time.monotonic() >= deadline):
                break
            try:
                segment = (
                    docling_pdf_page(
                        original, page, data, fingerprint, allow_ocr, cancelled, docling_deadline
                    )
                    if ocr_engine == "docling"
                    else parse_pdf_page(original, page, directory, allow_ocr, ocr_engine, deadline)
                )
                if (
                    ocr_engine == "apple-vision"
                    and len(json.dumps([*segments, segment], ensure_ascii=False).encode("utf8"))
                    > 1800000
                ):
                    if segments:
                        break  # 本页留到下批；已完成片段不会因超出客户端2MiB回执而全部丢失。
                    raise ParserError("PAGE_RECEIPT_LIMIT")
                segments.append(segment)
            except (ParserError, subprocess.TimeoutExpired, ET.ParseError) as error:
                if str(error) == "DOCLING_CANCELLED":
                    raise
                segments.append(
                    {
                        "id": f"page-{page}",
                        "page": page,
                        "content": "",
                        "status": "failed",
                        "reviewRequired": True,
                        "errorCode": "PAGE_PARSE_FAILED",
                        **(
                            {
                                "role": "unassigned",
                                "sourceSha256": fingerprint,
                                "extractionVersion": "yozi-docling-page-v1",
                                "gradingAuthority": False,
                            }
                            if ocr_engine == "docling"
                            else {}
                        ),
                    }
                )
            completed = page
        next_page = completed + 1 if completed < total else None
    else:
        if not allow_ocr:
            raise ParserError("OCR_CONSENT_REQUIRED")
        apple_preview, apple_dimensions = None, None
        try:
            if ocr_engine == "apple-vision":
                content, words, apple_preview, apple_dimensions = parse_apple_image(original)
            else:
                content, words = parse_image(original)
        except (ParserError, subprocess.TimeoutExpired):
            # 新图片未形成可删除的资料回执；仅回滚本次新副本，不删除旧原件。
            if created:
                shutil.rmtree(directory)
            raise
        segments = [
            {
                "id": "image-1",
                "page": 1,
                "content": content[:20000],
                "words": words[:3000],
                "location": {"region": "full_image"},
                "role": "unassigned",
                "method": "apple_vision" if ocr_engine == "apple-vision" else "tesseract",
                "reviewRequired": True,
                "extractionVersion": "poppler-apple-vision-v1"
                if ocr_engine == "apple-vision"
                else VERSION,
                "uncertainties": ["公式、上下标、单位和区域角色需按原图校对"],
                **(
                    {
                        "dimensions": apple_dimensions,
                        "coordinateSpace": "preview_pixels_top_left",
                        "recognitionStatus": "text_candidate" if content else "no_text",
                    }
                    if apple_preview
                    else {}
                ),
                "preview": apple_preview
                or "data:image/" + suffix[1:] + ";base64," + base64.b64encode(data).decode(),
            }
        ]
        total = 1
        next_page = None
    return {
        "id": fingerprint,
        "fingerprint": fingerprint,
        "name": str(payload.get("name", "私人资料"))[:160],
        "kind": "pdf" if is_pdf else "image",
        "scope": "private",
        "publishable": False,
        "original": {
            "connectorFileId": fingerprint,
            "sha256": fingerprint,
            "byteLength": len(data),
        },
        "segments": segments,
        "totalPages": total,
        "nextPage": next_page,
        "dataFlow": "authorized_local_connector",
        "extraCloudCost": 0,
        "extractionVersion": "yozi-docling-page-v1"
        if ocr_engine == "docling"
        else "poppler-apple-vision-v1"
        if any(s.get("method") == "apple_vision" for s in segments)
        else PDF_TEXT_VERSION
        if any(s.get("method") == "pdf_text" for s in segments)
        else VERSION,
        "recognitionEngine": ocr_engine,
        **(
            {"recognitionAllowed": allow_ocr, "gradingAuthority": False}
            if ocr_engine == "docling"
            else {}
        ),
        "status": "partial"
        if next_page
        else "needs_retry"
        if any(s.get("status") == "failed" for s in segments)
        else "ready",
        "corrections": [],
    }


def make_handler(token, origin, storage_root, stopping=None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # 不记录资料、密钥和请求 body。

        def reply(self, code, data):
            raw = json.dumps(data, ensure_ascii=False).encode("utf8")
            try:
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                pass  # A cancelled request must not log private details or retry a reply.

        def cancelled(self):
            if stopping and stopping.is_set():
                return True
            try:
                readable, _, _ = select.select([self.connection], [], [], 0)
                return bool(readable) and self.connection.recv(1, socket.MSG_PEEK) == b""
            except OSError:
                return True

        def do_OPTIONS(self):
            if self.headers.get("Origin") != origin:
                self.reply(403, {"success": False, "message": "ORIGIN_FORBIDDEN"})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.end_headers()

        def do_POST(self):
            request_origin = self.headers.get("Origin")
            if (
                request_origin
                and request_origin != origin
                or not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token)
            ):
                self.reply(403, {"success": False, "message": "AUTH_OR_ORIGIN_FORBIDDEN"})
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                if length <= 0 or length > MAX_BYTES * 1.4 + 10000:
                    raise ParserError("REQUEST_LIMIT")
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ParserError("REQUEST_INVALID")
                if self.path == "/parse" and "action" in payload:
                    self.reply(200, {"success": True, "data": upload_action(payload, storage_root)})
                elif self.path == "/parse":
                    if not PARSER_SLOTS.acquire(blocking=False):
                        self.reply(429, {"success": False, "message": "PARSER_BUSY"})
                        return
                    try:
                        result = parse_material(payload, storage_root, cancelled=self.cancelled)
                    finally:
                        PARSER_SLOTS.release()
                    self.reply(200, {"success": True, "data": result})
                elif self.path == "/delete" and re.fullmatch(
                    "[a-f0-9]{64}", str(payload.get("fileId", ""))
                ):
                    self.reply(
                        200,
                        {"success": True, "data": delete_material(payload["fileId"], storage_root)},
                    )
                elif self.path == "/health":
                    self.reply(
                        200,
                        {
                            "success": True,
                            "data": {
                                "version": VERSION,
                                "pdfText": bool(shutil.which("pdftotext")),
                                "pagePreview": bool(shutil.which("pdftoppm")),
                                "ocrBinaryAvailable": bool(shutil.which("tesseract")),
                                "ocrEngines": {
                                    "docling": docling_capabilities(),
                                    "appleVision": apple_capabilities(),
                                    "tesseract": {
                                        "available": bool(shutil.which("tesseract")),
                                        "recognitionState": "not_tested",
                                    },
                                },
                                "uploadRecovery": {
                                    "available": True,
                                    "contract": UPLOAD_CONTRACT,
                                    "maxReceipts": MAX_UPLOAD_RECEIPTS,
                                    "storageId": storage_identity(storage_root),
                                },
                                "uploadMaintenance": {
                                    "available": True,
                                    "contract": UPLOAD_MAINTENANCE_CONTRACT,
                                    "generation": _upload_epoch(storage_root)["generation"],
                                },
                                "modelInference": False,
                                "maxBytes": MAX_BYTES,
                            },
                        },
                    )
                elif self.path == "/chat":
                    self.reply(410, {"success": False, "message": "MODEL_CONNECTOR_MOVED"})
                else:
                    self.reply(404, {"success": False, "message": "ROUTE_UNAVAILABLE"})
            except OSError:
                self.reply(500, {"success": False, "message": "DELETE_OR_STORAGE_FAILED"})
            except (
                ParserError,
                ValueError,
                subprocess.TimeoutExpired,
                TimeoutError,
            ) as error:
                if str(error) == "DOCLING_CANCELLED":
                    return
                self.reply(
                    409 if str(error) == "FILE_BUSY" else 422,
                    {
                        "success": False,
                        "message": "材料解析未完成，请检查文件、工具和资源限制后分段重试",
                    },
                )

    return Handler


def valid_material_client_origin(origin):
    # Native macOS origin is opt-in; opaque/null and arbitrary custom schemes stay rejected.
    return origin == "tauri://localhost" or bool(re.fullmatch(r"https?://[^/]+", origin))


def main():
    token = os.environ.get("MATERIAL_CONNECTOR_TOKEN", "")
    origin = os.environ.get("MATERIAL_CONNECTOR_ORIGIN", "")
    if len(token) < 32 or not valid_material_client_origin(origin):
        raise SystemExit(
            "请配置至少32字符 MATERIAL_CONNECTOR_TOKEN 和精确 MATERIAL_CONNECTOR_ORIGIN"
        )
    root = os.environ.get("MATERIAL_CONNECTOR_STORAGE")
    port = int(os.environ.get("MATERIAL_CONNECTOR_PORT", "8765"))
    if not 1024 <= port <= 65535:
        raise SystemExit("MATERIAL_CONNECTOR_PORT 必须是 1024—65535")
    if not root:
        # 默认临时目录，退出删除，避免默认保留私人原文件。
        with tempfile.TemporaryDirectory(prefix="exam-private-material-") as directory:
            serve_material(token, origin, directory, port)
    else:
        Path(root).mkdir(mode=0o700, parents=True, exist_ok=True)
        serve_material(token, origin, root, port)


def serve_material(token, origin, root, port):
    stopping = threading.Event()
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(token, origin, root, stopping))
    server.daemon_threads = False

    def interrupt(_signal, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stopping.set()
        stop_apple_warmup()
        server.server_close()


if __name__ == "__main__":
    main()
