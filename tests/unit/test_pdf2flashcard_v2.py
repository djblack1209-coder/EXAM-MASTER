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


class RecordingClient(FakeClient):
    def __init__(self, response=None):
        self.response = response or FakeResponse()
        super().__init__(self.response)
        self.create_kwargs = []
        self.chat.completions = self

    def create(self, **kwargs):
        self.create_kwargs.append(kwargs)
        return self.response


class Pdf2FlashcardV2Test(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("AI_PROVIDER_DISABLED_LIST", None)
        os.environ.pop("LLM_DISABLED_PROVIDERS", None)
        os.environ.pop("AI_PROVIDER_DISABLED_KEYS", None)
        os.environ.pop("LLM_DISABLED_KEYS", None)
        os.environ.pop("LLM_REQUEST_TIMEOUT_SECONDS", None)
        os.environ.pop("LLM_MAX_TOKENS", None)
        os.environ.pop("PDF2FLASHCARD_BATCH_CHAR_LIMIT", None)
        os.environ.pop("TEST_LLM_API_KEY", None)

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

        self.assertEqual(bad_client.calls, 1)
        self.assertEqual(good_client.calls, 2)

    def test_ai_parse_text_falls_back_when_question_like_batch_returns_zero_cards(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            module.LLM_CACHE_PATH = Path(tmp) / "cache.json"
            module.LLM_USAGE_PATH = Path(tmp) / "usage.json"
            empty_response = FakeResponse(
                choices=[{"message": {"content": "[]"}, "finish_reason": "stop"}],
                msg=None,
                status=None,
                model="empty-model",
            )
            good_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 28, "type": "analysis", "question": "Q", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="fallback-model",
            )
            empty_client = CountingClient(empty_response)
            good_client = CountingClient(good_response)
            module.create_llm_backends = lambda: [
                {
                    "name": "empty",
                    "base_url": "https://empty.example/v1",
                    "model": "empty-model",
                    "client": empty_client,
                },
                {
                    "name": "fallback",
                    "base_url": "https://fallback.example/v1",
                    "model": "fallback-model",
                    "client": good_client,
                },
            ]
            question_like_text = "28. 结合材料回答下列问题。" + "材料文本" * 120

            cards = module.ai_parse_text(question_like_text, "politics", "2023")

        self.assertEqual(empty_client.calls, 1)
        self.assertEqual(good_client.calls, 1)
        self.assertEqual(cards[0]["number"], 28)

    def test_ai_parse_text_ignores_empty_cache_for_question_like_batch(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            module.LLM_CACHE_PATH = Path(tmp) / "cache.json"
            module.LLM_USAGE_PATH = Path(tmp) / "usage.json"
            question_like_text = "35. 结合材料回答问题。" + "材料文本" * 120
            cache_key = module.llm_cache_key(
                question_like_text,
                "politics",
                "2023",
                "https://cached.example/v1",
                "cached-model",
            )
            module.save_cached_cards(cache_key, [], len(question_like_text))
            good_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 35, "type": "analysis", "question": "Q", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="cached-model",
            )
            client = CountingClient(good_response)
            module.create_llm_backends = lambda: [
                {
                    "name": "cached",
                    "base_url": "https://cached.example/v1",
                    "model": "cached-model",
                    "client": client,
                }
            ]

            cards = module.ai_parse_text(question_like_text, "politics", "2023")

        self.assertEqual(client.calls, 1)
        self.assertEqual(cards[0]["number"], 35)

    def test_ai_parse_text_falls_back_when_question_like_batch_has_only_duplicate_numbers(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            module.LLM_CACHE_PATH = Path(tmp) / "cache.json"
            module.LLM_USAGE_PATH = Path(tmp) / "usage.json"
            first_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 34, "type": "analysis", "question": "Q34", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="first-model",
            )
            duplicate_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 34, "type": "analysis", "question": "Duplicate", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="duplicate-model",
            )
            good_response = FakeResponse(
                choices=[
                    {
                        "message": {
                            "content": '[{"number": 35, "type": "analysis", "question": "Q35", "options": [], "answer": "A"}]'
                        },
                        "finish_reason": "stop",
                    }
                ],
                msg=None,
                status=None,
                model="fallback-model",
            )
            duplicate_client = CountingClient(duplicate_response)
            good_client = CountingClient(good_response)
            first_client = CountingClient(first_response)
            module.split_text_into_batches = lambda _text: [
                "34. 结合材料回答问题。" + "材料文本" * 120,
                "35. 结合材料回答问题。" + "材料文本" * 120,
            ]
            module.create_llm_backends = lambda: [
                {
                    "name": "first",
                    "base_url": "https://first.example/v1",
                    "model": "first-model",
                    "client": first_client,
                },
                    {
                        "name": "duplicate",
                        "base_url": "https://duplicate.example/v1",
                        "model": "duplicate-model",
                        "client": duplicate_client,
                    },
                    {
                        "name": "fallback",
                        "base_url": "https://fallback.example/v1",
                        "model": "fallback-model",
                        "client": good_client,
                    },
            ]

            cards = module.ai_parse_text("ignored", "politics", "2023")

        self.assertEqual([card["number"] for card in cards], [34, 35])
        self.assertEqual(first_client.calls, 2)
        self.assertEqual(duplicate_client.calls, 1)
        self.assertEqual(good_client.calls, 1)

    def test_ai_parse_batch_passes_request_timeout(self):
        os.environ["LLM_REQUEST_TIMEOUT_SECONDS"] = "7.5"
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
            )
            client = RecordingClient(good_response)

            module.ai_parse_batch(
                client,
                "1. 示例题干 A. 甲 B. 乙 C. 丙 D. 丁",
                "english",
                "2000",
                max_retries=1,
            )

        self.assertEqual(client.create_kwargs[0]["timeout"], 7.5)

    def test_add_llm_backend_sets_client_timeout(self):
        os.environ["TEST_LLM_API_KEY"] = "test-key"
        module = load_pdf2flashcard_module()
        module.LLM_REQUEST_TIMEOUT_SECONDS = 9.5

        class FakeOpenAI:
            def __init__(self, **kwargs):
                self.kwargs = kwargs

        original_openai = module.OpenAI
        try:
            module.OpenAI = FakeOpenAI
            backends = []
            module.add_llm_backend(
                backends,
                set(),
                "test",
                "https://example.test/v1",
                "test-model",
                "TEST_LLM_API_KEY",
            )
        finally:
            module.OpenAI = original_openai

        self.assertEqual(backends[0]["client"].kwargs["timeout"], 9.5)

    def test_stable_backend_error_covers_quota_and_verification_failures(self):
        module = load_pdf2flashcard_module()

        stable_messages = [
            "Request too large for model on tokens per minute",
            "User not found.",
            "Access denied: please complete identity verification before trying again.",
            "AI Gateway requires a valid credit card on file",
            "The number of prompt tokens for free accounts is limited to 4096.",
        ]

        for message in stable_messages:
            with self.subTest(message=message):
                self.assertTrue(module.is_stable_backend_error(RuntimeError(message)))

    def test_env_controls_batch_size_and_token_limit(self):
        os.environ["PDF2FLASHCARD_BATCH_CHAR_LIMIT"] = "1800"
        os.environ["LLM_MAX_TOKENS"] = "2048"

        module = load_pdf2flashcard_module()

        self.assertEqual(module.BATCH_CHAR_LIMIT, 1800)
        self.assertEqual(module.LLM_MAX_TOKENS, 2048)

    def test_process_pdf_normalizes_politics_exam_type_distribution(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "flashcards"
            output_dir.mkdir()
            parsed_cards = [
                {"number": 16, "type": "single_choice", "question": "Q16", "options": [], "answer": "A"},
                {"number": 17, "type": "single_choice", "question": "Q17", "options": [], "answer": "C"},
                {"number": 28, "type": "single_choice", "question": "Q28", "options": [], "answer": "CD"},
                {"number": 33, "type": "single_choice", "question": "Q33", "options": [], "answer": "ABCD"},
                {"number": 34, "type": "single_choice", "question": "Q34", "options": [], "answer": "分析题答案"},
            ]

            module.OUTPUT_DIR = output_dir
            module.HASH_DB_PATH = Path(tmp) / "hashes.json"
            module.ocr_pdf = lambda _path: "政治真题文本"
            module.sanitize_text = lambda text: text
            module.ai_parse_text = lambda _text, _subject, _year: [dict(card) for card in parsed_cards]

            result = module.process_pdf("/tmp/source.pdf", "politics", "2023")

        by_number = {card["number"]: card for card in result["cards"]}
        self.assertEqual(by_number[16]["type"], "single_choice")
        self.assertEqual(by_number[17]["type"], "multi_choice")
        self.assertEqual(by_number[28]["type"], "multi_choice")
        self.assertEqual(by_number[33]["type"], "multi_choice")
        self.assertEqual(by_number[34]["type"], "analysis")

    def test_process_pdf_normalizes_english1_exam_type_distribution(self):
        module = load_pdf2flashcard_module()
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "flashcards"
            output_dir.mkdir()
            parsed_cards = [
                {"number": 40, "type": "analysis", "question": "Q40", "options": [], "answer": "A"},
                {"number": 41, "type": "analysis", "question": "Q41", "options": [], "answer": "C"},
                {"number": 45, "type": "analysis", "question": "Q45", "options": [], "answer": "G"},
                {"number": 46, "type": "analysis", "question": "Q46", "options": [{"label": "A", "text": "bad"}], "answer": "译文"},
                {"number": 50, "type": "analysis", "question": "Q50", "options": [{"label": "A", "text": "bad"}], "answer": "译文"},
                {"number": 51, "type": "analysis", "question": "Q51", "options": [{"label": "A", "text": "bad"}], "answer": "写作要求"},
                {"number": 52, "type": "analysis", "question": "Q52", "options": [{"label": "A", "text": "bad"}], "answer": "写作要求"},
            ]

            module.OUTPUT_DIR = output_dir
            module.HASH_DB_PATH = Path(tmp) / "hashes.json"
            module.ocr_pdf = lambda _path: "英语一真题文本"
            module.sanitize_text = lambda text: text
            module.ai_parse_text = lambda _text, _subject, _year: [dict(card) for card in parsed_cards]

            result = module.process_pdf("/tmp/source.pdf", "english1", "2018")

        by_number = {card["number"]: card for card in result["cards"]}
        self.assertEqual(by_number[40]["type"], "single_choice")
        self.assertEqual(by_number[41]["type"], "single_choice")
        self.assertEqual(by_number[45]["type"], "single_choice")
        self.assertEqual(by_number[46]["type"], "translation")
        self.assertEqual(by_number[46]["options"], [])
        self.assertEqual(by_number[50]["type"], "translation")
        self.assertEqual(by_number[51]["type"], "essay")
        self.assertEqual(by_number[51]["options"], [])
        self.assertEqual(by_number[52]["type"], "essay")

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
