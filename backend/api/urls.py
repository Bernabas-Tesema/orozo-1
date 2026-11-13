from django.urls import path

from . import portal_views, views

urlpatterns = [
    # Auth & accounts (React portal)
    path("auth/me", portal_views.auth_me),
    path("auth/me/", portal_views.auth_me),
    path("auth/login", portal_views.auth_login),
    path("auth/login/", portal_views.auth_login),
    path("auth/logout", portal_views.auth_logout),
    path("auth/logout/", portal_views.auth_logout),
    path("auth/change-password", portal_views.auth_change_password),
    path("auth/setup-password", portal_views.auth_setup_password),
    path("auth/switch-role", portal_views.auth_switch_role),
    path("users", portal_views.users_list),
    path("users/", portal_views.users_list),
    # Catalog
    path("languages", portal_views.languages),
    path("interpreters", portal_views.interpreters),
    path("interpreters/<str:interpreter_id>", portal_views.interpreter_detail),
    path("availability", portal_views.availability),
    # Requests & sessions
    path("requests", portal_views.requests_collection),
    path("requests/<str:reference>", portal_views.request_detail),
    path("requests/<str:reference>/cancel", portal_views.cancel_request),
    path("assignments", portal_views.assignments),
    path("sessions/<str:session_id>", portal_views.session_detail),
    path("sessions/<str:session_id>/join", portal_views.session_join),
    path("sessions/<str:session_id>/heartbeat", portal_views.session_heartbeat),
    path("sessions/<str:session_id>/end", portal_views.session_end),
    path("sessions/<str:session_id>/livekit-token", portal_views.livekit_token),
    path("livekit/config", portal_views.livekit_config),
    path("completions", portal_views.completions),
    path("feedback", portal_views.feedback),
    # Ops
    path("notifications", portal_views.notifications),
    path("notifications/<str:notification_id>/read", portal_views.notification_read),
    path("platform-settings", portal_views.platform_settings),
    path("audit-logs", portal_views.audit_logs),
    path("supervisor/queue", portal_views.supervisor_queue),
    path("organizations", portal_views.organizations),
    path("supervisors", portal_views.supervisors),
    path("reports", portal_views.reports),
    path("reports/organization", portal_views.organization_report),
    path("support/chat", portal_views.support_chat),
    path("support/voice-question", portal_views.support_voice),
    path("support/identify-audio", portal_views.support_identify),
    # Legacy thin endpoints still used by some clients
    path("categories", views.categories),
]
