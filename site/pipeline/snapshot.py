"""Build the weekly Pulse snapshot (JSON) from the company's rules (rules/pulse_metrics.py).

Usage: python3 rr_dashboard_snapshot.py <rules_dir> <data_dir> <goals_rows.json> <out.json>
  rules_dir      ./rr-metrics-data/rules
  data_dir       ./rr-data/data
  goals_rows.json  the current quarter tab of the goals sheet (A1:H30) as a JSON list of rows
Every number comes from pulse_metrics.py. Never shows customer names (Job Name is never read out).
"""
import json, re, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import pandas as pd

rules_dir, data_dir, goals_path, out_path = sys.argv[1:5]
coords_path = sys.argv[5] if len(sys.argv) > 5 else None
spend_path = sys.argv[6] if len(sys.argv) > 6 else None
sys.path.insert(0, rules_dir)
import pulse_metrics as rr
import config

ET = config.TZ
MS_SALES = None
status = json.load(open(f"{data_dir}/status.json"))
run_utc = datetime.fromisoformat(status["job_export_raw"]["runDate"][:19]).replace(tzinfo=timezone.utc)
pulled = run_utc.astimezone(ET)
as_of = pd.Timestamp(pulled.date())
df = rr.load(f"{data_dir}/job_export_raw_latest.csv")
MS_SALES = rr.MS["sales_count_if_currently"]
rip_path = f"{data_dir}/Revenue_In_Progress_latest.csv"

def d(x): return pd.Timestamp(x).strftime("%Y-%m-%d")
def rate(a, b): return {"n": int(a), "d": int(b), "pct": round(a / b, 4) if b else None}

# ---- periods
lw_s, lw_e = rr.last_week(as_of)
q = (as_of.month - 1) // 3
q_s = pd.Timestamp(as_of.year, q * 3 + 1, 1)
q_e = (q_s + pd.offsets.QuarterEnd(0)).normalize()
q_days = (q_e - q_s).days + 1
q_elapsed = (as_of - q_s).days + 1
share = q_elapsed / q_days
cw_s = as_of - pd.Timedelta(days=as_of.weekday()); cw_e = cw_s + pd.Timedelta(days=6)
y_s = pd.Timestamp(as_of.year, 1, 1)

# ---- goals sheet
rows = json.load(open(goals_path))
def num(s):
    if s is None or str(s).strip() in ("", "n/a"): return None
    s = str(s).replace("$", "").replace(",", "").strip()
    if s.endswith("%"): return float(s[:-1]) / 100
    try: return float(s)
    except ValueError: return None
goals = {}
for r in rows:
    if len(r) >= 2 and r[0] and r[0] not in ("Metric",) and not r[0].upper().startswith(("HISTORICAL", config.NAME.upper()[:6])):
        goals[r[0].strip()] = {"q": num(r[1]), "weekly": num(r[2]) if len(r) > 2 else None,
                               "actual": num(r[3]) if len(r) > 3 else None, "owner": r[5] if len(r) > 5 else ""}

def block(s, e, reps=None):
    m = rr.metrics(df, s, e, reps)
    return {k: (float(v) if not isinstance(v, int) else v) for k, v in m.items()}

LW, QTD, YTD = block(lw_s, lw_e), block(q_s, as_of), block(y_s, as_of)

def derived(m):
    return {
        "avg_ticket": round(m["sales"] / m["jobs_sold"], 2) if m["jobs_sold"] else None,
        "ug_pct": round(m["upgrades"] / m["revenue"], 4) if m["revenue"] else None,
        "booking_rate": rate(m["appointments"], m["leads"]),
        "sit_rate": rate(m["sits"], m["appointments"]),
        "close_team": rate(m["close_sold_team"], m["close_sits_team"]),
        "close_company": rate(m["close_sold_company"], m["close_sits_company"]),
        "gp": rate(0, 0) if not m["gp_contract_closed"] else {"profit": m["gp_profit_closed"], "contract": m["gp_contract_closed"], "pct": round(m["gp_profit_closed"] / m["gp_contract_closed"], 4)},
    }
LWd, QTDd, YTDd = derived(LW), derived(QTD), derived(YTD)

