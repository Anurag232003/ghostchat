import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
MEDIA_DIR = BASE_DIR / "uploads"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb+srv://ajha5678910_db_user:IY0ovFTYk2mtMkue@cluster0.bfsvwyk.mongodb.net/?appName=Cluster0"
)
DATABASE_NAME = os.getenv("DATABASE_NAME", "e2ee_anonymous_chat")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
