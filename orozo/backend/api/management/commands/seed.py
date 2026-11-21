from django.core.management.base import BaseCommand

from api.seed_data import seed_if_empty


class Command(BaseCommand):
    help = "Load ORZO languages, client accounts, and interpreters when the database is empty."

    def handle(self, *args, **options):
        created = seed_if_empty()
        if created:
            self.stdout.write(self.style.SUCCESS("Seeded ORZO client data."))
        else:
            self.stdout.write("ORZO data is already present.")
