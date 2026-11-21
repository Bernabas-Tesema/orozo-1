from django.urls import include, path

from api.views import home

urlpatterns = [
    path("", home),
    path("api", home),
    path("api/", home),
    path("api/v1/", include("api.urls")),
]
