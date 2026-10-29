from django.urls import path

from . import views

urlpatterns = [
    path("languages", views.languages),
    path("categories", views.categories),
    path("auth/login", views.login),
    path("organizations", views.organizations),
    path("interpreters", views.interpreters),
    path("requests", views.requests_collection),
    path("requests/<str:reference>/cancel", views.cancel_request),
    path("sessions/<str:session_id>", views.session_detail),
    path("sessions/<str:session_id>/end", views.end_session),
    path("feedback", views.feedback),
]
