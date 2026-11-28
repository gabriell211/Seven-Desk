#!/usr/bin/env bash
set -euo pipefail

# Flutter 3.24.5 builds its own included Gradle plugin (:gradle) with AGP 7.3.0.
# Its separate settings.gradle.kts ignores repositories in flutter/android.
if [[ -n "${FLUTTER_SDK_ROOT:-}" ]]; then
  flutter_root="$FLUTTER_SDK_ROOT"
else
  flutter_executable="$(command -v flutter)"
  flutter_root="$(dirname "$(dirname "$(readlink -f "$flutter_executable")")")"
fi
gradle_dir="$flutter_root/packages/flutter_tools/gradle"
settings="$gradle_dir/settings.gradle.kts"
if [[ ! -f "$settings" ]]; then
  echo "Flutter Gradle included build not found: $settings" >&2
  exit 1
fi

# Keep third-party artifacts isolated from the user's Maven cache. Each byte
# is pinned and verified so an alternate Maven host cannot change the build.
seed="$gradle_dir/.sevendesk-maven-seed"
temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$temp_dir"' EXIT

while read -r relative sha256; do
  [[ -n "$relative" ]] || continue
  target="$seed/$relative"
  mkdir -p "$(dirname "$target")"
  if [[ -f "$target" ]] && [[ "$(sha256sum "$target" | cut -d' ' -f1)" == "$sha256" ]]; then
    continue
  fi

  valid=false
  for origin in https://maven-central.storage-download.googleapis.com/maven2 https://repo.maven.apache.org/maven2 https://repo1.maven.org/maven2; do
    candidate="$temp_dir/$(basename "$relative")"
    if curl --fail --location --silent --show-error --retry 3 \
        --retry-connrefused --connect-timeout 10 --max-time 45 \
        --output "$candidate" "$origin/$relative" \
        && [[ "$(sha256sum "$candidate" | cut -d' ' -f1)" == "$sha256" ]]; then
      install -m 0644 "$candidate" "$target"
      valid=true
      break
    fi
    echo "Maven artifact unavailable or checksum mismatch: $origin/$relative" >&2
  done
  if [[ "$valid" != true ]]; then
    echo "Unable to verify pinned Gradle dependency: $relative" >&2
    exit 1
  fi
  echo "Verified Android Gradle dependency: $relative"
done <<'MAVEN_ARTIFACTS'
com/squareup/javawriter/2.5.0/javawriter-2.5.0.pom e1abd7f1116cf5e0c59947693e2189208ec94296b2a3394c959e3511d399a7b0
com/squareup/javawriter/2.5.0/javawriter-2.5.0.jar fcfb09fb0ea0aa97d3cfe7ea792398081348e468f126b3603cb3803f240197f0
org/ow2/asm/asm/9.1/asm-9.1.pom c683a90dd68f2b1788cbdfc4647ea9405ef5925b371c199f8fd39d44d3cede8d
org/ow2/asm/asm/9.1/asm-9.1.jar cda4de455fab48ff0bcb7c48b4639447d4de859a7afc30a094a986f0936beba2
MAVEN_ARTIFACTS

# Patch only the Flutter SDK on the disposable CI runner, never the app's
# Gradle settings or the pinned Android Gradle Plugin version.
python3 - "$settings" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
old = "    repositories {\n        google()\n        mavenCentral()\n"
new = (
    "    repositories {\n"
    "        // Seven Desk CI: verified local Maven seed for Flutter's included build.\n"
    "        maven { url = uri(file(\".sevendesk-maven-seed\")) }\n"
    "        google()\n"
    "        maven { url = uri(\"https://maven-central.storage-download.googleapis.com/maven2/\") }\n"
    "        mavenCentral()\n"
    "        maven { url = uri(\"https://repo1.maven.org/maven2/\") }\n"
)
if new not in source:
    if source.count(old) != 1:
        raise SystemExit("Unexpected Flutter Gradle repository configuration")
    path.write_text(source.replace(old, new, 1))
print("Flutter Gradle dependency repositories prepared")
PY

# A Flutter plugin (desktop_drop) declares its own buildscript repositories.
# The app's settings.gradle and allprojects.repositories cannot reorder those.
# Install an init script *before* Gradle starts on this disposable CI runner,
# so Maven Central's public mirror precedes the plugin's own mavenCentral().
# Google Maven and Maven Central remain available for missing coordinates.
gradle_user_home="${GRADLE_USER_HOME:-$HOME/.gradle}"
mkdir -p "$gradle_user_home/init.d"
cat > "$gradle_user_home/init.d/sevendesk-ci-central-mirror.gradle" <<'GRADLE_INIT'
gradle.beforeProject { project ->
    project.buildscript.repositories {
        maven {
            name = 'sevendeskCiCentralMirror'
            url 'https://maven-central.storage-download.googleapis.com/maven2/'
        }
    }
}
GRADLE_INIT
echo "Configured Maven Central mirror ahead of plugin buildscript repositories"
