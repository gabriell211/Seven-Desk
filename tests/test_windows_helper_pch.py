"""Windows window-helper PCH mitigation must not suppress its build or x64 output."""
from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/third-party-RustDeskTempTopMostWindow.yml"
PATCH = ROOT / "scripts/ci/patch-window-helper-pch.ps1"
NAMESPACE = {"m": "http://schemas.microsoft.com/developer/msbuild/2003"}


class WindowsHelperPchTests(unittest.TestCase):
    def test_only_arm64_is_patched(self) -> None:
        code = PATCH.read_text(encoding="utf-8")
        self.assertIn("if ($Platform -ne 'ARM64')", code)
        self.assertIn("if ($definitions.Count -ne 2 -or $perFileOverrides.Count -ne 2)", code)
        self.assertIn("$setting.InnerText = 'NotUsing'", code)
        self.assertIn("contains(@Condition, '|ARM64')", code)
        self.assertIn("ProjectFile", code)
        self.assertIn("$xml.Save($absolute)", code)

    def test_upstream_style_project_contains_both_pch_overrides(self) -> None:
        # Two ARM64 config rules and two pch.cpp rules mirror the pinned helper project.
        fixture = '''<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
          <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Debug|ARM64'">
            <ClCompile><PrecompiledHeader>Use</PrecompiledHeader></ClCompile>
          </ItemDefinitionGroup>
          <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|ARM64'">
            <ClCompile><PrecompiledHeader>Use</PrecompiledHeader></ClCompile>
          </ItemDefinitionGroup>
          <ItemGroup><ClCompile Include="pch.cpp">
            <PrecompiledHeader Condition="'$(Configuration)|$(Platform)'=='Debug|ARM64'">Create</PrecompiledHeader>
            <PrecompiledHeader Condition="'$(Configuration)|$(Platform)'=='Release|ARM64'">Create</PrecompiledHeader>
          </ClCompile></ItemGroup>
        </Project>'''
        root = ET.fromstring(fixture)
        definitions = root.findall(".//m:ItemDefinitionGroup/m:ClCompile/m:PrecompiledHeader", NAMESPACE)
        overrides = root.findall(".//m:ItemGroup/m:ClCompile/m:PrecompiledHeader", NAMESPACE)
        self.assertEqual([e.text for e in definitions], ["Use", "Use"])
        self.assertEqual([e.text for e in overrides], ["Create", "Create"])

    def test_helper_uses_pinned_readonly_source_and_fails_on_build_error(self) -> None:
        code = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("https://downloads.sevendesk.tech/deps/window-helper.git", code)
        self.assertIn("ecd8d6a139eee76845ea66423fb739af450fda90", code)
        self.assertIn("SevenDeskWindowHelper/WindowInjection", code)
        self.assertIn("patch-window-helper-pch.ps1", code)
        self.assertIn("/m:1 /nodeReuse:false", code)
        self.assertIn("/p:CL_MPCount=1", code)
        self.assertIn("/p:UseMultiToolTask=false", code)
        self.assertIn("if ($LASTEXITCODE -ne 0) { throw 'Windows helper MSBuild failed' }", code)
        self.assertIn("topmostwindow-artifacts-", code)
        self.assertNotIn("continue-on-error: true", code)

if __name__ == "__main__":
    unittest.main()
