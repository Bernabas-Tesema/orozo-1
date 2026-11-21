from django.db import models


class Account(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=160)
    role = models.CharField(max_length=32)
    client_account_type = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    organization_name = models.CharField(max_length=200)
    status = models.CharField(max_length=32, default="active")
    password_hash = models.CharField(max_length=256, default="")

    def to_api(self):
        return {
            "id": self.id,
            "email": self.email,
            "fullName": self.full_name,
            "role": self.role,
            "clientAccountType": self.client_account_type or None,
            "phone": self.phone,
            "organizationName": self.organization_name,
            "status": self.status,
        }


class Language(models.Model):
    code = models.CharField(primary_key=True, max_length=8)
    name = models.CharField(max_length=80)
    native_name = models.CharField(max_length=80)
    script = models.CharField(max_length=16)
    variants = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    def to_api(self):
        return {
            "code": self.code,
            "name": self.name,
            "nativeName": self.native_name,
            "script": self.script,
            "variants": self.variants,
            "isActive": self.is_active,
        }


class Interpreter(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField()
    languages = models.JSONField(default=list)
    categories = models.JSONField(default=list)
    availability = models.CharField(max_length=16, default="available")
    verification_state = models.CharField(max_length=16, default="verified")
    rating = models.FloatField(default=4.8)

    def to_api(self):
        return {
            "id": self.id,
            "fullName": self.full_name,
            "languages": self.languages,
            "categories": self.categories,
            "availability": self.availability,
            "verificationState": self.verification_state,
            "rating": self.rating,
            "email": self.email,
            "phone": self.phone,
        }


class InterpretationRequest(models.Model):
    reference = models.CharField(primary_key=True, max_length=32)
    requester_id = models.CharField(max_length=64)
    requester_name = models.CharField(max_length=160)
    requester_phone = models.CharField(max_length=40, blank=True)
    organization_name = models.CharField(max_length=200)
    source_language = models.CharField(max_length=16)
    target_language = models.CharField(max_length=16)
    is_unknown_language = models.BooleanField(default=False)
    unknown_language_notes = models.TextField(blank=True)
    service_category = models.CharField(max_length=32)
    urgency = models.CharField(max_length=16, default="standard")
    modality = models.CharField(max_length=24, default="audio")
    schedule_type = models.CharField(max_length=16, default="immediate")
    scheduled_time = models.CharField(max_length=40, blank=True, null=True)
    status = models.CharField(max_length=32, default="submitted")
    min_routing_context = models.TextField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    assigned_interpreter_id = models.CharField(max_length=64, blank=True, null=True)
    assigned_interpreter_name = models.CharField(max_length=160, blank=True, null=True)
    active_session_id = models.CharField(max_length=32, blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    escalation_reason = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def to_api(self):
        return {
            "reference": self.reference,
            "requesterId": self.requester_id,
            "requesterName": self.requester_name,
            "requesterPhone": self.requester_phone,
            "organizationName": self.organization_name,
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "isUnknownLanguage": self.is_unknown_language,
            "unknownLanguageNotes": self.unknown_language_notes,
            "serviceCategory": self.service_category,
            "urgency": self.urgency,
            "modality": self.modality,
            "scheduleType": self.schedule_type,
            "scheduledTime": self.scheduled_time,
            "status": self.status,
            "minRoutingContext": self.min_routing_context,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "assignedInterpreterId": self.assigned_interpreter_id,
            "assignedInterpreterName": self.assigned_interpreter_name,
            "activeSessionId": self.active_session_id,
            "cancellationReason": self.cancellation_reason,
            "escalationReason": self.escalation_reason,
        }


class InterpretationSession(models.Model):
    id = models.CharField(primary_key=True, max_length=32)
    request_reference = models.CharField(max_length=32)
    session_token = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default="ready_to_join")
    communication_mode = models.CharField(max_length=24, default="audio")
    low_bandwidth_mode = models.BooleanField(default=True)
    recording_enabled = models.BooleanField(default=False)
    duration_seconds = models.PositiveIntegerField(default=0)
    interpreter_name = models.CharField(max_length=160, blank=True)
    client_name = models.CharField(max_length=160)
    organization_name = models.CharField(max_length=200)
    source_language = models.CharField(max_length=16)
    target_language = models.CharField(max_length=16)
    service_category = models.CharField(max_length=32)
    connection_health = models.CharField(max_length=16, default="optimal")

    def to_api(self):
        return {
            "id": self.id,
            "requestReference": self.request_reference,
            "sessionToken": self.session_token,
            "status": self.status,
            "communicationMode": self.communication_mode,
            "lowBandwidthMode": self.low_bandwidth_mode,
            "recordingEnabled": self.recording_enabled,
            "durationSeconds": self.duration_seconds,
            "interpreterName": self.interpreter_name or None,
            "clientName": self.client_name,
            "organizationName": self.organization_name,
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "serviceCategory": self.service_category,
            "connectionHealth": self.connection_health,
        }


class SessionFeedback(models.Model):
    session_id = models.CharField(max_length=32)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
