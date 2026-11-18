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


if __name__ == "__main__":
    unittest.main()
