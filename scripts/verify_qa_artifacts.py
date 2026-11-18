#!/usr/bin/env python3
"""Verify local QA binaries without publishing them as a release."""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import zipfile

VERSION = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
TYPES = {
    "windows-x64-exe": ("x86_64.exe", "exe"),
    "windows-arm64-exe": ("aarch64.exe", "exe"),
    "windows-x64-msi": ("x86_64.msi", "msi"),
    "windows-arm64-msi": ("aarch64.msi", "msi"),
    "macos-x64": ("x86_64.dmg", "dmg"),
    "macos-arm64": ("aarch64.dmg", "dmg"),
    "linux-x64": ("x86_64.AppImage", "appimage"),
    "linux-arm64": ("aarch64.AppImage", "appimage"),
    "android-universal": ("universal.apk", "apk"),
}
MAGIC = {
    "exe": b"MZ",
    "msi": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
    "appimage": b"\x7fELF",
    "apk": b"PK",
}

def inspect(root: Path, version: str, commit: str) -> dict:
    if not VERSION.fullmatch(version) or not COMMIT.fullmatch(commit):
        raise ValueError("Invalid version or source commit")
    if not root.is_dir():
        raise ValueError("QA artifact directory does not exist")
    files = [p for p in root.rglob("*") if p.is_file()]
    by_name: dict[str, list[Path]] = {}
    for path in files:
        by_name.setdefault(path.name, []).append(path)
    result = []
    for platform, (suffix, kind) in TYPES.items():
        name = f"sevendesk-{version}-{suffix}"
        matches = by_name.get(name, [])
        if len(matches) != 1:
            raise ValueError(f"{platform}: expected one artifact named {name}; got {len(matches)}")
        path = matches[0]
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"{platform}: unsafe artifact path")
        size = path.stat().st_size
        if size < 4096:
            raise ValueError(f"{platform}: artifact truncated")
        with path.open("rb") as reader:
            start = reader.read(8)
            if kind in MAGIC and not start.startswith(MAGIC[kind]):
                raise ValueError(f"{platform}: invalid executable header")
            if kind == "dmg":
                reader.seek(-512, 2)
                if reader.read(4) != b"koly":
                    raise ValueError(f"{platform}: missing DMG UDIF trailer")
        if kind == "apk":
            try:
                with zipfile.ZipFile(path) as apk:
                    if "AndroidManifest.xml" not in apk.namelist():
                        raise ValueError(f"{platform}: Android manifest missing")
                    bad = apk.testzip()
                    if bad is not None:
                        raise ValueError(f"{platform}: corrupted APK ZIP member")
            except zipfile.BadZipFile as exc:
                raise ValueError(f"{platform}: corrupt APK") from exc
        digest = sha256()
        with path.open("rb") as reader:
            for chunk in iter(lambda: reader.read(1024 * 1024), b""):
                digest.update(chunk)
        result.append({"platform": platform, "name": name, "size": size,
                       "sha256": digest.hexdigest()})
    return {"status": "QA_ONLY_NOT_A_RELEASE", "source_commit": commit,
            "version": version, "files": result}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = inspect(args.root, args.version, args.commit)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("Validated", len(report["files"]), "QA-only executables / packages")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
