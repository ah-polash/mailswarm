#!/bin/sh
# Sync the Prisma schema to the database only when asked to.
#
# Builds skip this on purpose: dev may point DATABASE_URL at the production
# database, and an unguarded `prisma db push` in `npm run build` would push the
# locally checked-out schema straight into production. The VPS deploy doesn't
# push either; run `FORCE_DB_PUSH=1 npm run build` (or `npx prisma db push`)
# deliberately after a schema change.
set -e

if [ "$FORCE_DB_PUSH" = "1" ]; then
  echo "[build] running prisma db push..."
  prisma db push
else
  echo "[build] skipping prisma db push. Set FORCE_DB_PUSH=1 to run it."
fi
