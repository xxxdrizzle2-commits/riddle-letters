"""Safety checks for the offline OCR result contract; uses no model or images."""

import runpy
import unittest
from pathlib import Path


normalize_result = runpy.run_path(str(Path(__file__).with_name("ocr-offline.py")))["normalize_result"]


class OfflineOcrContractTests(unittest.TestCase):
    def test_preserves_recognized_words_and_maps_source_line(self):
        raw = {"res": {
            "rec_texts": ["我今添写错孒", "看不清□"],
            "rec_scores": [0.91, 0.45],
            "rec_polys": [
                [[10, 20], [90, 20], [90, 40], [10, 40]],
                [[10, 50], [90, 50], [90, 70], [10, 70]],
            ],
        }}
        result = normalize_result(raw, b"synthetic-image", 100, 100)
        self.assertEqual(result["lines"][0]["text"], "我今添写错孒")
        self.assertEqual(result["lines"][1]["text"], "看不清□")
        self.assertEqual(result["lines"][0]["polygon"], [0.1, 0.2, 0.9, 0.2, 0.9, 0.4, 0.1, 0.4])
        self.assertTrue(result["lines"][1]["uncertain"])
        self.assertTrue(result["humanReviewRequired"])
        self.assertNotIn("correctedText", result["lines"][0])

    def test_rejects_misaligned_or_outside_line_coordinates(self):
        raw = {"rec_texts": ["一行"], "rec_scores": [0.9], "rec_polys": []}
        with self.assertRaises(ValueError):
            normalize_result(raw, b"synthetic", 100, 100)
        raw["rec_polys"] = [[[0, 0], [101, 0], [101, 10], [0, 10]]]
        with self.assertRaises(ValueError):
            normalize_result(raw, b"synthetic", 100, 100)


if __name__ == "__main__":
    unittest.main()
