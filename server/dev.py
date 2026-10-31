"""Serves the page and the API from one origin for local play."""
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app import app

app.mount("/", StaticFiles(directory=Path(__file__).parent.parent / "site", html=True))
