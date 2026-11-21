"""Packaging regressions from the Seven Desk 2026-11-19 completed build.

These checks fail fast before MSI/AppImage packaging; platform compilation,
signature validation and actual installer tests remain mandatory in CI.
"""
from pathlib import Path
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
        self.assertNotRegex(package, r"<InstallValidate\s+Condition=")
        self.assertNotIn('AllowSameVersionUpgrades="yes"', package)
        self.assertIn('AllowSameVersionUpgrades="no"', package)
        self.assertIn("SEVENDESK_SAME_OR_NEWER_INSTALLED", package)
        self.assertIn('OnlyDetect="yes"', package)
        self.assertIn('IncludeMinimum="yes"', package)

    def test_harvested_files_have_default_language(self):
        generator = (ROOT / "res/msi/preprocess.py").read_text(encoding="utf-8")
        self.assertRegex(generator, r'<File Source=.*DefaultLanguage="1033"')

    def test_vcpkg_ports_match_compiler_and_runtime(self):
        opus = (ROOT / "res/vcpkg/opus/portfile.cmake").read_text(encoding="utf-8")
        aom = (ROOT / "res/vcpkg/aom/portfile.cmake").read_text(encoding="utf-8")
        libyuv = (ROOT / "res/vcpkg/libyuv/portfile.cmake").read_text(encoding="utf-8")
        self.assertIn("VCPKG_CRT_LINKAGE", opus)
        self.assertIn("-DOPUS_STATIC_RUNTIME=ON", opus)
        self.assertIn("-DOPUS_STATIC_RUNTIME=OFF", opus)
        self.assertIn("string(FIND", aom)
        self.assertIn("NOT _aom_libm_offset EQUAL -1", aom)
        self.assertIn("AND NOT BUILD_OPTIONS", libyuv)

    def test_rpm_files_are_not_double_listed(self):
        for name in ("rpm-flutter.spec", "rpm-flutter-suse.spec"):
            with self.subTest(name=name):
                spec = (ROOT / "res" / name).read_text(encoding="utf-8")
                files = spec.split("%files", 1)[1].split("%changelog", 1)[0]
                self.assertIn("/usr/share/rustdesk/*", files)
                self.assertNotIn("/usr/share/rustdesk/files/rustdesk.service", files)
                self.assertNotIn("/usr/share/rustdesk/files/rustdesk.desktop", files)

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
                self.assertIn("https://keyserver.ubuntu.com", recipe)
                self.assertIn("871920D1991BC93C", recipe)
                self.assertEqual(
                    recipe.count("key_url:"),
                    8 if architecture == "x86_64" else 4,
                )


if __name__ == "__main__":
    unittest.main()
