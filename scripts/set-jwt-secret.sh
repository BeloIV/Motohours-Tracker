#!/bin/bash
# Writes a random JWT_SECRET into .env (created with mode 600 if missing).
# Never prints the value. Existing valid secret is kept unless --rotate.
#   scripts/set-jwt-secret.sh            # first setup
#   scripts/set-jwt-secret.sh --rotate   # new secret — logs everybody out
# Then: docker compose up -d --build backend
set -euo pipefail
cd "$(dirname "$0")/.."

DEFAULTS=("your-super-secret-jwt-key-change-this-in-production" "your-secret-key-change-in-production")
[ -f .env ] || { touch .env; chmod 600 .env; }

current=$(sed -n 's/^JWT_SECRET=//p' .env | tail -1)
valid=1
[ ${#current} -ge 32 ] || valid=0
for d in "${DEFAULTS[@]}"; do [ "$current" = "$d" ] && valid=0; done

if [ "$valid" = 1 ] && [ "${1:-}" != "--rotate" ]; then
    echo "JWT_SECRET already set (${#current} chars) — nothing to do. Use --rotate to replace it."
    exit 0
fi

mkdir -p backups
cp .env "backups/env.bak-$(date +%F-%H%M%S)"
chmod 600 backups/env.bak-*

secret=$(openssl rand -hex 48)
if grep -q '^JWT_SECRET=' .env; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env
else
    [ -s .env ] && [ -n "$(tail -c1 .env)" ] && echo >> .env
    echo "JWT_SECRET=${secret}" >> .env
fi
chmod 600 .env
echo "JWT_SECRET written to .env (${#secret} chars). Existing logins are invalid after the backend restarts."
