from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_assignment_feedback_session_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="account",
            name="password_hash",
            field=models.CharField(max_length=512),
        ),
    ]
