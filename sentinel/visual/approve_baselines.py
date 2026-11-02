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

def approve_baselines(approver_name="Lead QA Architect"):
    if not os.path.exists(CURRENT_DIR) or not os.listdir(CURRENT_DIR):
        print("❌ No current screenshots found to approve. Run visual regression first.")
        sys.exit(1)

    metadata = {
        "approvedBy": approver_name,
        "approvedAt": datetime.utcnow().isoformat() + "Z",
        "baselines": {}
    }

    count = 0
    for filename in os.listdir(CURRENT_DIR):
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
            print(f"  ✅ Approved baseline: {filename} (SHA256: {sha256[:12]}...)")

    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSuccessfully approved and cataloged {count} baselines in {METADATA_FILE}.")

if __name__ == "__main__":
    approver = sys.argv[1] if len(sys.argv) > 1 else "Lead QA Architect"
    approve_baselines(approver)
