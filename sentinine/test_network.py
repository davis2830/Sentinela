import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
from unittest.mock import Mock, patch
from common import network
from test_agent import agent


class EndpointParsingTests(unittest.TestCase):
    def test_ipv4_hostnames_and_ipv6_ports(self):
        for value, host, port in [('internal.test:5432','internal.test',5432),
            ('10.0.0.1:443','10.0.0.1',443),('[fd00::10]:5432','fd00::10',5432),
            ('fd00::10','fd00::10',80),('[fd00::10]','fd00::10',80),
            ('https://[fd00::10]:8443/','fd00::10',8443),
            ('https://internal.test','internal.test',443)]:
            with self.subTest(value=value):self.assertEqual(network.parse_endpoint(value)[:2],(host,port))

    def test_invalid_ports_credentials_and_paths_fail_without_port_fallback(self):
        for value in ('host:0','host:-1','host:65536','host:not-port','host:',
                      '[fd00::1]:0','[fd00::1','host:80/path','user:secret@host:80','http://host?x=1'):
            with self.subTest(value=value),self.assertRaises(ValueError):network.parse_endpoint(value)

    def test_dns_requires_a_name_not_an_ip_or_nameserver_port(self):
        self.assertEqual(network.dns_host('internal.test'),'internal.test')
        self.assertEqual(network.dns_host('https://internal.test/path'),'internal.test')
        for value in ('10.0.0.1','fd00::1','[fd00::1]','internal.test:53'):
            with self.subTest(value=value),self.assertRaises(ValueError):network.dns_host(value)


class ResolverTests(unittest.TestCase):
    def test_system_resolver_returns_both_families_in_isolated_process(self):
        # localhost is fixture-only; production target boundaries are checked separately.
        addresses=network.resolve_addresses('localhost',443,2)
        self.assertTrue(addresses)
        self.assertEqual({item[0] for item in addresses},{socket.AF_INET,socket.AF_INET6})
        self.assertTrue(all(item[3][1]==443 for item in addresses))

    def test_child_timeout_kills_and_reaps_the_actual_stuck_process(self):
        with tempfile.TemporaryDirectory() as directory:
            worker=Path(directory)/'stuck.py'
            worker.write_text('import time\ntime.sleep(60)\n')
            children=[]
            original=subprocess.Popen
            def spawn(*args,**kwargs):
                child=original(*args,**kwargs);children.append(child);return child
            start=time.monotonic()
            with patch.object(network,'RESOLVER_WORKER',worker),patch('subprocess.Popen',side_effect=spawn):
                with self.assertRaises(TimeoutError):network.resolve_addresses('stuck.test',80,.15)
            self.assertLess(time.monotonic()-start,2)
            self.assertEqual(len(children),1)
            self.assertIsNotNone(children[0].poll(),'Timed-out resolver must be reaped, not abandoned')

    def test_worker_environment_does_not_inherit_control_secrets(self):
        response={'addresses':[[socket.AF_INET,socket.SOCK_STREAM,socket.IPPROTO_TCP,['10.0.0.1',80]]]}
        with patch.dict(os.environ,{'SENTININE_TOKEN':'fixture-secret','SENTININE_TOKEN_FILE':'private-path'}),\
             patch.object(network.subprocess,'run',return_value=Mock(stdout=json.dumps(response))) as execute:
            network.resolve_addresses('internal.test',80,1)
        environment=execute.call_args.kwargs['env']
        self.assertNotIn('SENTININE_TOKEN',environment);self.assertNotIn('SENTININE_TOKEN_FILE',environment)

    def test_numeric_ipv6_never_starts_dns_worker(self):
        with patch.object(network.subprocess,'run') as worker:
            addresses=network.resolve_addresses('::1',80,1)
        worker.assert_not_called()
        self.assertEqual(addresses[0][0],socket.AF_INET6)

    def test_empty_or_failed_lookup_is_not_success(self):
        for output in ({'addresses':[]},{'error':'gaierror'}):
            with patch.object(network.subprocess,'run',return_value=Mock(stdout=json.dumps(output))),self.assertRaises(socket.gaierror):
                network.resolve_addresses('missing.test',80,1)


