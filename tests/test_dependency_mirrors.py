"""Guard Git dependency provenance and avoid unreliable mandatory VPS rewrites."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
HWCODEC_SHA = "ec38ebaf2454269d4c5668a57e3813c6e5541be7"
EXTERNALS_SHA = "8903740a1f47884906a6e347ad3d8d56304d9771"


class DependencySourceTests(unittest.TestCase):
    def test_workflows_do_not_redirect_git_dependencies(self):
        for filename in ("flutter-build.yml", "bridge.yml", "ci.yml"):
            with self.subTest(filename=filename):
                text = (ROOT / ".github/workflows" / filename).read_text()
                self.assertNotIn("GIT_CONFIG_COUNT", text)
                self.assertNotIn("GIT_CONFIG_KEY_", text)
                self.assertNotIn("GIT_CONFIG_VALUE_", text)
                self.assertNotIn("downloads.sevendesk.tech/deps/", text)
                self.assertNotIn("GIT_SSL_NO_VERIFY", text)
                self.assertNotIn("http.sslVerify false", text)

    def test_cross_architecture_containers_do_not_inherit_git_rewrites(self):
        text = (ROOT / ".github/workflows/flutter-build.yml").read_text()
        blocks = re.findall(
            r"^          dockerRunArgs: \|\n((?:            .*\n)+)", text, flags=re.M
        )
        self.assertEqual(len(blocks), 4)
        for block in blocks:
            self.assertNotIn("GIT_CONFIG_", block)

    def test_pinned_upstream_commit_is_unchanged(self):
        cargo_lock = (ROOT / "Cargo.lock").read_text()
        self.assertIn(
            'source = "git+https://github.com/rustdesk-org/hwcodec#'
            + HWCODEC_SHA + '"',
            cargo_lock,
        )
        mac = (ROOT / ".github/workflows/flutter-build.yml").read_text()
        self.assertIn("Verify pinned upstream Git dependencies (macOS)", mac)
        self.assertIn(f"hwcodec {HWCODEC_SHA}", mac)
        self.assertIn(f"externals {EXTERNALS_SHA}", mac)
        self.assertIn("cargo build --locked", mac)

    def test_optional_mirror_probe_retains_original_commit_ids(self):
        script = (ROOT / ".github/scripts/verify-dependency-mirrors.sh").read_text()
        self.assertIn("set -euo pipefail", script)
        self.assertIn(f"hwcodec {HWCODEC_SHA}", script)
        self.assertIn(f"externals {EXTERNALS_SHA}", script)


if __name__ == "__main__":
    unittest.main()
