"""Fail-closed gate for publishing installers to the Seven Desk VPS."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_public_release import validated_physical_qa


class VPSReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.work = tempfile.TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        self.root = Path(self.work.name)
        self.approval = self.root / "approval.json"
        self.evidence = self.root / "evidence"
        self.evidence.mkdir()

    def doc(self, uac=True, source_sha="a" * 40):
        items = []
        for n in (1, 2):
            m = f"physical-machine-{n:02d}"
            f = self.evidence / f"machine-{n}.log"
            f.write_text("SYNTHETIC FIXTURE ONLY. NOT REAL PHYSICAL QA.\n")
            f.chmod(0o600)
            items.append({"machine_id": m, "filename": f.name, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
        return {
            "tag": "v1.5.4", "source_commit": source_sha, "ci_run_id": 12345,
            "reviewed_by": "unit-test-fixture",
            "machines": [{"id": "physical-machine-01"}, {"id": "physical-machine-02"}],
            "session_checks": {"connection": True, "disconnect": True, "file_transfer": True, "uac_elevation": uac},
            "android_signing": {"distribution_key": True, "debug_key_rejected": True, "certificate_sha256": "b" * 64},
            "evidence": items,
        }

    def write(self, doc):
        self.approval.write_text(json.dumps(doc))
        self.approval.chmod(0o600)

    def check(self):
        return validated_physical_qa("a" * 40, 12345, self.approval,
                                     evidence_root=self.evidence, expected_uid=os.geteuid())

    def test_no_evidence(self):
        self.assertFalse(self.check())

    def test_synthetic_happy_path_only_validates_structure(self):
        self.write(self.doc())
        self.assertTrue(self.check())

    def test_uac_failure(self):
        self.write(self.doc(uac=False))
        with self.assertRaisesRegex(ValueError, "uac_elevation"):
            self.check()

    def test_wrong_commit(self):
        self.write(self.doc(source_sha="c" * 40))
        with self.assertRaisesRegex(ValueError, "exact release"):
            self.check()

    def test_unsafe_permissions(self):
        self.write(self.doc())
        self.approval.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "permissions"):
            self.check()

    def test_duplicate_machine(self):
        record = self.doc()
        record["machines"][1]["id"] = record["machines"][0]["id"]
        self.write(record)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.check()


if __name__ == "__main__":
    unittest.main()