class NetworkBoundaryTests(unittest.TestCase):
    def test_private_ipv4_and_ula_allowed_but_protected_and_mapped_ips_rejected(self):
        for address in ('10.0.0.1','192.168.1.1','fd00::1'):
            network.validate_target_addresses([(socket.AF_INET,1,6,(address,80))])
        for address in ('127.0.0.1','::1','::','169.254.169.254','fd00:ec2::254','fe80::1','ff02::1','::ffff:127.0.0.1','::ffff:169.254.169.254'):
            with self.subTest(address=address),self.assertRaises(OSError):
                network.validate_target_addresses([(socket.AF_INET6,1,6,(address,80))])

    def test_mixed_safe_and_unsafe_dns_answers_fail_closed_before_socket_creation(self):
        addresses=[(socket.AF_INET,1,6,('10.0.0.1',80)),(socket.AF_INET6,1,6,('::1',80,0,0))]
        with patch.object(network,'resolve_addresses',return_value=addresses),patch.object(network.socket,'socket') as sockets:
            with self.assertRaises(OSError):network.connect_bounded('mixed.test',80,1,target=True)
        sockets.assert_not_called()

    def test_failed_socket_is_closed_before_trying_next_family(self):
        addresses=[(socket.AF_INET6,1,6,('fd00::1',80,0,0)),(socket.AF_INET,1,6,('10.0.0.1',80))]
        failed=Mock();failed.connect.side_effect=ConnectionRefusedError()
        good=Mock()
        with patch.object(network,'resolve_addresses',return_value=addresses),patch.object(network.socket,'socket',side_effect=[failed,good]):
            self.assertIs(network.connect_bounded('dual.test',80,1,target=True),good)
        failed.close.assert_called_once();good.close.assert_not_called()

    def test_all_failed_sockets_close_and_shared_deadline_is_not_multiplied(self):
        addresses=[(socket.AF_INET6,1,6,('fd00::1',80,0,0)),(socket.AF_INET,1,6,('10.0.0.1',80))]
        first=Mock();first.connect.side_effect=TimeoutError()
        second=Mock();second.connect.side_effect=TimeoutError()
        with patch.object(network,'resolve_addresses',return_value=addresses),\
             patch.object(network.socket,'socket',side_effect=[first,second]),\
             patch.object(network.time,'monotonic',side_effect=[0,.1,.6]):
            with self.assertRaises(TimeoutError):network.connect_bounded('dual.test',80,1,target=True)
        first.close.assert_called_once();second.close.assert_called_once()
        self.assertAlmostEqual(first.settimeout.call_args.args[0],.45)
        self.assertAlmostEqual(second.settimeout.call_args.args[0],.4)


class TCPIntegrationTests(unittest.TestCase):
    def test_dns_with_only_aaaa_record_is_a_successful_resolution(self):
        task={'target_id':'fixture','target_type':'dns','endpoint':'ipv6-only.lan','max_latency_ms':2000}
        addresses=[(socket.AF_INET6,socket.SOCK_STREAM,socket.IPPROTO_TCP,('fd00::10',0,0,0))]
        with patch.object(agent,'resolve_addresses',return_value=addresses):
            self.assertEqual(agent.check_target(task)['status'],'up')

    def test_actual_ipv4_and_ipv6_connections_close_after_check(self):
        for family,host,endpoint in [(socket.AF_INET,'127.0.0.1','127.0.0.1'),(socket.AF_INET6,'::1','[::1]')]:
            with self.subTest(family=family),socket.socket(family,socket.SOCK_STREAM) as server:
                server.bind((host,0));server.listen();server.settimeout(2)
                task={'target_id':'fixture','target_type':'tcp','endpoint':f'{endpoint}:{server.getsockname()[1]}','max_latency_ms':2000}
                with patch.object(network,'validate_target_addresses'):
                    result=agent.check_target(task)
                self.assertEqual(result['status'],'up')
                with server.accept()[0] as connection:
                    connection.settimeout(1)
                    self.assertEqual(connection.recv(1),b'','Check must close the successful socket')

    def test_dns_timeout_and_literal_configuration_errors_have_distinct_results(self):
        task={'target_id':'fixture','target_type':'dns','endpoint':'internal.test','max_latency_ms':500}
        with patch.object(agent,'resolve_addresses',side_effect=TimeoutError()):
            result=agent.check_target(task)
        self.assertEqual(result['status'],'down');self.assertEqual(result['error_message'],'TimeoutError')
        task['endpoint']='10.0.0.1'
        self.assertEqual(agent.check_target(task)['status'],'error')


if __name__=='__main__':unittest.main()
