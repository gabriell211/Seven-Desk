import os
import stat
import tempfile
import unittest
from pathlib import Path

from build import ensure_debian_maintainer_scripts_executable


class DebianMaintainerPermissionsTest(unittest.TestCase):
    def setUp(self):
        self.previous_dir = Path.cwd()
        self.temp_dir = tempfile.TemporaryDirectory()
        os.chdir(self.temp_dir.name)
        self.control_dir = Path("tmpdeb/DEBIAN")
        self.control_dir.mkdir(parents=True)

    def tearDown(self):
        os.chdir(self.previous_dir)
        self.temp_dir.cleanup()

    def test_all_maintainer_scripts_get_executable_mode(self):
        for name in ("preinst", "postinst", "prerm", "postrm", "config"):
            script = self.control_dir / name
            script.write_text("#!/bin/sh\nexit 0\n")
            script.chmod(0o644)

        ensure_debian_maintainer_scripts_executable()

        for name in ("preinst", "postinst", "prerm", "postrm", "config"):
            with self.subTest(name=name):
                self.assertEqual(
                    stat.S_IMODE((self.control_dir / name).stat().st_mode), 0o755
                )

    def test_missing_optional_scripts_are_allowed(self):
        ensure_debian_maintainer_scripts_executable()
        self.assertEqual(list(self.control_dir.iterdir()), [])

    def test_symlinks_are_rejected(self):
        target = Path("target.sh")
        target.write_text("#!/bin/sh\n")
        target.chmod(0o644)
        (self.control_dir / "preinst").symlink_to(target.resolve())

        with self.assertRaises(RuntimeError):
            ensure_debian_maintainer_scripts_executable()

        self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o644)


if __name__ == "__main__":
    unittest.main()
