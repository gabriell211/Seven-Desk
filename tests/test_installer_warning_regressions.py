"""Packaging regressions from the Seven Desk 2026-11-19 completed build.

These checks fail fast before MSI/AppImage packaging; platform compilation,
signature validation and actual installer tests remain mandatory in CI.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InstallerWarningRegressionTests(unittest.TestCase):
    def test_shell_execute_results_are_pointer_width(self):
        source = (ROOT / "res/msi/CustomActions/CustomActions.cpp").read_text(encoding="utf-8")
        self.assertNotIn("(int)hi", source)
        self.assertIn("reinterpret_cast<INT_PTR>(hi)", source)
        self.assertNotIn("reinterpret_cast<const BYTE*>(valueData)", source)
        self.assertIn("reinterpret_cast<const BYTE*>(&valueData)", source)

    def test_msi_uses_unconditional_install_validate(self):
        package = (ROOT / "res/msi/Package/Package.wxs").read_text(encoding="utf-8-sig")
        self.assertNotRegex(package, r"<InstallValidate\\s+Condition=")
        self.assertNotIn('AllowSameVersionUpgrades="yes"', package)
        self.assertIn('AllowSameVersionUpgrades="no"', package)

    def test_harvested_files_have_default_language(self):
        generator = (ROOT / "res/msi/preprocess.py").read_text(encoding="utf-8")
        self.assertRegex(generator, r'<File Source=.*DefaultLanguage="1033"')

    def test_appimages_do_not_accept_unsigned_packages(self):
        for architecture in ("x86_64", "aarch64"):
            with self.subTest(architecture=architecture):
                recipe = (ROOT / f"appimage/AppImageBuilder-{architecture}.yml").read_text(encoding="utf-8")
                self.assertIn("allow_unauthenticated: false", recipe)
                self.assertIn("gstreamer1.0-tools", recipe)
                self.assertIn("    - bash", recipe)
                self.assertIn("    - dash", recipe)
                self.assertNotIn("http://archive.ubuntu.com", recipe)
                self.assertNotIn("http://ports.ubuntu.com", recipe)


if __name__ == "__main__":
    unittest.main()
