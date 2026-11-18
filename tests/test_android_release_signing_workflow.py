"""Release APK signing must reject debug keys for all distribution variants."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class AndroidReleaseSigningWorkflowTests(unittest.TestCase):
    def test_release_apks_use_verified_non_debug_signing(self):
        workflow = (ROOT / ".github/workflows/flutter-build.yml").read_text(encoding="utf-8")
        marker = "      - name: Verify signed Android identity"
        self.assertEqual(workflow.count(marker), 2)
        for idx, section in enumerate(workflow.split(marker)[1:], start=1):
            with self.subTest(build=idx):
                guard = section.split("      - name: Upload Artifacts", 1)[0]
                self.assertIn("!inputs.qa-artifacts", guard)
                self.assertIn("apksigner verify --verbose --print-certs", guard)
                self.assertIn("Verified using v2 scheme (APK Signature Scheme v2): true", guard)
                self.assertIn("Signer #1 certificate SHA-256 digest", guard)
                self.assertIn("CN=Android Debug", guard)
                self.assertIn("exit 1", guard)


if __name__ == "__main__":
    unittest.main()
