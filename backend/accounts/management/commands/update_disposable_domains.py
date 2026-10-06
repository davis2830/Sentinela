import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from accounts.beta import audit, normalize_email
from accounts.models import DisposableDomainPolicy, User


class Command(BaseCommand):
    help = "Atomically install a reviewed local disposable-domain policy; invalid updates leave the last policy intact."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True)
        parser.add_argument("--operator", required=True)
        parser.add_argument("--reason", required=True)

    def handle(self, *args, **options):
        try:
            operator = User.objects.get(pk=options["operator"], is_active=True, is_superuser=True)
            data = json.loads(Path(options["file"]).read_text(encoding="utf-8"))
            version, domains = data["version"], data["domains"]
            if not isinstance(version, str) or not 1 <= len(version) <= 50:
                raise ValueError("Invalid version")
            if not isinstance(domains, list) or not 1 <= len(domains) <= 100000 or len(options["reason"].strip()) < 3:
                raise ValueError("Invalid domains/reason")
            normalized = []
            for domain in domains:
                if not isinstance(domain, str) or any(c in domain for c in "/:@[]") or "." not in domain:
                    raise ValueError("Invalid domain")
                normalized.append(normalize_email("policy@" + domain).split("@", 1)[1])
        except (ValueError, TypeError, KeyError, OSError, User.DoesNotExist):
            raise CommandError("Update rejected. Existing policy unchanged; validate file, operator and reason.") from None
        with transaction.atomic():
            DisposableDomainPolicy.objects.update_or_create(pk=1,
                defaults={"version": version, "domains": sorted(set(normalized))})
            audit(operator, f"Política de correos temporales actualizada a {version}. Motivo: {options['reason']}")
        self.stdout.write(f"Policy {version} installed ({len(set(normalized))} domains).")
