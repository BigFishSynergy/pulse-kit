# The Pulse site

Next.js 14, deployed on the client's own Vercel with **Root Directory `site`**. Everything company-specific comes from `pulse.config.json`; the client's own content (zips, goals, Speed Round material, logos) lives in `content/` and `public/pulse/brand/`.

| Who | Where | Sees |
|---|---|---|
| Sales reps | `/pulse` (login), `/pulse/me`, `/pulse/me/reports`, `/pulse/me/game`, `/pulse/me/ask` (when `PULSE_ASK_REPS=on`) | Only their own numbers, map, open quotes, coaching card, player card and meter, plus the team's leaderboard tops |
| CSRs | `/pulse` (login), `/pulse/csr`, `/pulse/me/game` | Only their own CSR screen, plus the sales team's tops and totals |
| Leadership | `/pulse/hq` (login), `/pulse/hq/*` | Everything: Pulse, Scorecard, Reports, Moneyball, Map, Team (POWER, player cards, hot and cold), Production, Job costing, Marketing, Speed Round, Ask Claude, Requests, Activity, any rep's or CSR's screen, and Post to Slack for the admin |

The server only ever sends each person the files their role may see. A rep who guesses a leadership address gets a plain 404, and so does anyone opening a page switched off in `pulse.config.json`.

## The data job (`pipeline/`)

`build.py` reads the rules folder and the data branch and writes every JSON file the site reads: `snapshot.py` (leadership numbers), `people.py` (reps, leaderboards, production), `geo_more.py` (zips, open quotes, market), `facts.py` (the Report Builder ledger, checked against the rules on eight date ranges every run; any mismatch stops the build), `privacy.py` (stops the build if a customer name appears), `cycle.py`, `cards.py` (POWER), `meter.py` (hot and cold), `deals.py` (same-day closes, lost reasons, CSR screens), `scoreboard.py` (the Scorecard, checked against the rules' `scorecard()`), `costs.py` (job costing). On Mondays `coach.py` writes coaching cards and `quiz.py` the Speed Round (both need `ANTHROPIC_API_KEY`). `upload_blob.mjs` uploads the result to the private Blob store. `.github/workflows/pulse-data.yml` runs it all.

## Run it locally

```bash
cd site && npm install
echo "PULSE_SESSION_SECRET=$(openssl rand -hex 24)" > .env.local
echo "PULSE_DATA_DIR=/path/to/a/pulse-data/folder" >> .env.local     # or BLOB_READ_WRITE_TOKEN to read the live store
node users.mjs add pat "Pat Owner" lead
npm run dev
```

`bash ../sample/run_sample.sh` does all of this with the sample company.

## Logins

`node users.mjs list | add | password | link | rename | guest | remove | push`. Passwords are stored only as scrypt hashes in `PULSE_USERS`. See `docs/SETUP.md` step 11.
