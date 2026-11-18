import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_qa_artifacts import inspect, TYPES

VERSION = "1.5.3"
COMMIT = "a" * 40

def build_fake(root):
    for name, (suffix, kind) in TYPES.items():
        path = root / f"sevendesk-{VERSION}-{suffix}"
        content = bytearray(5000)
        if kind == "dmg":
            content[-512:-508] = b"koly"
        elif kind == "exe":
            content[:2] = b"MZ"
        elif kind == "msi":
            content[:8] = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        elif kind == "appimage":
            content[:4] = b"\x7fELF"
        elif kind == "apk":
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("AndroidManifest.xml", b"manifest", compress_type=zipfile.ZIP_STORED)
                z.writestr("assets/test.bin", b"0" * 6000, compress_type=zipfile.ZIP_STORED)
            continue
        path.write_bytes(content)

class VerifyQA(unittest.TestCase):
    def test_complete_build_has_nine_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build_fake(root)
            report = inspect(root, VERSION, COMMIT)
            self.assertEqual(report["status"], "QA_ONLY_NOT_A_RELEASE")
            self.assertEqual(len(report["files"]), 9)
            self.assertTrue(all(len(x["sha256"]) == 64 for x in report["files"]))

    def test_missing_or_invalid_binaries_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build_fake(root)
            (root / f"sevendesk-{VERSION}-x86_64.AppImage").unlink()
            with self.assertRaisesRegex(ValueError, "expected one artifact"):
                inspect(root, VERSION, COMMIT)
            build_fake(root)
            (root / f"sevendesk-{VERSION}-x86_64.exe").write_bytes(b"MZ")
            with self.assertRaisesRegex(ValueError, "truncated"):
                inspect(root, VERSION, COMMIT)
            build_fake(root)
            (root / f"sevendesk-{VERSION}-x86_64.dmg").write_bytes(b"X" * 5000)
            with self.assertRaisesRegex(ValueError, "UDIF"):
                inspect(root, VERSION, COMMIT)

    def test_invalid_metadata_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build_fake(root)
            with self.assertRaisesRegex(ValueError, "Invalid version"):
                inspect(root, "../x", COMMIT)
            with self.assertRaisesRegex(ValueError, "Invalid version"):
                inspect(root, VERSION, "not-a-commit")

if __name__ == "__main__":
    unittest.main()
