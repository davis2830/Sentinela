from django.core.management.base import BaseCommand, CommandError
from accounts.beta import delivery_configuration_errors


class Command(BaseCommand):
    help = "Read-only configuration gate; does not send mail or validate actual delivery."

    def handle(self, *args, **options):
        errors = delivery_configuration_errors()
        if errors:
            for error in errors:
                self.stderr.write(error)
            raise CommandError("Beta delivery configuration gate failed. Admissions must stay closed.")
        self.stdout.write("Configuration gate passed. Real delivery, DNS authentication and Turnstile still require validation.")
