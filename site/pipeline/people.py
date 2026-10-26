"""People views for the Pulse site: each sales rep's own screen, team leaderboards, and production.

Every count starts from rr_metrics.masks() so it matches the CRM and the company's rules. Nothing here re-defines a metric;
it only groups the certified masks by rep, week, month or zip code.
Customer names (the Job Name column) are never read. Jobs are identified by job number and CRM link only.
"""
import re

import pandas as pd
import config

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Smallest sample that counts on a leaderboard, so one lucky sit cannot top the board.
MIN_SITS = {"week": 3, "month": 8, "quarter": 12, "year": 25}
# Close rate always shows as rolling 30 days, whatever period is picked: a short quarter-to-date
# window catches appointments before their sales come in. Same 30 days a year earlier for last year.
CLOSE_DAYS = 30
MIN_SITS_CLOSE = 8
MIN_JOBS = {"week": 2, "month": 3, "quarter": 4, "year": 6}
FOLLOW_UP_DAYS = 180
FOLLOW_UP_LIMIT = 40


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def d(x):
    return pd.Timestamp(x).strftime("%Y-%m-%d")


def rate(a, b):
    return {"n": int(a), "d": int(b), "pct": round(a / b, 4) if b else None}


def build(rr, df, as_of, coords):
    as_of = pd.Timestamp(as_of).normalize()
    roster = [n for n in rr.SALES_TEAM if n not in rr.HIDDEN]
    rep_col = df["Primary Salesperson"]
    amt = df["Contract Amount"]
    parent = df["Parent Lead Source"].fillna("")
    sub_u = df["Sub Lead Source"].fillna("").str.upper()
    # Job Name Url (the link for records without an RR number yet) may be missing from the export; use it when present
    url = df["Job Number Url"].where(df["Job Number Url"].notna(), df["Job Name Url"]) if "Job Name Url" in df.columns else df["Job Number Url"]

    def numbers(M, name):
        """One rep's numbers inside one window of masks. Close rate uses the sales team definition."""
        mine = rep_col == name
        jobs = int((M["jobs_sold"] & mine).sum())
        sales = round(float(amt[M["sales"] & mine].sum()), 2)
        sg = M["leads"] & (parent == config.SELF_GEN) & (mine | (sub_u == name.upper()))
        return {"sits": int((M["sits"] & mine).sum()), "jobs_sold": jobs, "sales": sales,
                "avg_ticket": round(sales / jobs, 2) if jobs else None,
                "close": rate((M["close_sold_team"] & mine).sum(), (M["close_sits_team"] & mine).sum()),
                "self_gen_leads": int(sg.sum())}

    def team_numbers(M):
        on = rep_col.isin(roster)
        jobs = int((M["jobs_sold"] & on).sum())
        sales = round(float(amt[M["sales"] & on].sum()), 2)
        sg = M["leads"] & (parent == config.SELF_GEN) & (on | sub_u.isin([n.upper() for n in roster]))
        total = {"sits": int((M["sits"] & on).sum()), "jobs_sold": jobs, "sales": sales,
                 "avg_ticket": round(sales / jobs, 2) if jobs else None,
                 "close": rate(M["close_sold_team"].sum(), M["close_sits_team"].sum()),
                 "self_gen_leads": int(sg.sum())}
        k = len(roster)
        per_rep = {"sits": round(total["sits"] / k, 1), "jobs_sold": round(jobs / k, 1), "sales": round(sales / k, 2),
                   "avg_ticket": total["avg_ticket"], "close": total["close"], "self_gen_leads": round(total["self_gen_leads"] / k, 1)}
        return total, per_rep

    def masks(s, e):
        return rr.masks(df, s, e)

    def shift_year(t):
        return (pd.Timestamp(t) - pd.DateOffset(years=1)).normalize()

    # ---- periods: this week so far, month, quarter, year to date, each against the same dates last year
    cw_s = as_of - pd.Timedelta(days=as_of.weekday())
    m0 = pd.Timestamp(as_of.year, as_of.month, 1)
    q_s = pd.Timestamp(as_of.year, ((as_of.month - 1) // 3) * 3 + 1, 1)
    y_s = pd.Timestamp(as_of.year, 1, 1)
    periods = {
        "week": ("This week so far", cw_s, as_of, cw_s - pd.Timedelta(days=364), as_of - pd.Timedelta(days=364)),
        "month": ("Month to date", m0, as_of, shift_year(m0), shift_year(as_of)),
        "quarter": ("Quarter to date", q_s, as_of, shift_year(q_s), shift_year(as_of)),
        "year": ("Year to date", y_s, as_of, shift_year(y_s), shift_year(as_of)),
    }
    PM = {k: (masks(a, b), masks(la, lb)) for k, (_, a, b, la, lb) in periods.items()}
    period_meta = {k: {"label": lab, "start": d(a), "end": d(b), "ly_start": d(la), "ly_end": d(lb)} for k, (lab, a, b, la, lb) in periods.items()}

    team = {}
    for k, (Mc, Ml) in PM.items():
        tot, avg = team_numbers(Mc)
        team[k] = {"total": tot, "per_rep": avg}

    # ---- close rate, rolling 30 days (and the same 30 days last year), used for every period below
    c_s, c_e = rr.rolling(as_of, CLOSE_DAYS)
    MC, MCly = masks(c_s, c_e), masks(shift_year(c_s), shift_year(c_e))
    def close30(M, name=None):
        mine = (rep_col == name) if name else rep_col.isin(roster)
        return rate((M["close_sold_team"] & mine).sum(), (M["close_sits_team"] & mine).sum()) if name else rate(M["close_sold_team"].sum(), M["close_sits_team"].sum())
    close_window = {"days": CLOSE_DAYS, "start": d(c_s), "end": d(c_e), "ly_start": d(shift_year(c_s)), "ly_end": d(shift_year(c_e))}
    for k in team:
        team[k]["total"]["close"] = close30(MC)
        team[k]["per_rep"]["close"] = close30(MC)

    # ---- trend buckets: 13 full weeks ending last week plus this week so far; 13 months with this month so far
    lw_s, _ = rr.last_week(as_of)
    week_starts = [lw_s - pd.Timedelta(days=7 * i) for i in range(12, -1, -1)] + [cw_s]
    month_starts = [(m0 - pd.DateOffset(months=i)).normalize() for i in range(12, -1, -1)]

    def week_bounds(s):
        e = min(s + pd.Timedelta(days=6), as_of)
        return s, e, s - pd.Timedelta(days=364), e - pd.Timedelta(days=364)

    def month_bounds(s):
        e = min((s + pd.offsets.MonthEnd(0)).normalize(), as_of)
        return s, e, shift_year(s), shift_year(e)

    WM = [(s, *week_bounds(s)[1:], masks(*week_bounds(s)[:2]), masks(*week_bounds(s)[2:])) for s in week_starts]
    MM = [(s, *month_bounds(s)[1:], masks(*month_bounds(s)[:2]), masks(*month_bounds(s)[2:])) for s in month_starts]

    def trend_point(M, name):
        n = numbers(M, name)
        return {"sales": n["sales"], "jobs_sold": n["jobs_sold"], "sits": n["sits"], "close_n": n["close"]["n"], "close_d": n["close"]["d"]}

    # ---- geography for the rep map
    zips = coords["zips"]
    zcol = df["Job: Location Zip Code"].astype(str).str.extract(r"(\d{5})")[0]
    inbox = zcol.map(lambda z: z in zips)  # every listed zip; OUT zips are drawn as the gray block (content/zips.json)
    geo_windows = {"90": rr.rolling(as_of, 90), "365": rr.rolling(as_of, 365), "all": (df["Lead Milestone Date"].min(), as_of)}
    GM = {k: masks(a, b) for k, (a, b) in geo_windows.items()}

    def rep_geo(name):
        mine = (rep_col == name) & inbox
        out = {}
        for k, (a, b) in geo_windows.items():
            M = GM[k]
            z = {}
            # Towns are judged on Demo Conversion (the rules): demos held there that signed, whenever they signed.
            for key, m in (("sits", M["close_sits_team"]), ("sold", M["demo_conv_sold_team"]), ("jobs_sold", M["jobs_sold"])):
                for zz, c in zcol[m & mine].value_counts().items():
                    z.setdefault(zz, {})[key] = int(c)
            for zz, v in amt[M["sales"] & mine].groupby(zcol).sum().items():
                z.setdefault(zz, {})["sales"] = round(float(v), 2)
            for zz, v in amt[M["jobs_sold"] & mine].groupby(zcol).sum().items():
                z.setdefault(zz, {})["sales_jobs"] = round(float(v), 2)
            out[k] = {"start": d(a), "end": d(b), "zips": z}
        used = set().union(*[set(w["zips"]) for w in out.values()])
        return {"windows": out, "places": {zz: [zips[zz][0], zips[zz][1], zips[zz][2]] for zz in used if zz in zips}}

    # ---- follow-ups: my quoted appointments that are still open (Prospect, never approved), newest first
    open_q = ((df["Current Milestone"] == "Prospect") & (df["Primary Estimate Total"] > 0) & df["Initial Appointment Date"].notna()
              & df["Approved Milestone Date"].isna() & ~df["_cb"] & ~df["_wt"].isin(rr.WT["contacts_leads_appointments_exclude"])
              & (df["Initial Appointment Date"] >= as_of - pd.Timedelta(days=FOLLOW_UP_DAYS)) & (df["Initial Appointment Date"] <= as_of))

    def follow_ups(name):
        t = df[open_q & (rep_col == name)].sort_values("Initial Appointment Date", ascending=False)
        rows = []
        for i, r in t.head(FOLLOW_UP_LIMIT).iterrows():
            rows.append({"url": url[i] if pd.notna(url[i]) else None,
                         "appt": d(r["Initial Appointment Date"]), "days": int((as_of - r["Initial Appointment Date"]).days),
                         "quote": round(float(r["Primary Estimate Total"]), 2),
                         "status": r["Current Status"] if pd.notna(r["Current Status"]) else "",
                         "town": str(r["Job: Location City"]).title() if pd.notna(r["Job: Location City"]) else "",
                         "zip": (re.search(r"\d{5}", str(r["Job: Location Zip Code"])) or [None])[0],
                         "source": r["Parent Lead Source"] if pd.notna(r["Parent Lead Source"]) else "",
                         "rating": r["Appointment Rating"] if pd.notna(r["Appointment Rating"]) else ""})
        return {"window_days": FOLLOW_UP_DAYS, "count": int(len(t)), "quoted_total": round(float(t["Primary Estimate Total"].sum()), 2), "rows": rows}

    # ---- leaderboards: rank everyone, then each rep only gets the top 3 and their own spot
    boards_def = [("jobs_sold", "Jobs sold", "count"), ("sales", "Sales", "money"), ("close", "Close rate", "rate"),
                  ("avg_ticket", "Avg ticket", "money"), ("self_gen_leads", "Self-gen leads", "count")]
    per_rep = {k: {n: numbers(PM[k][0], n) for n in roster} for k in periods}
    per_rep_ly = {k: {n: numbers(PM[k][1], n) for n in roster} for k in periods}
    for n in roster:
        c, cl = close30(MC, n), close30(MCly, n)
        for k in periods:
            per_rep[k][n]["close"], per_rep_ly[k][n]["close"] = c, cl

    def rank(rows):
        """Competition ranking (1, 1, 3) on rows of (name, value), highest first."""
        rows = sorted(rows, key=lambda r: -r[1])
        out, prev, place = [], None, 0
        for i, (n, v, extra) in enumerate(rows):
            if v != prev:
                place, prev = i + 1, v
            out.append({"rank": place, "rep": n, "value": v, **extra})
        return out

    boards = {}
    for k in periods:
        boards[k] = {}
        for key, label, fmt in boards_def:
            rows, waiting = [], {}
            for n in roster:
                x = per_rep[k][n]
                if key == "close":
                    if x["close"]["d"] < MIN_SITS_CLOSE:
                        waiting[n] = {"needs": f"{MIN_SITS_CLOSE - x['close']['d']} more sits in the last {CLOSE_DAYS} days to qualify"}
                        continue
                    v, extra = x["close"]["pct"], {"n": x["close"]["n"], "d": x["close"]["d"]}
                elif key == "avg_ticket":
                    if x["jobs_sold"] < MIN_JOBS[k]:
                        waiting[n] = {"needs": f"{MIN_JOBS[k] - x['jobs_sold']} more jobs sold to qualify"}
                        continue
                    v, extra = x["avg_ticket"], {"jobs": x["jobs_sold"]}
                else:
                    v, extra = x[key], {}
                if v:  # nobody is ranked on a zero
                    rows.append((n, v, extra))
            note = {"close": f"Rolling {CLOSE_DAYS} days, minimum {MIN_SITS_CLOSE} sits", "avg_ticket": f"Minimum {MIN_JOBS[k]} jobs sold"}.get(key, "")
            boards[k][key] = {"label": label, "fmt": fmt, "note": note, "ranked": rank(rows), "waiting": waiting}

    # most improved: sales this month so far against the same days of last month
    pm_s = (m0 - pd.DateOffset(months=1)).normalize()
    pm_e = min((pm_s + pd.offsets.MonthEnd(0)).normalize(), pm_s + pd.Timedelta(days=(as_of - m0).days))
    Mp = masks(pm_s, pm_e)
    imp_rows = []
    for n in roster:
        a, b = per_rep["month"][n]["sales"], numbers(Mp, n)["sales"]
        if a - b > 0:
            imp_rows.append((n, round(a - b, 2), {"this": a, "last": b}))
    most_improved = {"label": "Most improved", "fmt": "money_delta", "note": f"Sales {MONTHS[m0.month - 1]} 1 to {as_of.day} vs {MONTHS[pm_s.month - 1]} 1 to {pm_e.day}",
                     "ranked": rank(imp_rows), "waiting": {}}

    def board_for(name):
        """What one rep may see: the top 3 of each board, plus their own place."""
        out = {}
        for k, bs in boards.items():
            out[k] = {}
            for key, b in list(bs.items()) + [("most_improved", most_improved)]:
                me = next((r for r in b["ranked"] if r["rep"] == name), None)
                out[k][key] = {"label": b["label"], "fmt": b["fmt"], "note": b["note"],
                               "top": [r for r in b["ranked"] if r["rank"] <= 3],
                               "me": me, "me_waiting": b["waiting"].get(name), "ranked_count": len(b["ranked"])}
        return out

    reps = {}
    for n in roster:
        reps[slug(n)] = {
            "rep": n, "slug": slug(n), "as_of": d(as_of), "team_size": len(roster), "close_window": close_window,
            "periods": {k: {**period_meta[k], "me": per_rep[k][n], "ly": per_rep_ly[k][n], "team": team[k]} for k in periods},
            "trend": {
                "weekly": [{"start": d(s), "end": d(e), "partial": s == cw_s, "cur": trend_point(Mc, n), "ly": trend_point(Ml, n)} for s, e, _, _, Mc, Ml in WM],
                "monthly": [{"start": d(s), "end": d(e), "partial": s == m0, "cur": trend_point(Mc, n), "ly": trend_point(Ml, n)} for s, e, _, _, Mc, Ml in MM],
            },
            "geo": rep_geo(n),
            "follow_ups": follow_ups(n),
            "boards": board_for(n),
        }

    # ---- production: installs by week, month and period, time from sold to installed, upgrades by who sold them
    def prod_point(M):
        return {"revenue": round(float(amt[M["revenue"]].sum()), 2), "jobs_installed": int(M["jobs_installed"].sum()),
                "upgrades": round(float(amt[M["upgrades"]].sum()), 2), "upgrades_count": int(M["upgrades"].sum())}

    def cycle(M):
        t = df[M["jobs_installed"]]
        days = (t["Completed Milestone Date"] - t["Approved Milestone Date"]).dt.days.dropna()
        days = days[days >= 0]
        if not len(days):
            return {"n": 0}
        return {"n": int(len(days)), "median": float(days.median()), "average": round(float(days.mean()), 1),
                "p75": float(days.quantile(0.75)), "within_30": int((days <= 30).sum()), "over_60": int((days > 60).sum())}

    ld = {k: periods[k] for k in periods}
    lw_e = lw_s + pd.Timedelta(days=6)
    prod_periods = {"last_week": ("Last week", lw_s, lw_e, lw_s - pd.Timedelta(days=364), lw_e - pd.Timedelta(days=364))}
    prod_periods.update({k: v for k, v in ld.items() if k != "week"})
    production = {
        "periods": {k: {"label": lab, "start": d(a), "end": d(b), "ly_start": d(la), "ly_end": d(lb),
                        "cur": prod_point(masks(a, b)), "ly": prod_point(masks(la, lb)), "cycle": cycle(masks(a, b))}
                    for k, (lab, a, b, la, lb) in prod_periods.items()},
        "weekly": [{"start": d(s), "end": d(e), "partial": s == cw_s, "cur": prod_point(Mc), "ly": prod_point(Ml)} for s, e, _, _, Mc, Ml in WM],
        "monthly": [{"start": d(s), "end": d(e), "partial": s == m0, "cur": prod_point(Mc), "ly": prod_point(Ml), "cycle": cycle(Mc)} for s, e, _, _, Mc, Ml in MM],
        # every month since January three years back, for the month picker (this month is month to date)
        "months": [{"start": d(s), "end": d(e), "ly_start": d(la), "ly_end": d(lb), "partial": s == m0,
                    "cur": prod_point(masks(s, e)), "ly": prod_point(masks(la, lb)), "cycle": cycle(masks(s, e))}
                   for s, e, la, lb in (month_bounds(pd.Timestamp(y, m, 1)) for y in range(as_of.year - 3, as_of.year + 1) for m in range(1, 13)
                                        if pd.Timestamp(y, m, 1) <= m0)],
        "cycle_90": cycle(masks(*rr.rolling(as_of, 90))),
        "note": "The export has no crew field and no job cost lines, so installs cannot be split by crew. Upgrades can, by who sold them.",
    }

    people = {"as_of": d(as_of), "close_window": close_window, "roster": [{"rep": n, "slug": slug(n)} for n in roster],
              "boards": {k: {**bs, "most_improved": most_improved} for k, bs in boards.items()},
              "periods": period_meta, "team": team,
              "summary": [{"rep": n, "slug": slug(n), **{k: per_rep[k][n] for k in periods}} for n in roster]}
    return reps, people, production
