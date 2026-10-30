"""Run a local PP-OCRv6 baseline or normalize its JSON for synthetic adult letters.

This script never uploads an image. The generated JSON is sensitive research data:
keep it in a task-specific D: directory and do not commit real correspondence.
PaddleOCR is an optional, separately provisioned dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


def _private_output_path(raw: str) -> Path:
    path = Path(raw).resolve()
    if os.name == "nt" and path.drive.upper() != "D:":
        raise ValueError("OCR output must be on the D: drive")
    return path


def _prediction(raw: dict[str, Any]) -> dict[str, Any]:
    value = raw.get("res", raw)
    if not isinstance(value, dict):
        raise ValueError("PaddleOCR result has no prediction object")
    return value


def normalize_result(raw: dict[str, Any], image_bytes: bytes, width: int, height: int, *, page: int = 1) -> dict[str, Any]:
    """Keep model text verbatim and map every recognized line to the source image."""
    if width <= 0 or height <= 0:
        raise ValueError("image dimensions must be positive")
    prediction = _prediction(raw)
    texts = prediction.get("rec_texts")
    scores = prediction.get("rec_scores")
    polygons = prediction.get("rec_polys")
    if not isinstance(texts, list) or not isinstance(scores, list) or not isinstance(polygons, list):
        raise ValueError("PaddleOCR result must contain rec_texts, rec_scores and rec_polys")
    if not (len(texts) == len(scores) == len(polygons)):
        raise ValueError("PaddleOCR line arrays have different lengths")

    lines: list[dict[str, Any]] = []
    for index, (model_text, score, polygon) in enumerate(zip(texts, scores, polygons)):
        if not isinstance(model_text, str) or not isinstance(score, (int, float)) or isinstance(score, bool):
            raise ValueError(f"line {index} has invalid text or confidence")
        if not 0 <= score <= 1 or not isinstance(polygon, list) or len(polygon) != 4:
            raise ValueError(f"line {index} has invalid confidence or polygon")
        normalized: list[float] = []
        for point in polygon:
            if not isinstance(point, list) or len(point) != 2:
                raise ValueError(f"line {index} has an invalid polygon point")
            x, y = point
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)) or not 0 <= x <= width or not 0 <= y <= height:
                raise ValueError(f"line {index} has an out-of-image point")
            normalized.extend((round(x / width, 6), round(y / height, 6)))
        lines.append({
            "id": f"line-{page}-{index + 1}",
            "pageIndex": page - 1,
            "text": model_text,
            "confidence": round(float(score), 6),
            "polygon": normalized,
            "uncertain": score < 0.7,
        })

    return {
        "schemaVersion": 1,
        "engine": "PaddleOCR",
        "engineVersion": "PP-OCRv6",
        "sourceSha256": hashlib.sha256(image_bytes).hexdigest(),
        "page": page,
        "imageWidth": width,
        "imageHeight": height,
        "lines": lines,
        "status": "completed",
        "humanReviewRequired": True,
    }


def _run_paddle(image: Path, cache_dir: Path) -> dict[str, Any]:
    # Set all known model/cache roots before importing PaddleOCR. No task data go to C:.
    cache_dir.mkdir(parents=True, exist_ok=True)
    for key in ("PADDLE_HOME", "PADDLEX_HOME", "HF_HOME", "XDG_CACHE_HOME"):
        os.environ[key] = str(cache_dir)
    try:
        from paddleocr import PaddleOCR  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("PaddleOCR is not installed; use --paddle-json or provision it separately on D:") from exc
    engine = PaddleOCR(
        ocr_version="PP-OCRv6",
        lang="ch",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    predictions = engine.predict(str(image))
    if len(predictions) != 1:
        raise ValueError("Expected exactly one page; process each page separately")
    return predictions[0].json


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, type=Path, help="Synthetic adult handwriting PNG/JPEG")
    parser.add_argument("--output", required=True, help="Private normalized JSON on D:")
    parser.add_argument("--paddle-json", type=Path, help="Existing official PaddleOCR result JSON; skips model execution")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--cache-dir", type=Path, default=Path("D:/CodexData/work/riddle-ocr-cache"))
    args = parser.parse_args()
    image = args.image.resolve()
    output = _private_output_path(args.output)
    if args.page < 1 or not image.is_file():
        parser.error("image must exist and page must be at least 1")
    try:
        from PIL import Image  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("Pillow is needed to read image dimensions") from exc
    with Image.open(image) as source:
        if source.format not in ("PNG", "JPEG"):
            raise ValueError("Only PNG/JPEG input is supported")
        width, height = source.size
    image_bytes = image.read_bytes()
    raw = json.loads(args.paddle_json.read_text(encoding="utf-8")) if args.paddle_json else _run_paddle(image, _private_output_path(str(args.cache_dir)))
    result = normalize_result(raw, image_bytes, width, height, page=args.page)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(result['lines'])} model lines to {output}")


if __name__ == "__main__":
    main()
