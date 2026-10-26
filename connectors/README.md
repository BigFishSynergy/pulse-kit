# Connectors

A connector has one job: land the files in `docs/DATA-CONTRACT.md` on the `data` branch, with a `status.json` that says when the CRM produced them. The rules (`rules/`) and the Pulse (`site/`) only ever read those files, so nothing past this folder changes per CRM.

| Connector | For | How the data gets in | Workflow |
|---|---|---|---|
| `acculynx/` | AccuLynx | AccuLynx runs three saved reports on a schedule; the pull reads the newest run through the AccuLynx API (read only) | `pull-acculynx.yml` |
| `csv/` | Any CRM that can export a CSV | Someone uploads the exports to the `imports` branch; the converter maps the columns | `import-csv.yml` |
| `jobnimbus/` | JobNimbus | Reserved. Built in its own session on a real account | (coming) |
| `optional/` | GoHighLevel call transcripts | Matches setter calls to jobs. Optional extra | (wire in when needed) |

Pick the connector in `site/pulse.config.json` (`crm.connector`) and in the repo variable `CRM_CONNECTOR`. Every connector's workflow runs `scripts/scrub.py` (drops customer names, phones, emails and street addresses) and `scripts/data_contract.py` (checks every required column is there) before it saves anything. When it saves new data it starts `pulse-data`, which rebuilds the site's numbers.

## Adding a connector

1. Make a folder here with the pull script and a README (what it reads, which secrets it needs, read only).
2. Make it write the three contract files and `status.json` into `$DATA_DIR`.
3. Copy `pull-acculynx.yml` for the workflow: keep the scrub, contract check, save and "Rebuild the Pulse" steps as they are.
4. Run `python scripts/data_contract.py <folder>` on what it produced until it says the check passed.
