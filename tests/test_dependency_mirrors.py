"""Check reproducible source mirror configuration without network requests."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
MAPPINGS = (
    ("url.https://downloads.sevendesk.tech/deps/hwcodec.git.insteadOf", "https://github.com/rustdesk-org/hwcodec"),
    ("url.https://downloads.sevendesk.tech/deps/hwcodec.git.insteadOf", "https://github.com/rustdesk-org/hwcodec.git"),
    ("url.https://downloads.sevendesk.tech/deps/externals.git.insteadOf", "https://github.com/rustdesk-org/externals.git"),
    ("url.https://downloads.sevendesk.tech/deps/externals.git.insteadOf", "https://github.com/rustdesk-org/externals"),
)


class DependencyMirrorTests(unittest.TestCase):
    def test_rust_build_workflows_use_pinned_mirrors(self):
        for filename in ("flutter-build.yml", "bridge.yml", "ci.yml"):
            with self.subTest(filename=filename):
                code = (ROOT / ".github/workflows" / filename).read_text()
                self.assertIn('GIT_CONFIG_COUNT: "4"', code)
                for n, (key, value) in enumerate(MAPPINGS):
                    self.assertIn(f'GIT_CONFIG_KEY_{n}: "{key}"', code)
                    self.assertIn(f'GIT_CONFIG_VALUE_{n}: "{value}"', code)
                self.assertNotIn("GIT_SSL_NO_VERIFY", code)
                self.assertNotIn("http.sslVerify false", code)

    def test_all_cross_architecture_containers_receive_mirror_config(self):
        data = (ROOT / ".github/workflows/flutter-build.yml").read_text()
        blocks = re.findall(r"^          dockerRunArgs: \|\n((?:            .*\n)+)", data, flags=re.M)
        self.assertEqual(len(blocks), 4)
        for block in blocks:
            self.assertIn("--env GIT_CONFIG_COUNT", block)
            for n in range(4):
                self.assertIn(f"--env GIT_CONFIG_KEY_{n}", block)
                self.assertIn(f"--env GIT_CONFIG_VALUE_{n}", block)

    def test_probe_checks_original_submodule_commits(self):
        script = (ROOT / ".github/scripts/verify-dependency-mirrors.sh").read_text()
        self.assertIn("set -euo pipefail", script)
        self.assertIn("hwcodec ec38ebaf2454269d4c5668a57e3813c6e5541be7", script)
        self.assertIn("externals 8903740a1f47884906a6e347ad3d8d56304d9771", script)


if __name__ == "__main__":
    unittest.main()
