from django.contrib.auth.hashers import make_password
from django.db import migrations, models


def set_demo_passwords(apps, schema_editor):
    Account = apps.get_model("api", "Account")
    hashed = make_password("orzo")
    Account.objects.filter(password_hash="").update(password_hash=hashed)
    if not Account.objects.filter(pk="usr-admin-1").exists():
        Account.objects.create(
            id="usr-admin-1",
            email="admin.dawit@elip.et",
            full_name="Dawit Mengistu",
            role="platform_admin",
            client_account_type="",
            phone="+251 91 888 9999",
            organization_name="Ministry of Innovation & Technology / ELIP Operations",
            status="active",
            password_hash=hashed,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="password_hash",
            field=models.CharField(default="", max_length=256),
        ),
        migrations.RunPython(set_demo_passwords, migrations.RunPython.noop),
    ]
