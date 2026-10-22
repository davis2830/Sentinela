import tempfile
import unittest
from pathlib import Path
from release import write_checksums, verify


class PackageIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        for name in ('release.json', 'compatibility.json', 'image.docker.tar'):
            (self.directory/name).write_bytes(b'fixture-package')
        write_checksums(self.directory)

    def tearDown(self):
        self.temp.cleanup()

    def test_checksums_verify_integrity_without_claiming_authenticity(self):
        self.assertEqual(verify(self.directory), {'integrity': 'verified', 'authenticity': 'not_verified'})

    def test_tampered_archive_is_rejected(self):
        (self.directory/'image.docker.tar').write_bytes(b'tampered')
        with self.assertRaises(ValueError): verify(self.directory)

    def test_extra_file_or_path_traversal_is_rejected(self):
        (self.directory/'extra.key').touch()
        with self.assertRaises(ValueError): verify(self.directory)
        (self.directory/'extra.key').unlink()
        (self.directory/'SHA256SUMS').write_text('0'*64+'  ../outside\n')
        with self.assertRaises(ValueError): verify(self.directory)

    def test_missing_compatibility_report_is_rejected(self):
        (self.directory/'compatibility.json').unlink()
        write_checksums(self.directory)
        with self.assertRaises(ValueError): verify(self.directory)
