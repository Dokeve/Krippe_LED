#!/usr/bin/env bash
# Fetch FullCalendar distribution files (CSS + JS) from jsDelivr into public/vendor/fullcalendar
# Usage: ./scripts/fetch-fullcalendar.sh [version]
# Example: ./scripts/fetch-fullcalendar.sh 6.1.11

set -euo pipefail

VERSION=${1:-6.1.11}
OUTDIR="$(dirname "$(readlink -f "$0")")/../public/vendor/fullcalendar"
mkdir -p "$OUTDIR"

CSS_URL="https://cdn.jsdelivr.net/npm/fullcalendar@${VERSION}/index.global.min.css"
JS_URL="https://cdn.jsdelivr.net/npm/fullcalendar@${VERSION}/index.global.min.js"

echo "Fetching FullCalendar v${VERSION} into $OUTDIR"

curl -fsSL -o "$OUTDIR/index.global.min.css" "$CSS_URL"
curl -fsSL -o "$OUTDIR/index.global.min.js" "$JS_URL"

echo "Downloaded:" 
ls -lh "$OUTDIR/index.global.min."*

echo "Done. Restart your server (if running) and reload the UI to use the local files."
