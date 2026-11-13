import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from install import arguments


class InstallationProfileTests(unittest.TestCase):
    def test_profile_paths_with_spaces_and_no_secret_in_command(self):
        with tempfile.TemporaryDirectory(prefix='senti9 with spaces ') as directory:
            token=Path(directory)/'token with spaces.txt';token.write_text('secret-fixture')
            profile={'schema_version':1,'version':'1.8.0','configured':True,'container_name':'senti9-12345678','volume_name':'senti9-12345678-state','image':'private.example/senti9:1.8.0','server_url':'https://control.example.test','platform':'windows','distribution':'local'}
            with patch.dict('os.environ',{'SENTININE_ENV':'production'},clear=True):args=arguments(profile,token)
            self.assertIn(f'type=bind,source={token.resolve()},target=/run/secrets/sentinine_token,readonly',args)
            self.assertNotIn('secret-fixture',str(args));self.assertIn('never',args)
            self.assertNotIn('--privileged',args);self.assertNotIn('--network',args)
            for key,value in [('image','bad; run'),('container_name','../other'),('version','0.0.0')]:
                with self.assertRaises(ValueError):arguments({**profile,key:value},token)
