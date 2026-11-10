"""Regression guard for the Windows product name, installer and release assets."""
import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class WindowsBrandingTests(unittest.TestCase):
    def test_windows_installers_use_seven_desk_identity(self):
        spec = importlib.util.spec_from_file_location(
            "msi_preprocess", ROOT / "res" / "msi" / "preprocess.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        options = module.make_parser().parse_args(
            ["--app-name", "SevenDesk", "--display-name", "Seven Desk",
             "--manufacturer", "Seven Desk"]
        )
        self.assertEqual((options.app_name, options.display_name, options.manufacturer),
                         ("SevenDesk", "Seven Desk", "Seven Desk"))

        workflow = (ROOT / ".github/workflows/flutter-build.yml").read_text(encoding="utf-8")
        self.assertIn("Rename-Item -LiteralPath ./rustdesk/rustdesk.exe -NewName SevenDesk.exe", workflow)
        self.assertIn('python preprocess.py --arp -d ../../rustdesk --app-name SevenDesk --display-name "Seven Desk"', workflow)
        self.assertIn("SignOutput/sevendesk-", workflow)
        self.assertIn("python3 ./generate.py -f ../../rustdesk/ -o . -e ../../rustdesk/SevenDesk.exe", workflow)
        wix = (ROOT / "res/msi/Package/Package.wxs").read_text(encoding="utf-8")
        self.assertIn('Name="$(var.ProductDisplayName)"', wix)

        winres = (ROOT / "flutter/windows/runner/Runner.rc").read_text(encoding="utf-8")
        self.assertIn('VALUE "ProductName", "Seven Desk"', winres)
        self.assertIn('VALUE "OriginalFilename", "SevenDesk.exe"', winres)
        src = (ROOT / "src/common.rs").read_text(encoding="utf-8")
        self.assertIn('return "SevenDesk".to_owned();', src)
        self.assertIn('"RustDesk" | "SevenDesk"', src)


if __name__ == "__main__":
    unittest.main()
