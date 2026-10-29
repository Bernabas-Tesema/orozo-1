from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        from django.db.models.signals import post_migrate

        from .seed_data import seed_if_empty

        post_migrate.connect(lambda **kwargs: seed_if_empty(), sender=self)
