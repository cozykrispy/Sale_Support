import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Fusion Advantec - AI Sales Support Hub API"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sales_support.db")
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "fusion-advantec-super-secret-jwt-key-2026"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Requirement: Token valid for 1 hour (3600s)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1/chat/completions"
    DEFAULT_AI_MODEL: str = os.getenv(
        "DEFAULT_AI_MODEL", "cohere/north-mini-code:free"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
