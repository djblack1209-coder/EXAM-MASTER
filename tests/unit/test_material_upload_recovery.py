import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import threading
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from tests.unit.test_private_material_parser import PARSER, make_pdf


class UploadRecoveryTests(unittest.TestCase):
    def prepare(self, root, request_id="upload_test_12345678", data=None):
        data = data or make_pdf(1)
        return PARSER.upload_action(
            {
                "action": "prepare-upload",
                "requestId": request_id,
                "storageId": PARSER.storage_identity(root),
                "size": len(data),
            },
            root,
        )

    def upload(self, root, request_id="upload_test_12345678", data=None):
        data = data or make_pdf(1)
        return PARSER.parse_material(
            {
                "requestId": request_id,
                "storageId": PARSER.storage_identity(root),
                "name": "Synthetic.pdf",
                "contentBase64": base64.b64encode(data).decode(),
                "allowOCR": False,
            },
            root,
        )

    def inspect(self, root, request_id="upload_test_12345678"):
        return PARSER.upload_action(
            {
                "action": "upload-receipt",
                "requestId": request_id,
                "storageId": PARSER.storage_identity(root),
            },
            root,
        )

    def close(self, root, request_id="upload_test_12345678"):
        return PARSER.upload_action(
            {
                "action": "close-upload",
                "requestId": request_id,
                "storageId": PARSER.storage_identity(root),
            },
            root,
        )

    def test_lost_first_reply_can_locate_original_and_resume_without_original_body(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            result = self.upload(
                root
            )  # Simulate a dropped response after the actual parser completed.
            receipt = self.inspect(root)
            self.assertEqual(receipt["state"], "stored")
            self.assertEqual(receipt["fileId"], result["original"]["connectorFileId"])
            resumed = PARSER.parse_material({"fileId": receipt["fileId"], "allowOCR": False}, root)
            self.assertEqual(resumed["fingerprint"], result["fingerprint"])
            self.assertNotIn("segments", receipt)
            self.assertNotIn("name", receipt)

    def test_prepared_intent_closed_before_late_body_never_creates_original(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            self.assertEqual(self.close(root)["state"], "closed")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CLOSED"):
                self.upload(root)
            self.assertEqual(list(Path(root).glob("*/original.*")), [])
            self.assertEqual(self.close(root)["state"], "closed")

    def test_parse_request_id_requires_registration_before_writing_original(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_NOT_PREPARED"):
                self.upload(root)
            self.assertEqual(list(Path(root).glob("*/original.*")), [])

    def test_close_lost_reply_original_is_confirmed_and_cannot_reappear_on_replay(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            self.upload(root)
            result = self.close(root)
            self.assertTrue(result["originalDeleted"])
            self.assertEqual(list(Path(root).glob("*/original.*")), [])
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CLOSED"):
                self.upload(root)
            self.assertEqual(self.inspect(root)["state"], "closed")

    def test_size_and_reused_request_content_conflicts_are_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CONFLICT"):
                self.prepare(root, data=make_pdf(2))
            self.upload(root)
            changed = make_pdf(1).replace(b"twelve", b"eleven")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CONFLICT"):
                self.upload(root, data=changed)

    def test_cancelling_duplicate_intent_preserves_existing_and_other_claimed_original(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            result = self.upload(root)
            self.prepare(root, "upload_other_12345678")
            self.upload(root, "upload_other_12345678")
            closed = self.close(root)
            self.assertTrue(closed["sharedOriginalRetained"])
            self.assertTrue((Path(root) / result["fingerprint"]).exists())
            self.assertEqual(self.inspect(root, "upload_other_12345678")["state"], "stored")

    def test_standard_original_delete_closes_claims_and_metadata_has_no_source_or_token(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            result = self.upload(root)
            PARSER.delete_material(result["fingerprint"], root)
            self.assertEqual(self.inspect(root)["state"], "closed")
            for path in Path(root).glob("upload-receipts/*.json"):
                text = path.read_text()
                self.assertNotIn("Synthetic.pdf", text)
                self.assertNotIn("Calculate", text)
                self.assertNotIn("contentBase64", text)

    def test_invalid_metadata_and_symlink_fail_closed(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            for value in [
                True,
                [],
                {"action": "prepare-upload", "requestId": "../escape", "size": 4},
                {
                    "action": "upload-receipt",
                    "requestId": "upload_test_12345678",
                    "token": "FORBIDDEN",
                },
            ]:
                with self.assertRaises(PARSER.ParserError):
                    PARSER.upload_action(value, root)
            for invalid_id in [int("1" * 64), True, "../outside"]:
                with self.assertRaisesRegex(PARSER.ParserError, "FILE_INVALID"):
                    PARSER.parse_material({"fileId": invalid_id}, root)
            (Path(root) / "upload-receipts").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(PARSER.ParserError):
                self.prepare(root)
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_receipt_directory_budget_does_not_evict_unknown_originals(self):
        with tempfile.TemporaryDirectory() as root:
            for index in range(PARSER.MAX_UPLOAD_RECEIPTS):
                self.prepare(root, f"upload_budget_{index:08d}")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_LIMIT"):
                self.prepare(root, "upload_overflow_12345678")
            self.assertEqual(self.inspect(root, "upload_budget_00000000")["state"], "prepared")

    def test_invalid_pdf_still_has_locatable_original_for_explicit_cleanup(self):
        data = b"%PDF-invalid-test-only"
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root, data=data)
            with self.assertRaisesRegex(PARSER.ParserError, "PARSER_FAILED:pdfinfo"):
                self.upload(root, data=data)
            self.assertEqual(self.inspect(root)["fileId"], hashlib.sha256(data).hexdigest())
            self.assertTrue(self.close(root)["originalDeleted"])

    def test_retargeted_storage_at_same_origin_rejects_old_metadata_and_body(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            storage_id = PARSER.storage_identity(first)
            self.prepare(first)
            for payload in [
                {
                    "action": "upload-receipt",
                    "requestId": "upload_test_12345678",
                    "storageId": storage_id,
                },
                {
                    "requestId": "upload_test_12345678",
                    "storageId": storage_id,
                    "contentBase64": base64.b64encode(make_pdf(1)).decode(),
                },
            ]:
                call = PARSER.upload_action if "action" in payload else PARSER.parse_material
                with self.assertRaisesRegex(PARSER.ParserError, "STORAGE_TARGET_CHANGED"):
                    call(payload, second)
            self.assertEqual(self.inspect(first)["state"], "prepared")
            self.assertEqual(list(Path(second).glob("*/original.*")), [])

    def test_receipt_write_failure_precedes_original_write(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            with patch.object(
                PARSER, "_write_receipt", side_effect=OSError("TEST_ONLY_RECEIPT_FAILURE")
            ):
                with self.assertRaises(OSError):
                    self.upload(root)
            self.assertEqual(list(Path(root).glob("*/original.*")), [])
            self.assertEqual(self.inspect(root)["state"], "prepared")

    def test_failed_raw_write_has_locatable_receiving_intent_and_explicit_close(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            with patch.object(
                PARSER, "_store_original", side_effect=OSError("TEST_ONLY_RAW_FAILURE")
            ):
                with self.assertRaises(OSError):
                    self.upload(root)
            receipt = self.inspect(root)
            self.assertEqual(receipt["state"], "absent")
            self.assertEqual(receipt["fileId"], hashlib.sha256(make_pdf(1)).hexdigest())
            self.assertTrue(self.close(root)["originalDeleted"])
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CLOSED"):
                self.upload(root)

    def test_failure_after_original_write_still_recovers_from_write_ahead_receipt(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            write = PARSER._write_receipt

            def fail_stored(storage, value):
                if value["state"] == "stored":
                    raise OSError("TEST_ONLY_AFTER_ORIGINAL")
                return write(storage, value)

            with patch.object(PARSER, "_write_receipt", side_effect=fail_stored):
                with self.assertRaises(OSError):
                    self.upload(root)
            receipt = self.inspect(root)
            self.assertEqual(receipt["state"], "stored")
            resumed = PARSER.parse_material(
                {"fileId": receipt["fileId"], "storageId": PARSER.storage_identity(root)}, root
            )
            self.assertEqual(resumed["fingerprint"], receipt["fileId"])
            self.assertTrue(self.close(root)["originalDeleted"])

    def test_delete_failure_leaves_closing_intent_no_late_body_and_retry_is_verified(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            self.upload(root)
            with patch.object(
                PARSER.shutil, "rmtree", side_effect=OSError("TEST_ONLY_DELETE_FAILURE")
            ):
                with self.assertRaises(OSError):
                    self.close(root)
            self.assertEqual(self.inspect(root)["state"], "closing")
            with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_CLOSED"):
                self.upload(root)
            self.assertTrue(self.close(root)["originalDeleted"])
            self.assertEqual(list(Path(root).glob("*/original.*")), [])

    def test_corrupt_receipt_flags_and_partial_original_are_not_promoted(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            result = self.upload(root)
            path = PARSER._receipt_path(root, "upload_test_12345678")
            value = json.loads(path.read_text())
            for field, invalid in [
                ("owned", "true"),
                ("fileId", int("1" * 64)),
                ("bodyFingerprint", "wrong"),
                ("originalDeleted", 1),
            ]:
                path.write_text(json.dumps({**value, field: invalid}))
                with self.assertRaisesRegex(PARSER.ParserError, "UPLOAD_INVALID"):
                    self.inspect(root)
            path.write_text(json.dumps(value))
            original = Path(root) / result["fingerprint"] / "original.pdf"
            original.write_bytes(b"%PDF-partial")
            self.assertEqual(self.inspect(root)["state"], "absent")
            with self.assertRaisesRegex(PARSER.ParserError, "FILE_INVALID"):
                PARSER.parse_material({"fileId": result["fingerprint"]}, root)
            self.assertTrue(self.close(root)["originalDeleted"])

    def test_preexisting_legacy_original_is_preserved_by_pending_cancel(self):
        with tempfile.TemporaryDirectory() as root:
            result = PARSER.parse_material(
                {"contentBase64": base64.b64encode(make_pdf(1)).decode()}, root
            )
            self.prepare(root)
            self.upload(root)
            receipt = self.close(root)
            self.assertFalse(receipt["originalDeleted"])
            self.assertTrue(receipt["sharedOriginalRetained"])
            self.assertTrue((Path(root) / result["fingerprint"] / "original.pdf").exists())

    def test_metadata_waits_for_active_original_write_and_returns_busy_without_mutation(self):
        with tempfile.TemporaryDirectory() as root:
            self.prepare(root)
            results = []
            with PARSER.LOCK:

                def check():
                    try:
                        self.close(root)
                    except PARSER.ParserError as error:
                        results.append(str(error))

                thread = threading.Thread(target=check)
                thread.start()
                thread.join(timeout=2)
                self.assertFalse(thread.is_alive())
            self.assertEqual(results, ["FILE_BUSY"])
            self.assertEqual(self.inspect(root)["state"], "prepared")

    def test_actual_http_registration_auth_origin_storage_and_tombstone_replay(self):
        with tempfile.TemporaryDirectory() as root:
            token = "TEST_ONLY_UPLOAD_HTTP_TOKEN_32_chars"
            origin = "http://localhost:5173"
            server = ThreadingHTTPServer(("127.0.0.1", 0), PARSER.make_handler(token, origin, root))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            headers = {
                "Authorization": "Bearer " + token,
                "Origin": origin,
                "Content-Type": "application/json",
            }
            endpoint = f"http://127.0.0.1:{server.server_port}/parse"

            def request(payload, supplied=headers):
                with urlopen(
                    Request(endpoint, data=json.dumps(payload).encode(), headers=supplied),
                    timeout=5,
                ) as response:
                    return json.load(response)["data"]

            try:
                storage_id = PARSER.storage_identity(root)
                prepare = {
                    "action": "prepare-upload",
                    "requestId": "upload_http_12345678",
                    "storageId": storage_id,
                    "size": len(make_pdf(1)),
                }
                for supplied in [
                    {},
                    {**headers, "Origin": "http://evil.local"},
                    {**headers, "Authorization": "Bearer wrong"},
                ]:
                    with self.assertRaises(HTTPError) as caught:
                        request(prepare, supplied)
                    self.assertEqual(caught.exception.code, 403)
                self.assertEqual(list(Path(root).glob("upload-receipts/*.json")), [])
                self.assertEqual(request(prepare)["state"], "prepared")
                for bad in [
                    {**prepare, "contentBase64": "FORBIDDEN"},
                    {**prepare, "storageId": "a" * 32},
                    [],
                ]:
                    with self.assertRaises(HTTPError) as caught:
                        request(bad)
                    self.assertEqual(caught.exception.code, 422)
                closed = request(
                    {
                        "action": "close-upload",
                        "requestId": prepare["requestId"],
                        "storageId": storage_id,
                    }
                )
                self.assertTrue(closed["originalDeleted"])
                with self.assertRaises(HTTPError) as caught:
                    request(
                        {
                            "requestId": prepare["requestId"],
                            "storageId": storage_id,
                            "contentBase64": base64.b64encode(make_pdf(1)).decode(),
                        }
                    )
                self.assertEqual(caught.exception.code, 422)
                self.assertEqual(list(Path(root).glob("*/original.*")), [])
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
