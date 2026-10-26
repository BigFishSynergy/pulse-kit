"""The data contract: the one file shape every connector must produce (docs/DATA-CONTRACT.md explains each column).

The rules (rules/pulse_metrics.py) and the Pulse (site/pipeline) only ever read these files and columns, so nothing
downstream changes per CRM. A connector's whole job is to land these files on the data branch.

Used by scripts/check_rules.py (every rules change), connectors/csv/convert.py (every import) and sample/make_sample.py.
Usage: python scripts/data_contract.py path/to/data      prints what is missing or not allowed, exits 1 if anything is
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

# Dates are M/D/YY, optionally followed by a time ("10/07/26 2:15 PM"), like AccuLynx exports them.
DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{2}(\s.*)?$")

FILES = {
    "job_export_raw_latest.csv": {
        "about": "Every lead, prospect, job and dead lead. One row per record.",
        "required": [
            ("Job Number", "text", "The job number once the record is approved (blank before). Starts with the job number prefix in rules/settings.json."),
            ("Job Number Url", "text", "Link that opens the record in the CRM."),
            ("Job Category", "text", "Residential, Commercial, Property Management (the CRM's own names)."),
            ("Job Trade Type", "text", "Trade or trades, combined in one cell if more than one. Contains \"Call Back\" for rework."),
            ("Work Type", "text", "New, Repair, Upsell / Change Order (the upgrade work type), Service, Insurance and so on."),
            ("Primary Salesperson", "text", "The rep who owns the record, spelled exactly as the roster in rules/settings.json."),
            ("Contract Amount", "money", "Signed contract value. Real from Approved on."),
            ("Primary Estimate Total", "money", "Total of the primary estimate. Over 0 means they were quoted (a sit)."),
            ("Discount Amount", "money", "Discount on the job, stored as a negative number. 0 or blank if none."),
            ("Profit", "money", "Gross profit in dollars, after commissions. Closed jobs only."),
            ("Profit %", "number", "Profit divided by Contract Amount, as a fraction (0.35 for 35%). 1 means 100%: costs not loaded."),
            ("Parent Lead Source", "text", "Rollup bucket for the lead source (GOOGLE, META, REFERRAL...)."),
            ("Sub Lead Source", "text", "The specific source under the parent."),
            ("Appointment Set By", "text", "The CSR (setter) who booked the appointment."),
            ("Current Milestone", "text", "Stage now: Unassigned Lead, Assigned Lead, Prospect, Approved, Completed, Invoiced, Closed or Dead."),
            ("Current Status", "text", "Sub-status inside the stage (Scheduled, In Progress, Pending...)."),
            ("Lead Milestone Date", "date", "Day the record came in."),
            ("Prospect Milestone Date", "date", "Day the appointment was booked."),
            ("Initial Appointment Date", "date", "Day the first appointment happened."),
            ("Approved Milestone Date", "date", "Day the contract was approved (the sale date)."),
            ("Completed Milestone Date", "date", "Day the job was installed."),
            ("Invoiced Milestone Date", "date", "Day the job was billed."),
            ("Closed Milestone Date", "date", "Day the job was closed out (job costing final)."),
            ("Dead Lead Milestone Date", "date", "Day the record died."),
            ("Dead Lead Reason", "text", "Why it died, exactly as the CRM names it."),
        ],
        "optional": [
            ("Job: Location Zip Code", "text", "Zip code of the job. Needed for the map, towns and regions. Zip only, never the street."),
            ("Job: Location City", "text", "Town of the job. Town only, never the street."),
            ("Appointment Rating", "text", "Hot / Great / Good, if the setters rate appointments."),
            ("Submitted for Approval Date", "date", "Day the rep submitted the job for approval."),
            ("Current Milestone Date", "date", "Day the record entered its current stage."),
            ("Current Status Date", "date", "Day the record entered its current status."),
            ("Job Last Touched Date", "date", "Last activity on the record."),
            ("Estimates", "number", "Number of estimates attached."),
            ("Comissions", "money", "Commission to the Primary Salesperson (spelled as AccuLynx exports it)."),
            ("Initial Lead Notes", "text", "Notes on the lead when it came in. Phones, emails and street addresses are masked by the connector."),
            ("Post Appointment Notes #1", "text", "The rep's notes after the appointment. Masked the same way."),
            ("Post Appointment Notes #2", "text", "More notes after the appointment. Masked the same way."),
        ],
    },
    "Revenue_In_Progress_latest.csv": {
        "about": "Approved jobs with scheduled installs. One row per trade on a job.",
        "required": [
            ("Job Number", "text", "Same job number as the job export."),
            ("Job Number Url", "text", "Link to the record."),
            ("Primary Salesperson", "text", "Same as the job export."),
            ("Trade Name", "text", "One trade per row. A two-trade job has two rows."),
            ("Crew Start Date", "date", "When the install starts."),
            ("Crew End Date", "date", "When the install ends."),
            ("Job Value", "money", "Full job value, repeated on every row of the job."),
            ("Current Status", "text", "Same as the job export."),
            ("Current Milestone", "text", "Same as the job export."),
        ],
        "optional": [],
    },
    "job_expenses_latest.csv": {
        "about": "Optional. Every cost line on Closed jobs, last 12 months, for job costing. Without it the Job costing page stays off.",
        "required": [
            ("Job Number", "text", "Same job number as the job export."),
            ("Job Number Url", "text", "Link to the record."),
            ("Payment Type", "text", "Paid = a job cost. Additional = commission."),
            ("Payment Amount", "money", "The line amount. Negative = a return or credit."),
            ("To/Method", "text", "Who or what was paid: \"Material [supplier]\", \"Labor [crew] Pay\", \"Labor [crew] Dump\", \"[rep] Commission\"."),
            ("Job Value", "money", "Contract Amount, repeated on every line of the job."),
            ("Balance Due", "money", "What the customer still owes."),
            ("Work Type", "text", "Same as the job export."),
            ("Additional Expenses", "money", "Total commission on the job."),
            ("Total Expenses", "money", "Total of all lines on the job."),
        ],
        "optional": [
            ("Memo/Notes", "text", "Free text. Masked by the connector."),
            ("Check Number/Reference", "text", "Free text."),
            ("Trade Type", "text", "Same as Job Trade Type."),
            ("Job Category", "text", "Same as the job export."),
            ("Paid in Full", "text", "Yes or No."),
        ],
    },
}

# Columns that must never be saved: customer names and contact details. Connectors drop them before saving.
NEVER = re.compile(r"(?i)(phone|mobile|cell|e-?mail|street|address|primary contact|customer name|homeowner|^job name$)")
# Inside free-text columns, these get masked.
MASKS = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[email removed]"),
    (re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"), "[phone removed]"),
    (re.compile(r"(?i)\b\d{1,6}\s+(?:[A-Z][a-z]+\s){1,3}(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|way|pl|place|ter|terrace|cir|circle|pkwy|hwy)\b\.?"), "[address removed]"),
]


def mask(text):
    s = str(text)
    for rx, rep in MASKS:
        s = rx.sub(rep, s)
    return s


def header(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return next(csv.reader(f), [])


def check_file(path, spec):
    """Problems with one file: required columns missing, columns that must never be saved, bad dates in the first rows."""
    out = []
    cols = header(path)
    for name, kind, _ in spec["required"]:
        if name not in cols:
            out.append(f"{path.name}: missing required column \"{name}\"")
    for c in cols:
        if NEVER.search(c) and c not in {n for n, _, _ in spec["required"] + spec["optional"]}:
            out.append(f"{path.name}: column \"{c}\" holds customer names or contact details and must not be saved (the connector drops it)")
    kinds = {n: k for n, k, _ in spec["required"] + spec["optional"]}
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        for i, row in zip(range(200), r):
            for c, k in kinds.items():
                v = (row.get(c) or "").strip()
                if k == "date" and v and not DATE_RE.match(v):
                    out.append(f"{path.name}: \"{c}\" on row {i + 2} is \"{v[:20]}\", not a M/D/YY date")
                    kinds[c] = "checked"
    return out


def check_folder(folder):
    """Problems across the data folder. The job export and Revenue In Progress are required; job expenses are optional."""
    folder = Path(folder)
    out = []
    for name, spec in FILES.items():
        p = folder / name
        if not p.exists():
            if name != "job_expenses_latest.csv":
                out.append(f"{name} is missing from {folder}")
            continue
        out += check_file(p, spec)
    st = folder / "status.json"
    if not st.exists():
        out.append(f"status.json is missing from {folder}")
    else:
        s = json.loads(st.read_text())
        if not (s.get("job_export_raw") or {}).get("runDate"):
            out.append("status.json has no job_export_raw.runDate (when the CRM produced the export, UTC ISO time)")
    return out


def scrub_csv(text):
    """Drop never-save columns and mask phones, emails and street addresses in every text cell. Returns clean CSV text.
    Handles records that spill across lines (unquoted notes), the same way the rules code repairs them."""
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    if not rows:
        return text
    hdr, n = rows[0], len(rows[0])
    k = next((i for i, c in enumerate(hdr) if "note" in c.lower()), n - 1)
    tail = n - 1 - k
    fixed, cur = [], None
    for row in rows[1:]:
        if cur is None:
            cur = row
        else:
            cur[-1] = cur[-1] + "\n" + (row[0] if row else "")
            cur.extend(row[1:])
        if len(cur) >= n:
            if len(cur) > n:
                cur = cur[:k] + [",".join(cur[k:len(cur) - tail])] + cur[len(cur) - tail:]
            fixed.append(cur)
            cur = None
    keep = [i for i, c in enumerate(hdr) if not NEVER.search(c)]
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([hdr[i] for i in keep])
    for row in fixed:
        w.writerow([mask(row[i]) if i < len(row) else "" for i in keep])
    return buf.getvalue()


if __name__ == "__main__":
    probs = check_folder(sys.argv[1] if len(sys.argv) > 1 else "data")
    print("\n".join(probs) if probs else "Data contract check passed.")
    sys.exit(1 if probs else 0)
