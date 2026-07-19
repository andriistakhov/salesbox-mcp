#!/usr/bin/env bash
#
# Redeploy after pushing new code. Run from inside the repo on the server:
#     sudo bash deploy/update.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Pulling latest code..."
git pull --ff-only

echo "==> Rebuilding and restarting..."
docker compose up -d --build

echo "==> Done. Logs: docker compose logs -f"
