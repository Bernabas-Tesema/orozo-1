"""cPanel / Phusion Passenger entry point for the ORZO Django API."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Ensure the backend package root is importable when Passenger starts from HOME.
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Load .env before Django settings import (passenger may not inject all vars).
env_path = BASE_DIR / ".env"
if env_path.exists():
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from config.wsgi import application  # noqa: E402
