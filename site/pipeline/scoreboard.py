"""Leadership Scorecard: a board of boxes for the week, the month and the quarter.

The rules' weekly scorecard (RULES.md section 13, pulse_metrics.scorecard) sets every rule and owner. This adds the month and
quarter views, sit rate, appointments over the last 30 days, demos, each rep's close rate next to the team's and the
company's, and the backlog rule (green from 3 to 5 weeks of the weekly revenue goal).

- Week = the last full Monday to Sunday, like the weekly scorecard. Close rate, average ticket and GP% use the 30 days ending that
  Sunday (the scorecard's R30), because one week is too few demos and closed jobs.
- Month and quarter = so far, paced against the goal (goal times the share of the period that has passed).
- Backlog and A/R over 30 are as of the data pull, the same in every view. Cash is typed in on the page.
- Close rate is graded for the sales team (today's roster) and each rep. The company number (everyone who sold,
  including people off the sales team and former reps) is shown for comparison, without a color.

Every box carries its status (good, near, bad), how far off it is (sev, for ranking the alerts) and one plain action.
"""
import pandas as pd
import config

OWNERS = config.OWNERS  # scorecard owner initials (rules/settings.json) -> names (pulse.config.json people.leadership)
WEEKS, MONTHS, QUARTERS = 13, 6, 4


def _r(a, b):
    return round(a / b, 4) if b else None


def _days(s, e):
    return (pd.Timestamp(e) - pd.Timestamp(s)).days + 1


