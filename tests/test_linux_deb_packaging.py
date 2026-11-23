"""Tests for Debian artifact naming and the Linux release packaging contract."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github/scripts/prepare-linux-deb-for-packaging.sh"


@unittest.skipUnless(shutil.which("dpkg-deb"), "Requires Debian dpkg-deb")
class DebianPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def make_package(self, filename, *, package="sevendesk", arch="amd64"):
        root = self.root / "source"
        (root / "DEBIAN").mkdir(parents=True)
        (root / "DEBIAN/control").write_text(
            f"Package: {package}\nVersion: 1.5.4\nArchitecture: {arch}\n"
            "Maintainer: Seven Desk <noreply@example.invalid>\n"
            "Description: Packaging regression fixture\n"
        )
        (root / "usr/share/sevendesk").mkdir(parents=True)
        (root / "usr/share/sevendesk/test").write_text("ok")
        result = self.root / filename
        subprocess.run(["dpkg-deb", "--build", str(root), str(result)],
                       check=True, stdout=subprocess.DEVNULL)
        shutil.rmtree(root)
        return result

    def prepare(self, arch="x86_64", destination="appimage/rustdesk.deb", suffix=""):
        return subprocess.run(
            ["bash", str(SCRIPT), "1.5.4", arch, destination, suffix],
            cwd=self.root, capture_output=True, text=True,
        )

    def test_branded_appimage_x64(self):
        package = self.make_package("sevendesk-1.5.4-x86_64.deb")
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / "appimage/rustdesk.deb").read_bytes(),
                         package.read_bytes())

    def test_branded_appimage_arm64(self):
        self.make_package("sevendesk-1.5.4-aarch64.deb", arch="arm64")
        result = self.prepare(arch="aarch64")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_legacy_filename_keeps_seven_desk_package_identity(self):
        self.make_package("rustdesk-1.5.4-x86_64-sciter.deb")
        result = self.prepare(destination="flatpak/rustdesk.deb", suffix="-sciter")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_artifact_is_rejected(self):
        self.assertNotEqual(self.prepare().returncode, 0)

    def test_ambiguous_artifacts_are_rejected(self):
        self.make_package("sevendesk-1.5.4-x86_64.deb")
        self.make_package("rustdesk-1.5.4-x86_64.deb")
        self.assertNotEqual(self.prepare().returncode, 0)

    def test_wrong_package_name_is_rejected(self):
        self.make_package("sevendesk-1.5.4-x86_64.deb", package="other")
        self.assertNotEqual(self.prepare().returncode, 0)

    def test_wrong_architecture_is_rejected(self):
        self.make_package("sevendesk-1.5.4-aarch64.deb", arch="amd64")
        self.assertNotEqual(self.prepare(arch="aarch64").returncode, 0)


class WorkflowTests(unittest.TestCase):
    def test_both_linux_packagers_use_validated_debian_input(self):
        text = (ROOT / ".github/workflows/flutter-build.yml").read_text()
        self.assertEqual(text.count(
            "bash .github/scripts/prepare-linux-deb-for-packaging.sh"), 2)
        self.assertIn("appimage/rustdesk.deb", text)
        self.assertIn("flatpak/rustdesk.deb", text)


if __name__ == "__main__":
    unittest.main()
