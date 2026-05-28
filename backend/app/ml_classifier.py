from functools import lru_cache
from importlib.util import find_spec

from app.classifier import (
    _is_neutral_navigation_page,
    _labels_for_request,
    DEFAULT_ALLOWED_KEYWORDS,
    DEFAULT_BLOCKED_KEYWORDS,
)
from app.schemas import ClassifyRequest, ClassifyResponse


MODEL_NAME = "facebook/bart-large-mnli"
ALLOWED_THRESHOLD = 0.55
BLOCKED_THRESHOLD = 0.50
MAX_INPUT_CHARS = 900


def is_ml_available() -> bool:
    return find_spec("transformers") is not None and find_spec("torch") is not None


def classify_page_with_ml(request: ClassifyRequest) -> ClassifyResponse:
    if _is_neutral_navigation_page(request):
        return ClassifyResponse(
            decision="allow",
            topLabel="navigation",
            score=1.0,
            reason="Navigation/search page allowed so the user can find focus-related content.",
        )

    allowed_labels = _labels_for_request(
        request.allowedCategories,
        DEFAULT_ALLOWED_KEYWORDS,
        not bool(request.categoriesUpdatedAt),
    )
    blocked_labels = _labels_for_request(
        request.blockedCategories,
        DEFAULT_BLOCKED_KEYWORDS,
        not bool(request.categoriesUpdatedAt),
    )
    text = _build_ml_input_text(request)

    if not text:
        return ClassifyResponse(
            decision="block",
            topLabel="non_focus",
            score=0.0,
            reason="This page does not clearly match your allowed focus categories.",
        )

    allowed_label, allowed_score = _score_categories(text, allowed_labels)
    blocked_label, blocked_score = _score_categories(text, blocked_labels)

    if blocked_score >= BLOCKED_THRESHOLD and blocked_score >= allowed_score:
        return ClassifyResponse(
            decision="block",
            topLabel=blocked_label,
            score=round(blocked_score, 2),
            reason=(
                "ML classifier matched a blocked distraction category "
                f"'{blocked_label}' with confidence {blocked_score:.2f}."
            ),
        )

    if allowed_score >= ALLOWED_THRESHOLD and allowed_score > blocked_score:
        return ClassifyResponse(
            decision="allow",
            topLabel=allowed_label,
            score=round(allowed_score, 2),
            reason=(
                "ML classifier matched an allowed focus category "
                f"'{allowed_label}' with confidence {allowed_score:.2f}."
            ),
        )

    if blocked_score >= BLOCKED_THRESHOLD:
        return ClassifyResponse(
            decision="block",
            topLabel=blocked_label,
            score=round(blocked_score, 2),
            reason=(
                "ML classifier found a stronger blocked signal than a clear focus match "
                f"for '{blocked_label}'."
            ),
        )

    return ClassifyResponse(
        decision="block",
        topLabel="non_focus",
        score=round(max(allowed_score, blocked_score), 2),
        reason="This page does not clearly match your allowed focus categories.",
    )


def _score_categories(text: str, labels: list[str]) -> tuple[str, float]:
    if not labels:
        return "non_focus", 0.0

    result = _get_pipeline()(text, labels, multi_label=True)
    top_label = str(result["labels"][0])
    top_score = float(result["scores"][0])

    return top_label, top_score


@lru_cache(maxsize=1)
def _get_pipeline():
    from transformers import pipeline

    return pipeline("zero-shot-classification", model=MODEL_NAME)


def _build_ml_input_text(request: ClassifyRequest) -> str:
    parts = [
        request.youtubeTitle,
        request.title,
        request.metaDescription,
        request.channelName,
    ]
    text = " ".join(part.strip() for part in parts if part and part.strip())

    return " ".join(text.split())[:MAX_INPUT_CHARS]
