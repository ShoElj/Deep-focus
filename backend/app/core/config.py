from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Deep-Focus API"
    app_version: str = "0.1.0"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="DEEP_FOCUS_")


settings = Settings()

