"""Write docs/DATA-CONTRACT.md from the spec in scripts/data_contract.py, so the doc and the check never disagree.
Usage: python scripts/contract_doc.py
"""
from pathlib import Path

from data_contract import FILES

ROOT = Path(__file__).resolve().parent.parent
out = ["# The data contract", "",
       "Every connector, whatever the CRM, produces exactly these files on the `data` branch. The rules (`rules/pulse_metrics.py`) and the Pulse (`site/pipeline`) only ever read them, so nothing past the connector changes per CRM. The column names are AccuLynx's own, because the rules were first matched to AccuLynx to the penny; another CRM's connector renames its columns to these.",
       "", "This page is written from `scripts/data_contract.py` (run `python scripts/contract_doc.py` after changing it). `python scripts/data_contract.py <folder>` checks a folder against it; every connector runs that check before it saves.", "",
       "## The rules for every file", "",
       "- CSV, UTF-8, one header row, the exact column names below. Extra columns are allowed and ignored, except the ones that are never allowed.",
       "- Dates are `M/D/YY`, a time after a space is fine (`10/07/26 2:15 PM`). Blank when the record has not reached that step.",
       "- Money is a plain number, no `$` or commas (`15500.00`). Discounts are negative.",
       "- **Never saved:** customer names, phone numbers, emails and street addresses (any column whose name says name, phone, mobile, cell, email, street, address, primary contact, customer or homeowner, and `Job Name`). Zip code and town are allowed. `scripts/scrub.py` drops those columns and masks phones, emails and street addresses inside notes, and every connector runs it before saving.",
       "- Records are identified only by `Job Number` and the CRM link.", "",
       "## status.json", "",
       "Written by the connector next to the files.", "",
       "```json", '{', '  "job_export_raw": { "runDate": "2026-10-25T13:05:00", "schedule": "Morning", "rows": 9612 },',
       '  "revenue_in_progress": { "runDate": "2026-10-25T13:05:00" },', '  "job_expenses_raw": { "runDate": "2026-10-25T13:05:00" }', '}', "```", "",
       "`runDate` is when the CRM produced the export, in UTC. The Pulse shows it as \"Data pulled\", in the company's time zone, and warns when it is over a day old.", ""]
for name, spec in FILES.items():
    out += [f"## `data/{name}`", "", spec["about"], "", "| Column | Kind | Required | What it holds |", "|---|---|---|---|"]
    out += [f"| {c} | {k} | yes | {d} |" for c, k, d in spec["required"]]
    out += [f"| {c} | {k} | no | {d} |" for c, k, d in spec["optional"]]
    out.append("")
out += ["## Optional extras", "",
        "| File | From | Used for |", "|---|---|---|",
        "| `data/ads_daily_latest.csv` | Windsor.ai (`WINDSOR_API_KEY`) | Ad spend by campaign: `date,platform,campaign,spend,impressions,clicks,platform_leads` (RULES.md section 14) |",
        "| `data/google_reviews_latest.csv` | Windsor.ai | Google reviews: `review_id,created_utc,stars,location,reviewer,text,reply`, phones and emails masked (the 5-star reviews scorecard line) |",
        "", "## How each stage reads the CRM", "",
        "The rules count a record by the date it entered each stage, so a connector must keep one date per stage, the day the record first got there:", "",
        "Unassigned Lead or Assigned Lead (Lead Milestone Date), Prospect (Prospect Milestone Date, the appointment was booked), Approved (the contract was signed), Completed (installed), Invoiced (billed), Closed (closed out, job costing final), Dead (lost, from any stage, with a Dead Lead Reason). `Current Milestone` is where the record is now.", "",
        "For a CRM that calls its stages something else, the connector translates the names (`connectors/csv/mapping.json` `values`), and the rules session records the translation in `rules/RULES.md` section 9.", ""]
(ROOT / "docs" / "DATA-CONTRACT.md").write_text("\n".join(out))
print("wrote docs/DATA-CONTRACT.md")
