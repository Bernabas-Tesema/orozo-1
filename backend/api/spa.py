"""Serve the built React portal from Django (cPanel Python app, no Node)."""

from pathlib import Path
from typing import Optional

from django.conf import settings
from django.http import FileResponse, Http404, HttpRequest, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie


def _frontend_dir() -> Path:
    configured = getattr(settings, "FRONTEND_DIST", None)
    if configured:
        return Path(configured)
    return Path(settings.BASE_DIR) / "frontend_dist"


def _safe_file(rel_path: str) -> Optional[Path]:
    root = _frontend_dir().resolve()
    candidate = (root / rel_path.lstrip("/")).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


@ensure_csrf_cookie
def spa_index(_request: HttpRequest) -> HttpResponse:
    index = _safe_file("index.html")
    if index is None:
        return HttpResponse(
            "<!doctype html><html><body style='font-family:sans-serif;padding:2rem'>"
            "<h1>ORZO portal build missing</h1>"
            "<p>Build the React app into <code>backend/frontend_dist</code> then restart.</p>"
            "<pre>npm run build:web</pre>"
            "<p>Django admin remains at <a href='/admin/'>/admin/</a>.</p>"
            "</body></html>",
            status=503,
            content_type="text/html; charset=utf-8",
        )
    response = FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response


def spa_asset(request: HttpRequest, asset_path: str = "") -> HttpResponse:
    """Serve a file from frontend_dist, or fall back to index.html for SPA routes."""
    raw = asset_path if asset_path is not None else request.path
    path = str(raw).lstrip("/")

    # Hard block: never serve the SPA for API/admin/static paths
    first = path.split("/", 1)[0].lower() if path else ""
    if first in ("api", "admin", "static", "django-api"):
        raise Http404("Not a frontend route")

    # Bare domain → landing / auth shell
    if path in ("", "index.html"):
        return spa_index(request)

    file_path = _safe_file(path)
    if file_path is not None:
        content_type = None
        suffix = file_path.suffix.lower()
        if suffix == ".js":
            content_type = "application/javascript"
        elif suffix == ".css":
            content_type = "text/css"
        elif suffix == ".svg":
            content_type = "image/svg+xml"
        elif suffix == ".json":
            content_type = "application/json"
        elif suffix == ".png":
            content_type = "image/png"
        elif suffix in (".jpg", ".jpeg"):
            content_type = "image/jpeg"
        elif suffix == ".ico":
            content_type = "image/x-icon"
        elif suffix == ".woff2":
            content_type = "font/woff2"
        return FileResponse(file_path.open("rb"), content_type=content_type)

    # Client-side routes → landing / role workspaces
    return spa_index(request)
