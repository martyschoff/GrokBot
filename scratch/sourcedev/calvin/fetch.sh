#!/bin/sh
# Download the public-domain CCEL plain texts the Calvin pipeline reads:
# Calvin Translation Society NT commentaries (calcom31..45) and the
# Beveridge Institutes. Research tooling only — these URLs are never spoken.
set -e
DIR="${CCEL_DIR:-/tmp/ccel}"
mkdir -p "$DIR"
for i in 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45; do
  curl -s -A "Mozilla/5.0" -o "$DIR/calcom$i.txt" \
    "https://www.ccel.org/ccel/c/calvin/calcom$i/cache/calcom$i.txt"
done
curl -s -A "Mozilla/5.0" -o "$DIR/institutes.txt" \
  "https://www.ccel.org/ccel/c/calvin/institutes/cache/institutes.txt"
ls -la "$DIR"
