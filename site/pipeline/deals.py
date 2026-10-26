"""Why deals got away, same-day closes, and the CSR screens.

Every count starts from rr_metrics.masks(), like the rest of the Pulse. Over the last 90 days:
  Same-day close   a sales team demo (close_sits_team) that signed the same day it was held
  Lost reasons     the Dead Lead Reason on demos that died without signing; demos still open are counted apart
  CSR numbers      appointments the CSR set (Appointment Set By): set, sat, sold and sales by each metric's own date,
                   and Demo Conversion (demos that ever signed), which the rules use to judge setters
  CSR cards        the same method as the reps' player cards (cards.py): five skills rated 40 to 99 against the CSR
                   group's average of 75, small samples pulled toward the group, POWER the weighted average; earned once
                   30 of their appointments have sat, rated on their real numbers
Customer names are never read. Jobs are identified by job number only.
"""
import re

import pandas as pd

import cards as player_cards
import config

WINDOW = 90
MIN_SAME_DAY_DEMOS = 15          # smallest sample that counts on the same-day board
CSR_MIN_APPOINTMENTS = config.CSR_MIN        # a CSR gets a screen after setting this many appointments in the last 90 days
NOT_CSRS = {"Other"}             # Appointment Set By values that are not a person
DEALS_DAYS = 30
DEALS_LIMIT = 15

CSR_SKILLS = [  # key, label, weight, kind (the reps' card curves: "rate" or "volume")
    ("booker", "Booker", 0.25, "volume"),       # appointments set
    ("converter", "Converter", 0.25, "rate"),   # their demos that signed (Demo Conversion)
    ("show", "Show Rate", 0.20, "rate"),        # appointments that sat
    ("money", "Moneymaker", 0.20, "volume"),    # sales from their appointments
    ("speed", "Speed", 0.10, "rate"),           # booked the same day the lead came in
]
CSR_PRIOR = 40       # appointments or demos of the group's rate added to each CSR's rates, as the reps' cards do with sits
CSR_DAYS, CSR_GAP_DAYS = 90, 60
CSR_MIN_DEMOS = 30   # like the sales cards (30 demos): a CSR earns a card once 30 of their appointments have sat
CSR_HOW = ("Every CSR card covers the last 90 days, and a CSR earns one once 30 of their appointments have sat, rated on "
           "their real numbers. It works like the "
           "sales cards: the CSR average is 75 in every skill, ratings run 40 to 99, and rates are pulled toward the average "
           "when there is little to go on. Booker is appointments set. Converter is the share of your demos that signed. "
           "Show Rate is appointments that sat. Moneymaker is sales from your appointments. Speed is appointments booked the "
           "same day the lead came in. POWER is the weighted average: Booker 25%, Converter 25%, Show Rate 20%, "
           "Moneymaker 20%, Speed 10%.")

# Common dead reasons, in plain words (any other reason shows as written in the CRM). "(CSR)" marks the same reason entered by a CSR; it counts with the rest.
REASONS = {
    "Went with Someone Else": "Went with someone else",
    "No Answer/No Response (Ghosted)": "Ghosted, no answer",
    "Estimated Cost was Too High": "Price too high",
    "Not Ready Yet": "Not ready yet",
    "Financing Denied": "Financing denied",
}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")


def d(x):
    return pd.Timestamp(x).strftime("%Y-%m-%d")


def rate(n, of):
    return {"n": int(n), "of": int(of), "pct": round(n / of, 4) if of else None}


def reason_label(r):
    r = re.sub(r"\s*\(CSR\)\s*$", "", str(r)).strip()
    return REASONS.get(r, r[:1].upper() + r[1:] if r else "No reason given")


