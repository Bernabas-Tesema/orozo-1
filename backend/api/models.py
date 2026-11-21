from datetime import timezone as dt_timezone

from django.db import models
from django.utils import timezone


class Account(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=160)
    role = models.CharField(max_length=32)
    client_account_type = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=32, default="active")
    password_hash = models.CharField(max_length=512)
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Organization account"
        verbose_name_plural = "Organizations"

    def __str__(self):
        return self.email


class WebSession(models.Model):
    """Bearer token sessions for the React portal (all roles)."""

    token = models.CharField(primary_key=True, max_length=64)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="web_sessions")
    created_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Portal web session"
        verbose_name_plural = "Portal web sessions"


class PlatformSettings(models.Model):
    """Singleton-style platform settings for the portal."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    assignment_timeout_seconds = models.PositiveIntegerField(default=45)
    max_auto_retries = models.PositiveIntegerField(default=3)
    emergency_priority_bypass = models.BooleanField(default=True)
    allow_direct_recording = models.BooleanField(default=False)
    maintenance_mode = models.BooleanField(default=False)
    telecom_low_bandwidth_preset = models.BooleanField(default=True)
    system_banner_notice = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Platform settings"
        verbose_name_plural = "Platform settings"

    def to_api(self) -> dict:
        return {
            "assignmentTimeoutSeconds": self.assignment_timeout_seconds,
            "maxAutoRetries": self.max_auto_retries,
            "emergencyPriorityBypass": self.emergency_priority_bypass,
            "allowDirectRecording": self.allow_direct_recording,
            "maintenanceMode": self.maintenance_mode,
            "telecomLowBandwidthPreset": self.telecom_low_bandwidth_preset,
            "systemBannerNotice": self.system_banner_notice,
        }


class Language(models.Model):
    code = models.CharField(primary_key=True, max_length=16)
    name = models.CharField(max_length=80)
    native_name = models.CharField(max_length=80)
    script = models.CharField(max_length=32)
    variants = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Supported language"
        verbose_name_plural = "Supported languages"


class Interpreter(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField()
    languages = models.JSONField(default=list)
    categories = models.JSONField(default=list)
    availability = models.CharField(max_length=32, default="offline")
    verification_state = models.CharField(max_length=32, default="pending")
    rating = models.FloatField(default=0)

    class Meta:
        verbose_name = "Accredited interpreter"
        verbose_name_plural = "Interpreter accreditation registry"


class InterpretationRequest(models.Model):
    reference = models.CharField(primary_key=True, max_length=64)
    requester_id = models.CharField(max_length=64, db_index=True)
    requester_name = models.CharField(max_length=160)
    requester_phone = models.CharField(max_length=32, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=16)
    target_language = models.CharField(max_length=16)
    is_unknown_language = models.BooleanField(default=False)
    unknown_language_notes = models.TextField(blank=True, null=True)
    service_category = models.CharField(max_length=64)
    urgency = models.CharField(max_length=32)
    modality = models.CharField(max_length=32)
    schedule_type = models.CharField(max_length=32)
    scheduled_time = models.CharField(max_length=40, blank=True, null=True)
    status = models.CharField(max_length=32, default="submitted", db_index=True)
    min_routing_context = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    assigned_interpreter_id = models.CharField(max_length=64, blank=True, null=True)
    assigned_interpreter_name = models.CharField(max_length=160, blank=True, null=True)
    active_session_id = models.CharField(max_length=64, blank=True, null=True)
    escalation_reason = models.TextField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)


class InterpretationSession(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    request_reference = models.CharField(max_length=64, db_index=True)
    session_token = models.CharField(max_length=128)
    status = models.CharField(max_length=32, default="created")
    communication_mode = models.CharField(max_length=32, default="audio")
    low_bandwidth_mode = models.BooleanField(default=True)
    recording_enabled = models.BooleanField(default=False)
    duration_seconds = models.PositiveIntegerField(default=0)
    interpreter_id = models.CharField(max_length=64, blank=True, null=True)
    interpreter_name = models.CharField(max_length=160, blank=True, null=True)
    client_id = models.CharField(max_length=64, blank=True, null=True)
    client_name = models.CharField(max_length=160, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=16, blank=True)
    target_language = models.CharField(max_length=16, blank=True)
    service_category = models.CharField(max_length=64, blank=True)
    connection_health = models.CharField(max_length=32, default="optimal")
    authorized_participant_ids = models.JSONField(default=list, blank=True)


class Assignment(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    request_reference = models.CharField(max_length=64, db_index=True)
    interpreter_id = models.CharField(max_length=64, db_index=True)
    interpreter_name = models.CharField(max_length=160)
    assigned_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    outcome = models.CharField(max_length=32, default="pending")
    responded_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default="")

    @staticmethod
    def _iso(dt):
        if not dt:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        # django.utils.timezone has no .utc — use datetime.timezone.utc
        return dt.astimezone(dt_timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    def to_api(self) -> dict:
        return {
            "id": self.id,
            "requestReference": self.request_reference,
            "interpreterId": self.interpreter_id,
            "interpreterName": self.interpreter_name,
            "assignedAt": self._iso(self.assigned_at),
            "expiresAt": self._iso(self.expires_at),
            "outcome": self.outcome,
            "respondedAt": self._iso(self.responded_at),
            "reason": self.reason or None,
        }


class Feedback(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    session_id = models.CharField(max_length=64, db_index=True)
    rating = models.PositiveSmallIntegerField(default=0)
    comment = models.TextField(blank=True, default="")
    request_reference = models.CharField(max_length=64, blank=True, default="")
    interpreter_id = models.CharField(max_length=64, blank=True, default="")
    submitted_at = models.DateTimeField(default=timezone.now)


class CompletionReport(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    session_id = models.CharField(max_length=64, db_index=True)
    request_reference = models.CharField(max_length=64, db_index=True)
    interpreter_id = models.CharField(max_length=64, blank=True, default="")
    outcome = models.CharField(max_length=64, default="completed")
    duration_minutes = models.PositiveIntegerField(default=0)
    issue_code = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    review_status = models.CharField(max_length=64, default="closed")
    supervisor_resolution_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    def to_api(self) -> dict:
        return {
            "id": self.id,
            "sessionId": self.session_id,
            "requestReference": self.request_reference,
            "interpreterId": self.interpreter_id,
            "outcome": self.outcome,
            "durationMinutes": self.duration_minutes,
            "issueCode": self.issue_code,
            "notes": self.notes,
            "reviewStatus": self.review_status,
            "supervisorResolutionNote": self.supervisor_resolution_note or None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Meeting(models.Model):
    """Group call / meeting created by a platform admin."""

    id = models.CharField(primary_key=True, max_length=64)
    title = models.CharField(max_length=200)
    creator_id = models.CharField(max_length=64)
    creator_name = models.CharField(max_length=160)
    communication_mode = models.CharField(max_length=32, default="video")
    status = models.CharField(max_length=32, default="active")  # active | ended
    created_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Group meeting"
        verbose_name_plural = "Group meetings"

    def to_api(self) -> dict:
        from django.utils import timezone as dt
        return {
            "id": self.id,
            "title": self.title,
            "creatorId": self.creator_id,
            "creatorName": self.creator_name,
            "communicationMode": self.communication_mode,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "endedAt": self.ended_at.isoformat() if self.ended_at else None,
            "participants": [
                p.to_api() for p in self.participants.all()
            ],
        }


class MeetingParticipant(models.Model):
    """Participant invited to a group meeting."""

    id = models.CharField(primary_key=True, max_length=64)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="participants")
    account_id = models.CharField(max_length=64, db_index=True)
    account_name = models.CharField(max_length=160)
    account_role = models.CharField(max_length=32, blank=True, default="")
    role = models.CharField(max_length=32, default="participant")  # host | participant
    status = models.CharField(max_length=32, default="invited")  # invited | joined | left
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Meeting participant"
        verbose_name_plural = "Meeting participants"

    def to_api(self) -> dict:
        return {
            "id": self.id,
            "accountId": self.account_id,
            "accountName": self.account_name,
            "accountRole": self.account_role,
            "role": self.role,
            "status": self.status,
            "joinedAt": self.joined_at.isoformat() if self.joined_at else None,
        }
