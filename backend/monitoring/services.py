from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import MonitoringCheck, MonitoringTarget


class MonitoringService:
    """Service for monitoring target management.

    Handles CRUD operations for targets and check retrieval.
    All business logic lives here, not in views.
    """

    @staticmethod
    def list_targets(organization_id):
        """Return all monitoring targets for an organization."""
        return MonitoringTarget.objects.filter(
            organization_id=organization_id
        ).order_by("-created_at")

    @staticmethod
    def get_target(target_id, organization_id):
        """Return a single target by ID within an organization."""
        return MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )

    @staticmethod
    @transaction.atomic
    def create_target(
        organization_id,
        name,
        target_type,
        endpoint,
        interval=60,
        enabled=True,
        tags=None,
    ):
        """Create a new monitoring target.

        Args:
            organization_id: UUID of the organization.
            name: Display name for the target.
            target_type: One of HTTP, HTTPS, TCP, DNS, API, SSL.
            endpoint: URL, domain, or address to monitor.
            interval: Check interval in seconds (default 60).
            enabled: Whether checks are active (default True).
            tags: List of custom string tags.

        Returns:
            The created MonitoringTarget instance.
        """
        target = MonitoringTarget.objects.create(
            organization_id=organization_id,
            name=name,
            target_type=target_type,
            endpoint=endpoint,
            interval=interval,
            enabled=enabled,
            tags=tags or [],
        )
        # Asynchronously register in submonitors after transaction commits
        from .tasks import register_target_in_submonitors
        transaction.on_commit(lambda: register_target_in_submonitors.delay(str(target.id)))

        return target

    @staticmethod
    @transaction.atomic
    def update_target(target_id, organization_id, **fields):
        """Update an existing monitoring target."""
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        for field, value in fields.items():
            if value is not None:
                setattr(target, field, value)
        target.save()
        return target

    @staticmethod
    @transaction.atomic
    def delete_target(target_id, organization_id):
        """Delete a monitoring target."""
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        target.delete()

    @staticmethod
    def list_checks(target_id, organization_id, limit=100):
        """Return recent checks for a target.

        Args:
            target_id: UUID of the target.
            organization_id: UUID of the organization (for scoping).
            limit: Maximum number of checks to return (default 100).

        Returns:
            QuerySet of MonitoringCheck instances.
        """
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        return target.checks.all()[:limit]

    @staticmethod
    @transaction.atomic
    def record_check(target_id, status, latency, details=None):
        """Record a monitoring check result and update target state.

        Called by Celery tasks after executing a check.

        Args:
            target_id: UUID of the target.
            status: Check status (up, down, slow, error).
            latency: Response time in milliseconds.
            details: Optional dict with extra check information.

        Returns:
            The created MonitoringCheck instance.
        """
        target = MonitoringTarget.objects.get(id=target_id)
        now = timezone.now()

        check = MonitoringCheck.objects.create(
            target=target,
            status=status,
            latency=latency,
            checked_at=now,
            details=details or {},
        )

        target.last_checked_at = now
        target.last_status = status
        target.last_latency = latency
        target.save(update_fields=["last_checked_at", "last_status", "last_latency"])

        return check

    @staticmethod
    def get_uptime_stats(target_id, organization_id, hours=24):
        """Calculate uptime percentage for a target over a time window.

        Args:
            target_id: UUID of the target.
            organization_id: UUID of the organization (for scoping).
            hours: Time window in hours (default 24).

        Returns:
            dict with total_checks, up_checks, uptime_percentage.
        """
        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        since = timezone.now() - timedelta(hours=hours)
        checks = target.checks.filter(checked_at__gte=since)

        total = checks.count()
        up = checks.filter(status="up").count()
        percentage = (up / total * 100) if total > 0 else 0.0

        return {
            "target_id": str(target_id),
            "hours": hours,
            "total_checks": total,
            "up_checks": up,
            "uptime_percentage": round(percentage, 2),
        }

    @staticmethod
    def get_timeseries_metrics(target_id, organization_id, period="24h"):
        """Calculate downsampled latency timeseries, daily availability heatmap, and downtime incidents."""
        from django.db.models import Count, Q, Avg
        from django.db.models.functions import TruncDate

        target = MonitoringTarget.objects.get(
            id=target_id, organization_id=organization_id
        )
        now = timezone.now()

        if period == "7d":
            hours = 24 * 7
            slot_seconds = 3600  # 1 hour
            label_fmt = "%d %b %H:%M"
        elif period == "30d":
            hours = 24 * 30
            slot_seconds = 3600 * 4  # 4 hours
            label_fmt = "%d %b %H:%M"
        else:
            period = "24h"
            hours = 24
            slot_seconds = 600  # 10 minutes
            label_fmt = "%H:%M"

        since = now - timedelta(hours=hours)
        checks_qs = target.checks.filter(checked_at__gte=since).order_by("checked_at")

        total_checks = checks_qs.count()
        up_checks = checks_qs.filter(status="up").count()
        down_checks_count = checks_qs.filter(status__in=["down", "error"]).count()
        uptime_pct = round((up_checks / total_checks * 100), 2) if total_checks > 0 else 100.0

        # Extract latencies for percentiles and stats
        raw_checks = list(checks_qs.values("id", "status", "latency", "checked_at", "details"))
        valid_latencies = [c["latency"] for c in raw_checks if c["latency"] is not None]

        if valid_latencies:
            sorted_lats = sorted(valid_latencies)
            avg_latency = round(sum(valid_latencies) / len(valid_latencies))
            max_latency = round(sorted_lats[-1])
            min_latency = round(sorted_lats[0])

            def _get_pct(p):
                idx = max(0, int(len(sorted_lats) * (p / 100.0)) - 1)
                return round(sorted_lats[idx])

            p50 = _get_pct(50)
            p90 = _get_pct(90)
            p99 = _get_pct(99)
        else:
            avg_latency = max_latency = min_latency = p50 = p90 = p99 = 0

        # Incidents clustering: group down/error checks within 3x interval
        down_checks = [c for c in raw_checks if c["status"] in ("down", "error")]
        incidents = []
        if down_checks:
            clusters = [[down_checks[0]]]
            for c in down_checks[1:]:
                prev = clusters[-1][-1]
                threshold_gap = max(target.interval * 3, 180)
                if (c["checked_at"] - prev["checked_at"]).total_seconds() <= threshold_gap:
                    clusters[-1].append(c)
                else:
                    clusters.append([c])

            for cluster in clusters:
                start = cluster[0]["checked_at"]
                last_down = cluster[-1]["checked_at"]
                next_up = (
                    target.checks.filter(checked_at__gt=last_down, status="up")
                    .order_by("checked_at")
                    .first()
                )
                end = next_up.checked_at if next_up else (last_down + timedelta(seconds=target.interval))
                dur_secs = max(int((end - start).total_seconds()), target.interval)

                if dur_secs < 60:
                    dur_str = f"{dur_secs} seg"
                elif dur_secs < 3600:
                    dur_str = f"{dur_secs // 60}m {dur_secs % 60}s"
                else:
                    dur_str = f"{dur_secs // 3600}h {(dur_secs % 3600) // 60}m"

                err_detail = cluster[0]["details"] or {}
                err_msg = (
                    err_detail.get("error")
                    or err_detail.get("blackbox_status")
                    or f"Interrupción de conexión en {target.endpoint}"
                )
                if err_msg == "failed":
                    err_msg = f"Fallo de conexión ({target.target_type.upper()}) hacia {target.endpoint}"

                incidents.append({
                    "id": str(cluster[0]["id"]),
                    "started_at": start.isoformat(),
                    "resolved_at": end.isoformat(),
                    "duration_seconds": dur_secs,
                    "duration_formatted": dur_str,
                    "error_message": str(err_msg),
                    "status_code": err_detail.get("status_code"),
                    "checks_failed": len(cluster),
                })

        total_downtime_seconds = sum(inc["duration_seconds"] for inc in incidents)

        # 30-day Availability Heatmap Blocks
        since_30d = now - timedelta(days=30)
        daily_stats = (
            target.checks.filter(checked_at__gte=since_30d)
            .annotate(day=TruncDate("checked_at"))
            .values("day")
            .annotate(
                total=Count("id"),
                up=Count("id", filter=Q(status="up")),
                down=Count("id", filter=Q(status__in=["down", "error"])),
                avg_lat=Avg("latency"),
            )
            .order_by("day")
        )
        daily_map = {d["day"]: d for d in daily_stats}
        daily_availability = []
        for i in range(29, -1, -1):
            cur_date = (now - timedelta(days=i)).date()
            if cur_date in daily_map:
                d = daily_map[cur_date]
                t = d["total"]
                u = d["up"]
                dw = d["down"]
                day_uptime = round((u / t * 100), 2) if t > 0 else 100.0
                day_status = (
                    "down"
                    if dw > 0
                    else ("slow" if (d["avg_lat"] or 0) > 300 else "operational")
                )
                avg_l = round(d["avg_lat"]) if d["avg_lat"] else 0
            else:
                day_uptime = 100.0
                t = 0
                dw = 0
                day_status = "no_data"
                avg_l = 0

            daily_availability.append({
                "date": cur_date.isoformat(),
                "label": cur_date.strftime("%d %b"),
                "uptime_percentage": day_uptime,
                "total_checks": t,
                "down_checks": dw,
                "status": day_status,
                "avg_latency": avg_l,
            })

        # Timeseries Buckets for Recharts AreaChart
        start_epoch = int(since.timestamp() // slot_seconds * slot_seconds)
        end_epoch = int(now.timestamp())
        buckets = {}
        for ep in range(start_epoch, end_epoch + slot_seconds, slot_seconds):
            buckets[ep] = {"lats": [], "down": 0, "up": 0}

        for chk in raw_checks:
            ep = int(chk["checked_at"].timestamp() // slot_seconds * slot_seconds)
            if ep in buckets:
                if chk["latency"] is not None:
                    buckets[ep]["lats"].append(chk["latency"])
                if chk["status"] in ("down", "error"):
                    buckets[ep]["down"] += 1
                else:
                    buckets[ep]["up"] += 1

        timeseries = []
        import datetime as dt_mod
        for ep, b in sorted(buckets.items()):
            dt = dt_mod.datetime.fromtimestamp(ep, tz=dt_mod.timezone.utc)
            lats = b["lats"]
            bucket_avg = round(sum(lats) / len(lats), 1) if lats else None
            bucket_max = round(max(lats), 1) if lats else None
            is_down = b["down"] > 0
            bucket_status = "down" if is_down else ("slow" if (bucket_avg or 0) > 300 else "up")

            timeseries.append({
                "timestamp": dt.isoformat(),
                "label": dt.strftime(label_fmt),
                "latency": bucket_avg,
                "max_latency": bucket_max,
                "status": bucket_status,
                "is_down": is_down,
                "down_count": b["down"],
                "total_count": b["up"] + b["down"],
            })

        return {
            "period": period,
            "target_id": str(target_id),
            "summary": {
                "uptime_percentage": uptime_pct,
                "total_checks": total_checks,
                "up_checks": up_checks,
                "down_checks": down_checks_count,
                "avg_latency": avg_latency,
                "p50_latency": p50,
                "p90_latency": p90,
                "p99_latency": p99,
                "max_latency": max_latency,
                "min_latency": min_latency,
                "total_downtime_seconds": total_downtime_seconds,
                "incidents_count": len(incidents),
            },
            "timeseries": timeseries,
            "daily_availability": daily_availability,
            "incidents": incidents,
        }