"""The event ledger behind the Report Builder.

Every metric in rr_metrics.masks() is a fixed set of records filtered to its own date column. So if we keep, for each
record, the day each of its dates falls on and which masks it passes, the site can add up ANY date range and land on
exactly the numbers rr_metrics.metrics() would give for that range. No metric is re-implemented here: the flags are
read straight off masks() run over the whole history.

One row per record per date that matters:
  L  Lead Milestone Date        bits: 1 contact, 2 lead
  A  Prospect Milestone Date    bits: 1 appointment
  I  Initial Appointment Date   bits: 1 sit, 2 close-rate demo (company), 4 that demo ever signed (Demo Conversion)
  S  Approved Milestone Date    bits: 1 counts in sales $, 2 job sold, 4 a close-rate demo signed this day (Close Rate)   v = contract amount
Close Rate (the rules) is demos signed in a period over demos held in it, so its sales sit on the S rows;
Demo Conversion credits a sale back to its demo, so its sales sit on the I rows.
  C  Completed Milestone Date   bits: 1 counts in revenue $, 2 job installed, 4 upgrade   v = contract amount
  G  Closed Milestone Date      bits: 1 GP job   v = contract, p = profit
GP % (the rules) counts jobs by the day they went Closed, upgrades in, Call Backs out, so its jobs sit on G rows.
Customer names, RR numbers and links are never written. Former reps become "Former reps".
"""
import pandas as pd

KINDS = ["L", "A", "I", "S", "C", "G"]


def build(rr, df, coords, rep=None):
    start = pd.Timestamp("2000-01-01")
    end = pd.Timestamp("2100-01-01")
    M = rr.masks(df, start, end)
    zips = coords["zips"]
    zcol = df["Job: Location Zip Code"].astype(str).str.extract(r"(\d{5})")[0]
    zcol = zcol.where(zcol.map(lambda z: isinstance(z, str) and z in zips), "")

    who = df["Primary Salesperson"].fillna("(no rep)").map(lambda x: "Former reps" if x in rr.HIDDEN else x)
    csr = df["Appointment Set By"].fillna("(none)").map(lambda x: "Former reps" if x in rr.HIDDEN else x)
    src = df["Parent Lead Source"].fillna("(blank)")
    sub = df["Sub Lead Source"].fillna("(blank)")
    amt = df["Contract Amount"].fillna(0)
    profit = df["Profit"].fillna(0)
    keep = pd.Series(True, index=df.index) if rep is None else (df["Primary Salesperson"] == rep)

    plan = [
        ("L", "Lead Milestone Date", [(M["contacts"], 1), (M["leads"], 2)]),
        ("A", "Prospect Milestone Date", [(M["appointments"], 1)]),
        ("I", "Initial Appointment Date", [(M["sits"], 1), (M["close_sits_company"], 2), (M["demo_conv_sold_company"], 4)]),
        ("S", "Approved Milestone Date", [(M["sales"], 1), (M["jobs_sold"], 2), (M["close_sold_company"], 4)]),
        ("C", "Completed Milestone Date", [(M["revenue"], 1), (M["jobs_installed"], 2), (M["upgrades"], 4)]),
        ("G", "Closed Milestone Date", [(M["gp_jobs"], 1)]),
    ]

    dims = {"rep": {}, "src": {}, "sub": {}, "zip": {}, "csr": {}}

    def code(dim, value):
        d = dims[dim]
        if value not in d:
            d[value] = len(d)
        return d[value]

    epoch = pd.Timestamp("2015-01-01")
    cols = {k: [] for k in ("k", "d", "r", "s", "u", "z", "c", "f", "v", "p")}
    for ki, (kind, col, parts) in enumerate(plan):
        bits = pd.Series(0, index=df.index)
        for m, b in parts:
            bits = bits + m.astype(int) * b
        sel = (bits > 0) & keep & df[col].notna()
        for i in df.index[sel]:
            cols["k"].append(ki)
            cols["d"].append(int((df.at[i, col] - epoch).days))
            cols["r"].append(code("rep", who[i]))
            cols["s"].append(code("src", src[i]))
            cols["u"].append(code("sub", sub[i]))
            cols["z"].append(code("zip", zcol[i]))
            cols["c"].append(code("csr", csr[i]))
            cols["f"].append(int(bits[i]))
            cols["v"].append(round(float(amt[i]), 2) if kind in ("S", "C", "G") else 0)
            cols["p"].append(round(float(profit[i]), 2) if kind == "G" else 0)

    return {
        "epoch": epoch.strftime("%Y-%m-%d"),
        "kinds": KINDS,
        "dims": {k: [name for name, _ in sorted(v.items(), key=lambda x: x[1])] for k, v in dims.items()},
        "roster": [n for n in rr.SALES_TEAM if n not in rr.HIDDEN],
        "towns": {z: v[2] for z, v in zips.items()},
        "rows": len(cols["k"]),
        "cols": cols,
    }


