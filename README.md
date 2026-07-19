# SalesBox MCP Server

An [MCP](https://modelcontextprotocol.io) server that wraps the **SalesBox public API** (`https://prod.salesbox.me`). It exposes the `/openapi/*` endpoints as MCP tools so Claude / any MCP client can manage cashbacks, categories, chats, SEO, custom fields, discounts, and filters.

It ships with two transports:

- **Streamable HTTP** (default) — for running on a VPS and connecting remotely.
- **stdio** — for local MCP clients (Claude Desktop, etc.).

Rate limits (100 req/min per company; upload 200/hour) are handled automatically: on HTTP `429` the server reads `Retry-After` and retries.

---

## 1. Prerequisites

- A SalesBox **OpenAPI token** — get it from the [support bot](https://t.me/salesboxsupport_bot).
- Node.js 20+ **or** Docker.

## 2. Configure

```bash
cp .env.example .env
# edit .env — set SALESBOX_API_TOKEN and (recommended) MCP_AUTH_TOKEN
```

Key settings (see `.env.example` for all):

| Var | Purpose |
|-----|---------|
| `SALESBOX_API_TOKEN` | Default SalesBox token. Clients can override per-request via the `X-Salesbox-Token` header. |
| `MCP_TRANSPORT` | `http` (VPS) or `stdio` (local). |
| `PORT` / `HOST` | HTTP listen address. |
| `MCP_AUTH_TOKEN` | Shared secret guarding `/mcp`. Clients send `Authorization: Bearer <token>`. **Set this if the port is public.** |

## 3. Run locally

```bash
npm install
npm run build
npm start            # HTTP on :3000
# or
npm run start:stdio  # stdio
```

Health check: `curl http://localhost:3000/health`

---

## 4. Deploy to a Hetzner VPS

Two options — **Docker (recommended)** or **systemd**.

### A note on the SDK security default
The Streamable HTTP transport validates the `Origin` header on requests it processes; keeping the container bound to `127.0.0.1` and terminating TLS at a reverse proxy (below) is the safe setup. Always also set `MCP_AUTH_TOKEN`.

### Option A — Docker + Caddy (auto HTTPS)

On a fresh Hetzner Cloud Ubuntu box:

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Get the code
git clone <your-repo-url> /opt/salesbox-mcp
cd /opt/salesbox-mcp
cp .env.example .env && nano .env   # set tokens

# 3. Build & run (binds to 127.0.0.1:3000 by compose default)
docker compose up -d --build
docker compose logs -f
```

Put TLS in front with Caddy (gets a Let's Encrypt cert automatically):

```bash
apt install -y caddy
# Point an A record: mcp.yourdomain.com -> <VPS IP>, then:
cp deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile      # replace mcp.example.com with your domain
systemctl restart caddy
```

Your endpoint is now `https://mcp.yourdomain.com/mcp`.

**Firewall (Hetzner Cloud firewall or ufw):** allow only 22, 80, 443. Do **not** expose port 3000 publicly — Caddy proxies to it over localhost.

```bash
ufw allow 22,80,443/tcp && ufw enable
```

### Option B — systemd (no Docker)

```bash
# Install Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs

# Code + build
git clone <your-repo-url> /opt/salesbox-mcp
cd /opt/salesbox-mcp
npm ci && npm run build
cp .env.example .env && nano .env

# Dedicated user + service
useradd --system --no-create-home salesbox || true
chown -R salesbox:salesbox /opt/salesbox-mcp
cp deploy/salesbox-mcp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now salesbox-mcp
systemctl status salesbox-mcp
```

Then front it with Caddy/Nginx for TLS the same way as Option A.

---

## 5. Connect a client

### Claude Code / any HTTP MCP client

```json
{
  "mcpServers": {
    "salesbox": {
      "type": "http",
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>",
        "X-Salesbox-Token": "<optional-per-client-salesbox-token>"
      }
    }
  }
}
```

`X-Salesbox-Token` is only needed if you did **not** bake `SALESBOX_API_TOKEN` into `.env`, or you want a different token per client.

### Claude Desktop (stdio, local)

```json
{
  "mcpServers": {
    "salesbox": {
      "command": "node",
      "args": ["/opt/salesbox-mcp/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "SALESBOX_API_TOKEN": "<your-token>"
      }
    }
  }
}
```

### Quick manual test

```bash
curl -X POST https://mcp.yourdomain.com/mcp \
  -H "Authorization: Bearer <MCP_AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 6. Tools

Grouped by resource. Every tool accepts an optional `token` argument to override the server token for that call.

- **Cashback** — `salesbox_cashback_list`, `_get`, `_create`, `_update`, `_delete`
- **Categories** — `salesbox_categories_list`, `salesbox_category_get`, `_create_many`, `_update_many`, `_delete`, `_set_ordering`
- **Category custom fields** — `salesbox_category_custom_fields_get`, `_set`, `salesbox_category_custom_field_clear`
- **Category SEO** — `salesbox_category_seo_get`, `_set`, `_clear_field`, `salesbox_categories_seo_list`, `_seo_update_many`, `_seo_delete_many`
- **Chats** — `salesbox_chats_by_user`, `salesbox_chat_send_message`
- **Company** — `salesbox_company_custom_fields_get`, `_set`, `salesbox_company_custom_field_clear`, `salesbox_company_seo_get`, `_set`, `_clear_field`
- **Custom field definitions** — `salesbox_custom_field_definitions_list`, `_definition_create`, `_definition_update`, `_definition_delete`
- **Discounts** — `salesbox_discounts_list`, `salesbox_discount_get`, `_create`, `_update`, `_delete`, `salesbox_discounts_delete_many`
- **Filters** — `salesbox_filters_list`, `_create_many`, `_update_many`, `_delete_many`
- **Escape hatch** — `salesbox_raw_request` — call any `/openapi/*` endpoint not covered above (the provided OpenAPI was large; use this for offers, orders, users, uploads, etc.).

> The `salesbox_raw_request` tool covers any endpoint that doesn't have a dedicated wrapper yet. If you want first-class tools for more resources (offers, orders, users, S3 upload…), the pattern in `src/tools.ts` is easy to extend.

## Project layout

```
src/
  index.ts     entrypoint (http + stdio transports)
  server.ts    builds the MCP server
  tools.ts     all tool definitions
  client.ts    SalesBox HTTP client (auth, 429 retry)
  config.ts    env-based config
  context.ts   per-request token (X-Salesbox-Token)
Dockerfile, docker-compose.yml
deploy/salesbox-mcp.service, deploy/Caddyfile
```
