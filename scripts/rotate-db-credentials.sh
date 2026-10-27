#!/bin/bash
# Moves the backend onto a non-superuser DB role and rotates both DB passwords.
#   - creates role motohours_app (or $DB_USER from .env) if missing and makes it
#     owner of motohours_db and all its tables/sequences
#   - sets new random passwords for that role and for the superuser motohours_user
#   - writes DB_USER / DB_PASSWORD / POSTGRES_PASSWORD into .env (backup in backups/)
#   - recreates the backend so it connects as the new role
# Run with the stack up: scripts/rotate-db-credentials.sh
# Safe to re-run: the second time it only rotates passwords. Data is not touched.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME=motohours_db
SU=motohours_user
[ -f .env ] || { touch .env; chmod 600 .env; }
APP_USER=$(sed -n 's/^DB_USER=//p' .env | tail -1)
if [ -z "$APP_USER" ] || [ "$APP_USER" = "$SU" ]; then APP_USER=motohours_app; fi
psql_db() { docker compose exec -T database psql -v ON_ERROR_STOP=1 -q -U "$SU" "$@"; }
APP_PW=$(openssl rand -base64 48 | tr -d '/+=' | head -c 40)
SU_PW=$(openssl rand -base64 48 | tr -d '/+=' | head -c 40)

mkdir -p backups
cp .env "backups/env.bak-$(date +%F-%H%M%S)"
docker compose exec -T database pg_dump -U "$SU" -Fc "$DB_NAME" > "backups/$DB_NAME-prerotate-$(date +%F-%H%M%S).dump"

psql_db -d "$DB_NAME" -v app_user="$APP_USER" -v db_name="$DB_NAME" -v su="$SU" \
  -v app_pw="$APP_PW" -v su_pw="$SU_PW" <<'SQL'
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') AS need_role \gset
\if :need_role
  CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\endif
ALTER ROLE :"app_user" PASSWORD :'app_pw';
BEGIN;
ALTER DATABASE :"db_name" OWNER TO :"app_user";
SELECT set_config('rotate.app_user', :'app_user', true) AS _ \gset
DO $$ DECLARE r record; BEGIN
  -- ALTER TABLE ... OWNER also moves the sequences the table owns.
  FOR r IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p') LOOP
    EXECUTE format('ALTER %s public.%I OWNER TO %I',
      CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
      r.relname, current_setting('rotate.app_user'));
  END LOOP; END $$;
COMMIT;
ALTER ROLE :"su" PASSWORD :'su_pw';
SQL

python3 - "$APP_USER" "$APP_PW" "$SU_PW" <<'PY'
import re, sys
user, app, su = sys.argv[1:]
s = open('.env').read()
for key, val in (('POSTGRES_PASSWORD', su), ('DB_USER', user), ('DB_PASSWORD', app)):
    if re.search(rf'(?m)^{key}=', s):
        s = re.sub(rf'(?m)^{key}=.*$', lambda m: f'{key}={val}', s)
    else:
        s = s.rstrip('\n') + ('\n' if s.strip() else '') + f'{key}={val}\n'
open('.env', 'w').write(s)
PY
chmod 600 .env backups/*

docker compose up -d --force-recreate backend
sleep 8
docker compose exec -T backend node -e "
const {Pool}=require('pg');const p=new Pool({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
p.query('select current_user u, (select rolsuper from pg_roles where rolname=current_user) s').then(r=>{console.log('backend connects as',r.rows[0].u,'superuser:',r.rows[0].s);p.end()}).catch(e=>{console.error('DB check failed:',e.message);process.exit(1)})"