# ---- scorecard (count/dollar metrics pace against goal x share of quarter; rates compare to goal)
spec = [
    ("Contacts", "contacts", "count"), ("Leads", "leads", "count"), ("Appointments", "appointments", "count"),
    ("Sits", "sits", "count"), ("Sales", "sales", "money"), ("Total Jobs", "jobs_sold", "count"),
    ("Revenue", "revenue", "money"), ("Upgrades ($)", "upgrades", "money"),
]
score = []
for label, key, fmt in spec:
    g = goals.get(label, {})
    gq = g.get("q")
    score.append({"metric": "Jobs Sold" if label == "Total Jobs" else ("Upgrades" if label == "Upgrades ($)" else label),
                  "owner": g.get("owner", ""), "fmt": fmt, "last_week": LW[key], "weekly_goal": g.get("weekly"),
                  "qtd": QTD[key], "q_goal": gq, "pace_target": round(gq * share, 2) if gq else None,
                  "pacing": round(QTD[key] / (gq * share), 4) if gq else None})
rate_spec = [
    ("Avg Ticket", "AVG Ticket", lambda x: x["avg_ticket"], "money"),
    ("Close Rate", "Close Rate", lambda x: x["close_team"], "rate"),
    ("Booking Rate", "Booking Rate", lambda x: x["booking_rate"], "rate"),
    ("Sit Rate", "Sit Rate", lambda x: x["sit_rate"], "rate"),
    ("UG % of Rev", "UG % of Rev", lambda x: x["ug_pct"], "pct"),
    ("GP%", "GP%", lambda x: x["gp"], "gp"),
]
for label, gkey, fn, fmt in rate_spec:
    g = goals.get(gkey, {})
    score.append({"metric": label, "owner": g.get("owner", ""), "fmt": fmt, "last_week": fn(LWd), "qtd": fn(QTDd), "q_goal": g.get("q")})
for label in ("Net Profit", "5 Star Reviews"):
    g = goals.get(label, {})
    score.append({"metric": label, "owner": g.get("owner", ""), "fmt": "money" if label == "Net Profit" else "count",
                  "qtd": g.get("actual"), "q_goal": g.get("q"), "source": "goals sheet"})

# ---- 13-week trend (Mon-Sun), ending last week
trend = []
for i in range(12, -1, -1):
    s = lw_s - pd.Timedelta(days=7 * i); e = s + pd.Timedelta(days=6)
    m = rr.metrics(df, s, e)
    trend.append({"week": d(s), "leads": m["leads"], "appointments": m["appointments"], "sits": m["sits"],
                  "sales": float(m["sales"]), "jobs_sold": m["jobs_sold"], "revenue": float(m["revenue"])})

# ---- months: last 12 full months + this month to date (current month flagged partial)
months = []
m0 = pd.Timestamp(as_of.year, as_of.month, 1)
for i in range(12, -1, -1):
    ms = (m0 - pd.DateOffset(months=i)).normalize(); me = (ms + pd.offsets.MonthEnd(0)).normalize()
    partial = i == 0
    m = rr.metrics(df, ms, as_of if partial else me)
    months.append({"month": d(ms), "partial": partial, "leads": m["leads"], "appointments": m["appointments"], "sits": m["sits"],
                   "sales": float(m["sales"]), "jobs_sold": m["jobs_sold"], "revenue": float(m["revenue"]),
                   "close_team": rate(m["close_sold_team"], m["close_sits_team"])})

# ---- comparisons: running totals by day. This month vs last month, this quarter vs same quarter last year,
# this year vs last year. Built from rr.masks so every count follows the certified rules.
DATECOL = {"leads": "Lead Milestone Date", "appointments": "Prospect Milestone Date", "sits": "Initial Appointment Date",
           "sales": "Approved Milestone Date", "jobs_sold": "Approved Milestone Date", "revenue": "Completed Milestone Date"}
def running(start, end, xs):
    """Running totals from start through start + (x - 1) days, for each x in xs."""
    Mx = rr.masks(df, start, end)
    out = []
    series = {}
    for k, col in DATECOL.items():
        sel = df[Mx[k]]
        vals = sel["Contract Amount"] if k in ("sales", "revenue") else pd.Series(1, index=sel.index)
        series[k] = (vals.groupby(sel[col]).sum().sort_index().cumsum())
    for x in xs:
        cut = start + pd.Timedelta(days=x - 1)
        row = {"x": int(x)}
        for k, ser in series.items():
            v = ser[ser.index <= cut]
            row[k] = round(float(v.iloc[-1]), 2) if len(v) else 0
            if k not in ("sales", "revenue"): row[k] = int(row[k])
        out.append(row)
    return out
