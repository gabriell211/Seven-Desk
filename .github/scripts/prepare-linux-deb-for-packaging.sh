#!/usr/bin/env bash
set -euo pipefail

# AppImage and Flatpak still consume an internal rustdesk.deb filename, but
# the downloadable package is always branded Seven Desk.
if (( $# < 3 || $# > 4 )); then
  echo "Usage: $0 VERSION ARCH DESTINATION [SUFFIX]" >&2
  exit 2
fi

version="$1"
arch="$2"
destination="$3"
suffix=""
if (( $# == 4 )); then
  suffix="$4"
fi

if [[ ! "$version" =~ ^[A-Za-z0-9][A-Za-z0-9.+~_-]*$ ]]; then
  echo "Invalid Debian package version" >&2
  exit 2
fi
case "$arch" in
  x86_64) expected_arch="amd64" ;;
  aarch64) expected_arch="arm64" ;;
  *) echo "Unsupported Debian architecture: $arch" >&2; exit 2 ;;
esac
case "$suffix" in
  ""|"-sciter") ;;
  *) echo "Unsupported Debian suffix: $suffix" >&2; exit 2 ;;
esac
case "$destination" in
  "appimage/rustdesk.deb"|"flatpak/rustdesk.deb") ;;
  *) echo "Unsupported package destination: $destination" >&2; exit 2 ;;
esac

count=0
source=""
for candidate in "sevendesk-$version-$arch$suffix.deb" "rustdesk-$version-$arch$suffix.deb"; do
  if [[ -f "$candidate" ]]; then
    count=$((count + 1))
    source="$candidate"
  fi
done
if (( count != 1 )); then
  echo "Expected exactly one Debian artifact; found $count" >&2
  ls -la -- *.deb 2>/dev/null || true
  exit 1
fi

[[ -s "$source" ]] || { echo "Empty Debian artifact: $source" >&2; exit 1; }
package="$(dpkg-deb -f "$source" Package)"
actual_arch="$(dpkg-deb -f "$source" Architecture)"
if [[ "$package" != "sevendesk" || "$actual_arch" != "$expected_arch" ]]; then
  echo "Invalid Debian package metadata: package=$package arch=$actual_arch" >&2
  exit 1
fi

mkdir -p -- "$(dirname -- "$destination")"
cp -- "$source" "$destination"
cmp -- "$source" "$destination"
echo "Seven Desk Debian package validated: $source -> $destination"
