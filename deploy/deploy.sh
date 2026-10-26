#!/usr/bin/env bash
set -euo pipefail

# Pull the current main branch on the VPS, rebuild, wait for readiness.
# Run from the repository root: ./deploy/deploy.sh
# Override with DEPLOY_HOST, DEPLOY_PATH, DEPLOY_BRANCH if needed.

HOST="${DEPLOY_HOST:-travelio-vps}"
APP_DIR="${DEPLOY_PATH:-/opt/travelio-book-search}"
BRANCH="${DEPLOY_BRANCH:-main}"
PUBLIC_URL="${PUBLIC_URL:-https://travelio.andriosirait.com}"

echo "==> deploying ${BRANCH} to ${HOST}:${APP_DIR}"

ssh "$HOST" "APP_DIR='${APP_DIR}' BRANCH='${BRANCH}' bash -s" <<'REMOTE'
set -euo pipefail
cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "error: $APP_DIR is not a git checkout" >&2
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "error: $APP_DIR/.env.production is missing" >&2
  exit 1
fi

git fetch --prune origin
git reset --hard "origin/$BRANCH"

sudo -n docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans
sudo -n docker image prune -f >/dev/null
REMOTE

echo "==> waiting for ${PUBLIC_URL}/api/ready"
for _ in $(seq 1 45); do
  if curl -fsS "${PUBLIC_URL}/api/ready" >/dev/null; then
    echo "==> ready"
    exit 0
  fi
  sleep 2
done

echo "error: deployment finished but readiness check failed" >&2
exit 1
