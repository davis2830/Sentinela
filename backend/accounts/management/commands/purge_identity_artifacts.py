from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import EmailChallenge, IdentityMail


class Command(BaseCommand):
    help = "Dry-run by default. Purge only expired identity artifacts older than 30 days, never users or audit."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=30)
        mails = IdentityMail.objects.filter(expires_at__lt=cutoff)
        challenges = EmailChallenge.objects.filter(expires_at__lt=cutoff)
        self.stdout.write(f"expired_mail={mails.count()} expired_challenges={challenges.count()} apply={options['apply']}")
        if options["apply"]:
            mails.delete()
            challenges.delete()
