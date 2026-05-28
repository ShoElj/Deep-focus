import os


class Settings:
    app_name: str = "Deep-Focus API"
    app_version: str = "0.1.0"
    classifier_mode: str = "keyword"

    def __init__(self) -> None:
        self.app_name = os.getenv("DEEP_FOCUS_APP_NAME", self.app_name)
        self.app_version = os.getenv("DEEP_FOCUS_APP_VERSION", self.app_version)
        self.classifier_mode = self._read_classifier_mode()

    def _read_classifier_mode(self) -> str:
        mode = os.getenv("DEEP_FOCUS_CLASSIFIER_MODE", self.classifier_mode)
        normalized_mode = mode.strip().lower()

        if normalized_mode in {"keyword", "ml"}:
            return normalized_mode

        return "keyword"


settings = Settings()
