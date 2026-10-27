#!/bin/bash
# Runs the backend test suite in throwaway containers: its own network, its own
# PostgreSQL, no .env. It never touches the database of a running deployment.
#   scripts/test.sh                  # all tests
#   scripts/test.sh tests/auth       # jest path filter
set -euo pipefail
cd "$(dirname "$0")/.."

ID=moto-test-$$
cleanup() {
  docker rm -f "$ID-db" >/dev/null 2>&1 || true
  docker network rm "$ID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$ID" >/dev/null
docker run -d --name "$ID-db" --network "$ID" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:15-alpine >/dev/null
until docker exec "$ID-db" pg_isready -U test -d test -q; do sleep 1; done
sleep 2

# Source mounted read-only and copied, so node_modules never lands in the repo
docker run --rm --network "$ID" -v "${BACKEND_DIR:-$PWD/backend}:/src:ro" \
  -e DB_HOST="$ID-db" -e DB_NAME=test -e DB_USER=test -e DB_PASSWORD=test \
  node:22-alpine sh -c 'cp -r /src /app && cd /app && rm -rf node_modules uploads \
    && npm ci --no-fund --no-audit >/dev/null 2>&1 && npx jest --runInBand --silent "$@"' -- "$@"
