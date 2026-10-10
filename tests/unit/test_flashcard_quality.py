from pathlib import Path
import json
import hashlib
import subprocess
import sys
import tempfile
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
SCRIPT = PROJECT_ROOT / "scripts" / "baidu" / "flashcard_quality.py"


def write_bank(directory: Path, name: str, cards: list[dict]) -> Path:
    path = directory / name
    path.write_text(
        json.dumps(
            {
                "source": name.replace(".json", ".pdf"),
                "subject": "english",
                "year": "2024",
                "total_cards": len(cards),
                "cards": cards,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def digest(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


class FlashcardQualityTest(unittest.TestCase):
    def test_supplement_answers_reject_source_or_answer_forgery_even_with_new_payload_hash(self):
        import copy
        from scripts.baidu import answer_evidence_repair as repair
        from scripts.baidu.flashcard_quality import politics_reference_proof_matches
        from tests.unit.test_answer_evidence_repair import politics_primary_fixture

        sources = [
            PROJECT_ROOT / "data/raw-inbox" / repair.POLITICS_REFERENCE_SOURCES[role][0]
            for role in ["question", "answer"]
        ]
        supplement = PROJECT_ROOT / "data/raw-inbox" / repair.POLITICS_SUPPLEMENT_SOURCE[0]
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "politics-2023.json"
            target.write_bytes(politics_primary_fixture())
            repair.restore_politics_reference(
                target, *sources, supplement_source=supplement, write=True
            )
            cards = json.loads(target.read_text())["cards"]
            for card in [cards[9], cards[10]]:
                self.assertTrue(politics_reference_proof_matches(card, "politics-2023"))
                for key, value in [
                    ("answer", "C"),
                    ("question", "forged question"),
                    ("options", []),
                ]:
                    damaged = copy.deepcopy(card)
                    damaged[key] = value
                    proof = damaged["answerEvidence"]["referenceProof"]
                    proof["contentHash"] = repair.hash_text(
                        json.dumps(
                            repair.politics_reference_payload(damaged, proof),
                            ensure_ascii=False,
                            sort_keys=True,
                        )
                    )
                    self.assertFalse(
                        politics_reference_proof_matches(damaged, "politics-2023"), key
                    )
                for key, value in [
                    ("page", 2),
                    ("number", 12),
                    ("filePath", "wrong.pdf"),
                    ("sourceBlockSha256", digest("forged")),
                    ("scoringAuthority", True),
                    ("rightsStatus", "verified"),
                ]:
                    damaged = copy.deepcopy(card)
                    proof = damaged["answerEvidence"]["referenceProof"]
                    proof["supplementProof"][key] = value
                    proof["contentHash"] = repair.hash_text(
                        json.dumps(
                            repair.politics_reference_payload(damaged, proof),
                            ensure_ascii=False,
                            sort_keys=True,
                        )
                    )
                    self.assertFalse(
                        politics_reference_proof_matches(damaged, "politics-2023"), key
                    )

    def test_politics_reference_is_source_bound_and_cannot_be_promoted_by_flags(self):
        import copy
        from scripts.baidu import answer_evidence_repair as repair
        from scripts.baidu.flashcard_quality import (
            audit_flashcard_file,
            politics_reference_proof_matches,
        )
        from tests.unit.test_answer_evidence_repair import politics_primary_fixture

        sources = [
            PROJECT_ROOT / "data/raw-inbox" / repair.POLITICS_REFERENCE_SOURCES[role][0]
            for role in ["question", "answer"]
        ]
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "politics-2023.json"
            target.write_bytes(politics_primary_fixture())
            repair.restore_politics_reference(target, *sources, write=True)
            payload = json.loads(target.read_text())
            self.assertTrue(
                all(politics_reference_proof_matches(c, target.stem) for c in payload["cards"])
            )
            self.assertEqual(
                audit_flashcard_file(target, payload)["sourceEvidenceBlockerCount"], 38
            )
            card = payload["cards"][2]
            for key, value in [
                ("question", "forged question"),
                ("answer", "D"),
                ("options", [{"key": "A", "text": "forged"}]),
                ("id", "politics-2023-004"),
            ]:
                damaged = copy.deepcopy(card)
                damaged[key] = value
                proof = damaged["answerEvidence"]["referenceProof"]
                proof["contentHash"] = repair.hash_text(
                    json.dumps(
                        repair.politics_reference_payload(damaged, proof),
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                )
                self.assertFalse(politics_reference_proof_matches(damaged, target.stem), key)
            for key, value in [
                ("answerFilePath", "data/raw-inbox/replacement.pdf"),
                ("answerFileSha256", digest("forged source")),
                ("sourceRole", "official_answer"),
                ("scoringAuthority", True),
            ]:
                damaged = copy.deepcopy(card)
                damaged["answerEvidence"]["referenceProof"][key] = value
                self.assertFalse(politics_reference_proof_matches(damaged, target.stem), key)
            promoted = copy.deepcopy(payload)
            promoted.pop("publicationStatus")
            promoted.pop("publicationBlockers")
            for c in promoted["cards"]:
                c["answerEvidenceStatus"] = c["answerEvidence"]["status"] = "matched"
                c["answerEvidence"].pop("referenceProof")
            self.assertEqual(
                audit_flashcard_file(target, promoted)["sourceEvidenceBlockerCount"], 38
            )

    def test_missing_cloze_blank_rejected_even_with_recomputed_full_payload_proof(self):
        import copy
        from scripts.baidu.flashcard_quality import audit_flashcard_file
        from scripts.baidu.english_passage_repair import cloze_source_payload, hash_text

        for year in [2006, 2007, 2010]:
            path = PROJECT_ROOT / f"src/config/flashcard-banks/english1-{year}.json"
            card = json.loads(path.read_text())["cards"][0]
            self.assertEqual(
                audit_flashcard_file(path, {"cards": [card]})["sourceEvidenceBlockerCount"], 0
            )
            damaged = copy.deepcopy(card)
            for key in ["passage", "context", "material"]:
                damaged[key] = damaged[key].replace("[1]", "")
            damaged["passageSegments"] = [s.replace("[1]", "") for s in damaged["passageSegments"]]
            proof = damaged["sourceEvidence"]["questionProof"]
            proof["contentHash"] = hash_text(
                json.dumps(cloze_source_payload(damaged, proof), ensure_ascii=False, sort_keys=True)
            )
            self.assertEqual(
                audit_flashcard_file(path, {"cards": [damaged]})["sourceEvidenceBlockerCount"], 1
            )

    def test_registered_translation_and_ordering_proofs_reject_scope_and_payload_drift(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        for bank_id, number in [
            ("english1-2007", 46),
            ("english1-2010", 41),
            ("english1-2010", 48),
        ]:
            path = PROJECT_ROOT / "src/config/flashcard-banks" / (bank_id + ".json")
            card = next(c for c in json.loads(path.read_text())["cards"] if c["number"] == number)
            self.assertEqual(
                audit_flashcard_file(path, {"cards": [card]})["sourceEvidenceBlockerCount"], 0
            )
            for change in [
                {"targetSegment": "changed"},
                {"fixedSequence": ["41", "E", "42"]},
                {"passage": card["passage"] + " changed"},
                {"sourceEvidence": {**card["sourceEvidence"], "questionProof": None}},
                {"number": 99},
            ]:
                self.assertEqual(
                    audit_flashcard_file(path, {"cards": [{**card, **change}]})[
                        "sourceEvidenceBlockerCount"
                    ],
                    1,
                )

    def test_restored_cloze_full_source_proof_rejects_drift_and_stripping(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        for bank_id in ["english1-2006", "english1-2007", "english1-2010"]:
            path = PROJECT_ROOT / "src/config/flashcard-banks" / (bank_id + ".json")
            card = json.loads(path.read_text())["cards"][0]
            with self.subTest(bank=bank_id):
                self.assertEqual(
                    audit_flashcard_file(path, {"cards": [card]})["sourceEvidenceBlockerCount"], 0
                )
                for change in [
                    {"passage": card["passage"] + " changed"},
                    {"context": card["context"] + " changed"},
                    {"answer": "B" if card["answer"] == "A" else "A"},
                    {"passageSegments": ["changed"]},
                    {"sourceEvidence": {**card["sourceEvidence"], "questionProof": None}},
                    {
                        "sourceEvidence": {
                            **card["sourceEvidence"],
                            "questionProof": {
                                **card["sourceEvidence"]["questionProof"],
                                "sourceFileSha256": digest("different"),
                            },
                        }
                    },
                ]:
                    self.assertEqual(
                        audit_flashcard_file(path, {"cards": [{**card, **change}]})[
                            "sourceEvidenceBlockerCount"
                        ],
                        1,
                    )

    def test_composite_payload_fields_and_registered_page_shapes_remain_bound(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        path = PROJECT_ROOT / "src/config/flashcard-banks/english2-2014.json"
        card = json.loads(path.read_text())["cards"][0]
        changes = [
            {
                "options": [
                    {**card["options"][0], "text": card["options"][0]["text"] + " altered"},
                    *card["options"][1:],
                ]
            },
            {"passage": card["passage"] + " altered"},
            {"material": card.get("material", "") + " altered"},
            {"answerEvidence": {**card["answerEvidence"], "evidenceRole": "different_role"}},
            {"answerEvidence": {**card["answerEvidence"], "answerTextHash": digest("different")}},
        ]
        for change in changes:
            with self.subTest(change=change):
                self.assertEqual(
                    audit_flashcard_file(path, {"cards": [{**card, **change}]})[
                        "sourceEvidenceBlockerCount"
                    ],
                    1,
                )
        for bank_id, number in [
            ("math1-2023", 7),
            ("math2-2014", 22),
            ("math3-2010", 20),
            ("math1-2025", 1),
        ]:
            with self.subTest(bank=bank_id):
                path = PROJECT_ROOT / "src/config/flashcard-banks" / (bank_id + ".json")
                card = next(
                    c for c in json.loads(path.read_text())["cards"] if c["number"] == number
                )
                self.assertEqual(
                    audit_flashcard_file(path, {"cards": [card]})["sourceEvidenceBlockerCount"], 0
                )
                self.assertEqual(
                    audit_flashcard_file(path, {"cards": [{**card, "questionImages": []}]})[
                        "sourceEvidenceBlockerCount"
                    ],
                    1,
                )

    def test_hash_batch_rejects_unknown_sources_extra_fields_and_limits_without_quality_writes(
        self,
    ):
        cases = [
            [{"bankId": "../private", "text": "x"}],
            [{"bankId": "english2-2014", "text": "x", "path": "/private"}],
            [{"bankId": "english2-2014", "text": "x" * 65537}],
            [{"bankId": "english2-2014", "text": "x"}] * 2049,
        ]
        for rows in cases:
            with self.subTest(size=len(rows)):
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "--legacy-hash-batch"],
                    input=json.dumps(rows),
                    capture_output=True,
                    text=True,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")

    def test_registered_composite_digest_binds_actual_payload_without_changing_cards(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        for bank_id in [
            "math1-2013",
            "math3-2017",
            "english1-2013",
            "english2-2014",
            "english2-2015",
            "english1-2022",
            "english1-2024",
            "politics-2024",
        ]:
            with self.subTest(bank=bank_id):
                source = PROJECT_ROOT / "src/config/flashcard-banks" / (bank_id + ".json")
                card = json.loads(source.read_text())["cards"][0]
                before = json.dumps(card)
                report = audit_flashcard_file(source, {"cards": [card]})
                self.assertEqual(report["sourceEvidenceBlockerCount"], 0)
                self.assertEqual(json.dumps(card), before)
                for field in ["question", "answer"]:
                    changed = {**card, field: card[field] + " altered"}
                    self.assertEqual(
                        audit_flashcard_file(source, {"cards": [changed]})[
                            "sourceEvidenceBlockerCount"
                        ],
                        1,
                    )

    def test_empty_or_malformed_card_payloads_cannot_pass(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        valid = {
            "id": "synthetic",
            "type": "short_answer",
            "question": "Find 2 + 3.",
            "answer": "5",
            "sourceEvidenceId": "synthetic",
            "answerEvidenceStatus": "matched",
            "questionTextHash": digest("Find 2 + 3."),
            "answerTextHash": digest("5"),
        }
        for payload, reason in [
            ([], "cards=empty"),
            ({"cards": []}, "cards=empty"),
            ({}, "cards=invalid_shape"),
            ({"cards": "invalid", "questions": [valid]}, "cards=invalid_shape"),
            ({"cards": [None]}, "cards=invalid_entries"),
            ({"cards": [valid, False]}, "cards=invalid_entries"),
        ]:
            with self.subTest(reason=reason, payload=payload):
                before = json.dumps(payload)
                report = audit_flashcard_file(Path("math1-2099.json"), payload)
                self.assertEqual(report["status"], "blocked")
                self.assertIn(reason, report["publicationBlockers"])
                self.assertEqual(json.dumps(payload), before)
        for payload in [[valid], {"questions": [valid]}]:
            with self.subTest(legacy=payload):
                self.assertEqual(
                    audit_flashcard_file(Path("math1-2099.json"), payload)["status"], "passed"
                )

    def test_empty_release_scope_is_not_publishable(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            for mode in ["empty", "support", "outside"]:
                with self.subTest(mode=mode):
                    if mode == "support":
                        (directory / "support.json").write_text(
                            json.dumps({"supportingEvidenceOnly": True, "cards": []})
                        )
                    if mode == "outside":
                        (directory / "outside.json").write_text(
                            json.dumps({"year": 2001, "cards": []})
                        )
                    report = build_quality_report(directory)
                    self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
                    self.assertEqual(report["summary"]["emptyScopeBlockerCount"], 1)

    def test_strict_cli_rejects_empty_input_without_writing_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            directory = root / "input"
            directory.mkdir()
            output = root / "report.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--flashcard-dir",
                    str(directory),
                    "--output",
                    str(output),
                    "--fail-on-blockers",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertEqual(list(directory.iterdir()), [])
            self.assertFalse(
                json.loads(output.read_text())["releaseReadiness"]["canPromoteToPublic"]
            )

    def test_digest_aliases_and_cleaning_whitespace_keep_content_boundaries(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        card = {
            "id": "synthetic",
            "type": "short_answer",
            "question": "Find 2 + 3.",
            "answer": "5",
            "sourceEvidenceId": "synthetic-source",
            "answerEvidenceStatus": "matched",
            "questionTextHash": digest("Find 2 + 3."),
            "answerTextHash": digest("5"),
        }
        cases = [
            ({"questionTextHash": "\u0085" + card["questionTextHash"] + "\u3000"}, False),
            ({"answerTextHash": "\ufeff" + card["answerTextHash"]}, True),
            ({"question": "\u001cFind\u00852\t+\n3.\u3000"}, False),
            ({"question": "\ufeffFind 2 + 3."}, True),
            ({"question": "Find 2 + 3?"}, True),
            (
                {
                    "questionTextHash": "sha256:placeholder",
                    "sourceEvidence": {"questionTextHash": card["questionTextHash"]},
                },
                True,
            ),
            ({"question_text_hash": digest("Different question")}, True),
            ({"sourceEvidence": {"questionTextHash": digest("Different question")}}, True),
            (
                {
                    "questionTextHash": None,
                    "answerTextHash": None,
                    "sourceEvidence": {
                        "questionTextHash": card["questionTextHash"],
                        "answerTextHash": card["answerTextHash"],
                    },
                },
                False,
            ),
            (
                {
                    "questionTextHash": None,
                    "answerTextHash": None,
                    "question_text_hash": card["questionTextHash"],
                    "answer_text_hash": card["answerTextHash"],
                },
                False,
            ),
        ]
        for changes, blocked in cases:
            with self.subTest(changes=changes):
                current = {**card, **changes}
                before = json.dumps(current)
                report = audit_flashcard_file(Path("math1-2099.json"), {"cards": [current]})
                self.assertEqual(report["sourceEvidenceBlockerCount"], int(blocked))
                self.assertEqual(report["status"], "blocked" if blocked else "passed")
                self.assertEqual(json.dumps(current), before)

    def test_stale_matched_digests_block_changed_content(self):
        from scripts.baidu.flashcard_quality import audit_flashcard_file

        original = {
            "id": "synthetic",
            "type": "short_answer",
            "question": "Find 2 + 3.",
            "answer": "5",
            "sourceEvidenceId": "synthetic-source",
            "answerEvidenceStatus": "matched",
            "questionTextHash": digest("Find 2 + 3."),
            "answerTextHash": digest("5"),
        }
        for field, value in [("question", "Find 2 + 4."), ("answer", "6")]:
            with self.subTest(field=field):
                card = {**original, field: value}
                report = audit_flashcard_file(Path("math1-2099.json"), {"cards": [card]})
                self.assertEqual(report["status"], "blocked")
                self.assertEqual(report["sourceEvidenceBlockerCount"], 1)
                self.assertIn(
                    field + "TextHash=content_mismatch", report["blockedCards"][0]["missingFields"]
                )

    def test_report_blocks_missing_answers_and_unmatched_source_evidence(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                    },
                    {
                        "id": "english-2024-002",
                        "type": "single_choice",
                        "question": "Question 2",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "",
                    },
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["fileCount"], 1)
        self.assertEqual(report["summary"]["cardCount"], 2)
        self.assertEqual(report["summary"]["missingAnswerCount"], 1)
        self.assertEqual(report["summary"]["sourceEvidenceBlockerCount"], 2)
        self.assertEqual(report["files"][0]["status"], "blocked")
        self.assertEqual(report["files"][0]["blockedCards"][1]["cardId"], "english-2024-002")
        self.assertIn("answer", report["files"][0]["blockedCards"][1]["missingFields"])

    def test_report_treats_known_answer_placeholders_as_missing(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-041",
                        "type": "analysis",
                        "question": "Question 41",
                        "options": [],
                        "answer": "完整的参考答案全文",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertEqual(report["summary"]["missingAnswerCount"], 1)
        self.assertIn("answer", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_report_allows_answer_matched_cards_with_hashes(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Question 1"),
                        "answerTextHash": digest("A"),
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)
        self.assertEqual(report["files"][0]["status"], "passed")

    def test_report_allows_english_gap_fill_questions_with_a_to_g_options(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-041",
                        "type": "single_choice",
                        "question": "Choose the most suitable paragraph.",
                        "options": [
                            {"label": "A", "text": "Option A"},
                            {"label": "B", "text": "Option B"},
                            {"label": "C", "text": "Option C"},
                            {"label": "D", "text": "Option D"},
                            {"label": "E", "text": "Option E"},
                            {"label": "F", "text": "Option F"},
                            {"label": "G", "text": "Option G"},
                        ],
                        "answer": "E",
                        "sourceEvidenceId": "src_ev_english_2024_041",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Choose the most suitable paragraph."),
                        "answerTextHash": digest("E"),
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)

    def test_report_allows_english_gap_fill_questions_with_a_to_h_options(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2023.json",
                [
                    {
                        "id": "english-2023-041",
                        "type": "single_choice",
                        "question": "Choose the most suitable paragraph.",
                        "options": [
                            {"label": "A", "text": "Option A"},
                            {"label": "B", "text": "Option B"},
                            {"label": "C", "text": "Option C"},
                            {"label": "D", "text": "Option D"},
                            {"label": "E", "text": "Option E"},
                            {"label": "F", "text": "Option F"},
                            {"label": "G", "text": "Option G"},
                            {"label": "H", "text": "Option H"},
                        ],
                        "answer": "F",
                        "sourceEvidenceId": "src_ev_english_2023_041",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Choose the most suitable paragraph."),
                        "answerTextHash": digest("F"),
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["blockerCount"], 0)

    def test_report_counts_invalid_choice_options_as_grading_blocker(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Question 1"),
                        "answerTextHash": digest("A"),
                        "passage": "Full source passage.",
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["gradingBlockerCount"], 1)
        self.assertIn("options=A-D-or-A-G", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_report_blocks_draft_publication_status_even_when_cards_are_structured(
        self,
    ):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            path = write_bank(
                flashcard_dir,
                "english1-2025-draft.json",
                [
                    {
                        "id": "english1-2025-021",
                        "type": "single_choice",
                        "question": "Question 21",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "C",
                        "sourceEvidenceId": "src_ev_english_2025_021",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Question 21"),
                        "answerTextHash": digest("C"),
                    }
                ],
            )
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["publicationStatus"] = "draft"
            path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["publicationBlockerCount"], 1)
        self.assertEqual(report["files"][0]["status"], "blocked")
        self.assertIn("publicationStatus=draft", report["files"][0]["publicationBlockers"])

    def test_report_skips_supporting_evidence_files(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_001",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Question 1"),
                        "answerTextHash": digest("A"),
                        "passage": "Full source passage.",
                    }
                ],
            )
            support_path = write_bank(
                flashcard_dir,
                "english-support-abcd1234-2024.json",
                [
                    {
                        "id": "support-001",
                        "type": "single_choice",
                        "question": "Support only",
                        "options": [],
                        "answer": "",
                    }
                ],
            )
            support_payload = json.loads(support_path.read_text(encoding="utf-8"))
            support_payload["supportingEvidenceOnly"] = True
            support_path.write_text(
                json.dumps(support_payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            report = build_quality_report(flashcard_dir)

        self.assertTrue(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["fileCount"], 1)
        self.assertEqual(report["summary"]["skippedFileCount"], 1)
        self.assertEqual(report["summary"]["missingAnswerCount"], 0)
        self.assertEqual(report["skippedFiles"][0]["reason"], "supportingEvidenceOnly")

    def test_report_skips_files_outside_release_year_scope_by_default(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english1-2001.json",
                [
                    {
                        "id": "english1-2001-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                    }
                ],
            )
            payload_path = flashcard_dir / "english1-2001.json"
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
            payload["year"] = "2001"
            payload_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            report = build_quality_report(flashcard_dir)

        self.assertEqual(report["summary"]["fileCount"], 0)
        self.assertEqual(report["summary"]["skippedFileCount"], 1)
        self.assertEqual(report["skippedFiles"][0]["reason"], "outsideReleaseYear:2001")

    def test_report_blocks_english_choice_cards_without_passage_material(self):
        from scripts.baidu.flashcard_quality import build_quality_report

        with tempfile.TemporaryDirectory() as tmp:
            flashcard_dir = Path(tmp)
            write_bank(
                flashcard_dir,
                "english1-2024.json",
                [
                    {
                        "id": "english1-2024-021",
                        "type": "single_choice",
                        "question": "Question 21",
                        "options": [
                            {"label": "A", "text": "A"},
                            {"label": "B", "text": "B"},
                            {"label": "C", "text": "C"},
                            {"label": "D", "text": "D"},
                        ],
                        "answer": "A",
                        "sourceEvidenceId": "src_ev_english_2024_021",
                        "answerEvidenceStatus": "matched",
                        "questionTextHash": digest("Question 21"),
                        "answerTextHash": digest("A"),
                    }
                ],
            )

            report = build_quality_report(flashcard_dir)

        self.assertFalse(report["releaseReadiness"]["canPromoteToPublic"])
        self.assertEqual(report["summary"]["gradingBlockerCount"], 1)
        self.assertIn("passage", report["files"][0]["blockedCards"][0]["missingFields"])

    def test_cli_fail_on_blockers_exits_two_and_writes_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            flashcard_dir = tmp_dir / "flashcards"
            flashcard_dir.mkdir()
            output = tmp_dir / "quality.json"
            write_bank(
                flashcard_dir,
                "english-2024.json",
                [
                    {
                        "id": "english-2024-001",
                        "type": "single_choice",
                        "question": "Question 1",
                        "options": [],
                        "answer": "",
                    }
                ],
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--flashcard-dir",
                    str(flashcard_dir),
                    "--output",
                    str(output),
                    "--fail-on-blockers",
                ],
                cwd=PROJECT_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 2)
            self.assertTrue(output.exists())
            self.assertIn("canPromoteToPublic=False", result.stdout)


if __name__ == "__main__":
    unittest.main()
