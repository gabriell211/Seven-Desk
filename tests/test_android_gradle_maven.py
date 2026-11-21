"""Regression checks for reproducible Android Gradle dependency recovery."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github/scripts/prepare-android-gradle-maven.sh"


class AndroidGradleMavenTests(unittest.TestCase):
    def test_all_android_apk_jobs_prepare_included_build(self):
        workflow = (ROOT / ".github/workflows/flutter-build.yml").read_text()
        self.assertEqual(workflow.count("bash .github/scripts/prepare-android-gradle-maven.sh"), 2)
        for job in ("build-rustdesk-android:", "build-rustdesk-android-universal:"):
            self.assertIn(job, workflow)

    def test_pinned_missing_dependency_artifacts(self):
        source = SCRIPT.read_text()
        required = (
            "com/squareup/javawriter/2.5.0/javawriter-2.5.0.pom",
            "com/squareup/javawriter/2.5.0/javawriter-2.5.0.jar",
            "org/ow2/asm/asm/9.1/asm-9.1.pom",
            "org/ow2/asm/asm/9.1/asm-9.1.jar",
        )
        for filename in required:
            with self.subTest(filename=filename):
                self.assertIn(filename, source)
        self.assertIn("sha256sum", source)
        self.assertIn("https://repo.maven.apache.org/maven2", source)
        self.assertIn("https://repo1.maven.org/maven2", source)

    def test_only_flutter_included_build_is_patched(self):
        source = SCRIPT.read_text()
        self.assertIn("packages/flutter_tools/gradle", source)
        self.assertIn("settings.gradle.kts", source)
        self.assertIn(".sevendesk-maven-seed", source)
        self.assertNotIn('gradle-wrapper.properties', source)
        self.assertNotIn('flutter/android/settings.gradle', source.split("python3 -")[1])


if __name__ == "__main__":
    unittest.main()
