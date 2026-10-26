# JobNimbus connector (reserved)

Not built yet. It gets its own session, on a real JobNimbus account (the first one is a client's, with their admin's go-ahead to make an API key), so every field is matched against what JobNimbus really sends.

What it has to do, same as every connector (`connectors/README.md`):

- Read only. Use the JobNimbus API key the client's admin makes and stores as the repo secret `JOBNIMBUS_API_KEY`.
- Produce the three files in `docs/DATA-CONTRACT.md`. JobNimbus works in jobs, contacts, statuses and workflows, so the connector maps its statuses to the contract's milestones (Lead, Prospect, Approved, Completed, Invoiced, Closed, Dead) and records the date each status was entered, from the job's status history.
- Never save contact names, phones, emails or addresses. Keep zip and city only.
- Write `status.json` with `job_export_raw.runDate` (when the data was read, UTC).
- Workflow: copy `.github/workflows/pull-acculynx.yml` to `pull-jobnimbus.yml`, swap the pull step, keep the scrub, check, save and rebuild steps, and turn it on with `CRM_CONNECTOR=jobnimbus`.

Until then a JobNimbus client can run on the CSV connector with JobNimbus's own exports.
