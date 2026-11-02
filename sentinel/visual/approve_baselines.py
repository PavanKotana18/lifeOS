#!/usr/bin/env python3
"""
LifeOS Sentinel — Baseline Approval Tool
Requires explicit human/maintainer confirmation to promote current screenshots to approved baselines.
"""

import hashlib
import json
import os
import shutil
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASELINES_DIR = os.path.join(BASE_DIR, "baselines")
CURRENT_DIR = os.path.join(BASE_DIR, "current")
METADATA_FILE = os.path.join(BASE_DIR, "approved_baselines.json")

def approve_baselines(approver_name):
    if not approver_name or not approver_name.strip():
        print("ERROR: A named approver is required.")
        sys.exit(2)

    if not os.path.exists(CURRENT_DIR) or not os.listdir(CURRENT_DIR):
        print("ERROR: No current screenshots found. Run visual regression first.")
        sys.exit(1)

    os.makedirs(BASELINES_DIR, exist_ok=True)
    metadata = {
        "approvedBy": approver_name.strip(),
        "approvedAt": datetime.utcnow().isoformat() + "Z",
        "baselines": {}
    }

    count = 0
    for filename in sorted(os.listdir(CURRENT_DIR)):
        if filename.endswith(".png"):
            src = os.path.join(CURRENT_DIR, filename)
            dst = os.path.join(BASELINES_DIR, filename)
            shutil.copy2(src, dst)
            with open(dst, "rb") as f:
                sha256 = hashlib.sha256(f.read()).hexdigest()
            metadata["baselines"][filename] = {
                "sha256": sha256,
                "sizeBytes": os.path.getsize(dst)
            }
            count += 1
            print(f"Approved baseline: {filename} ({sha256[:12]}...)")

    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Approved and cataloged {count} baselines.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Promote current screenshots to approved visual baselines."
    )
    parser.add_argument("--confirm", action="store_true",
                        help="Explicitly confirm baseline promotion.")
    parser.add_argument("--approver", required=True,
                        help="Name of the human approving these baselines.")
    args = parser.parse_args()
    if not args.confirm:
        parser.error("Baseline promotion requires --confirm.")
    approve_baselines(args.approver)
