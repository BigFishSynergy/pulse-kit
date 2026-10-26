"""Job costing and gross profit for the Pulse, from the Job Expenses report and the rules' pulse_metrics (section 4b).

Everything comes from rr_metrics.load_expenses / job_costs / cost_summary / discounts / expense_flags, so GP % here
always equals the rules' GP % metric: Closed jobs only, window by Closed date, upgrades in, no Call Backs,
no $0 or 100% profit jobs, Profit from the job export, goal from rules/settings.json (the one GP rule). The cost report only covers the last 365 days.
Nothing from the free-text Memo/Notes column is ever published; vendors are shown only for Material and Dump lines.
"""
import pandas as pd

SHOW_REPS_OWED = False  # flip to True once leadership wants reps to see what they owe on discounts over the max
BUCKET_ORDER = ["Material", "Labor", "Commission", "Dump", "CC Fee", "Warranty", "Sales Tax", "Permits", "Marketing", "Other"]
FLAG_LABELS = {
    "closed_with_no_material": "Closed with no material cost",
    "closed_with_no_labor": "Closed with no labor cost",
    "sales_rep_job_with_no_commission": "Sales rep job with no commission",
    "returns_bigger_than_material": "Returns bigger than material",
    "commission_paid_on_low_gp": "Commission paid on a job under 25% GP",
    "odd_expense_lines": "Odd expense lines (food, tests, checks to customers)",
}


def d(x):
    return pd.Timestamp(x).strftime("%Y-%m-%d")


def num(v, nd=2):
    return None if v is None or pd.isna(v) else round(float(v), nd)


def summary_rows(s):
    """cost_summary frame -> list of plain rows."""
    out = []
    for key, r in s.iterrows():
        row = {"key": "" if key is None else str(key), "jobs": int(r["Jobs"]), "value": num(r["Job Value"]), "profit": num(r["Profit"]), "gp": num(r["GP %"])}
        row["buckets"] = {b: {"d": num(r[b]), "pct": num(r[b + " %"])} for b in BUCKET_ORDER if b in s.columns and not pd.isna(r[b])}
        out.append(row)
    return out


def link_rows(t, n=10, extra=()):
    rows = []
    for rr_no, r in t.head(n).iterrows():
        row = {"rr": str(rr_no),
               "url": r.get("Job Number Url") if pd.notna(r.get("Job Number Url")) else None,
               "rep": r.get("Primary Salesperson") if pd.notna(r.get("Primary Salesperson")) else ""}
        for k in extra:
            row[k] = num(r.get(k)) if isinstance(r.get(k), (int, float)) else r.get(k)
        rows.append(row)
    return rows


def crews(exp, jc):
    jg = jc[jc["In GP"]]
    lines = exp[exp["Job Number"].isin(jg.index) & exp["Crew"].notna()]
    out = []
    for crew, g in lines.groupby("Crew"):
        jobs = jg.loc[jg.index.isin(g["Job Number"].unique())]
        v = jobs["Job Value"].sum()
        out.append({"crew": crew, "jobs": int(len(jobs)), "labor": num(g.loc[g["Bucket"] == "Labor", "Payment Amount"].sum()),
                    "dump": num(g.loc[g["Bucket"] == "Dump", "Payment Amount"].sum()), "value": num(v),
                    "gp": num(jobs["Profit"].sum() / v * 100) if v else None})
    return sorted(out, key=lambda x: -x["jobs"])


def discount_view(t, name=None):
    if name is not None:
        t = t[t["Primary Salesperson"] == name]
    over = t[t["Over Max $"] > 0].sort_values("Over Max $", ascending=False)
    res = {"jobs": int(len(t)), "avg_pct": num(t["Discount %"].mean()), "over_n": int(len(over)),
           "over_total": num(over["Over Max $"].sum()), "owes_total": num(over["Rep Owes $"].sum()),
           "worst": [{"rr": r["Job Number"], "url": r["Job Number Url"] if pd.notna(r["Job Number Url"]) else None,
                      "rep": r["Primary Salesperson"] or "", "pct": num(r["Discount %"]), "over": num(r["Over Max $"]), "owes": num(r["Rep Owes $"])}
                     for _, r in over.head(12).iterrows()]}
    if name is None:
        by = []
        for rep, g in t.groupby("Primary Salesperson"):
            if not rep:
                continue
            o = g[g["Over Max $"] > 0]
            by.append({"rep": rep, "jobs": int(len(g)), "avg_pct": num(g["Discount %"].mean()), "over_n": int(len(o)), "owes": num(o["Rep Owes $"].sum())})
        res["by_rep"] = sorted(by, key=lambda x: -x["jobs"])
    return res


