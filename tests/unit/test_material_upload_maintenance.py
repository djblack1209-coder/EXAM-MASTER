import tempfile
import base64
import json
import hashlib
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import unittest
from pathlib import Path
from unittest.mock import patch
from tests.unit.test_private_material_parser import PARSER, make_pdf


class UploadMaintenanceTests(unittest.TestCase):
    def request(self, root, action, **extra):
        return PARSER.upload_action(
            {"action": action, "storageId": PARSER.storage_identity(root), **extra}, root
        )

    def prepare(self, root, request_id, size=4):
        return self.request(root, "prepare-upload", requestId=request_id, size=size)

    def preview(self, root):
        return self.request(root, "preview-upload-maintenance")

    def compact(self, root, preview, request_id="maintenance_test_12345678"):
        return self.request(
            root,
            "compact-upload-receipts",
            requestId=request_id,
            generation=preview.get("fromGeneration", preview["generation"]),
            previewFingerprint=preview["previewFingerprint"],
        )

    def test_closed_receipts_free_capacity_without_reviving_old_registration(self):
        with tempfile.TemporaryDirectory() as root, patch.object(PARSER, "MAX_UPLOAD_RECEIPTS", 2):
            old_id = "upload_old_12345678"
            self.prepare(root, old_id)
            self.request(root, "close-upload", requestId=old_id)
            self.prepare(root, "upload_open_12345678")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_LIMIT"):
                self.prepare(root, "upload_full_12345678")
            preview = self.preview(root)
            self.assertEqual((preview["closedCount"], preview["openCount"]), (1, 1))
            result = self.compact(root, preview)
            self.assertEqual(result["removedCount"], 1)
            self.assertEqual(result["originalsDeleted"], 0)
            self.prepare(root, "upload_" + result["generation"] + "_new_12345678")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_RETIRED"):
                self.prepare(root, old_id)
            self.assertEqual(
                self.request(root, "upload-receipt", requestId=old_id)["state"], "retired"
            )
            self.assertEqual(len(list(Path(root).glob("upload-receipts/*.json"))), 2)

    def closed(self, root, request_id):
        self.prepare(root, request_id)
        return self.request(root, "close-upload", requestId=request_id)

    def test_repeat_operation_is_idempotent_and_does_not_remove_new_closed_receipts(self):
        with tempfile.TemporaryDirectory() as root:
            self.closed(root, "upload_closed_12345678")
            preview = self.preview(root)
            first = self.compact(root, preview)
            new_id = "upload_" + first["generation"] + "_new_12345678"
            self.closed(root, new_id)
            self.assertEqual(self.compact(root, preview), first)
            self.assertEqual(
                self.request(root, "upload-receipt", requestId=new_id)["state"], "closed"
            )
            second = self.compact(root, self.preview(root), "maintenance_next_12345678")
            self.assertNotEqual(second["generation"], first["generation"])
            self.assertEqual(
                self.request(root, "upload-receipt", requestId=new_id)["state"], "retired"
            )

    def test_originals_and_unresolved_claims_survive_compaction_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as root:
            data = make_pdf(1)
            for request_id in ["upload_source_12345678", "upload_duplicate_12345678"]:
                self.prepare(root, request_id, len(data))
                PARSER.parse_material(
                    {
                        "requestId": request_id,
                        "storageId": PARSER.storage_identity(root),
                        "contentBase64": base64.b64encode(data).decode(),
                    },
                    root,
                )
            self.request(root, "close-upload", requestId="upload_source_12345678")
            self.prepare(root, "upload_waiting_12345678")
            self.prepare(root, "upload_closing_12345678")
            value = PARSER._read_receipt(root, "upload_closing_12345678")
            value["state"] = "closing"
            PARSER._write_receipt(root, value)
            originals = {
                str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in Path(root).glob("[a-f0-9]*/**/*")
                if p.is_file()
            }
            claims = {
                request_id: PARSER._receipt_path(root, request_id).read_bytes()
                for request_id in [
                    "upload_duplicate_12345678",
                    "upload_waiting_12345678",
                    "upload_closing_12345678",
                ]
            }
            preview = self.preview(root)
            self.assertEqual(preview["openCount"], 3)
            self.compact(root, preview)
            self.assertEqual(
                originals,
                {
                    str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in Path(root).glob("[a-f0-9]*/**/*")
                    if p.is_file()
                },
            )
            for request_id, raw in claims.items():
                self.assertEqual(PARSER._receipt_path(root, request_id).read_bytes(), raw)
            receipt = self.request(root, "upload-receipt", requestId="upload_duplicate_12345678")
            self.assertEqual(
                PARSER.parse_material({"fileId": receipt["fileId"]}, root)["fingerprint"],
                receipt["fileId"],
            )

    def test_stale_preview_never_seals_or_removes_tombstones(self):
        with tempfile.TemporaryDirectory() as root:
            self.closed(root, "upload_closed_12345678")
            preview = self.preview(root)
            self.prepare(root, "upload_after_preview_12345678")
            before = {p.name: p.read_bytes() for p in Path(root).glob("upload-receipts/*")}
            with self.assertRaisesRegex(PARSER.ParserError, "MAINTENANCE_CHANGED"):
                self.compact(root, preview)
            self.assertEqual(
                before, {p.name: p.read_bytes() for p in Path(root).glob("upload-receipts/*")}
            )

    def test_seal_write_failure_does_not_remove_any_closed_receipt(self):
        with tempfile.TemporaryDirectory() as root:
            self.closed(root, "upload_closed_12345678")
            preview = self.preview(root)
            with patch.object(
                PARSER, "_write_upload_epoch", side_effect=OSError("TEST_ONLY_EPOCH_WRITE_FAILED")
            ):
                with self.assertRaises(OSError):
                    self.compact(root, preview)
            self.assertEqual(
                self.request(root, "upload-receipt", requestId="upload_closed_12345678")["state"],
                "closed",
            )
            self.assertEqual(self.compact(root, preview)["removedCount"], 1)

    def test_partial_removal_uses_persisted_plan_and_same_operation_after_restart(self):
        with tempfile.TemporaryDirectory() as root:
            for number in range(2):
                self.closed(root, f"upload_closed_{number:08d}")
            preview = self.preview(root)
            unlink = Path.unlink
            calls = 0

            def failing_unlink(path, *args, **kwargs):
                nonlocal calls
                if path.suffix == ".json":
                    calls += 1
                    if calls == 2:
                        raise OSError("TEST_ONLY_UNLINK_FAILED")
                return unlink(path, *args, **kwargs)

            with patch.object(Path, "unlink", failing_unlink):
                with self.assertRaises(OSError):
                    self.compact(root, preview)
            resumed = self.preview(root)
            self.assertTrue(resumed["pending"])
            self.assertEqual(resumed["plannedCount"], 2)
            with self.assertRaisesRegex(PARSER.ParserError, "MAINTENANCE_PENDING"):
                self.compact(root, resumed, "maintenance_other_12345678")
            new_id = "upload_" + resumed["generation"] + "_new_12345678"
            self.closed(root, new_id)
            result = self.compact(root, resumed)
            self.assertEqual(result["removedCount"], 2)
            self.assertEqual(
                self.request(root, "upload-receipt", requestId=new_id)["state"], "closed"
            )
            self.assertEqual(self.compact(root, preview), result)

    def test_final_reply_persistence_failure_keeps_plan_recoverable_without_repeating_generation(
        self,
    ):
        with tempfile.TemporaryDirectory() as root:
            self.closed(root, "upload_closed_12345678")
            preview = self.preview(root)
            write = PARSER._write_upload_epoch

            def fail_completed(storage, value):
                if value.get("latest", {}).get("state") == "completed":
                    raise OSError("TEST_ONLY_FINAL_WRITE_FAILED")
                return write(storage, value)

            with patch.object(PARSER, "_write_upload_epoch", side_effect=fail_completed):
                with self.assertRaises(OSError):
                    self.compact(root, preview)
            resumed = self.preview(root)
            self.assertTrue(resumed["pending"])
            self.assertEqual(resumed["closedCount"], 0)
            result = self.compact(root, resumed)
            self.assertEqual(result["generation"], resumed["generation"])
            self.assertEqual(result["removedCount"], 1)

    def test_retired_late_body_and_prepare_are_rejected_before_decode_or_original_write(self):
        with tempfile.TemporaryDirectory() as root:
            old_id = "upload_closed_12345678"
            self.closed(root, old_id)
            self.compact(root, self.preview(root))
            with patch.object(PARSER, "_store_original") as store:
                with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_RETIRED"):
                    PARSER.parse_material(
                        {
                            "requestId": old_id,
                            "storageId": PARSER.storage_identity(root),
                            "contentBase64": "INVALID",
                        },
                        root,
                    )
                with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_RETIRED"):
                    self.prepare(root, old_id)
                store.assert_not_called()
            retired = self.request(root, "close-upload", requestId=old_id)
            self.assertEqual(retired["originalStatus"], "unverified")
            self.assertNotIn("originalDeleted", retired)

    def test_removed_epoch_or_seal_fail_closed_instead_of_reenabling_legacy_registration(self):
        for name in ["epoch", "epoch-required"]:
            with tempfile.TemporaryDirectory() as root:
                self.closed(root, "upload_closed_12345678")
                self.compact(root, self.preview(root))
                (Path(root) / "upload-receipts" / name).unlink()
                with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_INVALID"):
                    self.prepare(root, "upload_old_12345678")
                self.assertEqual(list(Path(root).glob("*/original.*")), [])

    def test_corrupt_or_symlink_epoch_does_not_remove_receipts_or_touch_outside(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            self.closed(root, "upload_closed_12345678")
            preview = self.preview(root)
            path = Path(root) / "upload-receipts" / "epoch"
            original = path.read_bytes()
            for raw in [b"[]", b"{" + b"X" * 70000]:
                path.write_bytes(raw)
                with self.assertRaises(PARSER.ParserError):
                    self.compact(root, preview)
            path.unlink()
            target = Path(outside) / "protected"
            target.write_bytes(original)
            path.symlink_to(target)
            with self.assertRaises(PARSER.ParserError):
                self.compact(root, preview)
            self.assertEqual(target.read_bytes(), original)
            self.assertEqual(len(list(Path(root).glob("upload-receipts/*.json"))), 1)

    def test_malformed_pending_plan_and_null_file_id_fail_validation(self):
        with tempfile.TemporaryDirectory() as root:
            self.closed(root, "upload_closed_12345678")
            self.compact(root, self.preview(root))
            path = Path(root) / "upload-receipts" / "epoch"
            value = json.loads(path.read_text())
            value["latest"]["plan"] = [{}]
            path.write_text(json.dumps(value))
            with self.assertRaises(PARSER.ParserError):
                self.preview(root)
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root, "upload_open_12345678")
            value = PARSER._read_receipt(root, "upload_open_12345678")
            value.update(state="stored", fileId=None, owned=True, bodyFingerprint="a" * 64)
            PARSER._write_receipt(root, value)
            with self.assertRaises(PARSER.ParserError):
                self.preview(root)

    def test_full_512_closed_receipts_compact_below_original_bound_and_allow_new_registration(self):
        with tempfile.TemporaryDirectory() as root:
            for number in range(512):
                self.closed(root, f"upload_budget_{number:08d}")
            preview = self.preview(root)
            self.assertEqual(preview["closedCount"], 512)
            result = self.compact(root, preview)
            self.assertEqual(result["removedCount"], 512)
            self.assertEqual(list(Path(root).glob("upload-receipts/*.json")), [])
            self.prepare(root, "upload_" + result["generation"] + "_fresh_12345678")
            self.assertLessEqual((Path(root) / "upload-receipts" / "epoch").stat().st_size, 70000)
            self.assertEqual(PARSER.MAX_STORED, 50 * 1024 * 1024)

    def test_actual_http_auth_origin_preview_compact_replay_and_health_generation(self):
        with tempfile.TemporaryDirectory() as root:
            token = "TEST_ONLY_MAINTENANCE_HTTP_TOKEN_32_chars"
            origin = "http://localhost:5173"
            server = ThreadingHTTPServer(("127.0.0.1", 0), PARSER.make_handler(token, origin, root))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            headers = {
                "Authorization": "Bearer " + token,
                "Origin": origin,
                "Content-Type": "application/json",
            }
            base = f"http://127.0.0.1:{server.server_port}"

            def post(path, payload, supplied=headers):
                with urlopen(
                    Request(base + path, data=json.dumps(payload).encode(), headers=supplied),
                    timeout=5,
                ) as response:
                    return json.load(response)["data"]

            try:
                health = post("/health", {})
                identity = health["uploadRecovery"]["storageId"]
                self.assertTrue(health["uploadMaintenance"]["available"])
                for supplied in [
                    {},
                    {**headers, "Origin": "http://evil.local"},
                    {**headers, "Authorization": "Bearer wrong"},
                ]:
                    with self.assertRaises(HTTPError) as caught:
                        post(
                            "/parse",
                            {"action": "preview-upload-maintenance", "storageId": identity},
                            supplied,
                        )
                    self.assertEqual(caught.exception.code, 403)
                self.closed(root, "upload_closed_12345678")
                preview = post(
                    "/parse", {"action": "preview-upload-maintenance", "storageId": identity}
                )
                payload = {
                    "action": "compact-upload-receipts",
                    "storageId": identity,
                    "requestId": "maintenance_http_12345678",
                    "generation": preview["generation"],
                    "previewFingerprint": preview["previewFingerprint"],
                }
                with self.assertRaises(HTTPError) as caught:
                    post("/parse", {**payload, "contentBase64": "FORBIDDEN"})
                self.assertEqual(caught.exception.code, 422)
                result = post("/parse", payload)
                self.assertEqual(post("/parse", payload), result)
                self.assertEqual(
                    post("/health", {})["uploadMaintenance"]["generation"], result["generation"]
                )
                with self.assertRaises(HTTPError) as caught:
                    post(
                        "/parse",
                        {
                            "action": "prepare-upload",
                            "storageId": identity,
                            "requestId": "upload_closed_12345678",
                            "size": 4,
                        },
                    )
                self.assertEqual(caught.exception.code, 422)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)
