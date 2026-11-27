# App Factory Container-Only Live Smoke Guide (`E2-T1`, `ADR 0073`)

This guide covers bringing up and verifying the **App Factory** container-only MVP stack (`compose.factory.yaml` layered on `compose.yaml` and `compose.live.yaml`) using real OIDC behind Caddy TLS, model-pinned agent containers (`E3-T1`), companion services (`factory-board` and `factory-mcp`), and specialist agent folders (`E4-T1`, `E4-T2`).

> Strictly OCI containers, Docker Compose, Postgres containers, and Caddy TLS — zero Kubernetes, Helm, or CNPG dependencies.

## Prerequisites (`E2-T1`)

Before running the factory stack live, prepare an `.env.factory` file from [`.env.factory.example`](../../.env.factory.example) with real credentials:

1. **Model endpoint (`MODEL_BASE_URL`, `MODEL`, `MODEL_API_KEY`)**:
   - OpenAI-compatible inference base URL including `/v1` (`MODEL_BASE_URL`).
   - Default model (`MODEL`) plus optional per-tier pins: `ARCHITECT_MODEL`, `CODER_FAST_MODEL`, `CODER_LIGHT_MODEL`, and `TITLE_MODEL`.
2. **Real OIDC provider (`OAUTH2_PROXY_OIDC_ISSUER_URL`, `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET`, `OAUTH2_PROXY_COOKIE_SECRET`)**:
   - `mock-oidc` is disabled (`profiles: [disabled]`, `replicas: 0`) in [`compose.factory.yaml`](../../compose.factory.yaml).
   - `oauth2-proxy` validates browser sessions and JWT bearer tokens against `OAUTH2_PROXY_OIDC_ISSUER_URL`.
   - `orchestrator` runs with `server.environment: production` and `auth.mode: jwt` via [`dev/orchestrator.factory.yaml`](../../dev/orchestrator.factory.yaml). Because `orch-config` requires literal `https://` URLs for `auth.jwt.issuer` in production mode (no env interpolation), copy `dev/orchestrator.factory.yaml`, set your tenant's `auth.jwt.issuer` / `audiences`, and point `ORCH_FACTORY_CONFIG_FILE` to it.
3. **GitHub access & webhooks**:
   - `GITHUB_TOKEN` (or `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY_FILE` + `GITHUB_APP_OWNERS` / `GITHUB_APP_INSTALLATION_ID`).
   - `GITHUB_WEBHOOK_SECRET`, `WEBHOOK_GITHUB_SECRETS`, `DEPLOY_WEBHOOK_SECRET` (32+ random bytes each).
4. **Per-agent A2A, Postgres, & MCP secrets**:
   - `ARCHITECT_A2A_TOKEN`, `CODER_FAST_A2A_TOKEN`, `CODER_LIGHT_A2A_TOKEN`, `MCP_TOKEN_DEV`, `THREAD_TOOLS_SECRET`, `SHARING_SECRET`, `POSTGRES_PASSWORD`.
   - **`FACTORY_MCP_TOKEN` (Live OIDC Token Required)**: `factory-mcp` validates bearer JWTs against `OIDC_JWKS_URL` / `OIDC_AUDIENCE`. [`compose.factory.yaml`](../../compose.factory.yaml) supplies a non-empty placeholder fallback so `adam-architect` never crashes at header expansion, and [`dev/agents/architect/agent/mcp.json`](../../dev/agents/architect/agent/mcp.json) marks `factory-mcp` `"optional": true` so startup succeeds cleanly even before a live token is provisioned — however, **live `factory-mcp` tool calls require a real OIDC bearer JWT** in `FACTORY_MCP_TOKEN` (with the placeholder, `factory-mcp` rejects auth with `401` and `adam-architect` starts without `factory-mcp` tools).
