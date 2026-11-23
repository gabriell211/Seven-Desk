#!/usr/bin/env python3
"""Publish a fully successful public Seven Desk 1.5.4 release to Caddy's download root."""
from __future__ import annotations

import hashlib
import json
import re
import stat
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish_vps_release import API, read_json, tag_commit

TAG = "v1.5.4"
ROOT = Path("/srv/sevendesk/downloads")
PUBLISHER = Path(__file__).with_name("publish_vps_release.py")
APPROVAL = Path("/etc/sevendesk/release-approval-v1.5.4.json")
EVIDENCE_ROOT = Path("/srv/sevendesk/qa-evidence/v1.5.4")


def fetch_release():
    try:
        return read_json(f"{API}/releases/tags/{TAG}")
    except HTTPError as err:
        if err.code == 404:
            return None
        raise


def matching_run(sha: str):
    runs = read_json(f"{API}/actions/workflows/flutter-tag.yml/runs?per_page=100")
    if not isinstance(runs, dict) or not isinstance(runs.get("workflow_runs"), list):
        raise ValueError("Invalid workflow-run response")
    matches = [
        run for run in runs["workflow_runs"]
        if run.get("head_sha") == sha
        and run.get("head_branch") == TAG
        and run.get("event") == "push"
        and run.get("name") == "Seven Desk Release Build"
        and run.get("status") == "completed"
        and run.get("conclusion") == "success"
        and isinstance(run.get("id"), int)
    ]
    return max(matches, key=lambda run: run.get("run_started_at") or "") if matches else None



def validated_physical_qa(source_sha: str, run_id: int, approval_path: Path = APPROVAL, *, evidence_root: Path = EVIDENCE_ROOT, expected_uid: int = 0) -> bool:
    """Require root-protected, source-bound physical QA evidence before public mirroring.

    CI alone cannot attest to two physical machines or a Windows UAC elevation.
    """
    if not approval_path.exists():
        print("WAIT: no signed-off two-machine physical QA evidence")
        return False
    metadata = approval_path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != expected_uid or metadata.st_mode & 0o077:
        raise ValueError("Unsafe approval file ownership, type or permissions")
    doc = json.loads(approval_path.read_text(encoding="utf-8"))
    if (doc.get("tag") != TAG or doc.get("source_commit") != source_sha
            or doc.get("ci_run_id") != run_id):
        raise ValueError("QA approval is not tied to the exact release build")
    if not isinstance(doc.get("reviewed_by"), str) or not doc["reviewed_by"].strip():
        raise ValueError("QA evidence is missing a responsible reviewer")
    machines = doc.get("machines")
    if not isinstance(machines, list) or len(machines) != 2:
        raise ValueError("QA requires exactly two distinct physical machines")
    ids = [x.get("id") for x in machines if isinstance(x, dict)]
    if (len(ids) != 2 or len(set(ids)) != 2
            or any(not isinstance(x, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{8,80}", x) for x in ids)):
        raise ValueError("Invalid or duplicate machine references")
    checks = doc.get("session_checks", {})
    for check in ("connection", "disconnect", "file_transfer", "uac_elevation"):
        if checks.get(check) is not True:
            raise ValueError(f"Physical QA check not approved: {check}")
    android = doc.get("android_signing", {})
    if android.get("distribution_key") is not True or android.get("debug_key_rejected") is not True:
        raise ValueError("Android distribution signing has not been approved")
    if not re.fullmatch(r"[a-f0-9]{64}", str(android.get("certificate_sha256", ""))):
        raise ValueError("Missing Android distribution signing certificate fingerprint")
    evidence = doc.get("evidence")
    if not isinstance(evidence, list) or len(evidence) != 2:
        raise ValueError("Expected a separate source evidence record for each machine")
    evidence_ids = set()
    for item in evidence:
        if not isinstance(item, dict) or item.get("machine_id") not in ids:
            raise ValueError("Evidence references an unknown machine")
        evidence_ids.add(item["machine_id"])
        rel = item.get("filename")
        expected_sha = item.get("sha256", "")
        if not isinstance(rel, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,120}\.(?:json|txt|log)", rel):
            raise ValueError("Unsafe physical QA evidence filename")
        if not isinstance(expected_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_sha):
            raise ValueError("Missing physical QA evidence checksum")
        file = evidence_root / rel
        metadata = file.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != expected_uid or metadata.st_mode & 0o077:
            raise ValueError("Unsafe QA evidence file ownership, type or permissions")
        if metadata.st_size < 16 or metadata.st_size > 1024 * 1024:
            raise ValueError("QA evidence file size outside permitted bounds")
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        if digest != expected_sha:
            raise ValueError("QA evidence integrity mismatch")
    if evidence_ids != set(ids):
        raise ValueError("Incomplete machine evidence set")
    print("QA gate: two-machine evidence, UAC and Android signing approved for exact commit")
    return True


def main() -> int:
    release = fetch_release()
    if release is None or release.get("draft") or release.get("prerelease"):
        print(f"WAIT: {TAG} has no finalized public release")
        return 0
    sha = tag_commit(TAG)
    run = matching_run(sha)
    if run is None:
        print(f"WAIT: {TAG} has no successful matching tag workflow")
        return 0
    if not validated_physical_qa(sha, run["id"]):
        return 0
    existing = ROOT / "manifest.json"
    if existing.exists():
        manifest = json.loads(existing.read_text(encoding="utf-8"))
        if manifest.get("version") == TAG:
            if manifest.get("source_commit") != sha or manifest.get("build_run_id") != run["id"]:
                raise ValueError("Existing manifest contradicts published source")
            print(f"READY: {TAG} is already mirrored")
            return 0
    subprocess.run(
        [sys.executable, str(PUBLISHER), "--tag", TAG, "--commit", sha,
         "--run-id", str(run["id"]), "--root", str(ROOT)],
        check=True,
        timeout=5400,
    )
    print(f"PUBLISHED: {TAG} manifest and SHA-256-verified installers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

