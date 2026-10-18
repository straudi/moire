import os

# Tests never call real Bedrock/OpenWeatherMap, even when backend/.env has keys.
# Existing env vars win over .env (load_dotenv does not override), so set them before app import.
os.environ["AI_MODE"] = "dummy"
os.environ["OPENWEATHER_API_KEY"] = ""
