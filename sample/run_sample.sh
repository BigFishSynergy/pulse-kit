#!/usr/bin/env bash
# The end-to-end sample run: made-up data -> data contract check -> rules check -> privacy tests -> Pulse build
# (ledger proven equal to the rules, privacy guard) -> the site, built and started at http://localhost:3000/pulse.
# Nothing here touches a real CRM, a real company or the internet (except npm and pip installs).
# Usage: bash sample/run_sample.sh            (needs python3.12 and node 20+)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=sample/out
mkdir -p "$OUT"
[ -d "$OUT/venv" ] || python3.12 -m venv "$OUT/venv"
"$OUT/venv/bin/pip" install -q -r site/pipeline/requirements.txt
PY="$OUT/venv/bin/python"

echo "== 1. Sample map and data (made up)"
$PY scripts/make_zip_files.py --sample
$PY sample/make_sample.py
$PY sample/make_sample_rules.py

echo "== 2. Data contract"
$PY scripts/data_contract.py sample/data

echo "== 3. Rules check (the sample company's filled-in rules + the kit's pulse_metrics.py)"
rm -rf "$OUT/rules" && mkdir -p "$OUT/rules" && cp rules/pulse_metrics.py sample/rules/* "$OUT/rules/"
$PY scripts/check_rules.py sample/data/job_export_raw_latest.csv --rules "$OUT/rules"

echo "== 4. Privacy tests"
$PY sample/test_privacy.py

echo "== 5. Pulse build"
$PY site/pipeline/fetch_sheets.py --rules "$OUT/rules" --out "$OUT/sheets"
rm -rf "$OUT/pulse-data"
RULES_COMMIT=sample $PY site/pipeline/build.py --rules "$OUT/rules" --data sample/data --sheets "$OUT/sheets" --out "$OUT/pulse-data"

echo "== 6. Site"
cd site
[ -f .env.local ] || { echo "PULSE_SESSION_SECRET=$(openssl rand -hex 24)" > .env.local; chmod 600 .env.local; }
grep -q '^PULSE_DATA_DIR=' .env.local || echo "PULSE_DATA_DIR=$(cd .. && pwd)/$OUT/pulse-data" >> .env.local
node users.mjs list | grep -q '^pat ' || node users.mjs add pat "Pat Owner" lead --password sample-lead-pass >/dev/null
node users.mjs list | grep -q '^alex ' || node users.mjs add alex "Alex Rivera" rep alex-rivera --password sample-rep-pass >/dev/null
node users.mjs list | grep -q '^jamie ' || node users.mjs add jamie "Jamie Ortiz" csr jamie-ortiz --password sample-csr-pass >/dev/null
npm install --no-audit --no-fund --silent
npx next build
echo "Sample logins (local only): leadership pat, a rep alex, a CSR jamie. Passwords are in sample/README.md."
npx next start
