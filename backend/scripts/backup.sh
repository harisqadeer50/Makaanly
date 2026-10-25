#!/usr/bin/env bash
# Writes a compressed, date-stamped backup of the database. Needs the MongoDB Database Tools (mongodump).
#   MONGODB_URI="mongodb+srv://..." ./scripts/backup.sh [output-folder]
# Restore (into an empty or test database first!):
#   mongorestore --uri "$MONGODB_URI" --gzip --archive=backups/makaanly-YYYYMMDD-HHMMSS.archive.gz --drop
# Photos live in Cloudinary and are not part of this backup. See docs/DEPLOYMENT.md.
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI first}"
out="${1:-backups}"
mkdir -p "$out"
file="$out/makaanly-$(date +%Y%m%d-%H%M%S).archive.gz"
mongodump --uri "$MONGODB_URI" --gzip --archive="$file"
echo "Backup written to $file"
