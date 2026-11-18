"""Regression checks for Seven Desk Linux portable installer branding.

The runtime binary remains at its existing internal path until a separately
homologated Linux migration; only the user-facing AppImage name and icon change.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class AppImageIdentityTests(unittest.TestCase):
    def test_both_architectures_have_seven_desk_desktop_identity(self):
        for arch in ("x86_64", "aarch64"):
            with self.subTest(arch=arch):
                recipe = (ROOT / "appimage" / f"AppImageBuilder-{arch}.yml").read_text(encoding="utf-8")
                self.assertIn("    id: sevendesk\n", recipe)
                self.assertIn("    name: Seven Desk\n", recipe)
                self.assertIn("    icon: sevendesk\n", recipe)
                self.assertNotIn("    icon: rustdesk\n", recipe)
                self.assertIn("apps/sevendesk.png", recipe)
                self.assertNotIn("apps/rustdesk.png", recipe)
                self.assertIn("exec: usr/share/rustdesk/rustdesk\n", recipe)
                self.assertIn("    exec_args: $@\n", recipe)
                self.assertIn(" - rm -rf ./AppDir/usr/share/applications\n", recipe)

    def test_legacy_linux_desktop_entry_never_opens_terminal(self):
        desktop = (ROOT / "res" / "rustdesk.desktop").read_text(encoding="utf-8")
        self.assertIn("Name=Seven Desk\n", desktop)
        self.assertIn("Terminal=false\n", desktop)


if __name__ == "__main__":
    unittest.main()
