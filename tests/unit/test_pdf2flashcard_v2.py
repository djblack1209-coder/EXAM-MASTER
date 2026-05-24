import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = PROJECT_ROOT / "scripts" / "pipeline" / "pdf2flashcard-v2.py"


def load_pdf2flashcard_module():
    spec = importlib.util.spec_from_file_location("pdf2flashcard_v2", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeMessage:
    content = None


class FakeResponse:
    def __init__(self, choices=None, msg="Model not support", status="435", model=None):
        self.choices = choices
        self.msg = msg
        self.status = status
        self.model = model

    def model_dump(self):
        return {
            "choices": self.choices,
            "msg": self.msg,
            "status": self.status,
            "model": self.model,
        }


class FakeCompletions:
    def __init__(self, response):
        self.response = response

    def create(self, **kwargs):
        return self.response


class FakeChat:
    def __init__(self, response):
        self.completions = FakeCompletions(response)


class FakeClient:
    def __init__(self, response=None):
        self.chat = FakeChat(response or FakeResponse())


class CountingClient(FakeClient):
    def __init__(self, response=None):
        self.response = response or FakeResponse()
        super().__init__(self.response)
        self.calls = 0
        self.chat.completions = self

    def create(self, **kwargs):
        self.calls += 1
        return self.response


class Pdf2FlashcardV2Test(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("AI_PROVIDER_DISABLED_LIST", None)
        os.environ.pop("LLM_DISABLED_PROVIDERS", None)
        os.environ.pop("AI_PROVIDER_DISABLED_KEYS", None)
        os.environ.pop("LLM_DISABLED_KEYS", None)

    def test_ai_parse_batch_raises_provider_error_when_choices_missing(self):
        module = load_pdf2flashcard_module()

        with self.assertRaisesRegex(RuntimeError, "Model not support"):
            module.ai_parse_batch(
                FakeClient(),
                "1. 示例题干 A. 甲 B. 乙 C. 丙 D. 丁",
                "english",
                "2000",
                max_retries=1,
            )

    def test_ai_parse_text_falls_back_to_next_configured_backend(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            module.LLM_CACHE_PATH = Path(tmp) / "cache.json"
            module.LLM_USAGE_PATH = Path(tmp) / "usage.json"
            good_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 1, "type": "single_choice", "question": "Q", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="fallback-model",
            )
            module.create_llm_backends = lambda: [
                {
                    "name": "bad",
                    "base_url": "https://bad.example/v1",
                    "model": "bad-model",
                    "client": FakeClient(),
                },
                {
                    "name": "fallback",
                    "base_url": "https://fallback.example/v1",
                    "model": "fallback-model",
                    "client": FakeClient(good_response),
                },
            ]

            cards = module.ai_parse_text("1. 示例题干 A. 甲 B. 乙 C. 丙 D. 丁", "english", "2000")

        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["number"], 1)

    def test_ai_parse_text_skips_stably_unsupported_backend_after_first_batch(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            module.LLM_CACHE_PATH = Path(tmp) / "cache.json"
            module.LLM_USAGE_PATH = Path(tmp) / "usage.json"
            bad_client = CountingClient(FakeResponse())
            good_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 1, "type": "single_choice", "question": "Q", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="fallback-model",
            )
            good_client = CountingClient(good_response)
            module.split_text_into_batches = lambda _text: ["batch one", "batch two"]
            module.create_llm_backends = lambda: [
                {
                    "name": "bad",
                    "base_url": "https://bad.example/v1",
                    "model": "bad-model",
                    "client": bad_client,
                },
                {
                    "name": "fallback",
                    "base_url": "https://fallback.example/v1",
                    "model": "fallback-model",
                    "client": good_client,
                },
            ]

            module.ai_parse_text("ignored", "english", "2000")

        self.assertEqual(bad_client.calls, 3)
        self.assertEqual(good_client.calls, 2)

    def test_provider_disabled_merges_global_and_local_disable_lists(self):
        module = load_pdf2flashcard_module()
        os.environ["AI_PROVIDER_DISABLED_LIST"] = "iflow"
        os.environ["LLM_DISABLED_PROVIDERS"] = "llm_primary"

        self.assertTrue(module.provider_disabled("iflow", "IFLOW_API_KEY"))
        self.assertTrue(module.provider_disabled("llm_primary", "LLM_API_KEY"))

    def test_process_pdf_keeps_current_paper_cards_when_question_seen_in_other_year(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "flashcards"
            output_dir.mkdir()
            hash_db = Path(tmp) / "hashes.json"
            existing_output = output_dir / "english1-2001.json"
            existing_output.write_text(
                '{"total_cards": 1, "cards": [{"id": "existing", "answer": "A"}]}\n',
                encoding="utf-8",
            )
            repeated_across_years = {
                "number": 1,
                "type": "single_choice",
                "question": "Question text that appeared in another paper",
                "options": [],
                "answer": "A",
                "explanation": "",
            }

            module.OUTPUT_DIR = output_dir
            module.HASH_DB_PATH = hash_db
            module.ocr_pdf = lambda _path: "1. Question text that appeared in another paper"
            module.sanitize_text = lambda text: text
            module.ai_parse_text = lambda _text, _subject, _year: [dict(repeated_across_years)]
            hash_db.write_text(f'["{module.card_hash(repeated_across_years)}"]', encoding="utf-8")

            result = module.process_pdf("/tmp/source.pdf", "english1", "2001")

            self.assertEqual(result["total_cards"], 1)
            self.assertEqual(result["cards"][0]["id"], "english1-2001-001")
            self.assertNotEqual(result["cards"][0]["id"], "existing")

    def test_process_pdf_dedupes_repeated_batch_output_within_current_paper(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "flashcards"
            output_dir.mkdir()

            duplicate_card = {
                "number": 1,
                "type": "single_choice",
                "question": "Duplicate question emitted by overlapping batches",
                "options": [],
                "answer": "A",
                "explanation": "",
            }

            module.OUTPUT_DIR = output_dir
            module.HASH_DB_PATH = Path(tmp) / "hashes.json"
            module.ocr_pdf = lambda _path: "1. Duplicate question emitted by overlapping batches"
            module.sanitize_text = lambda text: text
            module.ai_parse_text = lambda _text, _subject, _year: [dict(duplicate_card), dict(duplicate_card)]

            result = module.process_pdf("/tmp/source.pdf", "english1", "2001")

            self.assertEqual(result["total_cards"], 1)
            self.assertEqual(len(result["cards"]), 1)


if __name__ == "__main__":
    unittest.main()
