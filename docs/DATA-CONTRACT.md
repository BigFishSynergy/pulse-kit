# The data contract

Every connector, whatever the CRM, produces exactly these files on the `data` branch. The rules (`rules/pulse_metrics.py`) and the Pulse (`site/pipeline`) only ever read them, so nothing past the connector changes per CRM. The column names are AccuLynx's own, because the rules were first matched to AccuLynx to the penny; another CRM's connector renames its columns to these.

This page is written from `scripts/data_contract.py` (run `python scripts/contract_doc.py` after changing it). `python scripts/data_contract.py <folder>` checks a folder against it; every connector runs that check before it saves.

## The rules for every file

- CSV, UTF-8, one header row, the exact column names below. Extra columns are allowed and ignored, except the ones that are never allowed.
- Dates are `M/D/YY`, a time after a space is fine (`10/07/26 2:15 PM`). Blank when the record has not reached that step.
- Money is a plain number, no `$` or commas (`15500.00`). Discounts are negative.
- **Never saved:** customer names, phone numbers, emails and street addresses (any column whose name says name, phone, mobile, cell, email, street, address, primary contact, customer or homeowner, and `Job Name`). Zip code and town are allowed. `scripts/scrub.py` drops those columns and masks phones, emails and street addresses inside notes, and every connector runs it before saving.
- Records are identified only by `Job Number` and the CRM link.

## status.json

Written by the connector next to the files.

```json
{
  "job_export_raw": { "runDate": "2026-10-25T13:05:00", "schedule": "Morning", "rows": 9612 },
  "revenue_in_progress": { "runDate": "2026-10-25T13:05:00" },
  "job_expenses_raw": { "runDate": "2026-10-25T13:05:00" }
}
```

`runDate` is when the CRM produced the export, in UTC. The Pulse shows it as "Data pulled", in the company's time zone, and warns when it is over a day old.

## `data/job_export_raw_latest.csv`

Every lead, prospect, job and dead lead. One row per record.

