"""Microsoft Store packaging contracts; no live Store identity or signing secrets used."""
import importlib.util
from pathlib import Path
import re
import unittest
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "scripts/store/msix_manifest.py"
spec = importlib.util.spec_from_file_location("msix_manifest", source)
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)


class MicrosoftStoreMsixTests(unittest.TestCase):
    def render(self, arch="x64", name="SevenDesk.QA", publisher="CN=SevenDesk.QA"):
        return manifest.build_manifest(name, publisher, "Seven Desk QA", "1.5.4.0", arch)

    def test_both_supported_windows_architectures(self):
        for arch in ("x64", "arm64"):
            with self.subTest(arch=arch):
                root = ET.fromstring(self.render(arch))
                q = lambda element: f"{{{manifest.BASE}}}{element}"
                identity = root.find(q("Identity"))
                self.assertEqual(identity.attrib["ProcessorArchitecture"], arch)
                self.assertEqual(identity.attrib["Version"], "1.5.4.0")
                app = root.find(f"{q('Applications')}/{q('Application')}")
                self.assertEqual(app.attrib["Executable"], "SevenDesk.exe")
                self.assertEqual(app.attrib[f"{{{manifest.UAP10}}}RuntimeBehavior"], "packagedClassicApp")
                self.assertEqual(app.attrib[f"{{{manifest.UAP10}}}TrustLevel"], "mediumIL")
                permission = root.find(f"{q('Capabilities')}/{{{manifest.RESCAP}}}Capability")
                self.assertEqual(permission.attrib["Name"], "runFullTrust")
                self.assertEqual(root.find(f"{q('Properties')}/{q('Logo')}").text, r"Assets\StoreLogo.png")

    def test_publisher_values_are_xml_escaped(self):
        xml = self.render(publisher="CN=Seven Desk & Co., O=Test").decode("utf-8")
        self.assertIn("CN=Seven Desk &amp; Co.", xml)
        ET.fromstring(xml)

    def test_invalid_version_rejected(self):
        for version in ("v1.5.4", "1.5.4", "1.5.4.1", "1.5.70000.0", "0.1.1.0", "1.5.evil.0"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                manifest.validate_version(version)

    def test_missing_partner_identity_rejected(self):
        for name,publisher in (("", "CN=Valid"), ("../../Bad", "CN=Valid"), ("Valid.Test", "BadPublisher")):
            with self.subTest(name=name,publisher=publisher), self.assertRaises(ValueError):
                self.render(name=name,publisher=publisher)

    def test_store_script_verifies_PE_and_round_trip(self):
        script = (ROOT / "scripts/store/build_msix.ps1").read_text()
        for token in ("0xaa64", "0x8664", "makeappx.exe", "unpack /p", "Get-FileHash",
                      "flutter_windows.dll", "Square150x150Logo.png", "data\\app.so"):
            self.assertIn(token.lower(), script.lower())

    def test_workflow_never_publishes_unsigned_package_to_website(self):
        workflow = (ROOT / ".github/workflows/microsoft-store.yml").read_text()
        self.assertIn("actions/download-artifact", workflow)
        self.assertIn("makeappx", workflow.lower())
        self.assertIn("workflow_dispatch", workflow)
        self.assertIn("use_partner_center", workflow)
        self.assertNotIn("softprops/action-gh-release", workflow)
        self.assertNotIn("downloads.sevendesk.tech", workflow)
        self.assertNotRegex(workflow, r"(?im)^\s*contents:\s*write\s*$")


if __name__ == "__main__":
    unittest.main()
