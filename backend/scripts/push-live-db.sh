#!/usr/bin/env bash
#
# Replaces the live database with a copy of the local one. Anything added on live
# since your last pull is lost, unless you restore the backup this makes first.
#
#   npm run db:push-live          from backend/ or the repo root
#
# The live URL comes from LIVE_DATABASE_URL, or from backend/.env.live (not in git).
# The local database comes from DATABASE_URL in backend/.env. Live is backed up to
# backend/backups/ (not in git) first, and the newest five backups are kept. The
# replace is one transaction, so a failure leaves live as it was.
set -euo pipefail
export LC_ALL=C   # sort, comm and join must agree on order.

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$BACKEND/backups"
KEEP_BACKUPS=5

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
case "$LOCAL_BASE" in
  *@localhost:*|*@localhost/*|*@127.0.0.1:*|*@127.0.0.1/*) ;;
  *) fail "the local DATABASE_URL is not on this machine" ;;
esac
case "$LIVE_URL" in
  *@localhost:*|*@localhost/*|*@127.0.0.1:*|*@127.0.0.1/*) fail "LIVE_DATABASE_URL points at this machine" ;;
esac

# The tools must be at least as new as both servers.
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
echo "Checking both databases..."
LIVE_MAJOR="$(psql "$LIVE_URL" -Atc "select current_setting('server_version_num')::int / 10000")" \
  || fail "could not reach the live database"
LOCAL_MAJOR="$(psql "$LOCAL_BASE" -Atc "select current_setting('server_version_num')::int / 10000")" \
  || fail "could not reach the local database"
NEEDED=$(( LIVE_MAJOR > LOCAL_MAJOR ? LIVE_MAJOR : LOCAL_MAJOR ))
TOOLS="$(find_tools "$NEEDED")" || fail "install PostgreSQL $NEEDED client tools (brew install postgresql@$NEEDED)"

LIVE_DB="$(psql "$LIVE_URL" -Atc 'select current_database()')"
LIVE_HOST="$(printf '%s' "$LIVE_URL" | sed -E 's#^[^@]*@([^/:?]+).*#\1#')"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

MIGRATIONS="select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by 1"
psql "$LIVE_URL" -Atc "$MIGRATIONS" | sort > "$WORK/live.migrations"
psql "$LOCAL_BASE" -Atc "$MIGRATIONS" | sort > "$WORK/local.migrations"

# Live ahead of local means the local copy is older than the deployed schema.
BEHIND="$(comm -23 "$WORK/live.migrations" "$WORK/local.migrations")"
[ -z "$BEHIND" ] || fail "live has migrations your local database lacks. Run npm run db:pull-live first:
$BEHIND"

SQL="select string_agg(format('select %L, count(*) from public.%I', tablename, tablename), ' union all ' order by tablename) from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'"
count_rows() {
  psql "$1" -At -F '|' -c "$(psql "$1" -Atc "$SQL")" | sort
}
count_rows "$LIVE_URL" > "$WORK/live.counts"
count_rows "$LOCAL_BASE" > "$WORK/local.counts"

echo
echo "Tables that will change (table: live -> local):"
join -t '|' -a 1 -a 2 -e 0 -o 0,1.2,2.2 "$WORK/live.counts" "$WORK/local.counts" > "$WORK/both"
awk -F '|' '$2 != $3 { printf "  %s: %s -> %s\n", $1, $2, $3 }' "$WORK/both"
LOSSES="$(awk -F '|' '$3 + 0 < $2 + 0 { printf "  %s: %d fewer rows\n", $1, $2 - $3 }' "$WORK/both")"
if [ -n "$LOSSES" ]; then
  echo
  echo "WARNING: live has rows your local database does not. They will be deleted:"
  echo "$LOSSES"
fi
NEW_MIGRATIONS="$(comm -13 "$WORK/live.migrations" "$WORK/local.migrations")"
if [ -n "$NEW_MIGRATIONS" ]; then
  echo
  echo "These schema changes reach live, whether or not the API code using them is deployed:"
  printf '%s\n' "$NEW_MIGRATIONS" | sed 's/^/  /'
fi

echo
echo "This replaces ALL data in '$LIVE_DB' on $LIVE_HOST with your local database."
echo "Edited rows are not listed above. Everyone on live will be logged out."
printf "Type the database name (%s) to continue: " "$LIVE_DB"
read -r ANSWER || ANSWER=""
[ "$ANSWER" = "$LIVE_DB" ] || fail "the name did not match, so nothing was changed"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/live_$(date +%Y%m%d_%H%M%S).dump"
echo "Backing up live to $BACKUP..."
"$TOOLS/pg_dump" "$LIVE_URL" -Fc --no-owner --no-acl -f "$BACKUP" || { rm -f "$BACKUP"; fail "the backup failed, so nothing was changed"; }
[ -s "$BACKUP" ] || { rm -f "$BACKUP"; fail "the backup was empty, so nothing was changed"; }

echo "Reading local data..."
"$TOOLS/pg_dump" "$LOCAL_BASE" -Fc --no-owner --no-acl -f "$WORK/local.dump" || fail "could not read the local database, so nothing was changed"

echo "Replacing live data..."
if ! "$TOOLS/pg_restore" -d "$LIVE_URL" --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error "$WORK/local.dump" 2> "$WORK/restore.log"; then
  tail -5 "$WORK/restore.log" >&2
  fail "the replace failed and was rolled back, so live is unchanged. Backup: $BACKUP"
fi

count_rows "$LIVE_URL" > "$WORK/after.counts"
count_rows "$LOCAL_BASE" > "$WORK/local.counts"
if ! diff "$WORK/after.counts" "$WORK/local.counts" > "$WORK/diff"; then
  echo "Warning: these tables differ from local after the push:"
  cat "$WORK/diff"
fi

# Keep the newest backups only.
ls -1t "$BACKUP_DIR"/live_*.dump | tail -n +$(( KEEP_BACKUPS + 1 )) | while read -r old; do
  echo "Removing old backup $old"
  rm -f "$old"
done

echo
echo "Done. Live now matches your local database."
echo "To undo it:"
echo "  $TOOLS/pg_restore -d \"\$LIVE_DATABASE_URL\" --clean --if-exists --no-owner --no-acl --single-transaction $BACKUP"
