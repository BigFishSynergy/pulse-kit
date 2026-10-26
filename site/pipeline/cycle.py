"""Cycle times: how many days each step takes, from a lead coming in to the job being completed (installed).

Every step starts from the rules' pulse_metrics masks, so each one is timed on the same records the dashboard counts:
  lead to appointment booked   Appointments, by Prospect Milestone Date
  lead to sit                  Sits, by Initial Appointment Date
  appointment booked to sale   Jobs sold, by Approved Milestone Date
  sit to sale                  Jobs sold, by Approved Milestone Date
  sale to completed            Jobs installed, by Completed Milestone Date
  lead to completed            Jobs installed, by Completed Milestone Date
A step is timed on the records that finished it inside the window (the end step's date). Days are whole calendar
days between the two dates. Negative gaps (dates entered out of order) are left out and counted as skipped.
The typical job is the median, so one stuck job cannot pull the number around.
"""
import pandas as pd

STEPS = [
    ("lead_to_appt", "Lead to appointment", "Lead Milestone Date", "Prospect Milestone Date", "appointments"),
    ("lead_to_sit", "Lead to sit", "Lead Milestone Date", "Initial Appointment Date", "sits"),
    ("appt_to_sale", "Appointment to sale", "Prospect Milestone Date", "Approved Milestone Date", "jobs_sold"),
    ("sit_to_sale", "Sit to sale", "Initial Appointment Date", "Approved Milestone Date", "jobs_sold"),
    ("sale_to_done", "Sale to completed", "Approved Milestone Date", "Completed Milestone Date", "jobs_installed"),
    ("lead_to_done", "Lead to completed", "Lead Milestone Date", "Completed Milestone Date", "jobs_installed"),
]
MONTHS_BACK = 36


def _days(df, mask, a, b):
    t = df[mask]
    days = (t[b].dt.normalize() - t[a].dt.normalize()).dt.days.dropna()
    return days[days >= 0], int(len(t) - (days >= 0).sum())


def _stats(days, skipped=0):
    if not len(days):
        return {"n": 0, "skipped": skipped}
    return {"n": int(len(days)), "median": float(days.median()), "average": round(float(days.mean()), 1),
            "p25": float(days.quantile(0.25)), "p75": float(days.quantile(0.75)),
            "same_day": int((days == 0).sum()), "within_7": int((days <= 7).sum()), "within_30": int((days <= 30).sum()), "skipped": skipped}


def _windows(rr, df, as_of, extra=None):
    out = {}
    for k, days in (("30", 30), ("90", 90), ("365", 365)):
        a, b = rr.rolling(as_of, days)
        M = rr.masks(df, a, b)
        out[k] = {"start": a.strftime("%Y-%m-%d"), "end": b.strftime("%Y-%m-%d"), "steps": {}}
        for key, _, c0, c1, mk in STEPS:
            m = M[mk] if extra is None else M[mk] & extra
            out[k]["steps"][key] = _stats(*_days(df, m, c0, c1))
    return out


def build(rr, df, as_of):
    as_of = pd.Timestamp(as_of).normalize()
    m0 = pd.Timestamp(as_of.year, as_of.month, 1)
    first = df["Lead Milestone Date"].min()
    monthly = []
    for i in range(MONTHS_BACK, -1, -1):
        s = (m0 - pd.DateOffset(months=i)).normalize()
        if s < first:
            continue
        e = min((s + pd.offsets.MonthEnd(0)).normalize(), as_of)
        M = rr.masks(df, s, e)
        row = {"month": s.strftime("%Y-%m"), "partial": s == m0, "steps": {}}
        for key, _, c0, c1, mk in STEPS:
            days, _ = _days(df, M[mk], c0, c1)
            row["steps"][key] = {"n": int(len(days)), "median": float(days.median()) if len(days) else None}
        # how busy the month was, to read against the times
        row["busy"] = {"leads": int(M["leads"].sum()), "jobs_sold": int(M["jobs_sold"].sum()), "jobs_installed": int(M["jobs_installed"].sum())}
        monthly.append(row)
    return {"steps": [{"key": k, "label": lab, "from": c0, "to": c1, "counts": mk} for k, lab, c0, c1, mk in STEPS],
            "windows": _windows(rr, df, as_of), "monthly": monthly,
            "note": "Median days. Each step is timed on the records that finished it in the window, using the company's counting rules."}


def for_rep(rr, df, as_of, name):
    """One rep's own steps: the ones a rep controls (sit to sale), plus lead to sit for their appointments."""
    mine = df["Primary Salesperson"] == name
    w = _windows(rr, df, pd.Timestamp(as_of).normalize(), mine)
    keep = ("lead_to_sit", "sit_to_sale", "appt_to_sale")
    return {k: {**v, "steps": {s: x for s, x in v["steps"].items() if s in keep}} for k, v in w.items()}
