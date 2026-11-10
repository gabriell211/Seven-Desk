"""Guard the mfx-dispatch port against third-party commit patch rate limiting."""

import pathlib
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
PORT_DIR = ROOT / "res" / "vcpkg" / "mfx-dispatch"
PATCH_FILE = PORT_DIR / "fix-missing-cstdint-import.patch"


class MfxDispatchPatchTests(unittest.TestCase):
    def test_port_uses_local_patch(self) -> None:
        portfile = (PORT_DIR / "portfile.cmake").read_text(encoding="utf-8")
        self.assertIn("fix-missing-cstdint-import.patch", portfile)
        self.assertNotIn("github.com/lu-zero/mfx_dispatch/commit/", portfile)
        self.assertNotIn("MISSING_CSTDINT_IMPORT_PATCH", portfile)

    def test_patch_applies_cleanly(self) -> None:
        # The surrounding include block comes from upstream mfx_dispatch 1.35.1.
        with tempfile.TemporaryDirectory() as directory:
            directory_path = pathlib.Path(directory)
            source = directory_path / "src" / "mfxparser.cpp"
            source.parent.mkdir()
            source.write_text(
                "#include <ctype.h>\n"
                "#include <stdio.h>\n"
                "#include <stdlib.h>\n"
                "#include <string.h>\n"
                "\n"
                "#include <list>\n"
                "\n"
                '#include "mfxloader.h"\n',
                encoding="utf-8",
            )
            result = subprocess.run(
                ["git", "apply", "--check", str(PATCH_FILE)],
                cwd=directory,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
