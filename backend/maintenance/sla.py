"""Tenant-scoped maintenance exclusions for sample-based availability."""
from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone

from .models import MaintenanceWindow


def eligible_checks(checks, organization_id, target_id, start, end, target_type='monitoring'):
    """Exclude [start, end) windows, without creating or changing telemetry."""
    windows = MaintenanceWindow.objects.filter(
        organization_id=organization_id, exclude_from_sla=True, start_time__lte=end,
    ).exclude(status='cancelled').filter(
        Q(recurrence='none', end_time__gt=start) | ~Q(recurrence='none')
    ).filter(
        Q(targets__target_type='all') |
        Q(targets__target_type=target_type, targets__target_id=target_id)
    ).distinct()
    excluded = Q(pk__in=[])
    for window in windows:
        if window.recurrence == 'none':
            excluded |= Q(checked_at__gte=window.start_time, checked_at__lt=window.end_time)
            continue
        anchor = timezone.localtime(window.start_time)
        day = timezone.localtime(start).date() - timedelta(days=1)
        series_end = min(end, window.updated_at) if window.status == 'completed' else end
        last_day = timezone.localtime(series_end).date()
        while day <= last_day:
            delta = (day - anchor.date()).days
            weekday = window.recurrence_day_of_week
            weekday = anchor.weekday() if weekday is None else weekday
            matches = delta >= 0 and (
                (window.recurrence == 'weekly' and day.weekday() == weekday) or
                (window.recurrence == 'biweekly' and day.weekday() == weekday and delta // 7 % 2 == 0) or
                (window.recurrence == 'monthly' and day.day == anchor.day)
            )
            if matches:
                clock = window.recurrence_time_start or anchor.time().replace(tzinfo=None)
                begin = timezone.make_aware(datetime.combine(day, clock), anchor.tzinfo)
                if window.recurrence_time_end:
                    finish = timezone.make_aware(datetime.combine(day, window.recurrence_time_end), anchor.tzinfo)
                    if finish <= begin:
                        finish += timedelta(days=1)
                else:
                    finish = begin + (window.end_time - window.start_time)
                if window.start_time <= begin < series_end:
                    excluded |= Q(checked_at__gte=begin, checked_at__lt=min(finish, series_end))
            day += timedelta(days=1)
    return checks.exclude(excluded)
