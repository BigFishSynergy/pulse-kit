"""Make the sample data: a made-up roofing company ("Summit Sample Roofing") whose files follow docs/DATA-CONTRACT.md.

Every person, zip, town and number here is invented. There are no customer fields at all. The links point at
crm.example.com. The files exist to prove the kit end to end: the data contract check, the rules check, the Pulse
build (with its ledger and privacy checks) and the site.

Usage: python sample/make_sample.py [--out sample/data] [--as-of 2026-10-25]
Writes job_export_raw_latest.csv, Revenue_In_Progress_latest.csv, job_expenses_latest.csv and status.json.
Same seed, same files, every time.
"""
import argparse
import csv
import json
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPS = ["Alex Rivera", "Jordan Lee", "Casey Morgan", "Taylor Brooks", "Riley Chen", "Morgan Patel"]
REP_SKILL = {"Alex Rivera": 1.25, "Jordan Lee": 1.1, "Casey Morgan": 1.0, "Taylor Brooks": 0.9, "Riley Chen": 0.85, "Morgan Patel": 0.95}
REP_START = {"Morgan Patel": date(2026, 4, 1)}           # a newer rep
FORMER = ["Drew Former"]                                  # left the team; hidden by name, still in totals
OWNER = "Pat Owner"                                       # sells now and then, not on the sales team
CSRS = ["Jamie Ortiz", "Avery Kim"]
SOURCES = [  # parent, sub, weight, quality
    ("GOOGLE", "Google Ads", 22, 1.0), ("GOOGLE", "Google Search", 10, 1.15), ("GOOGLE", "Google Business Profile", 9, 1.2),
    ("META", "Facebook Ads", 18, 0.8), ("REFERRAL", "Customer Referral", 9, 1.5), ("DIRECTORY", "Angi", 10, 0.75),
    ("EVENTS", "Home Show", 5, 0.9), ("SELF GEN", "Self Gen", 7, 1.3), ("DIRECT MAIL", "Postcards", 5, 0.85), ("z*OLD", "Old Billboard", 1, 0.6),
]
TRADES = [("Roofing", 70), ("Gutters", 10), ("Siding", 8), ("Roofing, Gutters", 9), ("Windows", 3)]
CATEGORIES = [("Residential", 92), ("Commercial", 6), ("Property Management", 2)]
WORK = [("New", 64), ("Repair", 20), ("Insurance", 6), ("Retail", 4), ("Inspection", 3), ("Warranty", 3)]
CSR_DEAD = [("Duplicate", 14), ("Test Lead", 2), ("Area Not Serviced (CSR)", 8), ("Trade Not Serviced (CSR)", 6), ("Bad Lead from Lead Service", 7),
            ("No Answer/No Response (Ghosted)", 40), ("Not Ready Yet", 20), ("Area Not Serviced", 3)]
SALES_DEAD = [("Went with Someone Else", 30), ("No Answer/No Response (Ghosted)", 25), ("Estimated Cost was Too High", 22), ("Not Ready Yet", 12),
              ("Financing Denied", 5), ("No Damage", 4), ("Trade Not Serviced (Sales)", 3), ("No Chance To Meet", 3), ("Trade Not Serviced", 2)]
SUPPLIERS = ["Material Ridgeway Supply", "Material Lone Oak Building", "Material Shop"]
CREWS = ["Bluebonnet Crew", "Pecan Crew", "Mesa Crew", "Cedar Crew"]


def pick(rng, pairs):
    total = sum(w for _, w in pairs)
    x = rng.uniform(0, total)
    for v, w in pairs:
        x -= w
        if x <= 0:
            return v
    return pairs[-1][0]


def fmt(d, t=False, rng=None):
    if d is None:
        return ""
    s = d.strftime("%m/%d/%y")
    if t:
        s += " " + f"{rng.choice([8, 9, 10, 11, 1, 2, 3, 4, 5, 6])}:{rng.choice(['00', '15', '30', '45'])} {rng.choice(['AM', 'PM'])}"
    return s