def windows(rr, as_of):
    q0 = pd.Timestamp(as_of.year, ((as_of.month - 1) // 3) * 3 + 1, 1)
    return {"qtd": ("Quarter to date", q0, as_of), "ytd": ("Year to date", pd.Timestamp(as_of.year, 1, 1), as_of),
            "90": ("Last 90 days", *rr.rolling(as_of, 90)), "365": ("Last 12 months", *rr.rolling(as_of, 365))}


def build(rr, df, exp, as_of):
    as_of = pd.Timestamp(as_of).normalize()
    goal = rr.EX["gp_goal_pct"]
    W = windows(rr, as_of)
    out = {"goal": goal, "covers_from": d(rr.rolling(as_of, 365)[0]), "windows": {}, "discounts": {}}
    for k, (label, s, e) in W.items():
        jc = rr.job_costs(exp, df, s, e)
        cb = jc[jc["Job Trade Type"].fillna("").str.contains(rr.S["call_back_text"])]
        out["windows"][k] = {
            "label": label, "start": d(s), "end": d(e),
            "total": summary_rows(rr.cost_summary(jc))[0],
            "by_rep": [r for r in summary_rows(rr.cost_summary(jc, "Primary Salesperson")) if r["key"]],
            "by_work": summary_rows(rr.cost_summary(jc, "Work Type")),
            "by_trade": summary_rows(rr.cost_summary(jc, "Job Trade Type")),
            "crews": crews(exp, jc),
            "callbacks": {"jobs": int(len(cb)), "cost": num(cb["Total Expenses"].sum())},
            "left_out": {"no_costs": int(((jc["Profit"] == 0) | (jc["Profit %"] == 1)).sum())},
        }
        out["discounts"][k] = {"label": label, **discount_view(rr.discounts(df, s, e))}

    # GP by the month jobs went Closed, last 12 months
    jc365 = rr.job_costs(exp, df, *rr.rolling(as_of, 365))
    jg = jc365[jc365["In GP"]].copy()
    jg["month"] = pd.to_datetime(jg["Closed Milestone Date"]).dt.strftime("%Y-%m")
    out["monthly"] = [{"month": m, "jobs": int(len(g)), "value": num(g["Job Value"].sum()), "profit": num(g["Profit"].sum()),
                       "gp": num(g["Profit"].sum() / g["Job Value"].sum() * 100) if g["Job Value"].sum() else None,
                       "material_pct": num(g["Material"].sum() / g["Job Value"].sum() * 100) if "Material" in g and g["Job Value"].sum() else None,
                       "labor_pct": num(g["Labor"].sum() / g["Job Value"].sum() * 100) if "Labor" in g and g["Job Value"].sum() else None}
                      for m, g in jg.groupby("month")]

    # who the material and dump money goes to (never crew pay or commissions, never memo text)
    v = exp[exp["Bucket"].isin(["Material", "Dump"])].copy()
    clean = (v["To/Method"].fillna("").str.replace(r"(?i)^(materials?|labor|other job expenses)\s*[-:]?\s*", "", regex=True)
             .str.replace(r"(?i)^account\s+", "", regex=True).str.replace(r"(?i)\s+dump$", "", regex=True).str.strip())
    v["vendor"] = v["Crew"].where(v["Bucket"].eq("Dump") & v["Crew"].notna(), clean).replace("", "(no name)")
    out["vendors"] = [{"vendor": name, "bucket": g["Bucket"].mode().iat[0], "spend": num(g["Payment Amount"].sum()), "lines": int(len(g))}
                      for name, g in sorted(v.groupby("vendor"), key=lambda kv: -kv[1]["Payment Amount"].sum())[:12]]

    # cost data that looks wrong, last 90 days: counts and RR links only
    fl = rr.expense_flags(exp, df, *rr.rolling(as_of, 90))
    out["flags"] = {k: {"label": FLAG_LABELS.get(k, k), "count": int(len(t)),
                        "rows": [{"rr": str(i),
                                  "url": r.get("Job Number Url") if pd.notna(r.get("Job Number Url")) else None,
                                  "rep": r.get("Primary Salesperson") if pd.notna(r.get("Primary Salesperson")) else ""}
                                 for i, r in t.head(8).iterrows()]}
                    for k, t in fl.items()}
    return out


def for_rep(rr, df, exp, as_of, name, lead_costs):
    """One rep's own GP and discounts, with the team's GP % alongside. Never other reps' numbers."""
    as_of = pd.Timestamp(as_of).normalize()
    out = {"goal": rr.EX["gp_goal_pct"], "windows": {}, "discounts": {}}
    for k, (label, s, e) in windows(rr, as_of).items():
        if k == "90":
            continue
        jc = rr.job_costs(exp, df, s, e)
        mine = jc[jc["Primary Salesperson"] == name]
        tot = summary_rows(rr.cost_summary(mine))[0] if len(mine[mine["In GP"]]) else None
        out["windows"][k] = {"label": label, "start": d(s), "end": d(e), "me": tot, "team_gp": lead_costs["windows"][k]["total"]["gp"]}
        v = discount_view(rr.discounts(df, s, e), name)
        # what a rep "owes" over the discount max stays on the leadership side until leadership decides reps should see it
        if not SHOW_REPS_OWED:
            v.pop("owes_total", None)
            for r in v["worst"]:
                r.pop("owes", None)
        out["discounts"][k] = {"label": label, **v}
    return out
