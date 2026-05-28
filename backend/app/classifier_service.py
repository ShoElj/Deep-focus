from app.classifier import classify_page as classify_page_with_keywords
from app.core.config import settings
from app.schemas import ClassifyRequest, ClassifyResponse


def classify_page(request: ClassifyRequest) -> ClassifyResponse:
    if settings.classifier_mode != "ml":
        return classify_page_with_keywords(request)

    try:
        from app.ml_classifier import classify_page_with_ml

        return classify_page_with_ml(request)
    except Exception:
        fallback_response = classify_page_with_keywords(request)
        fallback_response.reason = (
            "ML classifier unavailable. Used keyword fallback. "
            f"{fallback_response.reason}"
        )

        return fallback_response