def cmp_block(label_this, label_last, this_start, last_start, last_end, through, step=1):
    last_len = (last_end - last_start).days + 1
    xs_last = sorted(set(list(range(1, last_len + 1, step)) + [last_len, min(through, last_len)]))
    xs_this = sorted(set(list(range(1, through + 1, step)) + [through]))
    return {"this_label": label_this, "last_label": label_last, "through": through, "length": last_len,
            "this": running(this_start, this_start + pd.Timedelta(days=through - 1), xs_this),
            "last": running(last_start, last_end, xs_last)}
pm = (m0 - pd.DateOffset(months=1)).normalize()
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
lq_s = pd.Timestamp(as_of.year - 1, q_s.month, 1); lq_e = (lq_s + pd.offsets.QuarterEnd(0)).normalize()
ly_s = pd.Timestamp(as_of.year - 1, 1, 1); ly_e = pd.Timestamp(as_of.year - 1, 12, 31)
def month_ticks(start, length):
    t, cur = [], start
    while (cur - start).days < length:
        t.append({"x": (cur - start).days + 1, "label": MONTHS[cur.month - 1]})
        cur = (cur + pd.offsets.MonthBegin(1)).normalize()
    return t
compare = {
    "month": cmp_block(MONTHS[m0.month - 1] + " " + str(m0.year), MONTHS[pm.month - 1] + " " + str(pm.year), m0, pm, m0 - pd.Timedelta(days=1), as_of.day),
    "quarter": cmp_block(f"Q{q + 1} {as_of.year}", f"Q{q + 1} {as_of.year - 1}", q_s, lq_s, lq_e, q_elapsed),
    "year": cmp_block(str(as_of.year), str(as_of.year - 1), y_s, ly_s, ly_e, (as_of - y_s).days + 1, step=7),
}
compare["month"]["ticks"] = [{"x": x, "label": f"Day {x}"} for x in (1, 8, 15, 22, 29)]
compare["quarter"]["ticks"] = month_ticks(lq_s, compare["quarter"]["length"])
compare["year"]["ticks"] = [t for t in month_ticks(ly_s, 365) if t["label"] in ("Jan", "Apr", "Jul", "Oct")]

# ---- close rate 30/60/90 ending as_of
close_windows = []
for days in (30, 60, 90):
    s, e = rr.rolling(as_of, days); m = rr.metrics(df, s, e)
    close_windows.append({"days": days, "start": d(s), "end": d(e), "team": rate(m["close_sold_team"], m["close_sits_team"]),
                          "company": rate(m["close_sold_company"], m["close_sits_company"])})

# ---- who is in "company" close rate but not "sales team" (rolling 90); former reps grouped, never named
s90o, e90o = rr.rolling(as_of, 90); Mo = rr.masks(df, s90o, e90o)
xt = df[Mo["close_sits_company"] & ~Mo["close_sits_team"]]
outside = {}
for _, r in xt.iterrows():
    who = r["Primary Salesperson"] if pd.notna(r["Primary Salesperson"]) else "(no rep)"
    if who in rr.HIDDEN: who = "Former reps"
    o = outside.setdefault(who, {"who": who, "sits": 0, "sold": 0}); o["sits"] += 1; o["sold"] += int(pd.notna(r["Approved Milestone Date"]))
outside_team = sorted(outside.values(), key=lambda o: -o["sits"])

# ---- upgrades by person (Revenue rules: installed date), quarter to date and year to date; former reps grouped
def upg_by(s0, e0):
    Mu = rr.masks(df, s0, e0); u = df[Mu["upgrades"]]
    who = u["Primary Salesperson"].fillna("(no rep)").map(lambda x: "Former reps" if x in rr.HIDDEN else x)
    g = u.groupby(who)["Contract Amount"].agg(["size", "sum"]).sort_values("sum", ascending=False)
    return [{"who": i, "count": int(r["size"]), "amount": round(float(r["sum"]), 2)} for i, r in g.iterrows()]