def totals(facts, start, end, reps=None):
    """Add up the ledger for a date range, the same way the site does. Used to prove the ledger matches rr_metrics."""
    ep = pd.Timestamp(facts["epoch"])
    a, b = (pd.Timestamp(start) - ep).days, (pd.Timestamp(end) - ep).days
    c = facts["cols"]
    o = dict.fromkeys(["contacts", "leads", "appointments", "sits", "close_sits_company", "close_sold_company",
                       "close_sits_team", "close_sold_team", "demo_conv_sold_company", "demo_conv_sold_team",
                       "jobs_sold", "jobs_installed"], 0)
    o.update(sales=0.0, revenue=0.0, upgrades=0.0, gp_profit_closed=0.0, gp_contract_closed=0.0)
    roster = {i for i, n in enumerate(facts["dims"]["rep"]) if n in (reps if reps is not None else facts["roster"])}
    for k, d, r, f, v, p in zip(c["k"], c["d"], c["r"], c["f"], c["v"], c["p"]):
        if d < a or d > b:
            continue
        kind = facts["kinds"][k]
        if kind == "L":
            o["contacts"] += f & 1
            o["leads"] += f >> 1 & 1
        elif kind == "A":
            o["appointments"] += 1
        elif kind == "I":
            o["sits"] += f & 1
            if f & 2:
                o["close_sits_company"] += 1
                o["demo_conv_sold_company"] += f >> 2 & 1
                if r in roster:
                    o["close_sits_team"] += 1
                    o["demo_conv_sold_team"] += f >> 2 & 1
        elif kind == "S":
            if f & 1:
                o["sales"] += v
            o["jobs_sold"] += f >> 1 & 1
            if f & 4:
                o["close_sold_company"] += 1
                if r in roster:
                    o["close_sold_team"] += 1
        elif kind == "C":
            if f & 1:
                o["revenue"] += v
            o["jobs_installed"] += f >> 1 & 1
            if f & 4:
                o["upgrades"] += v
        elif kind == "G":
            o["gp_profit_closed"] += p
            o["gp_contract_closed"] += v
    return {k: (round(x, 2) if isinstance(x, float) else x) for k, x in o.items()}


def verify(rr, df, facts, as_of):
    """Check the ledger against rr_metrics.metrics() on a spread of ranges. Returns a list of mismatches."""
    as_of = pd.Timestamp(as_of)
    lw = rr.last_week(as_of)
    ranges = [lw, rr.rolling(as_of, 30), rr.rolling(as_of, 90), rr.rolling(as_of, 365),
              (pd.Timestamp(as_of.year, 1, 1), as_of), (pd.Timestamp(as_of.year - 1, 1, 1), pd.Timestamp(as_of.year - 1, 12, 31)),
              (pd.Timestamp("2026-07-01"), pd.Timestamp("2026-09-30")), (pd.Timestamp("2019-01-01"), as_of)]
    bad = []
    for s, e in ranges:
        want = rr.metrics(df, s, e)
        got = totals(facts, s, e)
        for k, v in want.items():
            if abs(float(v) - float(got[k])) > 0.011:
                bad.append(f"{pd.Timestamp(s).date()}..{pd.Timestamp(e).date()} {k}: rr_metrics {v} vs ledger {got[k]}")
    return bad
