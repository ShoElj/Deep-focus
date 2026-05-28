from fastapi import APIRouter

from app.core.config import settings
from app.ml_classifier import is_ml_available
from app.models.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        classifierMode=settings.classifier_mode,
        mlAvailable=is_ml_available(),
    )


@router.get("/version")
def version() -> dict[str, str]:
    return {"version": settings.app_version}
