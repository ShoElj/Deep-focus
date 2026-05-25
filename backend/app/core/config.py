import os


class Settings:
    app_name: str = "Deep-Focus API"
    app_version: str = "0.1.0"

    def __init__(self) -> None:
        self.app_name = os.getenv("DEEP_FOCUS_APP_NAME", self.app_name)
        self.app_version = os.getenv("DEEP_FOCUS_APP_VERSION", self.app_version)


settings = Settings()
