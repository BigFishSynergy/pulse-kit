# The sample run

A made-up roofing company, **Summit Sample Roofing**, in a made-up service area (32 fake zips, 99001 to 99032, drawn as hexagons near Austin so the basemap has streets). Every person, number and town is invented. The data has no customer fields at all, and the record links point at crm.example.com.

```bash
bash sample/run_sample.sh
```

| Step | What it proves |
|---|---|
| 1. `make_zip_files.py --sample`, `make_sample.py`, `make_sample_rules.py` | Makes the map files, about 9,600 records in the data contract shape, and the sample company's filled-in rules |
| 2. `scripts/data_contract.py` | The files follow `docs/DATA-CONTRACT.md` |
| 3. `scripts/check_rules.py` | The rules check passes: no FILL_IN left, every name in settings exists in the data, the math runs end to end |
| 4. `sample/test_privacy.py` | The scrubber drops name, phone, email and street columns and masks them in notes; the build's privacy guard catches a planted customer name |
| 5. `site/pipeline/build.py` | The whole Pulse builds, with the report ledger proven equal to the rules on eight date ranges |
| 6. `next build`, `next start` | The site builds and runs at http://localhost:3000/pulse |

## Sample logins (local only)

These exist only in `site/.env.local` on the machine that ran the sample. They are test values, never used anywhere real.

| Role | Name | Password | Start at |
|---|---|---|---|
| Leadership | `pat` | `sample-lead-pass` | /pulse/hq |
| Rep (Alex Rivera) | `alex` | `sample-rep-pass` | /pulse |
| CSR (Jamie Ortiz) | `jamie` | `sample-csr-pass` | /pulse |

## Screenshots

`sample/screenshots/` has every screen from the sample run (Oct 25, 2026): the login, the Pulse (Clean and Everything), the Scorecard, the Map, Team and POWER, Moneyball, Reports, Production, Job costing, Marketing, the Speed Round, Requests, a rep's screen seen from leadership, Post to Slack, Ask Claude, the rep's own screens, a rep getting a 404 on a leadership page, and a CSR's screen, plus the first-time Welcome page and the People page where the admin adds logins (a test login on the sample site; it no longer exists). Ask Claude, Make a graphic, the coaching cards and the Speed Round questions need an Anthropic key, so in the sample they show their "not switched on yet" states.