5. **Non-privileged Edge ports, Caddy `tls internal` CA Trust, & Custom Domain TLS Overrides**:
   - `EDGE_HTTP_PORT` (default `8080`) and `EDGE_HTTPS_PORT` (default `8443`), both bound to `127.0.0.1` so port `80` is never claimed.
   - [`dev/Caddyfile.factory`](../../dev/Caddyfile.factory) binds explicit internal-CA subjects (`https://edge:8443, https://127.0.0.1:8443, https://localhost:8443`) with `tls internal` so Caddy issues valid certs for `edge`, `127.0.0.1`, and `localhost`. `edge` persists its PKI in `caddy-data:/data`, exports only the public root CA (`/data/caddy/pki/authorities/local/root.crt`, never `root.key`) to `caddy-ca:/etc/caddy-ca/root.crt`, and verifies both `:8443` TLS (`curl --cacert /etc/caddy-ca/root.crt`) and `http://127.0.0.1:8080/readyz` in its healthcheck. `adam-architect` waits for `edge` (`service_healthy`) and `factory-mcp` (`service_started`), and `adam-architect`, `adam-coder-fast`, `adam-coder-light`, and `orchestrator` mount `caddy-ca:/etc/caddy-ca:ro` with `SSL_CERT_DIR=/etc/ssl/certs:/etc/caddy-ca` so `rustls`/`reqwest` trusts both public system CAs and Caddy's internal CA for `https://edge:8443` (`THREAD_TOOLS_URL` and `factory-mcp`).
   - **Custom Domain TLS Overrides**: If deploying beyond `edge` / `127.0.0.1` / `localhost` (e.g., a custom `ORCH_PUBLIC_URL` or `OAUTH2_PROXY_REDIRECT_URL` hostname), copy `dev/Caddyfile.factory`, add a site block for `https://<your-domain>:8443` (with `tls internal` for private domains or external/ACME certs for public domains, importing `factory_routes`), and point `CADDYFILE_FACTORY` to your override file. Keep the `https://edge:8443, https://127.0.0.1:8443, https://localhost:8443 { tls internal ... }` block intact so internal `edge` TLS (`THREAD_TOOLS_URL`, `factory-mcp`) and the `edge` healthcheck continue to pass; if you replace `tls internal` everywhere with external/ACME certs, `/etc/caddy-ca` remains empty and `/etc/ssl/certs` applies (update `edge`'s healthcheck host or `THREAD_TOOLS_ALLOWED_HOSTS` / `FACTORY_MCP_RESOURCE_URI` if `127.0.0.1` / `edge` SANs are removed).
6. **Isolated Agent DB Queues, Agent Folders, & Specialist `@mentions`**:
   - `coder-postgres` initializes separate `coder_fast` and `coder_light` databases via [`dev/coder-postgres-init/10-coder-databases.sql`](../../dev/coder-postgres-init/10-coder-databases.sql) so `adam-coder-fast` and `adam-coder-light` never share `adam_runs` rows or cross `/work` volumes. (If upgrading an existing `coder-postgres-data` volume created before this change, run `docker compose ... down -v` first so `initdb.d` executes.)
   - Legacy `compose.yaml` agents (`coder`, `chat`, `researcher`, `browser` and their sidecars) are placed in the `legacy-agents` profile (`MCP_ALLOW_INSECURE: "false"`) and remain off by default (`--profile legacy-agents` to opt in).
   - `ARCHITECT_AGENT_DIR` defaults to `./dev/agents/architect/agent`, while `CODER_FAST_AGENT_DIR` and `CODER_LIGHT_AGENT_DIR` default to `./dev/coder/agent` (note: `adam-coder` requires `name: coder` in the root `agent/instructions.md` mounted at `/etc/adam/agent`).
   - [`dev/agents.factory.yaml`](../../dev/agents.factory.yaml) routes `@cratestack-backend` and `@fespalier-mobile` as aliases on `adam-coder-fast`, and `@cloud-store-ops` as an alias on `adam-coder-light`.

## Offline Validation (No Secrets or Daemons Required)

Validate Compose merging, fail-closed env guards, Caddy syntax, and agent/docs checks:

```sh
# 1. Must succeed with .env.factory.example
docker compose -f compose.yaml -f compose.live.yaml -f compose.factory.yaml --env-file .env.factory.example config -q

# 2. Must also succeed without compose.live.yaml
docker compose -f compose.yaml -f compose.factory.yaml --env-file .env.factory.example config -q

# 3. Must fail closed when required OIDC/model/token env vars are stripped
env -i PATH="$PATH" HOME="$HOME" docker compose -f compose.yaml -f compose.live.yaml -f compose.factory.yaml --env-file /dev/null config -q

# 4. Must also fail closed when the real OIDC issuer is blanked (no mock-oidc fallback):
sed 's|^OAUTH2_PROXY_OIDC_ISSUER_URL=.*|OAUTH2_PROXY_OIDC_ISSUER_URL=|' \
  .env.factory.example > /tmp/no-oidc.factory.env
docker compose -f compose.yaml -f compose.live.yaml -f compose.factory.yaml --env-file /tmp/no-oidc.factory.env config -q
# Expected: "required variable OAUTH2_PROXY_OIDC_ISSUER_URL is missing a value" for
# oauth2-proxy, factory-board and factory-mcp.

# 5. Validate Caddy TLS reverse-proxy config
docker run --rm -v "$PWD/dev/Caddyfile.factory:/etc/caddy/Caddyfile:ro" caddy:2.11.4-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# 6. Docs and agent sync gates
node tools/agents/sync.mjs --check
node tools/docs-check/check-docs.mjs
```

## Live-Smoke Startup & Manual Verification

Start the full container stack:

```sh
docker compose -f compose.yaml -f compose.live.yaml -f compose.factory.yaml \
  --env-file .env.factory --profile app up -d --build --wait
```

Verify each surface manually against `E2E_SYSTEM_URL=https://127.0.0.1:${EDGE_HTTPS_PORT:-8443}` (using `-k` if using Caddy's `tls internal` self-signed cert):

1. **Readiness & Auth Fail-Closed**:
   ```sh
   curl -fsSk https://127.0.0.1:8443/readyz
   curl -fsSk https://127.0.0.1:8443/board/readyz
   curl -fsSk https://127.0.0.1:8443/factory-mcp/readyz
   # Unauthenticated /api/agents must return 401:
   curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:8443/api/agents
   ```
2. **Model-Pinned Agents (`GET /api/agents`, `E3-T1`)**:
   ```sh
   curl -fsSk -H "Authorization: Bearer $E2E_OIDC_TOKEN" https://127.0.0.1:8443/api/agents | jq '.[].id'
   # Expected: "adam-architect", "adam-coder-fast", "adam-coder-light"
   ```
3. **Live AG-UI Smoke Run**:
   - Send a `POST /agui/agents/adam-architect` request with a fresh `threadId` UUID and valid `Authorization: Bearer $E2E_OIDC_TOKEN` and confirm `RUN_FINISHED`.
4. **Verification Gate (`E4-T2`)**:
   - Inside any generated `app-factory-blueprint` working tree, run [`dev/agent-checks.sh`](../../dev/agent-checks.sh) to enforce `cratestack check`, `cratestack contract check`, `cratestack diff`, `cratestack generate-dart --preset fespalier --fespalier-ref v0.26.0 --check`, `fsp check`, `flutter test`, `cargo test --locked`, and `docker compose` validation.

Tear down cleanly when finished:

```sh
docker compose -f compose.yaml -f compose.live.yaml -f compose.factory.yaml --profile app down -v
```
