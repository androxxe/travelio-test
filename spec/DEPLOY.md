# Deployment runbook

Target: **https://travelio.andriosirait.com** (app + API, same origin).
`travelio-api.andriosirait.com` exposes **`/api/*` only** on the same container; its root returns a JSON descriptor; non-API paths return 404. The SPA keeps using the same-origin API, so the httpOnly wishlist cookie needs no CORS or `SameSite=None` configuration. The API hostname is for curl/Postman/integrations.

## Topology

| Piece | Where |
|---|---|
| App container (`shelf`) | VPS, published on `127.0.0.1:3100` only |
| PostgreSQL 17 | Compose service `db`, no host port, named volume `db-data` |
| Reverse proxy + TLS | Existing nginx on the VPS, certbot webroot |
| Deploy checkout | `/opt/travelio-book-search` (git clone of `main`) |
| Compose project | `travelio-book-search` (`docker-compose.prod.yml`) |

The app applies migrations on boot, retries the database for 15 seconds, and exposes `/api/health` (liveness) and `/api/ready` (database readiness). The container `HEALTHCHECK` uses `/api/ready`.

## Prerequisites

- DNS `A` records for `travelio.andriosirait.com` and `travelio-api.andriosirait.com` point at the VPS.
- SSH alias `travelio-vps` exists locally and resolves to the ops account (sudo NOPASSWD, no docker group — always use `sudo -n docker ...`).
- nginx is active on the host and ports 80/443 are open.
- `certbot` is installed and its renewal timer is active.

## First-time setup

```bash
# 1. Create the deploy directory owned by the ops user
ssh travelio-vps 'sudo install -d -o "$(id -u)" -g "$(id -g)" /opt/travelio-book-search'

# 2. Clone the public repo
ssh travelio-vps 'git clone https://github.com/androxxe/travelio-test.git /opt/travelio-book-search'

# 3. Create the production env file (never commit it)
ssh travelio-vps 'cd /opt/travelio-book-search && cp .env.production.example .env.production && chmod 600 .env.production'
```

Edit `/opt/travelio-book-search/.env.production` **in place** and set:

```dotenv
POSTGRES_PASSWORD=<openssl rand -hex 24>
GOOGLE_BOOKS_API_KEY=<server-side Books key>
```

Use a hex password so it is URL-safe inside `DATABASE_URL`. Do not print the file; verify key names only:

```bash
ssh travelio-vps "grep -o '^[A-Z_]*=' /opt/travelio-book-search/.env.production"
```

Build and start:

```bash
ssh travelio-vps 'cd /opt/travelio-book-search && sudo -n docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans'
ssh travelio-vps 'curl -fsS http://127.0.0.1:3100/api/ready'
```

### TLS

Install the HTTP-only bootstrap vhost, issue one certificate for both names, then install the final TLS vhost:

```bash
# 4. Bootstrap HTTP vhost
ssh travelio-vps 'sudo install -d /var/www/certbot'
scp deploy/nginx/bootstrap-http.conf travelio-vps:/tmp/travelio.conf
ssh travelio-vps 'sudo install -m 644 /tmp/travelio.conf /etc/nginx/sites-available/travelio.andriosirait.com.conf && sudo ln -sfn /etc/nginx/sites-available/travelio.andriosirait.com.conf /etc/nginx/sites-enabled/travelio.andriosirait.com.conf && sudo nginx -t && sudo systemctl reload nginx'

# 5. Issue the certificate
ssh travelio-vps 'sudo certbot certonly --webroot -w /var/www/certbot -d travelio.andriosirait.com -d travelio-api.andriosirait.com --cert-name travelio.andriosirait.com --non-interactive --agree-tos'

# 6. Final TLS + proxy vhost
scp deploy/nginx/travelio.andriosirait.com.conf travelio-vps:/tmp/travelio.conf
ssh travelio-vps 'sudo install -m 644 /tmp/travelio.conf /etc/nginx/sites-available/travelio.andriosirait.com.conf && sudo nginx -t && sudo systemctl reload nginx'
```

Backup the previous vhost before replacing it:

```bash
ssh travelio-vps 'sudo cp -a /etc/nginx/sites-available/travelio.andriosirait.com.conf /etc/nginx/sites-available/travelio.andriosirait.com.conf.bak.$(date -u +%Y%m%dT%H%M%SZ)'
```

## Deploying an update

```bash
./deploy/deploy.sh
```

The script fetches `origin/main`, hard-resets the deploy checkout, rebuilds the image, starts the stack, prunes dangling images, and polls `https://travelio.andriosirait.com/api/ready` for up to 90 seconds.

## Verification

```bash
curl -fsS https://travelio.andriosirait.com/api/health
curl -fsS https://travelio.andriosirait.com/api/ready
curl -fsS 'https://travelio.andriosirait.com/api/books?q=atomic%20habits&limit=2'
curl -sI https://travelio.andriosirait.com/ | grep -i strict-transport-security
curl -fsS https://travelio-api.andriosirait.com/api/health
curl -sI https://travelio-api.andriosirait.com/ | grep -i '^location:'
```

Cookie check (production must add `Secure` because `TRUST_PROXY=true`):

```bash
curl -sI https://travelio.andriosirait.com/api/wishlist | grep -i '^set-cookie:'
```

Browser flow: search → save → reload → item persists → remove.

## Rollback

```bash
ssh travelio-vps 'cd /opt/travelio-book-search && git log --oneline -5'
ssh travelio-vps 'cd /opt/travelio-book-search && git reset --hard <previous-sha> && sudo -n docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build'
```

Migrations are forward-only. A rollback of application code must not undo a migration that already ran; if a release needs a destructive schema change, ship it as a separate forward migration after the code rollback.

## Operations rules

- Back up a file before editing it on the server (`cp -a <file> <file>.bak.$(date -u +%Y%m%dT%H%M%SZ)`).
- Validate before reload: `sudo nginx -t`, `sudo -n docker compose ... config -q`.
- Never `cat`, `env`, or `printenv` the production env file; check key names or compare hashes.
- Never touch other projects on the host, their containers, volumes, vhosts, or certificates.
- Destructive commands (`docker compose down -v`, `docker volume rm`, `docker system prune`, `DROP`, `TRUNCATE`) require explicit user approval.
- Restrict the Google Books key in Google Cloud to the Books API and the VPS egress IP once the demo is stable.