def money(x):
    return f"{x:.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "data"))
    ap.add_argument("--as-of", default="2026-10-25")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    as_of = date.fromisoformat(a.as_of)
    rng = random.Random(20261025)
    zips = json.loads((HERE.parent / "site" / "content" / "zips.json").read_text())["zips"]
    zip_list = list(zips)
    zip_w = [(z, (0.35 if zips[z]["region"] == "OUT" else 1.0) * (1 + (int(z[-2:]) * 37 % 11) / 6)) for z in zip_list]

    start = date(2023, 1, 1)
    days = (as_of - start).days + 1
    rows, rip, exp = [], [], []
    job_no = 1000
    rid = 50000

    def seasonal(d):
        return 1 + 0.45 * math.sin((d.timetuple().tm_yday - 80) / 365 * 2 * math.pi) + 0.12 * (d.year - 2023)

    for k in range(days):
        day = start + timedelta(days=k)
        n = max(0, int(rng.gauss(6.5 * seasonal(day) * (0.55 if day.weekday() == 6 else 1.0), 1.4)))
        for _ in range(n):
            rid += 1
            parent, sub, _, quality = pick(rng, [((p, s, w, q), w) for p, s, w, q in SOURCES])
            if parent == "z*OLD" and day > date(2024, 6, 1):
                parent, sub, quality = "GOOGLE", "Google Ads", 1.0
            z = pick(rng, zip_w)
            trade = pick(rng, TRADES)
            cat = pick(rng, CATEGORIES)
            wt = pick(rng, WORK)
            if rng.random() < 0.03:
                wt = "Service"
            if rng.random() < 0.025:
                trade = trade.split(",")[0] + ", Call Back"
                wt = "Repair"
            team = [r for r in REPS if REP_START.get(r, start) <= day] + (FORMER if day < date(2025, 9, 1) else [])
            rep = OWNER if rng.random() < 0.03 else rng.choice(team)
            if parent == "SELF GEN":
                rep = rng.choice([r for r in REPS if REP_START.get(r, start) <= day])
            skill = REP_SKILL.get(rep, 0.9)
            r = {"rid": rid, "lead": day, "parent": parent, "sub": sub, "zip": z, "trade": trade, "cat": cat, "wt": wt, "rep": rep,
                 "csr": "", "prospect": None, "appt": None, "est": 0.0, "approved": None, "completed": None, "invoiced": None, "closed": None,
                 "dead": None, "reason": "", "contract": 0.0, "profit": None, "discount": 0.0, "rating": "", "status": "", "submitted": None}
            if day >= date(2025, 6, 1) and rng.random() < 0.85:
                r["rating"] = pick(rng, [("Hot 🔥", 25), ("Great", 45), ("Good", 30)])
            booked = rng.random() < 0.58 * min(1.3, quality) and wt != "Service"
            if not booked:
                if rng.random() < 0.82 and day < as_of - timedelta(days=2):
                    r["dead"] = day + timedelta(days=rng.randint(0, 9))
                    r["reason"] = pick(rng, CSR_DEAD)
                elif rng.random() < 0.3 and day < as_of - timedelta(days=10):
                    r["prospect"] = day + timedelta(days=rng.randint(0, 6))
                    r["reason"] = pick(rng, [("Area Not Serviced", 3), ("Trade Not Serviced", 2), ("Bad Lead from Lead Service", 2), ("Not Ready Yet", 5)])
                    r["dead"] = r["prospect"] + timedelta(days=rng.randint(0, 4))
                    r["csr"] = rng.choice(CSRS)
                rows.append(r)
                continue
            r["prospect"] = day + timedelta(days=0 if rng.random() < 0.45 else rng.randint(1, 5))
            if r["prospect"] > as_of:
                r["prospect"] = None
                rows.append(r)
                continue
            r["csr"] = rng.choice(CSRS) if rng.random() < 0.92 and parent != "SELF GEN" else ""
            if day < date(2024, 3, 1) and r["csr"] == "Avery Kim":
                r["csr"] = "Jamie Ortiz"
            appt = r["prospect"] + timedelta(days=rng.randint(1, 8))
            if appt > as_of:
                r["status"] = "Appointment Set"
                rows.append(r)
                continue
            if rng.random() > 0.84:  # no-show or cancelled
                r["dead"] = appt
                r["reason"] = pick(rng, [("No Chance To Meet", 50), ("No Answer/No Response (Ghosted)", 35), ("Not Ready Yet", 15)])
                rows.append(r)
                continue
            r["appt"] = appt
            quoted = rng.random() < 0.9
            if quoted:
                base = {"Roofing": 15500, "Gutters": 3200, "Siding": 14000, "Roofing, Gutters": 19000, "Windows": 9000}.get(trade.split(", Call")[0], 12000)
                r["est"] = round(base * math.exp(rng.gauss(0, 0.32)) * (2.2 if cat == "Commercial" else 1), 2)
            p_sell = 0.36 * skill * quality * (0.0 if not quoted else 1) * (0.6 if wt in ("Inspection", "Warranty") else 1)
            if rng.random() < p_sell:
                lag = 0 if rng.random() < 0.3 * skill else int(rng.expovariate(1 / 12)) + 1
                ap_d = appt + timedelta(days=min(lag, 120))
                if ap_d <= as_of:
                    job_no += 1
                    r["job"] = f"JOB-{job_no}"
                    r["approved"] = ap_d
                    if rep in REPS and rng.random() < 0.9:
                        r["submitted"] = ap_d - timedelta(days=rng.randint(0, 2))
                    disc = rng.choice([0, 0, 0, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.24])
                    r["contract"] = round(r["est"] * (1 - disc), 2)
                    r["discount"] = -round(r["est"] - r["contract"], 2)
                    inst = ap_d + timedelta(days=rng.randint(8, 55))
                    if inst <= as_of:
                        r["completed"] = inst
                        inv = inst + timedelta(days=rng.randint(0, 4))
                        if inv <= as_of:
                            r["invoiced"] = inv
                            cl = inv + timedelta(days=int(rng.expovariate(1 / 7)) + 2)
                            if cl <= as_of and rng.random() < 0.97:
                                r["closed"] = cl
                                gp = rng.gauss(0.355, 0.07)
                                if rng.random() < 0.02:
                                    gp = 1.0  # costs not loaded (a flag)
                                if "Call Back" in trade:
                                    gp = -0.4
                                r["profit"] = round(r["contract"] * gp, 2)
                    else:
                        r["status"] = pick(rng, [("Scheduled", 50), ("In Progress", 10), ("Pending Color Confirmation", 15), ("Finish Scheduling", 20), ("On Hold", 5)])
                    if r["completed"] and rng.random() < 0.18 and wt in ("New", "Insurance"):
                        rid += 1
                        job_no += 1
                        ug = dict(r, rid=rid, job=f"JOB-{job_no}", wt="Upsell / Change Order", est=round(rng.uniform(600, 4200), 2), rating="", csr=r["csr"])
                        ug["contract"], ug["discount"] = ug["est"], 0.0
                        ug["approved"] = r["approved"] + timedelta(days=rng.randint(1, 10))
                        ug["completed"] = r["completed"]
                        ug["submitted"] = None
                        if ug["closed"]:
                            ug["profit"] = round(ug["contract"] * rng.gauss(0.5, 0.08), 2)
                        rows.append(ug)
                    rows.append(r)
                    continue
            if day < as_of - timedelta(days=21) and rng.random() < 0.72:
                r["dead"] = appt + timedelta(days=rng.randint(1, 40))
                if r["dead"] > as_of:
                    r["dead"] = as_of
                r["reason"] = pick(rng, SALES_DEAD)
            else:
                r["status"] = "Quoted" if quoted else "Appointment Held"
            rows.append(r)

    # ---- stage, status and links
    for r in rows:
        stage = ("Closed" if r["closed"] else "Invoiced" if r["invoiced"] else "Completed" if r["completed"] else "Approved" if r["approved"]
                 else "Dead" if r["dead"] else "Prospect" if r["prospect"] else ("Assigned Lead" if r["rep"] else "Unassigned Lead"))
        r["stage"] = stage
        if stage == "Dead":
            r["status"] = "Dead"
        elif stage in ("Completed", "Invoiced", "Closed"):
            r["status"] = {"Completed": "Job Complete", "Invoiced": "Invoice Sent", "Closed": "Paid in Full"}[stage]
        elif not r["status"]:
            r["status"] = "New Lead" if stage.endswith("Lead") else "Appointment Set"
        r["stage_date"] = {"Closed": r["closed"], "Invoiced": r["invoiced"], "Completed": r["completed"], "Approved": r["approved"],
                           "Dead": r["dead"], "Prospect": r["prospect"]}.get(stage) or r["lead"]
    rows.sort(key=lambda r: (r["lead"], r["rid"]))

    cols = ["Job Number", "Job Number Url", "Job Category", "Job Trade Type", "Work Type", "Primary Salesperson", "Contract Amount",
            "Primary Estimate Total", "Estimates", "Discount Amount", "Comissions", "Profit", "Profit %", "Parent Lead Source", "Sub Lead Source",
            "Appointment Set By", "Appointment Rating", "Current Milestone", "Current Milestone Date", "Lead Milestone Date",
            "Prospect Milestone Date", "Initial Appointment Date", "Submitted for Approval Date", "Approved Milestone Date",
            "Completed Milestone Date", "Invoiced Milestone Date", "Closed Milestone Date", "Dead Lead Milestone Date", "Dead Lead Reason",
            "Current Status", "Job Last Touched Date", "Job: Location City", "Job: Location Zip Code"]
    with open(out / "job_export_raw_latest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        for r in rows:
            comm = round(r["contract"] * 0.08, 2) if r["approved"] and r["rep"] in REPS + FORMER and r["wt"] != "Upsell / Change Order" else 0
            pct = "" if r["profit"] is None or not r["contract"] else f"{r['profit'] / r['contract']:.4f}"
            w.writerow([r.get("job", ""), f"https://crm.example.com/records/{r['rid']}", r["cat"], r["trade"], r["wt"], r["rep"],
                        money(r["contract"]) if r["approved"] else "", money(r["est"]), 1 if r["est"] else 0, money(r["discount"]) if r["approved"] else "",
                        money(comm) if r["approved"] else "", money(r["profit"]) if r["profit"] is not None else "", pct, r["parent"], r["sub"],
                        r["csr"], r["rating"], r["stage"], fmt(r["stage_date"]), fmt(r["lead"]), fmt(r["prospect"]), fmt(r["appt"], True, rng),
                        fmt(r["submitted"]), fmt(r["approved"]), fmt(r["completed"]), fmt(r["invoiced"]), fmt(r["closed"]), fmt(r["dead"]), r["reason"],
                        r["status"], fmt(min(as_of, r["stage_date"] + timedelta(days=rng.randint(0, 6)))), zips[r["zip"]]["town"], r["zip"]])

    # ---- Revenue In Progress: approved jobs with crews scheduled (one row per trade)
    with open(out / "Revenue_In_Progress_latest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["Job Number", "Job Number Url", "Primary Salesperson", "Trade Name", "Crew Start Date", "Crew End Date", "Job Value", "Current Status", "Current Milestone"])
        for r in rows:
            if r["stage"] != "Approved" or r["status"] in ("Finish Scheduling", "On Hold"):
                continue
            st = max(r["approved"] + timedelta(days=rng.randint(6, 30)), as_of - timedelta(days=rng.randint(0, 3)))
            for t in r["trade"].split(", "):
                if t == "Call Back":
                    continue
                w.writerow([r["job"], f"https://crm.example.com/records/{r['rid']}", r["rep"], t, fmt(st, True, rng), fmt(st + timedelta(days=rng.randint(1, 3)), True, rng),
                            money(r["contract"]), r["status"], "Approved"])

    # ---- Job Expenses: every cost line on jobs closed in the last 365 days. Lines add up to Contract minus Profit.
    with open(out / "job_expenses_latest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["Job Number", "Job Number Url", "Payment Type", "Payment Amount", "To/Method", "Check Number/Reference", "Memo/Notes", "Job Value",
                    "Balance Due", "Paid in Full", "Work Type", "Trade Type", "Job Category", "Additional Expenses", "Total Expenses"])
        for r in rows:
            if not r["closed"] or r["closed"] < as_of - timedelta(days=365):
                continue
            jv = r["contract"]
            total = round(jv - (r["profit"] or 0), 2)
            comm = round(jv * 0.08, 2) if r["rep"] in REPS + FORMER and r["wt"] != "Upsell / Change Order" else 0.0
            if r["profit"] is not None and r["profit"] / jv >= 0.999:
                lines = []
                total = 0.0
            else:
                crew = rng.choice(CREWS)
                rest = total - comm
                parts = [(rng.choice(SUPPLIERS), 0.55), (f"Labor {crew} Pay", 0.33), (f"Labor {crew} Dump", 0.04), ("CC Fee", 0.02), ("Permit Fee", 0.02), ("Warranty Reserve", 0.04)]
                lines = [("Paid", round(rest * p, 2), to) for to, p in parts]
                lines[0] = ("Paid", round(rest - sum(x[1] for x in lines[1:]), 2), lines[0][2])
                if rng.random() < 0.05:
                    lines.append(("Paid", -round(rng.uniform(80, 600), 2), "Material Returns"))
                    lines[0] = ("Paid", lines[0][1] - lines[-1][1], lines[0][2])
                if comm:
                    lines.append(("Additional", comm, f"{r['rep']} Commission"))
            for ptype, amt, to in lines:
                w.writerow([r["job"], f"https://crm.example.com/records/{r['rid']}", ptype, money(amt), to, "", "", money(jv), "0.00", "Yes", r["wt"],
                            r["trade"], r["cat"], money(comm), money(total)])

    run = datetime(as_of.year, as_of.month, as_of.day, 13, 5)
    status = {"job_export_raw": {"runDate": run.strftime("%Y-%m-%dT%H:%M:%S"), "schedule": "Sample", "pulledAt": run.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                 "rows": len(rows), "file": "data/job_export_raw_latest.csv"},
              "revenue_in_progress": {"runDate": run.strftime("%Y-%m-%dT%H:%M:%S"), "schedule": "Sample", "file": "data/Revenue_In_Progress_latest.csv"},
              "job_expenses_raw": {"runDate": run.strftime("%Y-%m-%dT%H:%M:%S"), "schedule": "Sample", "file": "data/job_expenses_latest.csv"},
              "note": "Made-up sample data (sample/make_sample.py). No real company, people or customers."}
    (out / "status.json").write_text(json.dumps(status, indent=2) + "\n")
    print(f"{len(rows)} records, last job {job_no}, written to {out}")


if __name__ == "__main__":
    main()
