import unittest

from scripts.cleaning import build_math1_history_banks as builder


class Math1HistoryBanksTest(unittest.TestCase):
    def test_2018_uses_23_card_standard_structure_with_split_cross_page_prompt(self):
        spec = builder.SPECS[2018]

        self.assertEqual(builder.card_numbers_for_spec(spec), list(range(1, 24)))
        self.assertEqual(builder.expected_card_count(spec), 23)
        self.assertEqual(builder.section_for(spec, 1), "选择题")
        self.assertEqual(builder.section_for(spec, 8), "选择题")
        self.assertEqual(builder.section_for(spec, 9), "填空题")
        self.assertEqual(builder.section_for(spec, 14), "填空题")
        self.assertEqual(builder.section_for(spec, 15), "解答题")
        self.assertEqual(builder.type_for(spec, 1), "flashcard")
        self.assertEqual(builder.type_for(spec, 15), "short_answer")
        self.assertEqual(spec.question_pages[5], ["q05a", "q05b"])
        self.assertEqual(spec.source_id, "src_2cd530d0c9237cd5d84c348f")
        self.assertEqual(spec.file_name, "src_2cd530d0c9237cd5d84c348f-2018数一考研真题及答案.pdf")

    def test_2007_uses_24_card_10_choice_structure(self):
        spec = builder.SPECS[2007]

        self.assertEqual(builder.card_numbers_for_spec(spec), list(range(1, 25)))
        self.assertEqual(builder.expected_card_count(spec), 24)
        self.assertEqual(builder.section_for(spec, 1), "选择题")
        self.assertEqual(builder.section_for(spec, 10), "选择题")
        self.assertEqual(builder.section_for(spec, 11), "填空题")
        self.assertEqual(builder.section_for(spec, 16), "填空题")
        self.assertEqual(builder.section_for(spec, 17), "解答题")
        self.assertEqual(builder.type_for(spec, 1), "single_choice")
        self.assertEqual(builder.type_for(spec, 10), "single_choice")
        self.assertEqual(builder.type_for(spec, 11), "short_answer")
        self.assertEqual(spec.question_pages[9], ["q09a", "q09b"])
        self.assertEqual(spec.question_pages[19], ["q19a"])
        self.assertEqual(spec.question_pages[24], ["q24a", "q24b"])
        self.assertIn("q09b", spec.question_crop_masks)


if __name__ == "__main__":
    unittest.main()
