"""Release guard: native packages, Flutter and installer metadata must agree."""
import os
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class ReleaseVersionConsistencyTests(unittest.TestCase):
    def test_distribution_versions_match_native_package(self):
        native = re.search(r'(?m)^version = "(\d+\.\d+\.\d+)"$', read("Cargo.toml"))
        self.assertIsNotNone(native)
        version = native.group(1)
        patterns = {
            "libs/portable/Cargo.toml": rf'(?m)^version = "{re.escape(version)}"$',
            "flutter/pubspec.yaml": rf"(?m)^version: {re.escape(version)}\+\d+$",
            "res/PKGBUILD": rf"(?m)^pkgver={re.escape(version)}$",
            "res/rpm.spec": rf"(?m)^Version:\s+{re.escape(version)}$",
            "res/rpm-flutter.spec": rf"(?m)^Version:\s+{re.escape(version)}$",
            "res/rpm-flutter-suse.spec": rf"(?m)^Version:\s+{re.escape(version)}$",
            ".github/workflows/flutter-build.yml": rf'(?m)^  VERSION: "{re.escape(version)}"$',
            ".github/workflows/playground.yml": rf'(?m)^  VERSION: "{re.escape(version)}"$',
            "appimage/AppImageBuilder-x86_64.yml": rf"(?m)^    version: {re.escape(version)}$",
            "appimage/AppImageBuilder-aarch64.yml": rf"(?m)^    version: {re.escape(version)}$",
        }
        for path, pattern in patterns.items():
            with self.subTest(path=path):
                self.assertRegex(read(path), pattern)
        lockfile = read("Cargo.lock")
        for name in ("rustdesk", "rustdesk-portable-packer"):
            with self.subTest(package=name):
                match = re.search(r'(?m)^\[\[package\]\]\nname = "' + re.escape(name) +
                                  r'"\nversion = "([^"]+)"', lockfile)
                self.assertIsNotNone(match)
                self.assertEqual(match.group(1), version)
        tag = os.getenv("GITHUB_REF_NAME", "").strip()
        if tag and os.getenv("GITHUB_REF_TYPE") == "tag":
            self.assertRegex(tag, rf"^v?{re.escape(version)}(?:-[0-9]+)?$",
                                 "Published tag must match the compiled package version")


    def test_flatpak_sdk_2408_avoids_removed_appstream_compose(self):
        import json

        manifest = json.loads(read("flatpak/rustdesk.json"))
        self.assertEqual(manifest["runtime-version"], "24.08")
        self.assertIs(manifest["appstream-compose"], False)
        self.assertTrue((ROOT / "flatpak/tech.sevendesk.app.metainfo.xml").is_file())
        self.assertTrue(
            any("tech.sevendesk.app.metainfo.xml" in cmd
                for module in manifest["modules"] if isinstance(module, dict)
                for cmd in module.get("build-commands", [])),
            "Keep source AppStream metadata even when the obsolete composer is disabled",
        )

    def test_legacy_build_containers_bootstrap_signed_ca_packages_first(self):
        workflow = read(".github/workflows/flutter-build.yml")
        # Two legacy Linux variants, Sciter and Flatpak share this bootstrap.
        marker = "Bootstrapping CA certificates from GPG-signed Ubuntu packages"
        self.assertEqual(workflow.count(marker), 4)
        blocks = re.findall(r"(?m)^          install: \|\n((?:            .*\n)+)", workflow)
        patched = [block for block in blocks if marker in block]
        self.assertEqual(len(patched), 4)
        for block in patched:
            with self.subTest(builder=patched.index(block)):
                self.assertIn("dpkg-query -W -f='${Status}' ca-certificates", block)
                self.assertIn("apt_retry -o Acquire::https::Verify-Peer=false", block)
                self.assertIn("-o Acquire::https::Verify-Host=false", block)
                self.assertIn("install -y --no-install-recommends ca-certificates", block)
                self.assertIn("test -s /etc/ssl/certs/ca-certificates.crt", block)
                self.assertIn("update-ca-certificates", block)
                self.assertIn("apt_retry update", block.split("update-ca-certificates", 1)[1])
                self.assertNotIn("--allow-unauthenticated", block)
                self.assertNotIn("trusted=yes", block)
                self.assertNotIn("AllowInsecureRepositories", block)

    def test_flatpak_packaging_uses_supported_builder(self):
        workflow = read(".github/workflows/flutter-build.yml")
        block = workflow.split("  build-flatpak:\n", 1)[1].split("\n  build-rustdesk-web:", 1)[0]
        self.assertEqual(block.count("distro: ubuntu24.04,"), 3)
        self.assertEqual(block.count("on: ubuntu-24.04,"), 2)
        self.assertEqual(block.count("on: ubuntu-24.04-arm,"), 1)
        self.assertIn("apt_retry install -y git flatpak flatpak-builder", block)
        self.assertIn("apt_retry update -y", block)
        self.assertIn("https://archive.ubuntu.com/ubuntu", block)
        self.assertIn("flatpak-builder --version", block)
        self.assertNotIn("ubuntu22.04", block)


if __name__ == "__main__":
    unittest.main()
