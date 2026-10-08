"""Validate polymorphic references before writing tenant-owned resources."""
from django.apps import apps

TARGET_MODELS = {
    'monitoring': 'monitoring.MonitoringTarget',
    'uptime': 'monitoring.MonitoringTarget',
    'ssl': 'ssl_monitor.SSLCertificate',
    'dns': 'dns_monitor.DNSRecord',
    'domain': 'domain.DomainInfo',
    'api_check': 'api_checks.APICheckTarget',
    'api': 'api_checks.APICheckTarget',
    'security_headers': 'security_headers.SecurityHeaderTarget',
}


def require_target(organization_id, target_type, target_id):
    if target_id is None:
        return
    label = TARGET_MODELS.get(target_type)
    if not label or not apps.get_model(label).objects.filter(pk=target_id, organization_id=organization_id).exists():
        raise ValueError('Recurso no encontrado en la organización.')


def require_relation(organization_id, value, label):
    if value is not None and not apps.get_model(label).objects.filter(
        pk=getattr(value, 'pk', value), organization_id=organization_id,
    ).exists():
        raise ValueError('Referencia no encontrada en la organización.')
