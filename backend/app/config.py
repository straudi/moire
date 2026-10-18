import os

from dotenv import load_dotenv

load_dotenv()


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


AI_MODE = env("AI_MODE", "auto")
AWS_REGION = env("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = env("BEDROCK_MODEL_ID")
OPENWEATHER_API_KEY = env("OPENWEATHER_API_KEY")
ALLOWED_ORIGINS = [o.strip() for o in env("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

USE_BEDROCK = AI_MODE != "dummy" and bool(BEDROCK_MODEL_ID)
USE_OPENWEATHER = bool(OPENWEATHER_API_KEY)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
RATE_LIMIT_PER_MINUTE = 20
