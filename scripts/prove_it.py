"""The Prove It numbers: every number on guides/prove-it-checklist.md for a period, counted with the rules, so the owner only
has to read the matching number off the CRM's own report. When a line is off, --list shows the job numbers the rules
counted, to compare against the CRM report record by record (job numbers only, never names).

Usage:
  python scripts/prove_it.py path/to/data --start 2026-07-01 --end 2026-09-30
  python scripts/prove_it.py path/to/data --start 2026-07-01 --end 2026-09-30 --by "Primary Salesperson"
  python scripts/prove_it.py path/to/data --start 2026-07-01 --end 2026-09-30 --list sales
  [--rules path/to/rules]   (default: rules/)
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("data")
ap.add_argument("--start", required=True)
ap.add_argument("--end", required=True)
ap.add_argument("--rules", default=str(ROOT / "rules"))
ap.add_argument("--by", help='split by a column, for example "Primary Salesperson" or "Parent Lead Source"')
ap.add_argument("--list", help="list the job numbers behind one line: " + ", ".join(
    ["contacts", "leads", "appointments", "sits", "sales", "jobs_sold", "revenue", "jobs_installed", "upgrades", "gp_jobs", "close_sits_company", "close_sold_company"]))
a = ap.parse_args()
sys.path.insert(0, a.rules)
import pandas as pd  # noqa: E402
import pulse_metrics as rr  # noqa: E402

data = Path(a.data)
df = rr.load(str(data / "job_export_raw_latest.csv"))
s, e = pd.Timestamp(a.start), pd.Timestamp(a.end)


def pct(n, d):
    return f"{n / d * 100:.2f}% ({n} of {d})" if d else "no demos"


def money(x):
    return f"${x:,.2f}"


if a.list:
    M = rr.masks(df, s, e)
    if a.list not in M:
        sys.exit(f"Unknown line {a.list}")
    t = df.loc[M[a.list], ["Job Number", "Job Number Url", "Primary Salesperson", "Contract Amount"]].copy()
    t["Job Number"] = t["Job Number"].fillna("(no job number yet)")
    print(t.to_csv(index=False))
    print(f"{len(t)} records", file=sys.stderr)
    sys.exit(0)


def lines(d):
    m = rr.metrics(d, s, e)
    gp = m["gp_profit_closed"] / m["gp_contract_closed"] * 100 if m["gp_contract_closed"] else None
    return [
        ("1", "Contacts", m["contacts"]), ("2", "Leads", m["leads"]), ("3", "Appointments", m["appointments"]), ("4", "Sits", m["sits"]),
        ("5", "Sales $", money(m["sales"])), ("6", "Jobs sold", m["jobs_sold"]), ("7", "Revenue $", money(m["revenue"])),
        ("8", "Jobs installed", m["jobs_installed"]), ("9", "Upgrades $", money(m["upgrades"])),
        ("10", "Demo conversion (company)", pct(m["demo_conv_sold_company"], m["close_sits_company"])),
        ("10b", "Demo conversion (sales team)", pct(m["demo_conv_sold_team"], m["close_sits_team"])),
        ("11", "Close rate (company)", pct(m["close_sold_company"], m["close_sits_company"])),
        ("11b", "Close rate (sales team)", pct(m["close_sold_team"], m["close_sits_team"])),
        ("12", "GP %", "no closed jobs" if gp is None else f"{gp:.2f}% ({money(m['gp_profit_closed'])} profit on {money(m['gp_contract_closed'])})"),
    ]


print(f"Prove It numbers, {s.date()} to {e.date()}, counted with {a.rules}/pulse_metrics.py")
st = data / "status.json"
if st.exists():
    import json
    print("Data pulled:", json.loads(st.read_text()).get("job_export_raw", {}).get("runDate", "?"), "UTC")
print()
if a.by:
    for key, grp in df.groupby(df[a.by].fillna("(blank)")):
        if key in rr.HIDDEN:
            continue
        vals = dict((n, v) for _, n, v in lines(grp))
        print(f"{key}: sales {vals['Sales $']}, jobs sold {vals['Jobs sold']}, sits {vals['Sits']}, leads {vals['Leads']}")
else:
    for n, name, v in lines(df):
        print(f"{n:>4}  {name:<30} {v}")
    rip = data / "Revenue_In_Progress_latest.csv"
    if rip.exists():
        total, jobs = rr.revenue_in_progress(rip)
        print(f"{'13':>4}  {'Revenue in progress':<30} {money(total)} ({jobs} jobs, as of the pull)")
    now = df["Lead Milestone Date"].max()
    LS = rr.S["leadership_scorecard"]
    bl = (df["Current Milestone"] == "Approved") & df["Current Status"].isin(LS["backlog_statuses"])
    ar = (df["Current Milestone"] == "Invoiced") & (df["Invoiced Milestone Date"] <= now - pd.Timedelta(days=LS["ar_days"]))
    print(f"{'14':>4}  {'Backlog $':<30} {money(df.loc[bl, 'Contract Amount'].sum())} ({int(bl.sum())} jobs, as of the pull)")
    print(f"{'15':>4}  {'A/R over ' + str(LS['ar_days']) + ' days':<30} {money(df.loc[ar, 'Contract Amount'].sum())} ({int(ar.sum())} jobs, as of the pull)")