ly_same = pd.Timestamp(as_of.year - 1, as_of.month, as_of.day)
upgrades = {"qtd": upg_by(q_s, as_of), "ytd": upg_by(y_s, as_of),
            "ytd_total": YTD["upgrades"], "last_year_same_point": float(rr.metrics(df, ly_s, ly_same)["upgrades"]),
            "last_year_total": float(rr.metrics(df, ly_s, ly_e)["upgrades"])}

# ---- marketing: leads by parent source for the last 6 full months + this month so far
mk_months = [m for m in months][-7:]
mk = {}
for m in mk_months:
    ms = pd.Timestamp(m["month"]); me = as_of if m["partial"] else (ms + pd.offsets.MonthEnd(0)).normalize()
    Mm = rr.masks(df, ms, me)
    for src_name, cnt in df[Mm["leads"]]["Parent Lead Source"].fillna("(blank)").value_counts().items():
        mk.setdefault(src_name, {})[m["month"]] = int(cnt)
mk_rows = sorted(({"source": k, "by_month": v, "total": sum(v.values())} for k, v in mk.items()), key=lambda r: -r["total"])
marketing = {"months": [m["month"] for m in mk_months], "partial_last": True, "leads_by_source": mk_rows[:10]}

# ---- spend: joins the Marketing Spend by Source sheet to leads that came in the same month
if spend_path:
    SP = json.load(open(spend_path))
    srows, mrows = SP.get("spend") or [], SP.get("map") or []
    def money_cell(x):
        try: return float(str(x).replace("$", "").replace(",", "").strip())
        except ValueError: return None
    smap = {}
    for r in mrows[1:]:
        if len(r) >= 2 and r[0] and r[1] and str(r[1]).strip():
            subs = [x.strip().upper() for x in (r[2] if len(r) > 2 else "").split(",") if x.strip()]
            smap[r[0].strip()] = (r[1].strip().upper(), subs)
    lines_out, by_month, filled = {}, {}, []
    head = srows[0] if srows else []
    parent_u = df["Parent Lead Source"].fillna("").str.upper(); sub_u = df["Sub Lead Source"].fillna("").str.upper()
    for r in srows[1:]:
        if not r or not str(r[0]).strip(): continue
        mon = str(r[0]).strip()[:7]
        vals = {head[i]: money_cell(r[i]) for i in range(1, min(len(r), len(head))) if money_cell(r[i]) is not None}
        if not vals: continue
        filled.append(mon)
        ms = pd.Timestamp(mon + "-01"); me = min((ms + pd.offsets.MonthEnd(0)).normalize(), as_of)
        Mm = rr.masks(df, ms, me)
        for line, amt in vals.items():
            o = lines_out.setdefault(line, {"line": line, "spend": 0.0, "leads": 0, "appointments": 0, "sold": 0, "sales": 0.0, "mapped": line in smap})
            o["spend"] += amt
            bm = {"spend": amt}
            if line in smap:
                par, subs = smap[line]
                sel = Mm["leads"] & (parent_u == par) & (sub_u.isin(subs) if subs else True)
                coh = df[sel]
                booked = int(coh["Prospect Milestone Date"].notna().sum())
                soldm = coh["Current Milestone"].isin(MS_SALES) & coh["Approved Milestone Date"].notna() & ~coh["_cb"] & (coh["_wt"] != rr.UPG)
                o["leads"] += int(sel.sum()); o["appointments"] += booked; o["sold"] += int(soldm.sum()); o["sales"] += float(coh.loc[soldm, "Contract Amount"].sum())
                bm.update({"leads": int(sel.sum()), "sold": int(soldm.sum())})
            by_month.setdefault(line, {})[mon] = bm
    out_lines = []
    for o in lines_out.values():
        sp = o["spend"]
        o.update({"spend": round(sp, 2), "sales": round(o["sales"], 2),
                  "cost_per_lead": round(sp / o["leads"], 2) if o["leads"] else None,
                  "cost_per_appointment": round(sp / o["appointments"], 2) if o["appointments"] else None,
                  "cost_per_sold_job": round(sp / o["sold"], 2) if o["sold"] else None,
                  "sales_per_dollar": round(o["sales"] / sp, 2) if (sp and o["mapped"]) else None})
        out_lines.append(o)
    out_lines.sort(key=lambda o: -o["spend"])
    marketing["spend"] = {"months": sorted(set(filled)), "lines": out_lines, "by_month": by_month,
                          "total": round(sum(o["spend"] for o in out_lines), 2),
                          "note": "Spend in a month is matched to leads that came in that month. Booked, sold and sales follow those same leads to today, so recent months are still filling in."}


