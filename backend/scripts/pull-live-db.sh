#!/usr/bin/env bash
#
# Replaces the local database with a copy of the live one. It only reads from live.
#
#   npm run db:pull-live          from backend/ or the repo root
#
# The live URL comes from LIVE_DATABASE_URL, or from backend/.env.live (not in git).
# The local database comes from DATABASE_URL in backend/.env, and must be on this
# machine. The previous local database is kept as cura_backup_<time>, and the newest
# three backups are kept.
set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP_BACKUPS=3

fail() { echo "Stopped: $1" >&2; exit 1; }

read_env() {
  [ -f "$2" ] || return 0
  sed -n "s/^$1=//p" "$2" | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

LIVE_URL="${LIVE_DATABASE_URL:-$(read_env LIVE_DATABASE_URL "$BACKEND/.env.live")}"
[ -n "$LIVE_URL" ] || fail "set LIVE_DATABASE_URL, or add it to backend/.env.live"
case "$LIVE_URL" in *sslmode=*) ;; *\?*) LIVE_URL="$LIVE_URL&sslmode=require" ;; *) LIVE_URL="$LIVE_URL?sslmode=require" ;; esac

# Read from the file on purpose: an exported DATABASE_URL could point at live.
LOCAL_URL="$(read_env DATABASE_URL "$BACKEND/.env")"
[ -n "$LOCAL_URL" ] || fail "no DATABASE_URL in backend/.env"
LOCAL_BASE="${LOCAL_URL%%\?*}"
LOCAL_DB="${LOCAL_BASE##*/}"
ADMIN_URL="${LOCAL_BASE%/*}/postgres"
case "$LOCAL_BASE" in
  *@localhost:*|*@localhost/*|*@127.0.0.1:*|*@127.0.0.1/*) ;;
  *) fail "the local DATABASE_URL is not on this machine, so nothing was changed" ;;
esac
case "$LIVE_URL" in
  *@localhost:*|*@localhost/*|*@127.0.0.1:*|*@127.0.0.1/*) fail "LIVE_DATABASE_URL points at this machine" ;;
esac
case "$LOCAL_DB" in ''|*[!a-zA-Z0-9_]*) fail "unexpected local database name" ;; esac

# pg_dump must be at least as new as the live server.
find_tools() {
  local major="$1" dir
  for dir in "/opt/homebrew/opt/postgresql@$major/bin" "/usr/local/opt/postgresql@$major/bin" \
    "/usr/lib/postgresql/$major/bin" "$(dirname "$(command -v pg_dump 2>/dev/null || echo /none/x)")"; do
    if [ -x "$dir/pg_dump" ] && [ "$("$dir/pg_dump" --version | sed -E 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/')" -ge "$major" ]; then
      echo "$dir"
      return 0
    fi
  done
  return 1
}

command -v psql >/dev/null || fail "psql is not installed"
echo "Checking live..."
LIVE_MAJOR="$(psql "$LIVE_URL" -Atc "select current_setting('server_version_num')::int / 10000")" \
  || fail "could not reach the live database, so nothing was changed"
TOOLS="$(find_tools "$LIVE_MAJOR")" || fail "install PostgreSQL $LIVE_MAJOR client tools (brew install postgresql@$LIVE_MAJOR)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

# Everything that can fail on the live side happens before the local database is touched.
echo "Downloading live data..."
"$TOOLS/pg_dump" "$LIVE_URL" -Fc --no-owner --no-acl -f "$WORK/live.dump" \
  || fail "the download failed, so nothing was changed"
[ -s "$WORK/live.dump" ] || fail "the download was empty, so nothing was changed"

admin() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qAt "$@"; }

BACKUP="cura_backup_$(date +%Y%m%d_%H%M%S)"
HAD_LOCAL="$(admin -c "select count(*) from pg_database where datname = '$LOCAL_DB'")"

disconnect() {
  admin -c "select count(pg_terminate_backend(pid)) from pg_stat_activity where datname = '$1' and pid <> pg_backend_pid()" >/dev/null
}

# Puts the previous database back if the copy does not finish.
restore_previous() {
  echo "The copy failed. Putting your previous local database back..." >&2
  disconnect "$LOCAL_DB" || true
  admin -c "DROP DATABASE IF EXISTS \"$LOCAL_DB\"" || true
  [ "$HAD_LOCAL" = "1" ] && admin -c "ALTER DATABASE \"$BACKUP\" RENAME TO \"$LOCAL_DB\"" || true
}

if [ "$HAD_LOCAL" = "1" ]; then
  echo "Keeping your current local database as $BACKUP..."
  disconnect "$LOCAL_DB"
  admin -c "ALTER DATABASE \"$LOCAL_DB\" RENAME TO \"$BACKUP\""
fi

trap 'status=$?; if [ "$status" -ne 0 ]; then restore_previous; fi; rm -rf "$WORK"' EXIT

admin -c "CREATE DATABASE \"$LOCAL_DB\" TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'"

echo "Restoring..."
"$TOOLS/pg_restore" -d "$LOCAL_BASE" --no-owner --no-acl --exit-on-error "$WORK/live.dump"

# Local code may have migrations that live has not had yet.
echo "Applying local migrations..."
(cd "$BACKEND" && DATABASE_URL="$LOCAL_URL" npx prisma migrate deploy >/dev/null)

trap 'rm -rf "$WORK"' EXIT

# Compare every live table except the migration log, which differs when local code is
# ahead of live. A difference only warns: live can change during the copy.
SQL="$(psql "$LIVE_URL" -At -c "select string_agg(format('select %L, count(*) from public.%I', tablename, tablename), ' union all ' order by tablename) from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'")"
psql "$LIVE_URL" -At -F '|' -c "$SQL" > "$WORK/live.counts"
psql "$LOCAL_BASE" -At -F '|' -c "$SQL" > "$WORK/local.counts"
if ! diff "$WORK/live.counts" "$WORK/local.counts" > "$WORK/diff"; then
  echo "Warning: these tables differ from live (table|rows). Live may have changed during the copy:"
  cat "$WORK/diff"
fi

# Keep the newest backups only. Other databases are never touched.
for old in $(admin -c "select datname from pg_database where datname like 'cura\\_backup\\_%' order by datname desc offset $KEEP_BACKUPS"); do
  echo "Removing old backup $old"
  admin -c "DROP DATABASE \"$old\""
done

echo
echo "Done. Local database '$LOCAL_DB' now matches live."
echo "  users $(psql "$LOCAL_BASE" -Atc 'select count(*) from users'), doctors $(psql "$LOCAL_BASE" -Atc 'select count(*) from doctors'), patients $(psql "$LOCAL_BASE" -Atc 'select count(*) from patients')"
[ "$HAD_LOCAL" = "1" ] && echo "  Previous local database: $BACKUP"
exit 0
