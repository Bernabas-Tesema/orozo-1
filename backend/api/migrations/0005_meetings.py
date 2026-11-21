from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_account_password_hash_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Meeting",
            fields=[
                (
                    "id",
                    models.CharField(max_length=64, primary_key=True, serialize=False),
                ),
                ("title", models.CharField(max_length=200)),
                ("creator_id", models.CharField(max_length=64)),
                ("creator_name", models.CharField(max_length=160)),
                (
                    "communication_mode",
                    models.CharField(max_length=32, default="video"),
                ),
                ("status", models.CharField(max_length=32, default="active")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Group meeting",
                "verbose_name_plural": "Group meetings",
            },
        ),
        migrations.CreateModel(
            name="MeetingParticipant",
            fields=[
                (
                    "id",
                    models.CharField(max_length=64, primary_key=True, serialize=False),
                ),
                ("account_id", models.CharField(db_index=True, max_length=64)),
                ("account_name", models.CharField(max_length=160)),
                ("account_role", models.CharField(blank=True, default="", max_length=32)),
                ("role", models.CharField(default="participant", max_length=32)),
                ("status", models.CharField(default="invited", max_length=32)),
                ("joined_at", models.DateTimeField(blank=True, null=True)),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="participants",
                        to="api.meeting",
                    ),
                ),
            ],
            options={
                "verbose_name": "Meeting participant",
                "verbose_name_plural": "Meeting participants",
            },
        ),
    ]