def csr_cards(rr, df, as_of, csrs):
    """One card per CSR with 90 days setting appointments, rated against each other like the reps' player cards."""
    a, b = rr.rolling(as_of, CSR_DAYS)
    M = rr.masks(df, a, b)
    setter = df["Appointment Set By"]
    booked_same_day = df["Prospect Milestone Date"].dt.normalize() == df["Lead Milestone Date"].dt.normalize()
    signed = df["Approved Milestone Date"].notna()
    amt = df["Contract Amount"]
    raw, coming = {}, []
    for c in csrs:
        mine = setter == c
        start = player_cards._field_start(df.loc[mine, "Prospect Milestone Date"], b)
        if start is None:
            continue
        days = int((b - start).days + 1)
        sat_since = int((rr.masks(df, start, b)["sits"] & mine).sum())
        if sat_since < CSR_MIN_DEMOS:
            coming.append({"csr": c, "since": d(start), "days": days, "demos": sat_since, "needed": CSR_MIN_DEMOS})
            continue
        appts = M["appointments"] & mine
        demos = M["close_sits_company"] & mine
        raw[c] = {"set": int(appts.sum()), "sat": int((M["sits"] & mine).sum()), "demos": int(demos.sum()),
                  "signed": int((demos & signed).sum()), "sales": round(float(amt[M["sales"] & mine].sum()), 2),
                  "fast": int((appts & booked_same_day).sum()), "since": d(start)}
    if not raw:
        return {"window": {"days": CSR_DAYS, "start": d(a), "end": d(b)}, "how": CSR_HOW, "cards": [], "coming": coming}
    k = len(raw)
    T = {x: sum(r[x] for r in raw.values()) for x in ("set", "sat", "demos", "signed", "sales", "fast")}
    team = {"set": T["set"] / k, "sales": T["sales"] / k, "show": T["sat"] / T["set"] if T["set"] else 0,
            "converter": T["signed"] / T["demos"] if T["demos"] else 0, "speed": T["fast"] / T["set"] if T["set"] else 0, "csrs": k}

    def pulled(mine, n, avg):
        return ((mine + CSR_PRIOR * avg) / (n + CSR_PRIOR)) / avg if avg else None

    out = []
    for c, r in raw.items():
        ratio = {"booker": r["set"] / team["set"] if team["set"] else None,
                 "converter": pulled(r["signed"], r["demos"], team["converter"]),
                 "show": pulled(r["sat"], r["set"], team["show"]),
                 "money": r["sales"] / team["sales"] if team["sales"] else None,
                 "speed": pulled(r["fast"], r["set"], team["speed"])}
        skills = {key: {"label": lab, "rating": player_cards._rating(ratio[key], kind)} for key, lab, _, kind in CSR_SKILLS}
        power = int(round(sum(skills[key]["rating"] * w for key, _, w, _ in CSR_SKILLS)))
        out.append({"csr": c, "slug": slug(c), "power": power, "skills": skills,
                    "stats": {"set": r["set"], "sat": r["sat"], "demos": r["demos"], "signed": r["signed"], "sales": r["sales"],
                              "booked_same_day": r["fast"], "since": r["since"]}})
    out.sort(key=lambda x: (-x["power"], -x["stats"]["sales"]))
    place, prev = 0, None
    for i, x in enumerate(out):
        if x["power"] != prev:
            place, prev = i + 1, x["power"]
        x["rank"] = place
    return {"window": {"days": CSR_DAYS, "start": d(a), "end": d(b)}, "how": CSR_HOW, "cards": out, "coming": coming,
            "team": {kk: (round(v, 4) if isinstance(v, float) else v) for kk, v in team.items()}}


