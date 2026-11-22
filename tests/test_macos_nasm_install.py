"""Guard reproducible macOS NASM 2.16.03 setup and network mirrors."""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/flutter-build.yml"


class MacNasmInstallTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        lines = WORKFLOW.read_text().splitlines()
        start = lines.index("      - name: Install NASM")
        end = next(i for i in range(start + 1, len(lines))
                   if lines[i].startswith("      - name: "))
        cls.step_lines = lines[start:end]
        cls.script = "\n".join(
            line[10:] for line in cls.step_lines
            if line.startswith("          ")
        ) + "\n"

    def test_bash_script_is_valid(self):
        result = subprocess.run(["bash", "-n"], input=self.script,
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_sources_are_pinned_and_redundant(self):
        self.assertIn("version=2.16.03", self.script)
        self.assertIn(
            "expected_sha256=0d29bcd8a5fc617333f4549c7c1f93d1866a4a0915c40359e0a8585bb1a5aa75",
            self.script,
        )
        self.assertIn("https://www.nasm.us/", self.script)
        self.assertIn("https://linux.cs.nctu.edu.tw/", self.script)
        self.assertIn("https://files.kde.org/", self.script)
        self.assertIn("shasum -a 256", self.script)
        self.assertIn("Incorrect installed NASM version", self.script)
        self.assertNotIn("brew install nasm", "\n".join(
            line for line in self.step_lines if not line.lstrip().startswith("#")
        ))


if __name__ == "__main__":
    unittest.main()