# ---- reps, rolling 90 (sales team only, former reps never shown)
s90, e90 = rr.rolling(as_of, 90); M = rr.masks(df, s90, e90)
sits = rr.by_rep(df, M["close_sits_team"]); sold = rr.by_rep(df, M["close_sold_team"])
sales = rr.by_rep(df, M["sales"], "Contract Amount"); jobs = rr.by_rep(df, M["jobs_sold"])
reps = []
for name in rr.SALES_TEAM:
    if name in rr.HIDDEN: continue
    a, b = int(sold.get(name, 0)), int(sits.get(name, 0)); j = int(jobs.get(name, 0)); sv = float(sales.get(name, 0))
    reps.append({"rep": name, "close": rate(a, b), "sales": round(sv, 2), "jobs_sold": j, "avg_ticket": round(sv / j, 2) if j else None})
reps.sort(key=lambda r: -r["sales"])
s30, e30 = rr.rolling(as_of, 30); M30 = rr.masks(df, s30, e30)
sits30 = rr.by_rep(df, M30["close_sits_team"]); sold30 = rr.by_rep(df, M30["close_sold_team"]); sales30 = rr.by_rep(df, M30["sales"], "Contract Amount"); jobs30 = rr.by_rep(df, M30["jobs_sold"])
sg = df[(df["Parent Lead Source"] == config.SELF_GEN) & M["leads"]]
for r in reps:
    n = r["rep"]
    r["close_30"] = rate(int(sold30.get(n, 0)), int(sits30.get(n, 0)))
    r["sales_30"] = round(float(sales30.get(n, 0)), 2); r["jobs_sold_30"] = int(jobs30.get(n, 0))
    r["self_gen_leads_90"] = int(((sg["Primary Salesperson"] == n) | (sg["Sub Lead Source"].fillna("").str.upper() == n.upper())).sum())

# ---- lead sources, rolling 90. Their rate is Demo Conversion (the rules judge sources on it, not Close Rate).
src = []
col = "Parent Lead Source"
for name, grp in df.groupby(df[col].fillna("(blank)")):
    idx = grp.index
    L = int(M["leads"][idx].sum()); A = int(M["appointments"][idx].sum())
    cs = int(M["close_sits_company"][idx].sum()); cd = int(M["demo_conv_sold_company"][idx].sum())
    sv = float(df.loc[idx][M["sales"][idx]]["Contract Amount"].sum()); js = int(M["jobs_sold"][idx].sum())
    if L or A or sv:
        subs = []
        for sub, sg in grp.groupby(grp["Sub Lead Source"].fillna("(blank)")):
            j = sg.index
            sL = int(M["leads"][j].sum()); sA = int(M["appointments"][j].sum())
            scs = int(M["close_sits_company"][j].sum()); scd = int(M["demo_conv_sold_company"][j].sum())
            ssv = float(df.loc[j][M["sales"][j]]["Contract Amount"].sum()); sjs = int(M["jobs_sold"][j].sum())
            if sL or sA or ssv:
                subs.append({"source": sub, "leads": sL, "appointments": sA, "booking": rate(sA, sL), "close": rate(scd, scs), "jobs_sold": sjs, "sales": round(ssv, 2)})
        subs.sort(key=lambda r: (-r["sales"], -r["leads"]))
        src.append({"source": name, "leads": L, "appointments": A, "booking": rate(A, L), "close": rate(cd, cs), "jobs_sold": js, "sales": round(sv, 2), "subs": subs if len(subs) > 1 else []})
src.sort(key=lambda r: (-r["sales"], -r["leads"]))

