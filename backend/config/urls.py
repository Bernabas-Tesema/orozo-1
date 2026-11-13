from django.contrib import admin
from django.urls import include, path, re_path

from api.spa import spa_asset, spa_index
from api.views import home

urlpatterns = [
    path("admin/", admin.site.urls),
    # JSON API must be registered before the SPA catch-all
    path("api/v1/", include("api.urls")),
    path("api/sessions/", include("communications.urls_direct")),
    path("api/communications/", include("communications.urls")),
    path("api", home),
    path("api/", home),
    # React portal — never steal /api/, /admin/, or /static/
    re_path(
        r"^(?!api(?:/|$)|admin(?:/|$)|static(?:/|$)).*$",
        spa_asset,
    ),
]