def _quarter(t):
    qs = pd.Timestamp(t.year, 3 * ((t.month - 1) // 3) + 1, 1)
    return qs, qs + pd.DateOffset(months=3) - pd.Timedelta(days=1)


def _status(v, goal, more=True):
    """good at or past the goal, near within 5% (rates) or 10% (pace and less-is-better), bad beyond."""
    if v is None or goal is None:
        return None, 0.0
    if more:
        if v >= goal:
            return "good", 0.0
        return ("near" if v >= goal * 0.95 else "bad"), round(1 - v / goal, 4) if goal else 0.0
    if v <= goal:
        return "good", 0.0
    return ("near" if v <= goal * 1.1 else "bad"), round(v / goal - 1, 4) if goal else 0.0


def _pace(v, target):
    """A count or dollar total against the goal for the days that have passed."""
    if v is None or not target:
        return None, 0.0, None
    p = v / target
    st = "good" if p >= 1 else "near" if p >= 0.9 else "bad"
    return st, round(max(0.0, 1 - p), 4), round(p, 4)


def _values(rr, df, s, e, reps, reviews):
    """Every number for one window. Rates and averages come back as n and d so totals stay exact."""
    M = rr.masks(df, s, e)
    ca = df["Contract Amount"].fillna(0)
    upg = df["_wt"] == rr.UPG
    o = {
        "appts": int(M["appointments"].sum()),
        "sits": int(M["sits"].sum()),
        "demos": int(M["close_sits_company"].sum()),
        "sales": round(float(ca[M["sales"] & ~upg].sum()), 2),
        "sales_all": round(float(ca[M["sales"]].sum()), 2),
        "jobs_sold": int(M["jobs_sold"].sum()),
        "revenue": round(float(ca[M["revenue"]].sum()), 2),
        "jobs_installed": int(M["jobs_installed"].sum()),
        "gp_profit": round(float(df.loc[M["gp_jobs"], "Profit"].sum()), 2),
        "gp_contract": round(float(ca[M["gp_jobs"]].sum()), 2),
        "gp_jobs": int(M["gp_jobs"].sum()),
        "close_team": [int(M["close_sold_team"].sum()), int(M["close_sits_team"].sum())],
        "close_company": [int(M["close_sold_company"].sum()), int(M["close_sits_company"].sum())],
    }
    who = df["Primary Salesperson"]
    o["close_reps"] = {r: [int((M["close_sold_company"] & (who == r)).sum()), int((M["close_sits_company"] & (who == r)).sum())] for r in reps}
    if reviews is not None:
        o["reviews"] = int(((reviews["_t"] >= pd.Timestamp(s)) & (reviews["_t"] <= pd.Timestamp(e))).sum())
    return o


def _load_reviews(path):
    if path is None or not path.exists():
        return None
    rv = pd.read_csv(path, usecols=["created_utc", "stars"])
    rv = rv[rv["stars"].astype(str) == "5"].copy()
    rv["_t"] = pd.to_datetime(rv["created_utc"], utc=True).dt.tz_convert(config.TZ_NAME).dt.tz_localize(None).dt.normalize()
    return rv


def build(rr, df, as_of, scorecard_rows, reviews_path=None):
    t = pd.Timestamp(as_of).normalize()
    LS = rr.S["leadership_scorecard"]
    ninety = {m["name"]: m for m in LS["metrics"]}
    sheet = {r["metric"]: r for r in scorecard_rows}
    reps = [n for n in rr.SALES_TEAM if n not in rr.HIDDEN]
    reviews = _load_reviews(reviews_path)
    qs, qe = _quarter(t)
    q_days = _days(qs, qe)

    def per_day(metric):  # the quarter goal from the goals sheet, spread over the quarter's days
        g = (sheet.get(metric) or {}).get("q_goal")
        return g / q_days if g else None

    def rate_goal(metric):
        return (sheet.get(metric) or {}).get("q_goal")

    weekly_rev = (sheet.get("Revenue") or {}).get("weekly_goal")
    review_day = ninety["New 5-Star Google Reviews"]["goal"][1] / 7
    ar_goal = ninety["A/R 30+"]["goal"][1]
    cash_goal = ninety["Cash Balance"]["goal"][1]

    # ---- snapshots (as of the data pull)
    bl = (df["Current Milestone"] == "Approved") & df["Current Status"].isin(LS["backlog_statuses"])
    ar = (df["Current Milestone"] == "Invoiced") & (df["Invoiced Milestone Date"] <= t - pd.Timedelta(days=LS["ar_days"]))
    ca = df["Contract Amount"].fillna(0)
    backlog = round(float(ca[bl].sum()), 2)
    ar30 = round(float(ca[ar].sum()), 2)

    # ---- windows
    w_s, w_e = rr.last_week(t)
    week_hist = [(w_s - pd.Timedelta(days=7 * i), w_e - pd.Timedelta(days=7 * i)) for i in range(WEEKS - 1, -1, -1)]
    m_s = t.replace(day=1)
    month_hist = [((m_s - pd.DateOffset(months=i)), (m_s - pd.DateOffset(months=i - 1) - pd.Timedelta(days=1))) for i in range(MONTHS - 1, 0, -1)] + [(m_s, t)]
    quarter_hist = [((qs - pd.DateOffset(months=3 * i)), (qs - pd.DateOffset(months=3 * (i - 1)) - pd.Timedelta(days=1))) for i in range(QUARTERS - 1, 0, -1)] + [(qs, t)]

    def period(key, label, s, e, full_e, hist, r30):
        """r30: rates and averages use the 30 days ending e (the week view); otherwise the period itself."""
        v = _values(rr, df, s, e, reps, reviews)
        rs, re_ = rr.rolling(e, 30)
        v30 = _values(rr, df, rs, re_, reps, reviews)
        rv = v30 if r30 else v
        days_so_far, days_full = _days(s, min(e, t)), _days(s, full_e)
        hv = [(hs, he, _values(rr, df, hs, he, reps, reviews)) for hs, he in hist]
        hv30 = [(he, _values(rr, df, *rr.rolling(he, 30), reps, reviews)) for _, he in hist] if r30 else None

        def target(metric, weekly=None):
            if key == "week":
                return weekly if weekly is not None else (sheet.get(metric) or {}).get("weekly_goal")
            pd_ = per_day(metric)
            return round(pd_ * days_so_far, 2) if pd_ else None

        def full(metric):
            if key == "week":
                return (sheet.get(metric) or {}).get("weekly_goal")
            pd_ = per_day(metric)
            return round(pd_ * days_full, 2) if pd_ else None

        def hist_of(fn, rolling=False):
            if rolling and hv30 is not None:
                return [fn(x) for _, x in hv30]
            return [fn(x) for _, _, x in hv]

        tiles = []

        def add(k, label, owner, fmt, value, goal=None, status=None, sev=0.0, pace=None, goal_full=None, sub=None, hist=None, extra=None, action=None, window=None):
            tiles.append({k2: v2 for k2, v2 in {"key": k, "label": label, "owner": owner, "fmt": fmt, "value": value, "goal": goal,
                          "goal_full": goal_full, "status": status, "sev": sev, "pace": pace, "sub": sub, "hist": hist,
                          "action": action, "window": window, **(extra or {})}.items() if v2 is not None})

        # Sales
        tg = target("Appointments")
        st, sev, p = _pace(v["appts"], tg)
        add("appts", "Appointments", ninety_owner(ninety, "SQLs (Appointments)"), "count", v["appts"], tg, st, sev, p, full("Appointments"), hist=hist_of(lambda x: x["appts"]),
            action="Book more appointments. Every new lead gets a call the same day.")
        g = rate_goal("Sit Rate")
        sr = _r(v["sits"], v["appts"])
        st, sev = _status(sr, g)
        add("sit_rate", "Sit rate", ninety_owner(ninety, "SITS"), "rate", sr, g, st, sev, sub=f"{v['sits']} sits of {v['appts']} appointments",
            hist=hist_of(lambda x: _r(x["sits"], x["appts"])), action="Too many appointments are not sitting. Confirm every one the day before.")
        wk = (sheet.get("Appointments") or {}).get("weekly_goal")
        a30_s, a30_e = rr.rolling(min(e, t), 30)
        a30 = int(rr.masks(df, a30_s, a30_e)["appointments"].sum())
        g30 = round(wk / 7 * _days(a30_s, a30_e)) if wk else None
        st, sev, p = _pace(a30, g30)
        add("appts_30", "Appointments, last 30 days", ninety_owner(ninety, "SQLs (Appointments)"), "count", a30, g30, st, sev, p,
            hist=hist_of(lambda x: x["appts"], rolling=True) if r30 else None, window={"start": str(a30_s.date()), "end": str(a30_e.date())},
            action="The last 30 days of appointments are light, so sales will dip next. Push lead flow now.")
        tg = round(per_day("Sits") * days_so_far, 2) if key != "week" and per_day("Sits") else (sheet.get("Sits") or {}).get("weekly_goal")
        st, sev, p = _pace(v["demos"], tg)
        add("demos", "Demos", ninety_owner(ninety, "SITS"), "count", v["demos"], tg, st, sev, p, sub="Quoted appointments. Goal is the sits goal.",
            hist=hist_of(lambda x: x["demos"]), action="Fewer demos than goal. Fill the reps' calendars.")
        tg = target("Sales")
        st, sev, p = _pace(v["sales"], tg)
        add("sales", "Sales", ninety_owner(ninety, "Approved Experiences $"), "money", v["sales"], tg, st, sev, p, full("Sales"),
            sub="Upgrades left out, like the weekly scorecard", hist=hist_of(lambda x: x["sales"]), action="Sales are behind. Work the open quotes this week.")

        g = rate_goal("Close Rate")
        team = rv["close_team"]
        tr = _r(*team)
        st, sev = _status(tr, g)
        rep_rows = []
        for r in reps:
            n, d = rv["close_reps"][r]
            rp = _r(n, d)
            rst = _status(rp, g)[0] if d >= 5 else None  # under 5 demos is too few to grade
            rep_rows.append({"rep": r, "n": n, "d": d, "pct": rp, "status": rst})
        rep_rows.sort(key=lambda x: (x["pct"] is None, -(x["pct"] or 0)))
        low = [x["rep"] for x in rep_rows if x["status"] == "bad"]
        act = (f"{_names(low)} {'is' if len(low) == 1 else 'are'} under {round(g * 100)}%. Ride along or role-play before their next demos."
               if low else "The team is under goal. Go over last week's lost deals together.")
        add("close", "Close rate", ninety_owner(ninety, "Close Rate (R30)"), "rate", tr, g, st, sev,
            sub=f"Sales team: {team[0]} signed of {team[1]} demos",
            hist=hist_of(lambda x: _r(*x["close_team"]), rolling=r30),
            extra={"company": {"n": rv["close_company"][0], "d": rv["close_company"][1], "pct": _r(*rv["close_company"])}, "reps": rep_rows},
            action=act, window={"start": str(rs.date()), "end": str(re_.date())} if r30 else None)

        g = rate_goal("Avg Ticket")
        tk = _r(rv["sales_all"], rv["jobs_sold"])
        tk = round(tk, 2) if tk is not None else None
        inst = round(v30["revenue"] / v30["jobs_installed"], 2) if v30["jobs_installed"] else None
        st, sev = _status(tk, g)
        add("ticket", "Average ticket", ninety_owner(ninety, "AVG Ticket (R30)"), "money", tk, g, st, sev,
            sub=f"Sold jobs. Installed jobs, last 30 days: {_money(inst)}" if inst else "Sold jobs",
            hist=hist_of(lambda x: round(x["sales_all"] / x["jobs_sold"], 2) if x["jobs_sold"] else None, rolling=r30),
            extra={"installed": inst}, action="Tickets are small. Show the full system and the upgrades on every demo.",
            window={"start": str(rs.date()), "end": str(re_.date())} if r30 else None)

        # Production
        lo, hi = (3 * weekly_rev, 5 * weekly_rev) if weekly_rev else (None, None)
        weeks = round(backlog / weekly_rev, 1) if weekly_rev else None
        if lo is None:
            bst, bsev, bact = None, 0.0, None
        elif backlog < lo:
            bst, bsev, bact = "bad", round(1 - backlog / lo, 4), f"Only {weeks} weeks of work sold ahead. Sales needs to sell more."
        elif backlog > hi:
            bst, bsev, bact = "bad", round(backlog / hi - 1, 4), f"{weeks} weeks of work are waiting. Add a crew or schedule faster."
        else:
            bst, bsev, bact = "good", 0.0, None
        add("backlog", "Backlog", ninety_owner(ninety, "Backlog $"), "money", backlog, None, bst, bsev,
            extra={"weeks": weeks, "low": lo, "high": hi, "jobs": int(bl.sum()), "snap": True}, action=bact,
            sub="Sold, scheduled or in progress. Green is 3 to 5 weeks of the weekly revenue goal.")
        tg = target("Revenue")
        st, sev, p = _pace(v["revenue"], tg)
        add("revenue", "Revenue completed", ninety_owner(ninety, "Revenue $"), "money", v["revenue"], tg, st, sev, p, full("Revenue"),
            sub=f"{v['jobs_installed']} jobs installed", hist=hist_of(lambda x: x["revenue"]), action="Installs are behind goal. Check this week's crew schedule.")
        g = rate_goal("GP%")
        gp = _r(rv["gp_profit"], rv["gp_contract"])
        st, sev = _status(gp, g)
        add("gp", "Gross profit", ninety_owner(ninety, "GP% (R30)"), "pct", gp, g, st, sev,
            sub=f"{rv['gp_jobs']} jobs closed. Profit over price, on closed jobs.",
            hist=hist_of(lambda x: _r(x["gp_profit"], x["gp_contract"]), rolling=r30),
            action=f"GP is under {round((g or 0) * 100)}%. Check job costs on the jobs that closed under goal.",
            window={"start": str(rs.date()), "end": str(re_.date())} if r30 else None)

        # Money and reviews (cash is added on the page)
        st, sev = _status(ar30, ar_goal, more=False)
        add("ar30", "A/R over 30 days", ninety_owner(ninety, "A/R 30+"), "money", ar30, ar_goal, st, sev, extra={"jobs": int(ar.sum()), "snap": True, "less": True},
            sub="Invoiced more than 30 days ago", action=f"{_money(ar30)} is more than 30 days past invoice. Collect it this week.")
        if reviews is not None:
            tg = round(review_day * (7 if key == "week" else days_so_far), 1)
            st, sev, p = _pace(v["reviews"], tg)
            add("reviews", "New 5-star Google reviews", ninety_owner(ninety, "New 5-Star Google Reviews"), "count", v["reviews"], tg, st, sev, p,
                sub="All 5 locations", hist=hist_of(lambda x: x.get("reviews")), action="Few new 5-star reviews. Ask every finished job for one.")

        return {"key": key, "label": label, "start": str(pd.Timestamp(s).date()), "end": str(pd.Timestamp(e).date()),
                "days": days_so_far, "days_full": days_full,
                "hist_labels": [str(pd.Timestamp(hs).date()) for hs, _ in hist], "tiles": tiles}

    out = {
        "as_of": str(t.date()),
        "cash_goal": cash_goal,
        "cash_owner": OWNERS.get(ninety["Cash Balance"]["owner"], ""),
        "periods": {
            "week": period("week", "Last week", w_s, w_e, w_e, week_hist, True),
            "month": period("month", f"{t.strftime('%B')} so far", m_s, t, m_s + pd.DateOffset(months=1) - pd.Timedelta(days=1), month_hist, False),
            "quarter": period("quarter", f"Q{(t.month - 1) // 3 + 1} so far", qs, t, qe, quarter_hist, False),
        },
    }
    return out


def ninety_owner(ninety, name):
    return OWNERS.get((ninety.get(name) or {}).get("owner"), "")


def _names(xs):
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def _money(x):
    if x is None:
        return "-"
    return f"${x / 1e6:.2f}M" if abs(x) >= 1e6 else f"${round(x / 1e3):,}K" if abs(x) >= 1e4 else f"${x:,.0f}"


def check(rr, df, ex, rip_path, as_of, board, reviews_path=None):
    """The week boxes must equal the rules' scorecard() for the same week. Returns the differences."""
    t = pd.Timestamp(as_of).normalize()
    W = board["periods"]["week"]
    report = pd.Timestamp(W["end"]) + pd.Timedelta(days=1)
    sc = rr.scorecard(df, ex, rip_path, report_date=report, data_date=t, reviews_path=reviews_path)
    got = {r["Metric"]: r["Actual"] for _, r in sc.iterrows()}
    tile = {x["key"]: x for x in W["tiles"]}
    pairs = [("SQLs (Appointments)", tile["appts"]["value"]), ("Revenue $", tile["revenue"]["value"]),
             ("Approved Experiences $", tile["sales"]["value"]), ("Backlog $", tile["backlog"]["value"]), ("A/R 30+", tile["ar30"]["value"])]
    if "reviews" in tile:
        pairs.append(("New 5-Star Google Reviews", tile["reviews"]["value"]))
    comp = W["tiles"][[x["key"] for x in W["tiles"]].index("close")]["company"]
    if got.get("Close Rate (R30)") is not None and comp["pct"] is not None:
        pairs.append(("Close Rate (R30)", round(comp["pct"] * 100, 2)))
    if got.get("GP% (R30)") is not None and tile["gp"].get("value") is not None:
        pairs.append(("GP% (R30)", round(tile["gp"]["value"] * 100, 2)))
    bad = []
    for name, mine in pairs:
        theirs = got.get(name)
        if theirs is None or mine is None:
            continue
        if abs(float(theirs) - float(mine)) > 0.011:
            bad.append(f"{name}: scorecard {mine}, rules scorecard() {theirs}")
    return bad
