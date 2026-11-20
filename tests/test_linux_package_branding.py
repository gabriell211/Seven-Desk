"""Regression checks for Seven Desk Linux package launcher identity.

The internal app binary and service remain unchanged until a separate physical
connection compatibility test can validate renaming those runtime components.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class LinuxPackageBrandingTests(unittest.TestCase):
    def test_desktop_entries_launch_seven_desk(self):
        for path in ("res/rustdesk.desktop", "res/rustdesk-link.desktop"):
            with self.subTest(path=path):
                data = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn("Name=Seven Desk\n", data)
                self.assertIn("Exec=sevendesk %u\n", data)
                self.assertIn("Icon=sevendesk\n", data)
                self.assertNotIn("Exec=rustdesk %u", data)
                self.assertNotIn("Icon=rustdesk\n", data)

    def test_debian_launcher_and_cleanup(self):
        postinst = (ROOT / "res/DEBIAN/postinst").read_text(encoding="utf-8")
        prerm = (ROOT / "res/DEBIAN/prerm").read_text(encoding="utf-8")
        self.assertIn("/usr/share/rustdesk/rustdesk /usr/bin/sevendesk", postinst)
        self.assertIn("rm -f /usr/bin/sevendesk", prerm)

    def test_all_native_packages_include_new_icon_and_launcher(self):
        build = (ROOT / "build.py").read_text(encoding="utf-8")
        self.assertGreaterEqual(build.count("256x256/apps/sevendesk.png"), 3)
        for path in ("res/rpm-flutter.spec", "res/rpm-flutter-suse.spec", "res/PKGBUILD"):
            with self.subTest(path=path):
                data = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn("256x256/apps/sevendesk.png", data)
                self.assertIn("usr/bin/sevendesk", data)

    def test_deb_and_rpm_ci_artifacts_are_branded(self):
        workflow = (ROOT / ".github/workflows/flutter-build.yml").read_text(encoding="utf-8")
        self.assertIn("path: sevendesk-${{ env.VERSION }}-${{ matrix.job.arch }}.deb", workflow)
        self.assertIn("Upload Linux RPM packages", workflow)
        self.assertIn("path: sevendesk-${{ env.VERSION }}*.rpm", workflow)


if __name__ == "__main__":
    unittest.main()
