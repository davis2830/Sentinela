from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch
from types import SimpleNamespace
from organizations.models import Organization
from monitoring.models import MonitoringTarget
from monitoring.services import MonitoringService, AgentProbeService
from monitoring.serializers import MonitoringTargetSerializer
from monitoring.presentation import check_presentation
from monitoring.agent_payload import AgentResultSerializer
from monitoring.tasks import run_monitoring_check
from common.scan_limits import reserve

class CheckDiagnosticsTests(TestCase):
    def setUp(self):
        self.org=Organization.objects.create(name='Diagnostic',slug='diagnostic',beta_managed=False)
        self.target=MonitoringTarget.objects.create(organization=self.org,name='Web',endpoint='https://example.test',interval=60,max_latency_ms=500)

    def test_cloud_records_execution_policy_even_if_configuration_changes_mid_check(self):
        token=reserve(self.target)
        def execute(target):
            MonitoringTarget.objects.filter(pk=target.pk).update(max_latency_ms=50)
            return 'slow',577,{'status_code':200,'expected_status':200}
        with patch('monitoring.tasks._run_http_check',side_effect=execute):
            run_monitoring_check.run(str(self.target.id),scan_token=token)
        check=self.target.checks.get()
        self.assertEqual(check.details['evaluation_policy']['max_latency_ms'],500)
        self.assertEqual(check_presentation(check)['diagnostic'],'Superó el límite por 77 ms')

    def test_http_mismatch_is_brief_and_does_not_expose_raw_details(self):
        c=MonitoringService.record_check(self.target.id,'down',173,{'status_code':403,'expected_status':200,'error':'sensitive text'})
        output=MonitoringTargetSerializer(MonitoringService.list_targets(self.org.id).get()).data
        self.assertEqual(output['recent_checks'][-1]['diagnostic'],'HTTP 403 · esperado 200')
        self.assertNotIn('sensitive text',str(output['recent_checks']))
        self.assertEqual(c.latency,173)

    def test_legacy_does_not_invent_applied_limit(self):
        c=MonitoringService.record_check(self.target.id,'up',577)
        self.assertIsNone(check_presentation(c)['applied_max_latency_ms'])
        self.assertNotIn('evaluation_policy',c.details)

    def test_error_categories_and_unknown_errors_do_not_guess_causes(self):
        for error, expected in [('ReadTimeout','Tiempo de espera agotado'),('ConnectionRefusedError','Conexión rechazada'),('raw secret exception','Comprobación fallida · ver detalle')]:
            check=SimpleNamespace(details={'error':error},status='down',latency=None)
            self.assertEqual(check_presentation(check)['diagnostic'],expected)

    def test_agent_policy_is_optional_and_validated(self):
        base={'target_id':str(self.target.id),'status':'slow','response_time_ms':577}
        self.assertTrue(AgentResultSerializer(data=base).is_valid())
        for limit,valid in [(500,True),(0,False),(-1,False)]:
            data={**base,'evaluation_policy':{'max_latency_ms':limit,'expected_status':200}}
            self.assertEqual(AgentResultSerializer(data=data).is_valid(),valid)

    def test_agent_reported_policy_roundtrip_and_legacy_absence(self):
        from monitoring.models import AgentProbe
        probe=AgentProbe.objects.create(organization=self.org,name='Fixture LAN',token_hash='fixture-diagnostic-only')
        self.target.runner_type='agent'
        self.target.agent_probe=probe
        self.target.save(update_fields=['runner_type','agent_probe'])
        self.assertEqual(len(AgentProbeService.process_heartbeat(probe)),1)
        policy={'max_latency_ms':500,'expected_status':200}
        count=AgentProbeService.ingest_results(probe,[{'target_id':str(self.target.id),'status':'slow','response_time_ms':577,'http_status':200,'evaluation_policy':policy}])
        self.assertEqual(count,1)
        check=self.target.checks.get()
        self.assertEqual(check.details['evaluation_policy']['source'],'agent_reported')
        self.assertEqual(check_presentation(check)['applied_max_latency_ms'],500)
        legacy=MonitoringTarget.objects.create(organization=self.org,name='Legacy',endpoint='https://legacy.test',runner_type='agent',agent_probe=probe)
        self.assertEqual(len(AgentProbeService.process_heartbeat(probe)),1)
        AgentProbeService.ingest_results(probe,[{'target_id':str(legacy.id),'status':'up','response_time_ms':100,'http_status':200}])
        self.assertIsNone(check_presentation(legacy.checks.get())['applied_max_latency_ms'])
