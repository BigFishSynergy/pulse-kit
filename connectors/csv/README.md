# CSV connector (any CRM)

For a CRM with no connector yet: export the reports as CSV, upload them, and this turns them into the data contract files.

1. Export the job list, the scheduled installs and (optional) job costs from the CRM as CSV. Name them so they match the `match` patterns in `mapping.json` (defaults: `*job*export*.csv`, `*progress*.csv`, `*expense*.csv`).
2. On github.com, switch to the `imports` branch, open the `imports` folder, Add file, Upload files, and commit.
3. `import-csv.yml` converts them, drops customer names and contact details, checks them, saves them to the `data` branch, empties the `imports` branch, and rebuilds the Pulse.

`mapping.json` is filled in once, in the rules session: which export column feeds each contract column, how the export writes dates, and how the CRM's words translate (its sold stage becomes `Approved`). Only contract columns are ever written, so anything else in the export never reaches the repo.

Try it on a laptop before the first upload:

```bash
python connectors/csv/convert.py --inbox ~/Downloads/exports --map connectors/csv/mapping.json --out /tmp/pulse-data
python scripts/scrub.py /tmp/pulse-data
python scripts/data_contract.py /tmp/pulse-data
```

Upload as often as you want fresher numbers (daily is plenty for most). The client-facing steps are in `guides/any-crm-guide.md`.