# ---- installs this week (section 3 of RULES): installed so far + still to install
Mw = rr.masks(df, cw_s, as_of)
inst = df[Mw["revenue"]]
installed = [{"rr": r["Job Number"] if pd.notna(r["Job Number"]) else None, "url": r["Job Number Url"] if pd.notna(r["Job Number Url"]) else r.get("Job Name Url"),
              "rep": "" if r["Primary Salesperson"] in rr.HIDDEN else (r["Primary Salesperson"] if pd.notna(r["Primary Salesperson"]) else ""),
              "trade": r["Job Trade Type"] if pd.notna(r["Job Trade Type"]) else "", "work_type": r["Work Type"],
              "date": d(r["Completed Milestone Date"]), "amount": float(r["Contract Amount"])} for _, r in inst.sort_values("Completed Milestone Date").iterrows()]
rip = pd.read_csv(rip_path)
for c in ("Crew Start Date", "Crew End Date"):
    rip[c + "_d"] = pd.to_datetime(rip[c].astype(str).str.split(" ").str[0], format="%m/%d/%y", errors="coerce")
wk = rip[(rip["Crew Start Date_d"] >= as_of) & (rip["Crew Start Date_d"] <= cw_e)]
todo = []
for job, g in wk.groupby("Job Number"):
    r = g.iloc[0]
    todo.append({"rr": job, "url": r["Job Number Url"], "rep": "" if r["Primary Salesperson"] in rr.HIDDEN else r["Primary Salesperson"],
                 "trades": ", ".join(sorted(set(g["Trade Name"].astype(str)))), "date": d(g["Crew Start Date_d"].min()),
                 "status": r["Current Status"], "value": float(r["Job Value"])})
todo.sort(key=lambda r: (r["date"], r["rr"]))
stale = rip[(rip["Crew Start Date_d"] < as_of) & (rip["Current Milestone"] == "Approved")]["Job Number"].nunique()
rip_total, rip_jobs = rr.revenue_in_progress(rip_path)
rip_q, rip_q_jobs = rr.revenue_in_progress(rip_path, q_s, q_e)
installs = {"week_start": d(cw_s), "week_end": d(cw_e), "installed": installed, "installed_total": round(sum(i["amount"] for i in installed), 2),
            "to_install": todo, "to_install_total": round(sum(t["value"] for t in todo), 2),
            "at_risk": [t for t in todo if t["status"] in config.AT_RISK],
            "past_date_still_approved": int(stale),
            "in_progress_total": float(rip_total), "in_progress_jobs": int(rip_jobs), "finishing_this_quarter": float(rip_q), "finishing_this_quarter_jobs": int(rip_q_jobs)}

# ---- flags, quarter to date
names = {"quoted_but_marked_not_serviced": "Quoted but marked not serviced",
         "booked_but_should_not_be": "Booked but marked a reason that should have stopped it",
         "trade_not_serviced_on_main_trade": f"Trade Not Serviced on a {config.MAIN_TRADE_WORD} job",
         "appointment_with_no_setter": "Appointment with no Set By",
         "closed_with_bad_profit": "Closed with $0 or negative profit, or 100% profit"}
F = rr.flags(df, q_s, as_of)
flags = []
for k, t in F.items():
    if not len(t): continue
    # Only the flags named above. the rules also return lists the Pulse does not show (discount_over_max, which has
    # different columns), and may add more; skip those rather than stop the whole build.
    if k not in names:
        print(f"note: flag list {k} ({len(t)} rows) is not shown in the Pulse", file=sys.stderr)
        continue
    who_col = "Appointment Set By" if k == "booked_but_should_not_be" else "Primary Salesperson"
    vc = t[who_col].replace("", pd.NA).dropna().value_counts() if who_col in t.columns else pd.Series(dtype=int)
    rowsf = []
    for i, r in t.iterrows():
        u = r.get("Job Number Url") if pd.notna(r.get("Job Number Url")) else (df.at[i, "Job Name Url"] if "Job Name Url" in df.columns else None)
        rowsf.append({"rr": r.get("Job Number") if pd.notna(r.get("Job Number")) else None, "url": u,
                      "rep": r.get("Primary Salesperson") if pd.notna(r.get("Primary Salesperson")) else "",
                      "csr": r.get("Appointment Set By") if pd.notna(r.get("Appointment Set By")) else "",
                      "date": d(df.at[i, "Lead Milestone Date"]) if pd.notna(df.at[i, "Lead Milestone Date"]) else ""})
    rowsf.sort(key=lambda x: x["date"], reverse=True)
    flags.append({"key": k, "label": names[k], "count": len(t), "most": {"name": vc.index[0], "count": int(vc.iloc[0]), "role": "CSR" if who_col == "Appointment Set By" else "Rep"} if len(vc) else None,
                  "rows": rowsf[:5]})
