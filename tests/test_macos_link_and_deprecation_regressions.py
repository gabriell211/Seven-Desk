"""Guard the macOS linker, supported deployment versions and removed APIs."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MacOSLinkTests(unittest.TestCase):
    def test_permissions_do_not_require_compiler_rt_availability(self):
        source = (ROOT / "src/platform/macos.mm").read_text(encoding="utf-8")
        self.assertNotIn("@available(", source)
        for symbol in (
            "CGPreflightScreenCaptureAccess",
            "CGRequestScreenCaptureAccess",
            "IOHIDCheckAccess",
            "IOHIDRequestAccess",
        ):
            with self.subTest(symbol=symbol):
                self.assertIn(f'dlsym(RTLD_DEFAULT, "{symbol}")', source)

    def test_deprecated_macos_apis_removed(self):
        source = (ROOT / "src/platform/macos.mm").read_text(encoding="utf-8")
        self.assertNotIn("AuthorizationExecuteWithPrivileges(", source)
        self.assertNotIn("CGDisplayModeCopyPixelEncoding(", source)
        self.assertEqual(source.count("CGDisplayModeIsUsableForDesktopGUI(mode)"), 2)
        self.assertIn("AuthorizationFree(authRef, kAuthorizationFlagDefaults)", source)

    def test_codec_deployment_targets_align(self):
        x64 = (ROOT / "res/vcpkg-triplets/x64-osx.cmake").read_text(encoding="utf-8")
        arm = (ROOT / "res/vcpkg-triplets/arm64-osx.cmake").read_text(encoding="utf-8")
        workflow = (ROOT / ".github/workflows/flutter-build.yml").read_text(encoding="utf-8")
        self.assertIn('VCPKG_OSX_DEPLOYMENT_TARGET "10.14"', x64)
        self.assertIn('VCPKG_OSX_DEPLOYMENT_TARGET "12.3"', arm)
        self.assertIn("VCPKG_OSX_ARCHITECTURES x86_64", x64)
        self.assertIn("VCPKG_OSX_ARCHITECTURES arm64", arm)
        self.assertIn("VCPKG_DEFAULT_TRIPLET: ${{ matrix.job.vcpkg-triplet }}", workflow)
        self.assertIn("MACOSX_DEPLOYMENT_TARGET: ${{ matrix.job.arch == 'aarch64' && '12.3' || '10.14' }}", workflow)


if __name__ == "__main__":
    unittest.main()
