import base64
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import threading
import socket
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
from tests.unit.test_private_material_parser import make_pdf


def load(name, filename):
    spec = importlib.util.spec_from_file_location(
        name, Path(__file__).parents[2] / "scripts/pipeline" / filename
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


WORKER = load("docling_worker", "private-material-docling.py")
PARSER = load("docling_host", "private-material-parser.py")
PDF = b"%PDF-1.4\nSynthetic adapter transport fixture, not an actual document."
SHA = hashlib.sha256(PDF).hexdigest()


def request():
    return {
        "contentBase64": base64.b64encode(PDF).decode(),
        "sha256": SHA,
        "page": 1,
        "allowOCR": False,
    }


def fixture():
    def box(left, top, right, bottom, origin="BOTTOMLEFT"):
        return {"l": left, "t": top, "r": right, "b": bottom, "coord_origin": origin}

    def item(ref, kind, raw="", value="", coordinates=None, children=None):
        return {
            "self_ref": ref,
            "label": kind,
            "orig": raw,
            "text": value,
            "prov": [{"page_no": 1, "bbox": coordinates or box(10, 190, 150, 170)}],
            "children": [{"$ref": child} for child in (children or [])],
        }

    table = item("#/tables/0", "table", coordinates=box(10, 170, 150, 110))
    table["data"] = {
        "num_rows": 2,
        "num_cols": 2,
        "table_cells": [
            {
                "start_row_offset_idx": r,
                "end_row_offset_idx": r + 1,
                "start_col_offset_idx": c,
                "end_col_offset_idx": c + 1,
                "row_span": 1,
                "col_span": 1,
                "text": value,
                "bbox": box(10 + c * 70, 30 + r * 30, 70 + c * 70, 50 + r * 30, "TOPLEFT"),
            }
            for r, row in enumerate([["向东 / 米", "向西 / 米"], ["120", "80"]])
            for c, value in enumerate(row)
        ],
    }
    return {
        "schema_name": "DoclingDocument",
        "pages": {"1": {"size": {"width": 200, "height": 200}}},
        "groups": [],
        "texts": [
            item("#/texts/0", "formula", raw="h(x) = (x 2 - 1)/(x - 1), x != 1"),
            item(
                "#/texts/1",
                "caption",
                raw="向西 80 米",
                value="向西 80 米",
                coordinates=box(20, 50, 120, 40),
            ),
            item(
                "#/texts/2",
                "page_footer",
                raw="原页 1",
                value="原页 1",
                coordinates=box(10, 20, 100, 10),
            ),
        ],
        "tables": [table],
        "pictures": [
            item(
                "#/pictures/0", "picture", coordinates=box(10, 70, 150, 30), children=["#/texts/1"]
            )
        ],
        "body": {
            "children": [{"$ref": ref} for ref in ("#/texts/0", "#/tables/0", "#/pictures/0")]
        },
        "furniture": {"children": [{"$ref": "#/texts/2"}]},
    }


class DoclingNormalizationTests(unittest.TestCase):
    def test_empty_scan_table_keeps_region_without_inventing_text_or_enabling_ocr(self):
        document = fixture()
        document["tables"][0]["data"] = {"num_rows": 0, "num_cols": 0, "table_cells": []}
        for item in document["texts"]:
            item.update(text="", orig="")
        result = WORKER.normalize_document(document, 1, SHA, False)
        self.assertEqual(result["segment"]["content"], "")
        self.assertEqual(result["segment"]["words"], [])
        self.assertEqual(result["segment"]["recognitionStatus"], "no_text")
        self.assertEqual(result["segment"]["blocks"][1]["cells"], [])
        self.assertEqual(result["segment"]["blocks"][1]["bbox"], [10, 30, 150, 90])
        self.assertFalse(result["allowOCR"])
        document["tables"][0]["data"]["num_cols"] = 2
        with self.assertRaises(WORKER.DoclingError):
            WORKER.normalize_document(document, 1, SHA, False)

    def test_conversion_disallows_network_and_even_system_metadata_children(self):
        for event in (
            "socket.connect",
            "socket.getaddrinfo",
            "socket.sendto",
            "subprocess.Popen",
            "os.system",
        ):
            with self.assertRaises(WORKER.DoclingError):
                WORKER.offline_guard(event, ("uname", ["uname", "-p"], None, None))

    def test_formula_raw_picture_children_table_and_page_location_survive(self):
        result = WORKER.normalize_document(fixture(), 1, SHA, False)
        page = result["segment"]
        self.assertEqual(
            page["content"],
            "h(x) = (x 2 - 1)/(x - 1), x != 1\n向东 / 米\t向西 / 米\n120\t80\n向西 80 米\n原页 1",
        )
        self.assertEqual(page["blocks"][0]["text"], "")
        self.assertEqual(page["blocks"][0]["rawText"], "h(x) = (x 2 - 1)/(x - 1), x != 1")
        self.assertEqual(page["blocks"][0]["bbox"], [10, 10, 150, 30])
        self.assertEqual(
            page["blocks"][1]["cells"][3],
            {
                "row": 1,
                "rowSpan": 1,
                "column": 1,
                "columnSpan": 1,
                "text": "80",
                "bbox": [80, 60, 140, 80],
            },
        )
        self.assertEqual(page["coordinateSpace"], "pdf_points_top_left")
        self.assertTrue(page["reviewRequired"])
        self.assertEqual(page["role"], "unassigned")
        self.assertFalse(result["gradingAuthority"])
        self.assertEqual(result["sourceSha256"], SHA)
        self.assertTrue(all(w["confidence"] is None for w in page["words"]))

    def test_bad_coordinates_cross_page_and_missing_content_fail_closed(self):
        changes = [
            lambda d: d["texts"][0]["prov"][0]["bbox"].update(l=-1),
            lambda d: d["texts"][0]["prov"][0]["bbox"].update(t=float("nan")),
            lambda d: d["texts"][0]["prov"][0]["bbox"].update(coord_origin="unknown"),
            lambda d: d["texts"][0]["prov"][0].update(page_no=2),
            lambda d: d["body"]["children"].pop(0),
            lambda d: d["pictures"][0]["children"].append({"$ref": "#/pictures/0"}),
            lambda d: d["body"]["children"].append({"$ref": "#/texts/99"}),
            lambda d: d["body"]["children"].append({"$ref": "#/texts/0"}),
        ]
        for change in changes:
            with self.subTest(change=change):
                d = fixture()
                change(d)
                with self.assertRaises(WORKER.DoclingError):
                    WORKER.normalize_document(d, 1, SHA, False)

    def test_table_overlap_missing_cells_spans_and_limits_are_not_silently_repaired(self):
        for mutation in ("overlap", "missing", "span", "limit"):
            with self.subTest(mutation=mutation):
                d = fixture()
                table = d["tables"][0]["data"]
                if mutation == "overlap":
                    table["table_cells"][1] = copy.deepcopy(table["table_cells"][0])
                if mutation == "missing":
                    table["table_cells"].pop()
                if mutation == "span":
                    table["table_cells"][0]["row_span"] = 2
                if mutation == "limit":
                    table["num_rows"] = 101
                with self.assertRaises(WORKER.DoclingError):
                    WORKER.normalize_document(d, 1, SHA, True)

    def test_input_is_bytes_bound_to_hash_not_a_url_or_arbitrary_path(self):
        self.assertEqual(WORKER.decode_request(request()), PDF)
        for field, value in (
            ("page", True),
            ("page", 0),
            ("page", 2049),
            ("allowOCR", "true"),
            ("allowOCR", 1),
            ("sha256", "0" * 64),
            ("contentBase64", "https://example.com/private.pdf"),
            ("url", "file:///private"),
        ):
            with self.subTest(field=field, value=value):
                payload = request()
                payload[field] = value
                with self.assertRaises(WORKER.DoclingError):
                    WORKER.decode_request(payload)

    def test_changed_models_and_outside_symlinks_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = root / "models"
            models.mkdir()
            (models / "a").write_bytes(b"model")
            digest = hashlib.sha256(b"model").hexdigest()
            WORKER.verify_models(models, {"a": digest})
            (models / "a").write_bytes(b"different")
            with self.assertRaisesRegex(WORKER.DoclingError, "CHANGED"):
                WORKER.verify_models(models, {"a": digest})
            (root / "outside").write_bytes(b"model")
            (models / "b").symlink_to(root / "outside")
            with self.assertRaisesRegex(WORKER.DoclingError, "UNAVAILABLE"):
                WORKER.verify_models(models, {"b": digest})


@unittest.skipUnless(
    sys.platform == "darwin", "macOS host watchdog; other platforms are not enabled"
)
class DoclingHostTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.environment = patch.dict(
            os.environ,
            {
                "MATERIAL_DOCLING_ENABLED": "1",
                "MATERIAL_DOCLING_PYTHON": sys.executable,
                "MATERIAL_DOCLING_RUNTIME": str(self.root),
                "MATERIAL_DOCLING_MODELS": str(self.root),
                "PRIVATE_TEST_CREDENTIAL": "must-not-inherit",
            },
        )
        self.environment.start()
        self.file_patch = patch.object(PARSER, "__file__", str(self.root / "parser.py"))
        self.file_patch.start()
        self.children = []
        self.workspaces = []
        real_popen = subprocess.Popen

        def capture(*args, **kwargs):
            child = real_popen(*args, **kwargs)
            if str(self.root / "private-material-docling.py") in args[0]:
                self.children.append(child)
                self.workspaces.append(kwargs["env"]["TMPDIR"])
            return child

        self.popen_patch = patch.object(PARSER.subprocess, "Popen", side_effect=capture)
        self.popen_patch.start()

    def tearDown(self):
        self.popen_patch.stop()
        self.file_patch.stop()
        self.environment.stop()
        for child in self.children:
            self.assertIsNotNone(child.poll(), "owned child must be reaped")
        for directory in self.workspaces:
            self.assertFalse(
                Path(directory).exists(), "owned temporary input/cache must be removed"
            )
        self.temp.cleanup()

    def worker(self, suffix="", alter=None):
        response = {"success": True, "data": WORKER.normalize_document(fixture(), 1, SHA, False)}
        if alter:
            alter(response)
        (self.root / "private-material-docling.py").write_text(
            "import sys,json,os,time\njson.load(sys.stdin)\n"
            "assert 'PRIVATE_TEST_CREDENTIAL' not in os.environ\n"
            "assert os.environ['HF_HUB_OFFLINE']=='1'\n"
            + suffix
            + "\nprint("
            + repr(json.dumps(response, ensure_ascii=False))
            + ")\n"
        )

    def test_disabled_and_invalid_consent_do_not_spawn(self):
        with patch.dict(os.environ, {"MATERIAL_DOCLING_ENABLED": "0"}):
            with self.assertRaisesRegex(PARSER.ParserError, "UNAVAILABLE"):
                PARSER.docling_command(request())
        for value in (None, "true", 1):
            payload = request()
            payload["allowOCR"] = value
            with self.assertRaisesRegex(PARSER.ParserError, "INPUT_INVALID"):
                PARSER.docling_command(payload)
        self.assertEqual(self.children, [])

    def test_actual_pipes_do_not_inherit_credentials_and_keep_binding(self):
        self.worker()
        result = PARSER.docling_command(request())
        self.assertEqual(result["sourceSha256"], SHA)
        self.assertIn("x != 1", result["segment"]["content"])

    def test_capabilities_run_no_conversion_and_reject_unverified_claims(self):
        caps = {
            "contract": WORKER.CONTRACT,
            "status": "files_verified",
            "runtime": "macos_connector",
            "recognitionState": "not_tested",
            "maxPagesPerRequest": 1,
            "maxBytes": PARSER.MAX_BYTES,
            "dataFlow": "authorized_local_connector",
            "extraCloudCost": 0,
        }
        for bad in (False, True):
            value = {**caps, **({"recognitionState": "accuracy_verified"} if bad else {})}
            (self.root / "private-material-docling.py").write_text(
                "import sys\nassert sys.argv[3]=='--capabilities'\nprint("
                + repr(json.dumps({"success": True, "data": value}))
                + ")\n"
            )
            if bad:
                with self.assertRaisesRegex(PARSER.ParserError, "INVALID_RESULT"):
                    PARSER.docling_command(None)
            else:
                self.assertEqual(PARSER.docling_command(None), caps)

    def test_capability_checks_have_one_slot_and_their_own_small_memory_budget(self):
        PARSER.DOCLING_CAP_SLOT.acquire()
        try:
            self.assertFalse(PARSER.docling_capabilities()["available"])
            self.assertEqual(self.children, [])
        finally:
            PARSER.DOCLING_CAP_SLOT.release()
        (self.root / "private-material-docling.py").write_text("import time\ntime.sleep(10)\n")
        with patch.object(
            PARSER.subprocess,
            "run",
            return_value=subprocess.CompletedProcess([], 0, b"150000\n", b""),
        ):
            with self.assertRaisesRegex(PARSER.ParserError, "MEMORY_LIMIT"):
                PARSER.docling_command(None)

    def test_timeout_cancel_and_memory_limit_reap_children(self):
        self.worker("time.sleep(10)")
        with self.assertRaisesRegex(PARSER.ParserError, "TIMEOUT"):
            PARSER.docling_command(request(), deadline=time.monotonic() + 0.2)
        start = time.monotonic()
        with self.assertRaisesRegex(PARSER.ParserError, "CANCELLED"):
            PARSER.docling_command(request(), cancelled=lambda: time.monotonic() - start > 0.2)
        with patch.object(
            PARSER.subprocess,
            "run",
            return_value=subprocess.CompletedProcess([], 0, b"3000000\n", b""),
        ):
            with self.assertRaisesRegex(PARSER.ParserError, "MEMORY_LIMIT"):
                PARSER.docling_command(request())

    def test_output_limit_and_live_monitor_failure_reap_children(self):
        self.worker("sys.stdout.write('x'*2200000);sys.stdout.flush();time.sleep(10)")
        with self.assertRaisesRegex(PARSER.ParserError, "RESULT_LIMIT"):
            PARSER.docling_command(request())
        self.worker("time.sleep(10)")
        with patch.object(
            PARSER.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, b"", b"")
        ):
            with self.assertRaisesRegex(PARSER.ParserError, "MONITOR_FAILED"):
                PARSER.docling_command(request())

    def test_wrong_source_page_ocr_and_grading_are_rejected(self):
        for key, value in (
            ("sourceSha256", "0" * 64),
            ("page", 2),
            ("allowOCR", True),
            ("gradingAuthority", True),
        ):
            with self.subTest(key=key):
                self.worker(alter=lambda response: response["data"].update({key: value}))
                with self.assertRaisesRegex(PARSER.ParserError, "INVALID_RESULT"):
                    PARSER.docling_command(request())


class DoclingHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.pdf = make_pdf(3)
        self.sha = hashlib.sha256(self.pdf).hexdigest()
        self.token = "TEST_ONLY_DOCLING_HTTP_TOKEN_32_CHARACTERS"
        self.stopping = threading.Event()
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            PARSER.make_handler(self.token, "http://localhost:5173", self.root, self.stopping),
        )
        self.server.daemon_threads = False
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.cap = patch.object(PARSER, "docling_capabilities", return_value={"available": True})
        self.cap.start()
        self.calls = []

        def convert(payload, **options):
            self.calls.append(payload)
            page = payload["page"]
            d = fixture()
            d["pages"] = {str(page): d["pages"].pop("1")}
            for collection in ("texts", "pictures", "tables"):
                for item in d[collection]:
                    item["prov"][0]["page_no"] = page
            return WORKER.normalize_document(d, page, payload["sha256"], payload["allowOCR"])

        self.converter = patch.object(PARSER, "docling_command", side_effect=convert)
        self.converter.start()

    def tearDown(self):
        self.stopping.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.converter.stop()
        self.cap.stop()
        self.temp.cleanup()

    def post(self, body, path="/parse", token=None):
        request = Request(
            f"http://127.0.0.1:{self.server.server_port}{path}",
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + (token or self.token)},
        )
        try:
            # The actual endpoint has a 90-second total budget; cancellation tests
            # below independently assert prompt disconnect/shutdown handling.
            with urlopen(request, timeout=100) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def upload(self, **extra):
        return {
            "contentBase64": base64.b64encode(self.pdf).decode(),
            "name": "synthetic.pdf",
            "allowOCR": False,
            "ocrEngine": "docling",
            **extra,
        }

    def test_single_page_original_binding_preview_and_explicit_ocr_on_resume(self):
        code, response = self.post(self.upload())
        self.assertEqual(code, 200)
        material = response["data"]
        self.assertEqual(len(material["segments"]), 1)
        self.assertEqual(material["nextPage"], 2)
        self.assertFalse(material["recognitionAllowed"])
        self.assertFalse(material["gradingAuthority"])
        page = material["segments"][0]
        self.assertTrue(page["preview"].startswith("data:image/png;base64,"))
        self.assertEqual(page["blocks"][1]["cells"][3]["text"], "80")
        self.assertEqual(page["sourceSha256"], self.sha)
        self.assertEqual(page["role"], "unassigned")
        self.assertTrue(page["reviewRequired"])
        self.assertEqual(
            list((self.root / self.sha).iterdir()), [self.root / self.sha / "original.pdf"]
        )
        code, response = self.post(
            {"fileId": self.sha, "startPage": 3, "ocrEngine": "docling", "allowOCR": True}
        )
        self.assertEqual(code, 200)
        self.assertIsNone(response["data"]["nextPage"])
        self.assertEqual(response["data"]["segments"][0]["method"], "docling_rapidocr")
        self.assertTrue(self.calls[-1]["allowOCR"])
        self.assertEqual((self.root / self.sha / "original.pdf").read_bytes(), self.pdf)

    def test_unavailable_invalid_consent_images_and_wrong_storage_rejected_before_conversion(self):
        for extra in (
            {"allowOCR": "true"},
            {"allowOCR": 1},
            {
                "contentBase64": base64.b64encode(b"\x89PNG\r\n\x1a\ntest").decode(),
                "allowOCR": True,
            },
            {"storageId": "a" * 32},
        ):
            self.assertEqual(self.post(self.upload(**extra))[0], 422)
        PARSER.docling_capabilities.return_value = {"available": False}
        self.assertEqual(self.post(self.upload())[0], 422)
        self.assertEqual(self.calls, [])
        self.assertEqual(list(self.root.glob("*/original.*")), [])
        self.assertEqual(self.post({}, "/health", token="bad")[0], 403)

    def test_failed_page_has_no_candidate_but_keeps_recoverable_original(self):
        PARSER.docling_command.side_effect = PARSER.ParserError("DOCLING_MEMORY_LIMIT")
        code, response = self.post(self.upload())
        self.assertEqual(code, 200)
        page = response["data"]["segments"][0]
        self.assertEqual(page["status"], "failed")
        self.assertEqual(page["content"], "")
        self.assertFalse(page["gradingAuthority"])
        self.assertTrue((self.root / self.sha / "original.pdf").exists())

    def test_mismatched_preview_coordinates_do_not_return_misleading_regions(self):
        convert = PARSER.docling_command.side_effect

        def wrong_dimensions(*args, **kwargs):
            result = convert(*args, **kwargs)
            result["segment"]["dimensions"]["width"] = 100
            return result

        PARSER.docling_command.side_effect = wrong_dimensions
        code, response = self.post(self.upload())
        self.assertEqual(code, 200)
        self.assertEqual(response["data"]["segments"][0]["status"], "failed")
        self.assertNotIn("preview", response["data"]["segments"][0])
        self.assertEqual((self.root / self.sha / "original.pdf").read_bytes(), self.pdf)

    def test_disconnected_request_cancels_and_retains_upload_receipt_without_blocking_others(self):
        storage = PARSER.storage_identity(self.root)
        ticket = {"requestId": "upload_docling_test_12345678", "storageId": storage}
        self.assertEqual(
            self.post({**ticket, "action": "prepare-upload", "size": len(self.pdf)})[0], 200
        )
        started, ended = threading.Event(), threading.Event()

        def wait_for_cancel(payload, *, cancelled, **_options):
            started.set()
            try:
                deadline = time.monotonic() + 3
                while not cancelled():
                    if time.monotonic() >= deadline:
                        raise AssertionError("request did not cancel")
                    time.sleep(0.01)
                raise PARSER.ParserError("DOCLING_CANCELLED")
            finally:
                ended.set()

        PARSER.docling_command.side_effect = wait_for_cancel
        body = json.dumps(self.upload(**ticket)).encode()
        client = socket.create_connection(self.server.server_address)
        try:
            client.sendall(
                (
                    f"POST /parse HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {self.token}\r\n"
                    f"Content-Length: {len(body)}\r\n\r\n"
                ).encode()
                + body
            )
            self.assertTrue(started.wait(2))
            self.assertEqual(self.post(self.upload())[0], 409)  # No second heavy worker/queue.
        finally:
            client.close()
        self.assertTrue(ended.wait(2))
        code, receipt = self.post({**ticket, "action": "upload-receipt"})
        self.assertEqual(code, 200)
        self.assertEqual(receipt["data"]["state"], "stored")
        self.assertEqual(receipt["data"]["fileId"], self.sha)
        self.assertEqual((self.root / self.sha / "original.pdf").read_bytes(), self.pdf)

    def test_server_sigterm_cancels_active_worker_and_waits_for_cleanup(self):
        # A real HTTP process exercises serve_material's shutdown event. The fake
        # converter sleeps; no installed models or unrelated services are used.
        host = self.root / "private-material-parser.py"
        host.write_bytes(Path(PARSER.__file__).read_bytes())
        marker = self.root / "owned-worker.json"
        caps = {
            "contract": WORKER.CONTRACT,
            "status": "files_verified",
            "runtime": "macos_connector",
            "recognitionState": "not_tested",
            "maxPagesPerRequest": 1,
            "maxBytes": PARSER.MAX_BYTES,
            "dataFlow": "authorized_local_connector",
            "extraCloudCost": 0,
        }
        (self.root / "private-material-docling.py").write_text(
            "import sys,json,os,time\n"
            "if '--capabilities' in sys.argv:\n print("
            + repr(json.dumps({"success": True, "data": caps}))
            + ")\n"
            "else:\n json.load(sys.stdin)\n"
            f" open({str(marker)!r},'w').write(json.dumps({{'pid':os.getpid(),'workspace':os.environ['TMPDIR']}}))\n"
            " time.sleep(60)\n"
        )
        with socket.socket() as holder:
            holder.bind(("127.0.0.1", 0))
            port = holder.getsockname()[1]
        process = subprocess.Popen(
            [sys.executable, "-B", str(host)],
            env={
                "PATH": os.environ.get("PATH", ""),
                "MATERIAL_DOCLING_ENABLED": "1",
                "MATERIAL_DOCLING_PYTHON": sys.executable,
                "MATERIAL_DOCLING_RUNTIME": str(self.root),
                "MATERIAL_DOCLING_MODELS": str(self.root),
                "MATERIAL_CONNECTOR_TOKEN": self.token,
                "MATERIAL_CONNECTOR_ORIGIN": "http://localhost:5173",
                "MATERIAL_CONNECTOR_PORT": str(port),
                "MATERIAL_CONNECTOR_STORAGE": str(self.root / "shutdown-storage"),
            },
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        client = None
        try:
            deadline = time.monotonic() + 5
            while client is None:
                try:
                    client = socket.create_connection(("127.0.0.1", port), timeout=0.1)
                except OSError:
                    self.assertLess(time.monotonic(), deadline)
                    time.sleep(0.01)
            body = json.dumps(self.upload()).encode()
            client.sendall(
                (
                    f"POST /parse HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {self.token}\r\n"
                    f"Content-Length: {len(body)}\r\n\r\n"
                ).encode()
                + body
            )
            while not marker.exists() or not marker.stat().st_size:
                self.assertLess(time.monotonic(), deadline)
                time.sleep(0.01)
            child = json.loads(marker.read_text())
            process.terminate()
            output, errors = process.communicate(timeout=6)
            self.assertEqual(process.returncode, 0, errors)
            self.assertEqual(output, b"")
            self.assertEqual(errors, b"")
            with self.assertRaises(ProcessLookupError):
                os.kill(child["pid"], 0)
            self.assertFalse(Path(child["workspace"]).exists())
            self.assertEqual(
                (self.root / "shutdown-storage" / self.sha / "original.pdf").read_bytes(), self.pdf
            )
        finally:
            if client:
                client.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.communicate(timeout=6)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate()


if __name__ == "__main__":
    unittest.main()
