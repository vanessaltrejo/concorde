"""Upload the terrain tiles to the private Cloudflare R2 bucket, safely.

docs/HORIZON_ANYWHERE_PLAN.md step 6. Order of work:
  1. Refuse to start if the tiles are a test build or if storage or uploads
     would pass 95% of the R2 free tier (scripts/build_chunks.py check).
  2. Upload every tile with rclone (skips files already in the bucket, so a
     stopped upload can be re-run; no HEAD after upload, so no extra reads).
  3. Upload manifest.json last, so the app never sees a half-uploaded set.
  4. Read a few random tiles back through the gatekeeper Worker and compare
     them byte-for-byte with the local files.

Credentials come from .env.local in the repository root (git-ignored):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
They are passed to rclone as environment variables only: no rclone config
file with secrets is written.

Run:  .venv/Scripts/python.exe scripts/upload_tiles.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_chunks  # noqa: E402  (same folder: tile paths and the 95% check)

REPO = Path(__file__).resolve().parent.parent
BUCKET = "concorde-terrain"
WORKER_URL = "https://concorde-terrain.emiliano-bucam.workers.dev"
CHECK_ORIGIN = "http://localhost:5173"  # one of the Worker's allowed origins


def read_env_local() -> dict[str, str]:
    path = REPO / ".env.local"
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def find_rclone() -> str:
    found = shutil.which("rclone")
    if found:
        return found
    winget = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet"
    for candidate in [winget / "Links" / "rclone.exe", *winget.glob("Packages/Rclone.Rclone_*/*/rclone.exe")]:
        if candidate.exists():
            return str(candidate)
    sys.exit("rclone not found. Install it: winget install --id Rclone.Rclone --scope user")


def rclone_env(env_local: dict[str, str]) -> dict[str, str]:
    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY") if not env_local.get(k)]
    if missing:
        sys.exit(f"Add {', '.join(missing)} to {REPO / '.env.local'} first (see .env.example).")
    env = dict(os.environ)
    env.update(
        {
            "RCLONE_CONFIG_R2_TYPE": "s3",
            "RCLONE_CONFIG_R2_PROVIDER": "Cloudflare",
            "RCLONE_CONFIG_R2_ACCESS_KEY_ID": env_local["R2_ACCESS_KEY_ID"],
            "RCLONE_CONFIG_R2_SECRET_ACCESS_KEY": env_local["R2_SECRET_ACCESS_KEY"],
            "RCLONE_CONFIG_R2_ENDPOINT": f"https://{env_local['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            "RCLONE_CONFIG_R2_ACL": "private",
            # Required for tokens scoped to one bucket (Cloudflare rclone docs).
            "RCLONE_CONFIG_R2_NO_CHECK_BUCKET": "true",
        }
    )
    return env


def run_rclone(rclone: str, env: dict[str, str], extra: list[str], dry_run: bool) -> None:
    cmd = [
        rclone, "copy", str(build_chunks.TILES_DIR), f"r2:{BUCKET}",
        "--size-only",  # compare by size only: no hashing, no reads
        "--s3-no-head",  # no HEAD after each upload (would be a read)
        "--fast-list",  # few large listings instead of one per folder
        "--transfers", "16", "--checkers", "16",
        "--stats", "30s", "--stats-one-line",
        *extra,
    ]
    if dry_run:
        cmd.append("--dry-run")
    print("Running: rclone", " ".join(cmd[2:]), flush=True)  # secrets are in env, not in cmd
    result = subprocess.run(cmd, env=env)
    if result.returncode != 0:
        sys.exit(f"rclone stopped with code {result.returncode}. Run this script again to continue.")


def check_through_worker(samples: int) -> None:
    files = sorted(build_chunks.TILES_DIR.glob("*/*/*.bin"))
    picks = random.Random(7).sample(files, min(samples, len(files)))
    for path in picks:
        key = path.relative_to(build_chunks.TILES_DIR).as_posix()
        request = urllib.request.Request(f"{WORKER_URL}/{key}", headers={"Origin": CHECK_ORIGIN, "User-Agent": "concorde-upload-check"})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.read() != path.read_bytes():
                sys.exit(f"MISMATCH through the Worker: {key}")
    print(f"Worker check: {len(picks)} random tiles read back through the Worker, byte-for-byte identical.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="show what would be uploaded, upload nothing")
    parser.add_argument("--class-a-used", type=int, default=0, help="Class A operations already used this month")
    parser.add_argument("--samples", type=int, default=10, help="tiles to read back through the Worker")
    args = parser.parse_args()

    manifest_path = build_chunks.TILES_DIR / "manifest.json"
    if not manifest_path.exists():
        sys.exit("No manifest.json: build the tiles first (scripts/build_chunks.py build).")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("test") or any("note" in layer for layer in manifest["layers"]):
        sys.exit("manifest.json comes from a test build: run the full build before uploading.")

    # 1. The 95% guard: exits with an error if the upload would pass it.
    build_chunks.cmd_check(argparse.Namespace(class_a_used=args.class_a_used))

    env = rclone_env(read_env_local())
    rclone = find_rclone()
    # 2. Tiles first, 3. manifest last.
    run_rclone(rclone, env, ["--include", "*.bin"], args.dry_run)
    run_rclone(rclone, env, ["--include", "manifest.json"], args.dry_run)
    if args.dry_run:
        print("Dry run: nothing was uploaded.")
        return
    # 4. Read back through the Worker.
    check_through_worker(args.samples)
    print("Upload complete.")


if __name__ == "__main__":
    main()
