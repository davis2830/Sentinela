"""Read-only legacy review. Does not infer verification or normalize existing data."""
from collections import defaultdict
from django.core.management.base import BaseCommand
from accounts.beta import normalize_email
from accounts.models import User, BetaControl


class Command(BaseCommand):
    help = "Report legacy verification and canonical email collisions without modifying accounts."

    def handle(self, *args, **options):
        canonical = defaultdict(list)
        for user in User.objects.only("id", "email").iterator():
            try:
                canonical[normalize_email(user.email)].append(str(user.pk))
            except ValueError:
                self.stdout.write(f"invalid-email user_id={user.pk}")
        collisions = 0
        for ids in canonical.values():
            if len(ids) > 1:
                collisions += 1
                self.stdout.write("canonical-collision user_ids=" + ",".join(ids))
        self.stdout.write(f"legacy_unverified={User.objects.filter(verification_required=False, email_verified_at=None).count()} canonical_collisions={collisions}")
        control = BetaControl.objects.get(pk=1)
        self.stdout.write(f"admissions_open={control.admissions_open} capacity={control.capacity}; no changes applied")
