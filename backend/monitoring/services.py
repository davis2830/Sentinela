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
        owner_team=None,
        runner_type="cloud",
        agent_probe=None,
    ):
        owner_team_obj = None
        if owner_team:
            from users.models import Team
            owner_team_obj = Team.objects.filter(id=owner_team, organization_id=organization_id).first()

        agent_probe_obj = None
        if agent_probe:
            from .models import AgentProbe
            agent_probe_obj = AgentProbe.objects.filter(id=agent_probe, organization_id=organization_id).first()

        target = MonitoringTarget.objects.create(
            organization_id=organization_id,
            name=name,
            target_type=target_type,
            endpoint=endpoint,
            interval=interval,
            enabled=enabled,
            tags=tags or [],
            owner_team=owner_team_obj,
            runner_type=runner_type,
            agent_probe=agent_probe_obj,
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
        if "owner_team" in fields:
            team_val = fields.pop("owner_team")
            if team_val:
                from users.models import Team
                target.owner_team = Team.objects.filter(id=team_val, organization_id=organization_id).first()
            else:
                target.owner_team = None

        if "agent_probe" in fields:
            probe_val = fields.pop("agent_probe")
            if probe_val:
                from .models import AgentProbe
                target.agent_probe = AgentProbe.objects.filter(id=probe_val, organization_id=organization_id).first()
            else:
                target.agent_probe = None

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

    @staticmethod
    def get_organization_global_performance(organization_id, period="24h"):
        """Calculate real aggregate timeseries metrics and breakdown per service for the NOC Dashboard."""
        now = timezone.now()
        period = (period or "24h").strip().lower()
        if period == "1h":
            since = now - timedelta(hours=1)
            slot_seconds = 180  # 3 min intervals (20 points)
            label_fmt = "%H:%M"
        elif period == "6h":
            since = now - timedelta(hours=6)
            slot_seconds = 900  # 15 min intervals (24 points)
            label_fmt = "%H:%M"
        elif period == "7d":
            since = now - timedelta(days=7)
            slot_seconds = 21600  # 6h intervals (28 points)
            label_fmt = "%d/%m %Hh"
        elif period == "30d":
            since = now - timedelta(days=30)
            slot_seconds = 86400  # 24h intervals (30 points)
            label_fmt = "%d/%m"
        else:  # 24h default
            period = "24h"
            since = now - timedelta(hours=24)
            slot_seconds = 3600  # 1h intervals (24 points)
            label_fmt = "%H:%M"

        checks_qs = MonitoringCheck.objects.filter(
            target__organization_id=organization_id,
            checked_at__gte=since
        ).values("checked_at", "latency", "status")

        start_epoch = int(since.timestamp() // slot_seconds * slot_seconds)
        end_epoch = int(now.timestamp())
        buckets = {
            ep: {"lats": [], "up": 0, "down": 0}
            for ep in range(start_epoch, end_epoch + slot_seconds, slot_seconds)
        }

        for chk in checks_qs:
            ep = int(chk["checked_at"].timestamp() // slot_seconds * slot_seconds)
            if ep in buckets:
                if chk["latency"] is not None:
                    buckets[ep]["lats"].append(chk["latency"])
                if chk["status"] in ("up",):
                    buckets[ep]["up"] += 1
                else:
                    buckets[ep]["down"] += 1

        import datetime as dt_mod
        points = []
        last_valid_latency = 0
        all_latencies = []
        total_up = 0
        total_down = 0

        for ep, b in sorted(buckets.items()):
            dt = dt_mod.datetime.fromtimestamp(ep, tz=dt_mod.timezone.utc)
            lats = b["lats"]
            t = b["up"] + b["down"]
            total_up += b["up"]
            total_down += b["down"]
            if lats:
                avg_l = round(sum(lats) / len(lats), 1)
                last_valid_latency = avg_l
                all_latencies.extend(lats)
            else:
                avg_l = last_valid_latency

            uptime = round((b["up"] / t) * 100, 2) if t > 0 else 100.0
            points.append({
                "time": dt.strftime(label_fmt),
                "uptime": uptime,
                "latency": avg_l,
                "requests": t,
            })

        total_checks = total_up + total_down
        global_avg_uptime = round((total_up / total_checks * 100), 2) if total_checks > 0 else 100.0
        global_avg_latency = round(sum(all_latencies) / len(all_latencies)) if all_latencies else 0

        # Subservices real data
        # 1. Web targets (HTTP/HTTPS)
        web_targets = MonitoringTarget.objects.filter(
            organization_id=organization_id,
            target_type__in=["http", "https"]
        )
        web_total = web_targets.count()
        web_up = web_targets.filter(last_status="up").count()
        web_lats = [t.last_latency for t in web_targets if t.last_latency is not None]
        web_avg_lat = round(sum(web_lats) / len(web_lats)) if web_lats else 0

        # 2. Synthetic API Checks
        from api_checks.models import APICheckTarget
        api_targets = APICheckTarget.objects.filter(organization_id=organization_id)
        api_total = api_targets.count()
        api_up = api_targets.filter(last_status="pass").count()
        api_lats = [t.last_response_time_ms for t in api_targets if t.last_response_time_ms is not None]
        api_avg_lat = round(sum(api_lats) / len(api_lats)) if api_lats else 0

        # 3. Database / TCP
        db_targets = MonitoringTarget.objects.filter(
            organization_id=organization_id,
            target_type__in=["tcp", "db"]
        )
        db_total = db_targets.count()
        db_up = db_targets.filter(last_status="up").count()
        db_lats = [t.last_latency for t in db_targets if t.last_latency is not None]
        db_avg_lat = round(sum(db_lats) / len(db_lats)) if db_lats else 0

        # 4. SSL Certificates
        from ssl_monitor.models import SSLCertificate
        ssl_certs = SSLCertificate.objects.filter(organization_id=organization_id)
        ssl_total = ssl_certs.count()
        ssl_valid = ssl_certs.filter(is_valid=True).count()

        # 5. DNS Records
        from dns_monitor.models import DNSRecord
        dns_records = DNSRecord.objects.filter(organization_id=organization_id)
        dns_total = dns_records.count()
        dns_valid = dns_records.filter(last_scanned_at__isnull=False).count()
        dns_lats = [r.response_time_ms for r in dns_records if getattr(r, "response_time_ms", None) is not None]
        dns_avg_lat = round(sum(dns_lats) / len(dns_lats)) if dns_lats else 0

        period_seconds = max(1, int((now - since).total_seconds()))
        rps = round(total_checks / period_seconds, 2)
        rps_str = f"{round(rps * 60)}/m" if rps < 1 else f"{rps:.1f} rps"

        return {
            "period": period,
            "summary": {
                "avg_uptime": global_avg_uptime,
                "avg_latency": global_avg_latency,
                "total_requests": total_checks,
                "estimated_rps": rps_str,
            },
            "points": points,
            "services": {
                "web": {"count": web_up, "total": web_total, "avg_latency": web_avg_lat},
                "api": {"count": api_up, "total": api_total, "avg_latency": api_avg_lat},
                "db": {"count": db_up, "total": db_total, "avg_latency": db_avg_lat},
                "ssl": {"count": ssl_valid, "total": ssl_total, "avg_latency": 0},
                "dns": {"count": dns_valid, "total": dns_total, "avg_latency": dns_avg_lat},
            },
        }


class AgentProbeService:
    """Service for private satellite runners (Probes)."""

    @staticmethod
    def list_probes(organization_id):
        from .models import AgentProbe
        return AgentProbe.objects.filter(organization_id=organization_id).order_by("-created_at")

    @staticmethod
    def get_probe(probe_id, organization_id):
        from .models import AgentProbe
        return AgentProbe.objects.get(id=probe_id, organization_id=organization_id)

    @staticmethod
    @transaction.atomic
    def create_probe(organization_id, name):
        from .models import AgentProbe
        raw_token, token_hash = AgentProbe.generate_token()
        probe = AgentProbe.objects.create(
            organization_id=organization_id,
            name=name,
            token_hash=token_hash,
            status=AgentProbe.ProbeStatus.OFFLINE,
        )
        return probe, raw_token

    @staticmethod
    @transaction.atomic
    def delete_probe(probe_id, organization_id):
        from .models import AgentProbe
        probe = AgentProbe.objects.get(id=probe_id, organization_id=organization_id)
        probe.delete()

    @staticmethod
    def authenticate_token(raw_token):
        """Look up an AgentProbe by its raw token header."""
        if not raw_token or not raw_token.startswith("prb_live_"):
            return None
        import hashlib
        from .models import AgentProbe
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        return AgentProbe.objects.filter(token_hash=token_hash).first()

    @staticmethod
    def process_heartbeat(probe, hostname="", ip_address="", os_info="", version="1.0.0"):
        from .models import AgentProbe
        probe.last_heartbeat = timezone.now()
        probe.status = AgentProbe.ProbeStatus.ONLINE
        if hostname:
            probe.hostname = hostname
        if ip_address:
            probe.ip_address = ip_address
        if os_info:
            probe.os_info = os_info
        if version:
            probe.version = version
        probe.save(update_fields=["last_heartbeat", "status", "hostname", "ip_address", "os_info", "version", "updated_at"])

        # Fetch assigned active targets
        targets = probe.assigned_targets.filter(enabled=True)
        task_list = []
        for t in targets:
            task_list.append({
                "target_id": str(t.id),
                "name": t.name,
                "target_type": t.target_type,
                "endpoint": t.endpoint,
                "http_method": t.http_method,
                "expected_status": t.expected_status,
                "custom_headers": t.custom_headers,
                "request_body": t.request_body,
                "max_latency_ms": t.max_latency_ms,
                "interval": t.interval,
            })
        return task_list

    @staticmethod
    @transaction.atomic
    def ingest_results(probe, results):
        """Ingest batch check execution results from private probe."""
        from .models import MonitoringCheck, MonitoringTarget
        ingested = 0
        now = timezone.now()
        for item in results:
            target_id = item.get("target_id")
            if not target_id:
                continue
            target = MonitoringTarget.objects.filter(id=target_id, organization=probe.organization).first()
            if not target:
                continue

            status_val = item.get("status", "down")
            latency_val = float(item.get("response_time_ms", 0.0))
            http_status_val = item.get("http_status")
            error_msg = item.get("error_message", "")

            # Create check
            check = MonitoringCheck.objects.create(
                target=target,
                status=status_val,
                latency=latency_val,
                status_code=http_status_val,
                error_message=error_msg,
                checked_at=now,
            )

            # Update target
            target.last_status = status_val
            target.last_latency = latency_val
            target.last_checked_at = now
            target.save(update_fields=["last_status", "last_latency", "last_checked_at"])

            # Evaluate alert rules
            try:
                from alerts.services import AlertRuleService
                AlertRuleService.evaluate_target(target, check)
            except Exception:
                pass

            ingested += 1
        return ingested