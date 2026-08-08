import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "TrustGraph AI"
    API_V1_STR: str = "/api/v1"
    
    # JWT & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkeychangeinproduction1234567890!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database Settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./trustgraph.db"
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # CORS Settings
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "")
    BACKEND_CORS_ORIGINS_RAW: str = os.getenv("BACKEND_CORS_ORIGINS", "")

    @property
    def cors_origins(self) -> List[str]:
        origins: List[str] = []
        if self.FRONTEND_URL:
            origins.append(self.FRONTEND_URL.strip())
        if self.BACKEND_CORS_ORIGINS_RAW:
            for item in self.BACKEND_CORS_ORIGINS_RAW.split(","):
                if item.strip():
                    origins.append(item.strip())
        
        # Fallback for local development if no origin is specified
        if not origins:
            return ["*"]
        return list(set(origins))

    class Config:
        case_sensitive = True

settings = Settings()