flags.sort(key=lambda f: -f["count"])

S = json.load(open(f"{rules_dir}/settings.json"))

# ---- geography: results by zip code for the gold map (written to a separate file, <out>_geo.json)
geo = None
if coords_path:
    C = config.zips()
    zips = C["zips"]
    zcol = df["Job: Location Zip Code"].astype(str).str.extract(r"(\d{5})")[0]
    inbox = zcol.map(lambda z: z in zips)  # every listed zip; OUT zips are the gray block
    def geo_window(a0, b0):
        Mg = rr.masks(df, a0, b0); out = {}
        for key, m in (("leads", Mg["leads"]), ("appointments", Mg["appointments"]), ("sits", Mg["close_sits_company"]), ("sold", Mg["demo_conv_sold_company"]), ("jobs_sold", Mg["jobs_sold"])):
            for z, c in zcol[m & inbox].value_counts().items(): out.setdefault(z, {})[key] = int(c)
        for z, v in df[Mg["sales"] & inbox].groupby(zcol)["Contract Amount"].sum().items(): out.setdefault(z, {})["sales"] = round(float(v), 2)
        for z, v in df[Mg["jobs_sold"] & inbox].groupby(zcol)["Contract Amount"].sum().items(): out.setdefault(z, {})["sales_jobs"] = round(float(v), 2)
        return out
    allstart = df["Lead Milestone Date"].min()
    windows = {"30": rr.rolling(as_of, 30), "90": rr.rolling(as_of, 90), "365": rr.rolling(as_of, 365), "all": (allstart, as_of)}
    prior = (as_of - pd.Timedelta(days=730), as_of - pd.Timedelta(days=366))
    geo = {"as_of": d(as_of), "windows": {k: {"start": d(a0), "end": d(b0), "zips": geo_window(a0, b0)} for k, (a0, b0) in windows.items()},
           "prior_365": {"start": d(prior[0]), "end": d(prior[1]), "zips": geo_window(*prior)},
           "places": {z: [zips[z][0], zips[z][1], zips[z][2]] for z in set(zcol[inbox].dropna())},
           "background": C["background"], "outside_records": int((zcol.notna() & ~inbox).sum()), "no_zip_records": int(zcol.isna().sum())}

# ---- period board: week / month / quarter / year, each against the same period last year
def shift_year(t): return (pd.Timestamp(t) - pd.DateOffset(years=1)).normalize()
PER = {
    "week": ("Last week", lw_s, lw_e, lw_s - pd.Timedelta(days=364), lw_e - pd.Timedelta(days=364)),
    "month": ("Month to date", m0, as_of, shift_year(m0), shift_year(as_of)),
    "quarter": ("Quarter to date", q_s, as_of, shift_year(q_s), shift_year(as_of)),
    "year": ("Year to date", y_s, as_of, shift_year(y_s), shift_year(as_of)),
}
pblocks = {}
for k, (lab, a0, b0, la, lb) in PER.items():
    cur, ly = block(a0, b0), block(la, lb)
    pblocks[k] = {"label": lab, "start": d(a0), "end": d(b0), "ly_start": d(la), "ly_end": d(lb), "cur": cur, "ly": ly, "cur_d": derived(cur), "ly_d": derived(ly)}
board_spec = [("Contacts","contacts","count","Contacts"),("Leads","leads","count","Leads"),("Appointments","appointments","count","Appointments"),
              ("Sits","sits","count","Sits"),("Sales","sales","money","Sales"),("Jobs Sold","jobs_sold","count","Total Jobs"),
              ("Revenue","revenue","money","Revenue"),("Upgrades","upgrades","money","Upgrades ($)")]
