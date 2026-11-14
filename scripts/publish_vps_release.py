#!/usr/bin/env python3
"""Mirror a verified Seven Desk GitHub release to the downloads VPS."""

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
import urllib.request
from pathlib import Path


REPOSITORY = "gabriell211/Seven-Desk"
API = f"https://api.github.com/repos/{REPOSITORY}"
NAME = re.compile(r"^(?:sevendesk|rustdesk)-[A-Za-z0-9._-]{1,180}$")
INSTALLER_SUFFIXES = (".exe", ".msi", ".dmg", ".deb", ".rpm", ".apk", ".pkg.tar.zst")
REQUIRED = (
    re.compile(r"^sevendesk-.*-x86_64\.exe$"),
    re.compile(r"^sevendesk-.*-aarch64\.exe$"),
    re.compile(r"^rustdesk-.*-x86_64\.dmg$"),
    re.compile(r"^rustdesk-.*-aarch64\.dmg$"),
    re.compile(r"^rustdesk-.*-x86_64\.deb$"),
    re.compile(r"^rustdesk-.*-aarch64\.deb$"),
    re.compile(r"^rustdesk-.*-aarch64\.apk$"),
)


def request(url):
    return urllib.request.Request(url, headers={"User-Agent": "SevenDeskReleaseMirror/1.0"})


def read_json(url):
    with urllib.request.urlopen(request(url), timeout=30) as response:
        return json.load(response)


def tag_commit(tag):
    ref = read_json(f"{API}/git/ref/tags/{tag}")["object"]
    if ref["type"] == "tag":
        ref = read_json(f"{API}/git/tags/{ref['sha']}")["object"]
    if ref["type"] != "commit":
        raise ValueError("Release tag does not point to a commit")
    return ref["sha"]


def select_assets(release, run_started_at):
    selected = []
    for asset in release["assets"]:
        name = asset["name"]
        if not NAME.fullmatch(name) or not name.endswith(INSTALLER_SUFFIXES):
            continue
        if "unattended" in name or "wayland" in name:
            continue
        digest = asset.get("digest", "")
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError(f"Missing SHA-256 for {name}")
        if not isinstance(asset.get("size"), int) or asset["size"] <= 0:
            raise ValueError(f"Invalid size for {name}")
        if asset["created_at"] < run_started_at:
            raise ValueError(f"Asset predates the verified build: {name}")
        selected.append(asset)
    names = {asset["name"] for asset in selected}
    for pattern in REQUIRED:
        if not any(pattern.fullmatch(name) for name in names):
            raise ValueError(f"Required installer is missing: {pattern.pattern}")
    return sorted(selected, key=lambda asset: asset["name"])


def download(asset, destination):
    sha = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(request(asset["browser_download_url"]), timeout=120) as source:
        with destination.open("xb") as target:
            while chunk := source.read(1024 * 1024):
                target.write(chunk)
                sha.update(chunk)
                size += len(chunk)
    if size != asset["size"] or sha.hexdigest() != asset["digest"][7:]:
        raise ValueError(f"Installer failed integrity verification: {asset['name']}")
    destination.chmod(0o644)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--commit", required=True, help="Expected 40-character source commit SHA")
    parser.add_argument("--run-id", required=True, type=int)
    parser.add_argument("--root", type=Path, default=Path("/srv/sevendesk/downloads"))
    parser.add_argument("--check", action="store_true", help="Verify metadata without downloading")
    args = parser.parse_args()
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+-[0-9]+", args.tag):
        parser.error("Invalid release tag")
    if not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("Invalid commit SHA")
    actual_commit = tag_commit(args.tag)
    if actual_commit != args.commit:
        raise ValueError(f"Tag points to {actual_commit}, expected {args.commit}")
    run = read_json(f"{API}/actions/runs/{args.run_id}")
    if run["head_sha"] != args.commit or run["status"] != "completed":
        raise ValueError("Workflow run is not complete for this source commit")
    release = read_json(f"{API}/releases/tags/{args.tag}")
    if release["draft"] or release["prerelease"]:
        raise ValueError("Release is not public and final")
    assets = select_assets(release, run["run_started_at"])
    print(f"Verified {len(assets)} installers for {args.tag} at {actual_commit}")
    if args.check:
        return

    root = args.root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Download root is not a directory")
    version_dir = root / args.tag
    if version_dir.exists():
        raise FileExistsError(f"Release directory already exists: {version_dir}")
    stage = Path(tempfile.mkdtemp(prefix=f".{args.tag}-", dir=root))
    try:
        files = []
        for asset in assets:
            destination = stage / asset["name"]
            download(asset, destination)
            files.append({"name": asset["name"], "size": asset["size"], "sha256": asset["digest"][7:]})
            print(f"Verified {destination.name}")
        stage.rename(version_dir)
        manifest = {"version": args.tag, "source_commit": args.commit, "build_run_id": args.run_id, "files": files}
        temporary = root / f".manifest-{os.getpid()}.json"
        try:
            temporary.write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
            temporary.chmod(0o644)
            os.replace(temporary, root / "manifest.json")
        finally:
            temporary.unlink(missing_ok=True)
        print(f"Published {root / 'manifest.json'}")
    finally:
        if stage.exists() and stage.parent == root:
            shutil.rmtree(stage)


if __name__ == "__main__":
    main()