def build(rr, df, as_of, roster, people, scorecard):
    """Returns (per rep extras, same-day summary for leadership, CSR files by slug, CSR cards for leadership)."""
    as_of = pd.Timestamp(as_of).normalize()
    s90, e90 = rr.rolling(as_of, WINDOW)
    M = rr.masks(df, s90, e90)
    rep_col = df["Primary Salesperson"]
    signed_at = df["Approved Milestone Date"]
    held_at = df["Initial Appointment Date"]
    same_day = signed_at.notna() & (signed_at.dt.normalize() == held_at.dt.normalize())
    dead = df["Current Milestone"] == "Dead"
    window = {"days": WINDOW, "start": d(s90), "end": d(e90)}

    # ---- reps: same-day closes and why deals got away
    demos = M["close_sits_team"]
    team_sd = rate((demos & same_day).sum(), demos.sum())
    sd = {n: rate((demos & same_day & (rep_col == n)).sum(), (demos & (rep_col == n)).sum()) for n in roster}
    ranked = sorted([(n, v) for n, v in sd.items() if v["of"] >= MIN_SAME_DAY_DEMOS and v["n"] > 0], key=lambda x: -x[1]["pct"])
    places, prev, place = {}, None, 0
    for i, (n, v) in enumerate(ranked):
        if v["pct"] != prev:
            place, prev = i + 1, v["pct"]
        places[n] = place
    top = [{"rank": places[n], "rep": n, **v} for n, v in ranked if places[n] <= 3]

    extras = {}
    for n in roster:
        mine = demos & (rep_col == n)
        lost = mine & signed_at.isna() & dead
        reasons = df.loc[lost, "Dead Lead Reason"].fillna("").map(reason_label).value_counts()
        extras[n] = {
            "same_day": {**window, **sd[n], "team": team_sd, "rank": places.get(n), "ranked_count": len(ranked), "top": top,
                         "min_demos": MIN_SAME_DAY_DEMOS},
            "lost": {**window, "demos": int(mine.sum()), "signed": int((mine & signed_at.notna()).sum()),
                     "open": int((mine & signed_at.isna() & ~dead).sum()), "dead": int(lost.sum()),
                     "reasons": [{"reason": k, "n": int(v)} for k, v in reasons.items()]},
        }
    summary = {**window, "team": team_sd, "min_demos": MIN_SAME_DAY_DEMOS,
               "reps": [{"rep": n, "slug": slug(n), **sd[n], "rank": places.get(n)} for n in roster]}

    # ---- CSRs
    setter = df["Appointment Set By"]
    counts = setter[M["appointments"]].value_counts()
    csrs = [c for c, k in counts.items() if k >= CSR_MIN_APPOINTMENTS and c not in NOT_CSRS]
    amt = df["Contract Amount"]
    cw_s = as_of - pd.Timedelta(days=as_of.weekday())
    m0 = pd.Timestamp(as_of.year, as_of.month, 1)
    q_s = pd.Timestamp(as_of.year, ((as_of.month - 1) // 3) * 3 + 1, 1)
    periods = {"week": ("This week so far", cw_s), "month": ("Month to date", m0), "quarter": ("Quarter to date", q_s)}
    PM = {k: rr.masks(df, a, as_of) for k, (_, a) in periods.items()}
    sales_row = next((r for r in scorecard if r.get("metric") == "Sales"), {})
    hidden = set(rr.HIDDEN)

    def team_period(Mk):
        return {"sales": round(float(amt[Mk["sales"]].sum()), 2), "jobs_sold": int(Mk["jobs_sold"].sum())}

    def boards(k):
        bs = (people.get("boards") or {}).get(k) or {}
        return {key: {"label": bs[key]["label"], "fmt": bs[key]["fmt"], "note": bs[key].get("note", ""),
                      "top": [r for r in bs[key]["ranked"] if r["rank"] <= 3]}
                for key in ("sales", "jobs_sold", "close") if key in bs}

    cards = csr_cards(rr, df, as_of, csrs)
    files = {}
    for c in csrs:
        mine = setter == c
        per = {}
        for k, (label, a) in periods.items():
            Mk = PM[k]
            per[k] = {"label": label, "start": d(a), "end": d(as_of),
                      "set": int((Mk["appointments"] & mine).sum()), "sat": int((Mk["sits"] & mine).sum()),
                      "sold": int((Mk["jobs_sold"] & mine).sum()), "sales": round(float(amt[Mk["sales"] & mine].sum()), 2),
                      "team": team_period(Mk), "boards": boards(k)}
        my_demos = M["close_sits_company"] & mine
        ratings = []
        for rt, g in df.loc[my_demos, "Appointment Rating"].fillna("Not rated").groupby(df.loc[my_demos, "Appointment Rating"].fillna("Not rated")):
            idx = g.index
            ratings.append({"rating": rt, **rate(signed_at[idx].notna().sum(), len(idx))})
        order = {"hot": 0, "great": 1, "good": 2}  # AccuLynx adds an emoji ("Hot 🔥"), so sort on the word
        ratings.sort(key=lambda x: (order.get(str(x["rating"]).split(" ")[0].lower(), 9), -x["of"]))
        appts = M["appointments"] & mine
        booked_fast = appts & (df["Prospect Milestone Date"].dt.normalize() == df["Lead Milestone Date"].dt.normalize())
        dl = rr.masks(df, as_of - pd.Timedelta(days=DEALS_DAYS - 1), as_of)["sales"] & mine
        deals = []
        for i, r in df[dl].sort_values("Approved Milestone Date", ascending=False).head(DEALS_LIMIT).iterrows():
            rep = r["Primary Salesperson"] if pd.notna(r["Primary Salesperson"]) and r["Primary Salesperson"] not in hidden else ""
            deals.append({"rr": r["Job Number"] if pd.notna(r["Job Number"]) else None, "rep": rep,
                          "amount": round(float(r["Contract Amount"]), 2), "date": d(r["Approved Milestone Date"])})
        files[slug(c)] = {
            "csr": c, "slug": slug(c), "as_of": d(as_of), "periods": per,
            "conversion": {**window, **rate((my_demos & signed_at.notna()).sum(), my_demos.sum())},
            "team_conversion": {**window, **rate((M["close_sits_company"] & signed_at.notna()).sum(), M["close_sits_company"].sum())},
            "ratings": {**window, "rows": ratings},
            "booked_same_day": {**window, **rate(booked_fast.sum(), appts.sum())},
            "deals": {"days": DEALS_DAYS, "count": int(dl.sum()), "total": round(float(amt[dl].sum()), 2), "rows": deals},
            "quarter_goal": {"sales_goal": sales_row.get("q_goal"), "sales_qtd": sales_row.get("qtd"), "pacing": sales_row.get("pacing")},
            # their own card and place only, never the other CSRs' cards
            "card": {"window": cards["window"], "how": cards["how"], "count": len(cards["cards"]),
                     "me": next((x for x in cards["cards"] if x["csr"] == c), None),
                     "coming": next((x for x in cards["coming"] if x["csr"] == c), None)},
        }
    return extras, summary, files, cards