| Column | Kind | Required | What it holds |
|---|---|---|---|
| Job Number | text | yes | The job number once the record is approved (blank before). Starts with the job number prefix in rules/settings.json. |
| Job Number Url | text | yes | Link that opens the record in the CRM. |
| Job Category | text | yes | Residential, Commercial, Property Management (the CRM's own names). |
| Job Trade Type | text | yes | Trade or trades, combined in one cell if more than one. Contains "Call Back" for rework. |
| Work Type | text | yes | New, Repair, Upsell / Change Order (the upgrade work type), Service, Insurance and so on. |
| Primary Salesperson | text | yes | The rep who owns the record, spelled exactly as the roster in rules/settings.json. |
| Contract Amount | money | yes | Signed contract value. Real from Approved on. |
| Primary Estimate Total | money | yes | Total of the primary estimate. Over 0 means they were quoted (a sit). |
| Discount Amount | money | yes | Discount on the job, stored as a negative number. 0 or blank if none. |
| Profit | money | yes | Gross profit in dollars, after commissions. Closed jobs only. |
| Profit % | number | yes | Profit divided by Contract Amount, as a fraction (0.35 for 35%). 1 means 100%: costs not loaded. |
| Parent Lead Source | text | yes | Rollup bucket for the lead source (GOOGLE, META, REFERRAL...). |
| Sub Lead Source | text | yes | The specific source under the parent. |
| Appointment Set By | text | yes | The CSR (setter) who booked the appointment. |
| Current Milestone | text | yes | Stage now: Unassigned Lead, Assigned Lead, Prospect, Approved, Completed, Invoiced, Closed or Dead. |
| Current Status | text | yes | Sub-status inside the stage (Scheduled, In Progress, Pending...). |
| Lead Milestone Date | date | yes | Day the record came in. |
| Prospect Milestone Date | date | yes | Day the appointment was booked. |
| Initial Appointment Date | date | yes | Day the first appointment happened. |
| Approved Milestone Date | date | yes | Day the contract was approved (the sale date). |
| Completed Milestone Date | date | yes | Day the job was installed. |
| Invoiced Milestone Date | date | yes | Day the job was billed. |
| Closed Milestone Date | date | yes | Day the job was closed out (job costing final). |
| Dead Lead Milestone Date | date | yes | Day the record died. |
| Dead Lead Reason | text | yes | Why it died, exactly as the CRM names it. |
| Job: Location Zip Code | text | no | Zip code of the job. Needed for the map, towns and regions. Zip only, never the street. |
| Job: Location City | text | no | Town of the job. Town only, never the street. |
| Appointment Rating | text | no | Hot / Great / Good, if the setters rate appointments. |
| Submitted for Approval Date | date | no | Day the rep submitted the job for approval. |
| Current Milestone Date | date | no | Day the record entered its current stage. |
| Current Status Date | date | no | Day the record entered its current status. |
| Job Last Touched Date | date | no | Last activity on the record. |
| Estimates | number | no | Number of estimates attached. |
| Comissions | money | no | Commission to the Primary Salesperson (spelled as AccuLynx exports it). |
| Initial Lead Notes | text | no | Notes on the lead when it came in. Phones, emails and street addresses are masked by the connector. |
| Post Appointment Notes #1 | text | no | The rep's notes after the appointment. Masked the same way. |
| Post Appointment Notes #2 | text | no | More notes after the appointment. Masked the same way. |

## `data/Revenue_In_Progress_latest.csv`

Approved jobs with scheduled installs. One row per trade on a job.

| Column | Kind | Required | What it holds |
|---|---|---|---|
| Job Number | text | yes | Same job number as the job export. |
| Job Number Url | text | yes | Link to the record. |
| Primary Salesperson | text | yes | Same as the job export. |
| Trade Name | text | yes | One trade per row. A two-trade job has two rows. |
| Crew Start Date | date | yes | When the install starts. |
| Crew End Date | date | yes | When the install ends. |
| Job Value | money | yes | Full job value, repeated on every row of the job. |
| Current Status | text | yes | Same as the job export. |
| Current Milestone | text | yes | Same as the job export. |

## `data/job_expenses_latest.csv`

Optional. Every cost line on Closed jobs, last 12 months, for job costing. Without it the Job costing page stays off.

| Column | Kind | Required | What it holds |
|---|---|---|---|
| Job Number | text | yes | Same job number as the job export. |
| Job Number Url | text | yes | Link to the record. |
| Payment Type | text | yes | Paid = a job cost. Additional = commission. |
| Payment Amount | money | yes | The line amount. Negative = a return or credit. |
| To/Method | text | yes | Who or what was paid: "Material [supplier]", "Labor [crew] Pay", "Labor [crew] Dump", "[rep] Commission". |
| Job Value | money | yes | Contract Amount, repeated on every line of the job. |
| Balance Due | money | yes | What the customer still owes. |
| Work Type | text | yes | Same as the job export. |
| Additional Expenses | money | yes | Total commission on the job. |
| Total Expenses | money | yes | Total of all lines on the job. |
| Memo/Notes | text | no | Free text. Masked by the connector. |
| Check Number/Reference | text | no | Free text. |
| Trade Type | text | no | Same as Job Trade Type. |
| Job Category | text | no | Same as the job export. |
| Paid in Full | text | no | Yes or No. |

## Optional extras

| File | From | Used for |
|---|---|---|
| `data/ads_daily_latest.csv` | Windsor.ai (`WINDSOR_API_KEY`) | Ad spend by campaign: `date,platform,campaign,spend,impressions,clicks,platform_leads` (RULES.md section 14) |
| `data/google_reviews_latest.csv` | Windsor.ai | Google reviews: `review_id,created_utc,stars,location,reviewer,text,reply`, phones and emails masked (the 5-star reviews scorecard line) |

## How each stage reads the CRM

The rules count a record by the date it entered each stage, so a connector must keep one date per stage, the day the record first got there:

Unassigned Lead or Assigned Lead (Lead Milestone Date), Prospect (Prospect Milestone Date, the appointment was booked), Approved (the contract was signed), Completed (installed), Invoiced (billed), Closed (closed out, job costing final), Dead (lost, from any stage, with a Dead Lead Reason). `Current Milestone` is where the record is now.

For a CRM that calls its stages something else, the connector translates the names (`connectors/csv/mapping.json` `values`), and the rules session records the translation in `rules/RULES.md` section 9.
