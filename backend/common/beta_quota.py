"""Shared transactional admission. Legacy decorator name retained for compatibility."""
from functools import wraps
from inspect import signature
from django.db import transaction


def _existing(resource_type, values, function_name):
    from django.apps import apps
    labels = {'ssl_certificates': 'ssl_monitor.SSLCertificate', 'dns_records': 'dns_monitor.DNSRecord',
              'domains': 'domain.DomainInfo', 'api_checks': 'api_checks.APICheckTarget',
              'security_headers': 'security_headers.SecurityHeaderTarget'}
    filters = {'organization_id': values['organization_id']}
    if resource_type in ('ssl_certificates', 'dns_records', 'domains'):
        domain = values['domain'].strip().replace('https://', '').replace('http://', '').split('/')[0]
        domain = domain.split(':')[0]
        if resource_type == 'domains':
            domain = domain.lower()
        filters['domain'] = domain
        if resource_type == 'dns_records':
            filters['record_type'] = values.get('record_type', 'A')
    elif 'get_or_create' in function_name and resource_type in ('api_checks', 'security_headers'):
        filters['url'] = values['url']
    else:
        return False
    return apps.get_model(labels[resource_type]).objects.filter(**filters).exists()


def beta_creation(resource_type):
    def decorate(function):
        @wraps(function)
        @transaction.atomic
        def wrapped(*args, **kwargs):
            from organizations.models import Organization
            from organizations.services import QuotaService
            from common.subscriptions import require_monitoring
            values = dict(signature(function).bind(*args, **kwargs).arguments)
            org = Organization.objects.select_for_update().get(pk=values['organization_id'])
            require_monitoring(org)
            if not _existing(resource_type, values, function.__name__):
                QuotaService.check_quota(org, resource_type)
            return function(*args, **kwargs)
        return wrapped
    return decorate
