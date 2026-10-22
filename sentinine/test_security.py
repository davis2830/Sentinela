import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest
from unittest.mock import patch
from urllib.request import Request
from urllib.error import URLError, HTTPError
from security import load_token, validate_server_url, tls_context, control_request
from common.safe_http import open_request


class ConfigurationSecurityTests(unittest.TestCase):
    def test_control_http_requires_both_explicit_development_flags(self):
        for config, allowed in [({},False),({'SENTININE_ALLOW_HTTP':'true'},False),
            ({'SENTININE_ENV':'development'},False),
            ({'SENTININE_ENV':'development','SENTININE_ALLOW_HTTP':'true'},True)]:
            with self.subTest(config=config),patch.dict(os.environ,config,clear=True):
                if allowed:self.assertEqual(validate_server_url('http://localhost:8000'),'http://localhost:8000')
                else:
                    with self.assertRaises(ValueError):validate_server_url('http://localhost:8000')

    def test_invalid_or_credential_bearing_control_urls_rejected(self):
        for url in ('https://user:secret@example.test','https://example.test/?token=secret',
                    'https://example.test/#secret','file:///tmp/test','https://example.test:99999'):
            with self.subTest(url=url),patch.dict(os.environ,{},clear=True):
                with self.assertRaises(ValueError):validate_server_url(url)

    def test_token_file_precedence_and_missing_file_never_falls_back(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'token';path.write_text('\ufefffixture-file-token\n',encoding='utf-8');path.chmod(0o400)
            with patch.dict(os.environ,{'SENTININE_TOKEN_FILE':str(path),'SENTININE_TOKEN':'fixture-env-token'},clear=True):
                self.assertEqual(load_token(),'fixture-file-token')
                path.unlink()
                with self.assertRaises(ValueError):load_token()

    def test_token_file_rejects_empty_oversized_or_multiple_tokens(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'token'
            for value in ('','x'*4097,'one two'):
                path.chmod(0o600) if path.exists() else None
                path.write_text(value);path.chmod(0o400)
                with patch.dict(os.environ,{'SENTININE_TOKEN_FILE':str(path)},clear=True):
                    with self.assertRaises(ValueError):load_token()

    def test_legacy_environment_token_remains_compatible(self):
        with patch.dict(os.environ,{'SENTINEL_TOKEN':'fixture-legacy'},clear=True):
            self.assertEqual(load_token(),'fixture-legacy')

    @unittest.skipIf(os.name=='nt','POSIX permissions checked in Linux container')
    def test_writable_shared_secret_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'token';path.write_text('fixture');path.chmod(0o666)
            with patch.dict(os.environ,{'SENTININE_TOKEN_FILE':str(path)},clear=True):
                with self.assertRaises(ValueError):load_token()

    def test_insecure_override_is_development_only_and_never_applies_to_control(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(ValueError):tls_context(insecure=True)
        with patch.dict(os.environ,{'SENTININE_ENV':'development'},clear=True):
            self.assertEqual(tls_context(insecure=True).verify_mode,ssl.CERT_NONE)
            context=tls_context(control=True,insecure=True)
            self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
            self.assertTrue(context.check_hostname)


class TLSControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which('openssl'):
            raise RuntimeError('OpenSSL CLI requerido para verificar contratos TLS reales; usar target Docker tests.')
        cls.folder=tempfile.TemporaryDirectory()
        cls.root=Path(cls.folder.name)
        def run(*args):
            subprocess.run(['openssl',*args],cwd=cls.root,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        run('req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-subj','/CN=Senti9 isolated test CA',
            '-days','2','-addext','basicConstraints=critical,CA:TRUE')
        run('req','-new','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=localhost')
        (cls.root/'index.txt').write_text('')
        (cls.root/'serial').write_text('01\n')
        (cls.root/'newcerts').mkdir()
        (cls.root/'ca.cnf').write_text('''[ca]
default_ca=local
[local]
database=index.txt
serial=serial
new_certs_dir=newcerts
certificate=ca.pem
private_key=ca.key
default_md=sha256
policy=policy
default_days=1
[policy]
commonName=supplied
[server]
subjectAltName=IP:127.0.0.1
extendedKeyUsage=serverAuth
''')
        for name,days,san in [('valid','1','IP:127.0.0.1,DNS:localhost'),('expired','-1','IP:127.0.0.1'),('wronghost','1','DNS:other.invalid')]:
            if name=='expired':
                run('ca','-batch','-config','ca.cnf','-in','server.csr','-out','expired.pem',
                    '-startdate','20200101000000Z','-enddate','20200102000000Z','-extensions','server')
                continue
            (cls.root/'ext.cnf').write_text(f'subjectAltName={san}\nextendedKeyUsage=serverAuth\n')
            run('x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial',
                '-out',name+'.pem','-days',days,'-extfile','ext.cnf')

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def setUp(self):
        self.requests=[]

    def server(self, certificate):
        requests=self.requests
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                requests.append(self.path)
                body=json.dumps({'data':{'ok':True}}).encode()
                self.send_response(302 if self.path=='/redirect' else 200)
                if self.path=='/redirect':self.send_header('Location','http://other.invalid/')
                self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(self.root/(certificate+'.pem'),self.root/'server.key')
        server.socket=context.wrap_socket(server.socket,server_side=True)
        thread=Thread(target=server.serve_forever,daemon=True);thread.start()
        self.addCleanup(thread.join,3)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f'https://127.0.0.1:{server.server_port}'

    def trusted(self):
        return patch.dict(os.environ,{'SENTININE_ENV':'production','SENTININE_CONTROL_CA_FILE':str(self.root/'ca.pem')},clear=True)

    def test_valid_tls_with_corporate_ca_and_matching_hostname(self):
        # Resolve localhost (A/AAAA), fall back to the listener, keep TLS SNI/hostname.
        url=self.server('valid').replace('127.0.0.1','localhost')
        with self.trusted(),control_request(Request(url),timeout=2) as response:
            self.assertTrue(json.load(response)['data']['ok'])

    def test_expired_certificate_is_rejected_before_token_is_sent(self):
        url=self.server('expired')
        with self.trusted(),self.assertRaises(URLError) as error:
            control_request(Request(url,headers={'X-Probe-Token':'fixture-only'}),timeout=2)
        self.assertIn('expired',str(error.exception).lower())
        self.assertFalse(self.requests)

    def test_untrusted_certificate_is_rejected(self):
        url=self.server('valid')
        with patch.dict(os.environ,{},clear=True),self.assertRaises(URLError):
            control_request(Request(url),timeout=2)
        self.assertFalse(self.requests)

    def test_wrong_hostname_is_rejected(self):
        url=self.server('wronghost')
        with self.trusted(),self.assertRaises(URLError):control_request(Request(url),timeout=2)
        self.assertFalse(self.requests)

    def test_tls_redirect_never_downgrades_or_forwards_token(self):
        url=self.server('valid')
        with self.trusted(),self.assertRaises(HTTPError) as error:
            control_request(Request(url+'/redirect',headers={'X-Probe-Token':'fixture-only'}),timeout=2)
        self.assertEqual(error.exception.code,302)
        error.exception.close()
        self.assertEqual(self.requests,['/redirect'])

    def test_target_ca_does_not_change_control_trust(self):
        url=self.server('valid')
        with patch.dict(os.environ,{'SENTININE_TARGET_CA_FILE':str(self.root/'ca.pem')},clear=True):
            with open_request(Request(url),timeout=2,context=tls_context()) as response:self.assertEqual(response.status,200)
            with self.assertRaises(URLError):control_request(Request(url),timeout=2)
