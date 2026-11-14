# SOULARAB TECH Backend Server

This deployment runs the existing FastAPI backend as a persistent service behind Caddy-managed HTTPS.

## Requirements

- A Linux server with Docker Engine and the Docker Compose plugin.
- A domain or subdomain whose DNS A/AAAA record points to the server.
- Inbound TCP ports 80 and 443 available. UDP 443 is optional (HTTP/3).
- A strong API token.

## Configure

From the repository root:

```sh
cd backend
cp .env.production.example .env.production
```

Edit `.env.production`:
- Set `APP_DOMAIN` to the real API hostname.
- Replace `SOULARAB_API_TOKEN` with a long random secret. Do not reuse a password.
- Keep the local engine URLs unchanged until those engines are deliberately installed and secured on this server.

Generate a token on Linux with:

```sh
openssl rand -hex 32
```

## Start

```sh
docker compose --env-file .env.production -f compose.yaml config
docker compose --env-file .env.production -f compose.yaml up -d --build
docker compose --env-file .env.production -f compose.yaml ps
```

Caddy obtains and renews the TLS certificate automatically after DNS points to this server and ports 80/443 are reachable.

## Verify

```sh
curl -fsS https://YOUR_API_DOMAIN/api/health
curl -i https://YOUR_API_DOMAIN/api/security/status
```

The health endpoint is intentionally public and returns only service status/version. The security endpoint and application routes require:

```
Authorization: Bearer YOUR_SOULARAB_API_TOKEN
```

A missing production token prevents the backend from starting in production mode. The API container is not published directly to the internet; only Caddy is exposed.

## Data and maintenance

- SQLite and project workspaces persist in the named Docker volume `soularab_data`.
- Caddy certificate state persists in `caddy_data` and `caddy_config`.
- View logs: `docker compose --env-file .env.production -f compose.yaml logs -f backend gateway`.
- Restart: `docker compose --env-file .env.production -f compose.yaml restart`.
- Stop without deleting data: `docker compose --env-file .env.production -f compose.yaml down`.
- **Do not** use `docker compose down -v` unless you intentionally want to delete the database and stored projects.
- Back up the `soularab_data` volume before upgrades or server migration.

## Current scope and limitations

This deploys the existing API; it does not create user accounts, password recovery, multi-tenant authorization, a worker queue, or the five-node mesh. The current application uses one shared bearer token. Keep it private. Do not expose llama.cpp, ComfyUI, or whisper.cpp ports publicly. The local inference engine remains unavailable until llama-server is installed and connected on the same trusted host.

For Android, configure the app's API base URL as `https://YOUR_API_DOMAIN` and provide the same bearer token through the app's existing access-token setting. A static web build also needs `VITE_API_BASE_URL=https://YOUR_API_DOMAIN` at build time.
