#!/usr/bin/env python3
"""Render a validated Microsoft Store MSIX manifest for the native Seven Desk app."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = "http://schemas.microsoft.com/appx/manifest/foundation/windows10"
UAP = "http://schemas.microsoft.com/appx/manifest/uap/windows10"
UAP10 = "http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
RESCAP = "http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"

for prefix, uri in (("", BASE), ("uap", UAP), ("uap10", UAP10), ("rescap", RESCAP)):
    ET.register_namespace(prefix, uri)


def validate_identity(name: str, publisher: str, display_name: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,49}", name):
        raise ValueError("MSIX identity name must be 3-50 ASCII letters, digits, dots, underscores or hyphens")
    if not publisher.startswith("CN=") or len(publisher) > 240 or len(publisher) < 5:
        raise ValueError("MSIX Publisher must be a Partner Center distinguished name beginning with CN=")
    if any(ord(char) < 32 for char in publisher):
        raise ValueError("MSIX Publisher cannot contain control characters")
    if not display_name or len(display_name) > 256 or any(ord(char) < 32 for char in display_name):
        raise ValueError("PublisherDisplayName must be nonempty printable text")


def validate_version(version: str) -> None:
    parts = version.split(".")
    if len(parts) != 4 or not all(part.isdecimal() and part.isascii() for part in parts):
        raise ValueError("MSIX version must be numeric Major.Minor.Build.Revision")
    if any(int(part) > 65535 for part in parts) or int(parts[0]) == 0:
        raise ValueError("MSIX version components out of valid range")
    if int(parts[3]) != 0:
        raise ValueError("Microsoft Store MSIX packages must use revision 0")


def build_manifest(
    name: str,
    publisher: str,
    publisher_display_name: str,
    version: str,
    architecture: str,
) -> bytes:
    validate_identity(name, publisher, publisher_display_name)
    validate_version(version)
    if architecture not in {"x64", "arm64"}:
        raise ValueError("Only complete Windows x64 and ARM64 release payloads are supported")

    root = ET.Element(f"{{{BASE}}}Package", {"IgnorableNamespaces": "uap uap10 rescap"})
    ET.SubElement(root, f"{{{BASE}}}Identity", {
        "Name": name,
        "Publisher": publisher,
        "Version": version,
        "ProcessorArchitecture": architecture,
    })
    props = ET.SubElement(root, f"{{{BASE}}}Properties")
    for key, value in (
        ("DisplayName", "Seven Desk"),
        ("PublisherDisplayName", publisher_display_name),
        ("Description", "Seven Desk Remote Desktop"),
        ("Logo", r"Assets\StoreLogo.png"),
    ):
        ET.SubElement(props, f"{{{BASE}}}{key}").text = value

    resources = ET.SubElement(root, f"{{{BASE}}}Resources")
    for language in ("pt-BR", "en-US"):
        ET.SubElement(resources, f"{{{BASE}}}Resource", {"Language": language})
    dependencies = ET.SubElement(root, f"{{{BASE}}}Dependencies")
    ET.SubElement(dependencies, f"{{{BASE}}}TargetDeviceFamily", {
        "Name": "Windows.Desktop",
        "MinVersion": "10.0.19041.0",
        "MaxVersionTested": "10.0.26100.0",
    })
    capabilities = ET.SubElement(root, f"{{{BASE}}}Capabilities")
    ET.SubElement(capabilities, f"{{{RESCAP}}}Capability", {"Name": "runFullTrust"})
    applications = ET.SubElement(root, f"{{{BASE}}}Applications")
    application = ET.SubElement(applications, f"{{{BASE}}}Application", {
        "Id": "SevenDesk",
        "Executable": "SevenDesk.exe",
        f"{{{UAP10}}}RuntimeBehavior": "packagedClassicApp",
        f"{{{UAP10}}}TrustLevel": "mediumIL",
    })
    ET.SubElement(application, f"{{{UAP}}}VisualElements", {
        "DisplayName": "Seven Desk",
        "Description": "Seven Desk Remote Desktop",
        "Square150x150Logo": r"Assets\Square150x150Logo.png",
        "Square44x44Logo": r"Assets\Square44x44Logo.png",
        "BackgroundColor": "transparent",
    })
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--publisher", required=True)
    parser.add_argument("--publisher-display-name", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--architecture", choices=("x64", "arm64"), required=True)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()
    try:
        content = build_manifest(
            arguments.name,
            arguments.publisher,
            arguments.publisher_display_name,
            arguments.version,
            arguments.architecture,
        )
    except ValueError as exc:
        parser.error(str(exc))
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_bytes(content)
    print(f"Validated MSIX {arguments.architecture} manifest: {arguments.name} {arguments.version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
