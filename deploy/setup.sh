#!/usr/bin/env bash
#
# One-shot deploy for salesbox-mcp on a fresh Ubuntu VPS (Hetzner).
# Sets up: Docker + docker compose, .env (multi-tenant: empty SalesBox token,
# generated MCP_AUTH_TOKEN), Caddy reverse proxy with automatic HTTPS, and a
# minimal firewall.
#
# Run it FROM INSIDE the cloned repo, as root:
#
#     sudo bash deploy/setup.sh mcp.yourdomain.com
#
# Prerequisite: the repo is already cloned on the server and a DNS A record
# points mcp.yourdomain.com -> this server's public IP.
#
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash deploy/setup.sh <domain>   e.g. mcp.yourdomain.com" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

# Resolve the repo root (this script lives in deploy/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

echo "==> Repo:   $REPO_DIR"
echo "==> Domain: $DOMAIN"

# ---------------------------------------------------------------------------
# 1. Docker
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "==> Docker already installed."
fi

# ---------------------------------------------------------------------------
# 2. .env (multi-tenant defaults)
# ---------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  echo "==> Creating .env (multi-tenant: empty SALESBOX_API_TOKEN)..."
  MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
  cat > .env <<EOF
# Multi-tenant: no shared SalesBox token. Each client sends X-Salesbox-Token.
SALESBOX_API_TOKEN=
SALESBOX_BASE_URL=https://prod.salesbox.me

MCP_TRANSPORT=http
HOST=0.0.0.0
PORT=3000

# Shared secret guarding /mcp. Clients must send:
#   Authorization: Bearer <this value>
MCP_AUTH_TOKEN=$MCP_AUTH_TOKEN

SALESBOX_TIMEOUT_MS=30000
SALESBOX_MAX_RETRIES=2
SALESBOX_MAX_RETRY_WAIT=65
EOF
  chmod 600 .env
  echo "    Generated MCP_AUTH_TOKEN (save it, clients need it):"
  echo "    $MCP_AUTH_TOKEN"
else
  echo "==> .env already exists, leaving it untouched."
fi

# ---------------------------------------------------------------------------
# 3. Build & start the container (compose binds to 127.0.0.1:3000)
# ---------------------------------------------------------------------------
echo "==> Building and starting the container..."
docker compose up -d --build

# ---------------------------------------------------------------------------
# 4. Caddy (reverse proxy + automatic HTTPS)
# ---------------------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Installing Caddy..."
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
else
  echo "==> Caddy already installed."
fi

echo "==> Writing /etc/caddy/Caddyfile for $DOMAIN..."
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	reverse_proxy 127.0.0.1:3000
}
EOF
systemctl restart caddy
systemctl enable caddy >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 5. Firewall (ssh + http + https only)
# ---------------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
  echo "==> Configuring ufw firewall (22, 80, 443)..."
  ufw allow 22/tcp   >/dev/null 2>&1 || true
  ufw allow 80/tcp   >/dev/null 2>&1 || true
  ufw allow 443/tcp  >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
else
  echo "==> ufw not present; skipping (configure the Hetzner Cloud firewall instead)."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=========================================================="
echo " Deploy complete."
echo "   Endpoint:  https://$DOMAIN/mcp"
echo "   Health:    https://$DOMAIN/health   (may take ~30s for the TLS cert)"
echo ""
echo " Container logs:  docker compose logs -f"
echo " MCP_AUTH_TOKEN is in $REPO_DIR/.env"
echo "=========================================================="
