from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_portal_sessions_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="interpretationsession",
            name="authorized_participant_ids",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="interpretationsession",
            name="client_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="interpretationsession",
            name="interpreter_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.CreateModel(
            name="Assignment",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("request_reference", models.CharField(db_index=True, max_length=64)),
                ("interpreter_id", models.CharField(db_index=True, max_length=64)),
                ("interpreter_name", models.CharField(max_length=160)),
                ("assigned_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("expires_at", models.DateTimeField()),
                ("outcome", models.CharField(default="pending", max_length=32)),
                ("responded_at", models.DateTimeField(blank=True, null=True)),
                ("reason", models.TextField(blank=True, default="")),
            ],
        ),
        migrations.CreateModel(
            name="Feedback",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("session_id", models.CharField(db_index=True, max_length=64)),
                ("rating", models.PositiveSmallIntegerField(default=0)),
                ("comment", models.TextField(blank=True, default="")),
                ("request_reference", models.CharField(blank=True, default="", max_length=64)),
                ("interpreter_id", models.CharField(blank=True, default="", max_length=64)),
                ("submitted_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.CreateModel(
            name="CompletionReport",
            fields=[
                ("id", models.CharField(max_length=64, primary_key=True, serialize=False)),
                ("session_id", models.CharField(db_index=True, max_length=64)),
                ("request_reference", models.CharField(db_index=True, max_length=64)),
                ("interpreter_id", models.CharField(blank=True, default="", max_length=64)),
                ("outcome", models.CharField(default="completed", max_length=64)),
                ("duration_minutes", models.PositiveIntegerField(default=0)),
                ("issue_code", models.CharField(blank=True, default="", max_length=64)),
                ("notes", models.TextField(blank=True, default="")),
                ("review_status", models.CharField(default="closed", max_length=64)),
                ("supervisor_resolution_note", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
    ]
