import os


class Settings:
    # Search API configuration
    SEARCH_API_PROVIDER: str = os.getenv("SEARCH_API_PROVIDER", "google")  # google, serpapi, brave
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GOOGLE_CSE_ID: str = os.getenv("GOOGLE_CSE_ID", "")
    SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
    BRAVE_API_KEY: str = os.getenv("BRAVE_API_KEY", "")

    # Rate limiting
    REQUEST_DELAY_MIN: float = float(os.getenv("REQUEST_DELAY_MIN", "3.0"))
    REQUEST_DELAY_MAX: float = float(os.getenv("REQUEST_DELAY_MAX", "5.0"))
    MAX_CONCURRENT: int = int(os.getenv("MAX_CONCURRENT", "1"))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./enrichment.db")
    DB_PATH: str = os.getenv("DB_PATH", "./enrichment.db")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