board_rates = [("Avg Ticket","avg_ticket","money","AVG Ticket"),("Close Rate","close_team","rate","Close Rate"),("Booking Rate","booking_rate","rate","Booking Rate"),
               ("Sit Rate","sit_rate","rate","Sit Rate"),("UG % of Rev","ug_pct","pct","UG % of Rev"),("GP%","gp","gp","GP%")]
board_rows = []
for label, key, fmt, gk in board_spec:
    g = goals.get(gk, {}); gq = g.get("q")
    row = {"metric": label, "owner": g.get("owner", ""), "fmt": fmt, "values": {}, "ly": {}, "goal": {}}
    for k, pb in pblocks.items():
        row["values"][k] = pb["cur"][key]; row["ly"][k] = pb["ly"][key]
    row["goal"]["week"] = g.get("weekly")
    if gq:
        row["goal"]["quarter"] = gq; row["goal"]["quarter_pace"] = round(gq * share, 2); row["goal"]["quarter_pacing"] = round(QTD[key] / (gq * share), 4)
    if key == "sales":
        row["goal"]["year"] = S["goals"]["original_yearly_sales_goal"]
    board_rows.append(row)
for label, key, fmt, gk in board_rates:
    g = goals.get(gk, {})
    row = {"metric": label, "owner": g.get("owner", ""), "fmt": fmt, "values": {}, "ly": {}, "goal": {"rate": g.get("q")}}
    for k, pb in pblocks.items():
        row["values"][k] = pb["cur_d"][key]; row["ly"][k] = pb["ly_d"][key]
    board_rows.append(row)
board = {"periods": {k: {x: v[x] for x in ("label", "start", "end", "ly_start", "ly_end")} for k, v in pblocks.items()}, "rows": board_rows}

# ---- history: daily totals per metric per year, back to the first full year of data, for the multi-year charts
first = df["Lead Milestone Date"].min()
start_year = first.year + (0 if (first.month == 1 and first.day == 1) else 1)
Mh = rr.masks(df, pd.Timestamp(start_year, 1, 1), as_of)
history = {"years": list(range(start_year, as_of.year + 1)), "as_of": d(as_of), "first_record": d(first), "metrics": {}}
for k, col in DATECOL.items():
    sel = df[Mh[k]]
    vals = sel["Contract Amount"] if k in ("sales", "revenue") else pd.Series(1, index=sel.index)
    daily = vals.groupby(sel[col]).sum()
    per = {}
    for y in history["years"]:
        idx = pd.date_range(pd.Timestamp(y, 1, 1), min(pd.Timestamp(y, 12, 31), as_of))
        arr = daily.reindex(idx, fill_value=0)
        per[str(y)] = [round(float(v), 2) if k in ("sales", "revenue") else int(v) for v in arr.tolist()]
    history["metrics"][k] = per

out = {
    "week_start": d(lw_s), "week_end": d(lw_e), "as_of": d(as_of),
    "pulled_at": pulled.strftime("%b %-d, %-I:%M %p ") + config.tz_short(pulled),
    "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "quarter": {"label": f"Q{q + 1} {as_of.year}", "start": d(q_s), "end": d(q_e), "days_elapsed": q_elapsed, "days_total": q_days},
    "scorecard": score, "board": board, "history": history, "trend": trend, "months": months, "compare": compare, "outside_team": outside_team, "upgrades": upgrades, "marketing": marketing, "close_windows": close_windows, "reps": reps, "sources": src[:12],
    "installs": installs, "flags": flags,
    "ytd": {"sales": YTD["sales"], "revenue": YTD["revenue"], "jobs_sold": YTD["jobs_sold"], "gp": YTDd["gp"], "close_team": YTDd["close_team"],
            "original_yearly_sales_goal": S["goals"]["original_yearly_sales_goal"], "vs_original_goal": round(YTD["sales"] - S["goals"]["original_yearly_sales_goal"], 2)},
    "worth_knowing": [], "raise_this_week": [], "priorities": [], "team": [],
}
json.dump(out, open(out_path, "w"), indent=1, default=str)
if geo is not None:
    geo["week_start"] = out["week_start"]
    json.dump(geo, open(out_path.rsplit(".", 1)[0] + "_geo.json", "w"), default=str)
print(json.dumps({k: out[k] for k in ("week_start", "week_end", "as_of", "pulled_at", "quarter")}))
print("bytes", len(json.dumps(out, default=str)))
