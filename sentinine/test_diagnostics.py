import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from diagnostics import diagnose


class DiagnosticsTests(unittest.TestCase):
    def test_does_not_initialize_state_or_expose_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            state=Path(directory)/'absent'
            with patch.dict(os.environ,{'SENTININE_SERVER':'https://example.test','SENTININE_TOKEN':'private-fixture','SENTININE_STATE_DIR':str(state)},clear=True),patch('diagnostics.control_request',side_effect=OSError('private-fixture')):
                result=diagnose()
            self.assertFalse(state.exists())
            self.assertEqual(result['local_state'],'not_initialized')
            self.assertNotIn('private-fixture',str(result))

    def test_invalid_configuration_never_requests_tasks(self):
        with patch.dict(os.environ,{'SENTININE_SERVER':'http://example.test','SENTININE_TOKEN':'fixture'},clear=True),patch('diagnostics.control_request') as request:
            result=diagnose()
        self.assertEqual(result['configuration'],'invalid')
        request.assert_not_called()
