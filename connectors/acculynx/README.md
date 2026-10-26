# AccuLynx connector

`pull.mjs` asks the AccuLynx API (v2) for the newest run of each scheduled report and saves the files to the `data` branch. It only reads. Started by `.github/workflows/pull-acculynx.yml` every 30 minutes in working hours, or by the Run workflow button.

| Report (the file name AccuLynx gives it starts with) | Saved as | Must have |
|---|---|---|
| `job_export_raw` | `data/job_export_raw_latest.csv` | the job export columns in `docs/DATA-CONTRACT.md` |
| `revenue_in_progress` | `data/Revenue_In_Progress_latest.csv` | Crew Start Date, Crew End Date, Job Value |
| `job_expenses_raw` (optional) | `data/job_expenses_latest.csv` | To/Method, Payment Amount |

Settings (repo Settings, Secrets and variables, Actions):

| Name | Kind | What |
|---|---|---|
| `ACCULYNX_API_KEY` | secret | The AccuLynx API key. The client's admin makes it in AccuLynx and pastes it here themselves. |
| `ACCULYNX_SCHEDULES` | variable | The scheduled report IDs, `id:Label` pairs, comma separated: `a1b2c3:Morning,d4e5f6:Afternoon` |
| `CRM_CONNECTOR` | variable | `acculynx` (turns this workflow on) |
| `WINDSOR_API_KEY` | secret, optional | Ad spend and Google reviews from Windsor.ai. Skips itself without it. |

If a pull fails, the last good files stay in place and GitHub emails the repo owner. `status.json` lists what each schedule last sent, which is the first place to look. The client-facing steps (making the key, building the three reports, scheduling them, finding the IDs) are in `guides/acculynx-guide.md`.
