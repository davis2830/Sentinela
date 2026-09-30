import os
import django
import json
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from django.contrib.auth import get_user_model
from organizations.models import Organization
from monitoring.models import AgentProbe, MonitoringTarget, MonitoringCheck
from monitoring.services import AgentProbeService
from monitoring.tasks import check_sentinine_heartbeats
from alerts.models import Alert
from rest_framework.test import APIClient

User = get_user_model()

def run_test():
    print("=== TEST E2E: CICLO DE VIDA DE GUARDIÁN SENTININE ===")
    
    # 1. Obtener organización
    org = Organization.objects.first()
    if not org:
        org = Organization.objects.create(name="Sentinel Demo Org", slug="sentinel-demo")
    print(f"[OK] Organizacion: {org.name} ({org.id})")
    
    # 2. Registrar un nuevo Guardián Sentinine
    probe_name = "Sentinine Datacenter Santiago E2E"
    probe, raw_token = AgentProbeService.create_probe(
        organization_id=org.id,
        name=probe_name,
    )
    print(f"[OK] Sentinine creado: {probe.name}, ID: {probe.id}, Raw Token: {raw_token[:15]}...")
    assert raw_token.startswith("snt_live_"), f"El token debería comenzar con snt_live_, obtenido: {raw_token}"
    
    # 3. Crear un MonitoringTarget asignado al Sentinine
    target, created = MonitoringTarget.objects.get_or_create(
        organization_id=org.id,
        name="Servidor Interno SAP Core",
        defaults={
            'target_type': 'http',
            'endpoint': 'http://192.168.10.50:8080/health',
            'interval': 15,
            'enabled': True,
            'runner_type': 'agent',
            'agent_probe': probe
        }
    )
    if not created:
        target.runner_type = 'agent'
        target.agent_probe = probe
        target.enabled = True
        target.save()
    print(f"[OK] Target creado/actualizado: {target.name}, Runner: {target.runner_type}, Probe: {target.agent_probe.name}")
    
    # 4. Simular Heartbeat desde el Agente Sentinine (API Client)
    client = APIClient()
    client.credentials(HTTP_X_PROBE_TOKEN=raw_token)
    
    hb_payload = {
        "version": "1.1.0",
        "agent_name": "Sentinine",
        "ip_address": "192.168.10.2",
        "hostname": "sentinine-worker-01",
        "os_info": "Linux Alpine 3.20 (x86_64)",
    }
    
    response = client.post('/api/v1/agent-probes/heartbeat/', data=hb_payload, format='json')
    assert response.status_code == 200, f"Error en Heartbeat: {response.status_code} {response.data}"
    hb_data = response.data
    payload_data = hb_data.get('data', hb_data)
    tasks = payload_data.get('tasks', [])
    print(f"[OK] Heartbeat exitoso. Tasks asignados recibidos: {len(tasks)}")
    
    assert len(tasks) >= 1, f"El probe deberia recibir al menos 1 tarea asignada, payload: {hb_data}"
    assigned = tasks[0]
    print(f"     -> Target asignado: {assigned['name']} ({assigned['endpoint']}) - Tipo: {assigned['target_type']}")
    
    # 5. Simular reporte de resultados de monitoreo desde Sentinine
    results_payload = {
        "results": [
            {
                "target_id": str(target.id),
                "status": "up",
                "response_time_ms": 36.4,
                "http_status": 200,
                "error_message": ""
            }
        ]
    }
    
    submit_resp = client.post('/api/v1/agent-probes/submit-results/', data=results_payload, format='json')
    assert submit_resp.status_code == 200, f"Error en submit-results: {submit_resp.status_code} {submit_resp.data}"
    print(f"[OK] Submit results exitoso: {submit_resp.data}")
    
    # 6. Validar que el Target se actualizó en la BD
    target.refresh_from_db()
    probe.refresh_from_db()
    print(f"[OK] Target tras reporte: Last Status='{target.last_status}', Latencia={target.last_latency}ms, Checked At={target.last_checked_at}")
    assert target.last_status == 'up', f"Target status deberia ser 'up', obtenido: {target.last_status}"
    assert target.last_latency == 36.4, f"Latencia deberia ser 36.4, obtenido: {target.last_latency}"
    assert probe.status == 'online', f"Probe deberia ser online tras heartbeat, obtenido: {probe.status}"
    
    # 7. Validar insercion en MonitoringCheck
    check = MonitoringCheck.objects.filter(target=target).order_by('-checked_at').first()
    assert check is not None, "Deberia haberse guardado un MonitoringCheck"
    print(f"[OK] MonitoringCheck verificado: ID={check.id}, Status='{check.status}', Latencia={check.latency}ms")
    
    # 8. Validar Watchdog de Desconexión (Celery Beat)
    print("\n--- Validando Celery Watchdog check_sentinine_heartbeats ---")
    probe.last_heartbeat = timezone.now() - timedelta(seconds=65)
    probe.save(update_fields=['last_heartbeat'])
    
    watchdog_res = check_sentinine_heartbeats()
    print(f"[OK] Tarea Watchdog ejecutada: {watchdog_res}")
    
    probe.refresh_from_db()
    print(f"[OK] Estado de Sentinine tras watchdog: '{probe.status}' (Esperado: 'offline')")
    assert probe.status == 'offline', f"El probe deberia haber pasado a offline, obtenido: {probe.status}"
    
    alert = Alert.objects.filter(target_type='agent_probe', target_id=probe.id).order_by('-triggered_at').first()
    assert alert is not None, "El watchdog deberia haber generado una alerta de desconexión"
    print(f"[OK] Alerta de desconexión generada con éxito: [{alert.severity.upper()}] {alert.title}")
    
    # Limpieza
    target.delete()
    probe.delete()
    if alert:
        alert.delete()
    print("\n=== TODOS LOS TESTS DEL CICLO DE VIDA DE SENTININE PASARON EXITOSAMENTE ===")

if __name__ == '__main__':
    run_test()
