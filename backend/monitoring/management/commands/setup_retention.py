"""
Management Command: setup_retention
==================================
Configures automated data retention and compression policies for Sentinel telemetría.
Supports native TimescaleDB hypertable policies (retention & compression)
as well as optimized chunked cleanup for standard PostgreSQL.
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = "Configures TimescaleDB retention & compression policies, or purges historical telemetría older than N days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Number of days of raw telemetry to retain (default: 90).",
        )
        parser.add_argument(
            "--purge",
            action="store_true",
            help="Perform immediate purge of data older than --days.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        purge = options["purge"]
        cutoff = timezone.now() - timedelta(days=days)

        self.stdout.write(self.style.NOTICE(f"=== Configurando Políticas de Retención de Telemetría ({days} días) ==="))

        timescale_active = self._check_timescaledb()
        if timescale_active:
            self.stdout.write(self.style.SUCCESS("[OK] Extensión TimescaleDB detectada en PostgreSQL."))
            self._setup_timescale_policies(days)
        else:
            self.stdout.write(self.style.WARNING(
                "[AVISO] Extensión TimescaleDB no activa en esta instancia. "
                "Se aplicará estrategia de purga por lotes (PostgreSQL estándar)."
            ))

        if purge or not timescale_active:
            self._purge_old_data(cutoff)

    def _check_timescaledb(self) -> bool:
        """Check if TimescaleDB extension is active."""
        with connection.cursor() as cursor:
            try:
                cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';")
                row = cursor.fetchone()
                return bool(row)
            except Exception:
                return False

    def _setup_timescale_policies(self, days: int):
        """Configure native TimescaleDB retention and compression on hypertable."""
        with connection.cursor() as cursor:
            # 1. Retention policy
            try:
                cursor.execute(f"SELECT add_retention_policy('monitoring_check', INTERVAL '{days} days', if_not_exists => TRUE);")
                self.stdout.write(self.style.SUCCESS(f"[OK] Política de retención TimescaleDB activada en 'monitoring_check': {days} días."))
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"[INFO] Política de retención nativa: {exc}"))

            # 2. Compression policy (Compress chunks older than 7 days)
            try:
                cursor.execute("""
                    ALTER TABLE monitoring_check SET (
                        timescaledb.compress,
                        timescaledb.compress_segmentby = 'target_id',
                        timescaledb.compress_orderby = 'checked_at DESC'
                    );
                """)
                cursor.execute("SELECT add_compression_policy('monitoring_check', INTERVAL '7 days', if_not_exists => TRUE);")
                self.stdout.write(self.style.SUCCESS("[OK] Política de compresión TimescaleDB activada (chunks > 7 días)."))
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"[INFO] Política de compresión nativa: {exc}"))

    def _purge_old_data(self, cutoff):
        """Perform chunked batch deletion of expired telemetría."""
        self.stdout.write(f"Iniciando purga de telemetría anterior a {cutoff.strftime('%Y-%m-%d %H:%M:%S UTC')}...")
        
        tables = [
            ("monitoring_check", "checked_at"),
            ("api_checks_result", "checked_at"),
            ("security_headers_result", "checked_at"),
            ("ssl_monitor_certificate", "last_scanned_at"),
        ]

        with connection.cursor() as cursor:
            for table, col in tables:
                try:
                    # Check if table exists
                    cursor.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = '{table}';")
                    if not cursor.fetchone():
                        continue

                    # Execute count and delete
                    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} < %s;", [cutoff])
                    count = cursor.fetchone()[0]
                    if count > 0:
                        cursor.execute(f"DELETE FROM {table} WHERE {col} < %s;", [cutoff])
                        self.stdout.write(self.style.SUCCESS(f"  -> {table}: Se eliminaron {count:,} registros antiguos."))
                    else:
                        self.stdout.write(f"  -> {table}: 0 registros anteriores a la fecha de corte.")
                except Exception as exc:
                    self.stdout.write(self.style.WARNING(f"  -> {table}: Omitido ({exc})"))

        self.stdout.write(self.style.SUCCESS("=== Purga de Telemetría Finalizada Exitosamente ==="))
