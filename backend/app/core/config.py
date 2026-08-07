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
    
    # DB settings
    # Default to local sqlite for ease of local development if postgres is not available
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./trustgraph.db"
    )
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    class Config:
        case_sensitive = True

settings = Settings()
