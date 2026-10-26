"""Player cards: one power number per rep, built from six skill ratings, like the back of a sports card.

One window only: the last 90 days, every skill over the same 90 days. A rep earns a card at 30 demos (sits) since they
started ("once they have 30 demos under their belt, it's time to start rating them"; it was 90 days in
the field). Until then they show as "N of 30 demos". A rep's start is their first sit, or after their last gap of more than
60 days without a sit, so one stray early sit does not count as a start. Once a rep has a card they are rated on their real
numbers like everyone else, nothing scaled up ("we're not playing it soft").

Ratings run 40 to 99 and the team average is 75, where the team is every rep with a card. Each skill shows how far above
or below the team a rep is, on a curve that flattens near the ends, so a 90 takes being about 40% better than the team
(60% for the volume skills) and a 99 is close to out of reach.
  Closer       close rate (sales team rule)
  Moneymaker   sales dollars
  Big Ticket   average ticket
  Workhorse    sits run
  Self-Gen     self-gen leads
  Quick Close  average days from the appointment (the sit) to the signed contract, on sales signed in the last 30 days.
               Fewer days is better. It replaced an older speed skill.
Close rate, ticket and Quick Close are pulled toward the team when there is little to go on (40 sits, 8 jobs, 5 sales).
POWER is the weighted average of the six, plus the same-day modifier. Different strengths can reach the same power number.
  Same-day modifier (extra weight on closing at the table). The rep's same-day close rate, sales team
  demos in the 90 days that signed the day they were held, is rated like a skill against the team (pulled toward the
  team by 40 demos), then turned into -3 to +3 POWER: 0 at the team average, +1 at 83, +2 at 91, +3 at 99.

The record book replays the same card every Monday back to January 2023 (current team only, weeks with two or more
cards): the highest POWER ever and how long it has stood, each rep's best, and how many weeks in a row the current #1
has held the top spot.
Every count comes from the rules' pulse_metrics masks, the same numbers as the leaderboards.
"""
import math

import pandas as pd
import config


def _modifier(rating):
    """Same-day rating to POWER points: 0 at the average, one point per SAME_DAY_STEP, capped at SAME_DAY_MAX either way."""
    return int(max(-SAME_DAY_MAX, min(SAME_DAY_MAX, math.floor((rating - AVG) / SAME_DAY_STEP + 0.5))))

SKILLS = [  # key, label, weight, kind ("rate" compares to the team rate, "volume" to the team's average per rep)
    ("closer", "Closer", 0.25, "rate"),
    ("money", "Moneymaker", 0.30, "volume"),
    ("ticket", "Big Ticket", 0.20, "rate"),
    ("hustle", "Workhorse", 0.10, "volume"),
    ("rapid", "Quick Close", 0.10, "volume"),  # days spread like volumes do, so it uses the volume curve
    ("selfgen", "Self-Gen", 0.05, "volume"),
]
AVG, TOP, FLOOR = 75, 99, 40
SAME_DAY_MAX, SAME_DAY_STEP = 3, 8  # the modifier runs -3 to +3 POWER, one point per 8 rating points from the average
CURVE = {"rate": 2.5, "volume": 1.6}  # rates spread less than volumes, so a smaller edge counts for more
DAYS, GAP_DAYS, PULSE_DAYS = 90, 60, 30
MIN_DEMOS = 30  # sits since the rep's start that earn a card
PRIOR_SITS, PRIOR_JOBS, PRIOR_SALES = 40, 8, 5
HISTORY_FROM = pd.Timestamp(2023, 1, 2)  # a Monday
HOW = ("Every card covers the last 90 days, and a rep earns one at 30 demos, rated on their real numbers like everyone else. "
       "The team average is 75 in every "
       "skill. Ratings run 40 to 99 and show how far above or below the team a rep is; a 90 takes being well ahead of the "
       "team, and a 99 is close to out of reach. Quick Close is the average days from the appointment to the signed "
       "contract on sales signed in the last 30 days; fewer days rates higher. Close rate, ticket and Quick Close are pulled "
       "toward the team when there is little to go on, so one hot or cold week does not swing a card. POWER is the weighted "
       "average: Moneymaker 30%, Closer 25%, Big Ticket 20%, Workhorse 10%, Quick Close 10%, Self-Gen 5%. Then the same-day "
       "modifier adds up to 3 or takes off up to 3: it rates how often a rep's demos sign the same day they are held, "
       "against the team, and the team average adds nothing.")


def _rating(ratio, kind):
    """ratio = the rep's number over the team's. 1.0 is 75; the curve flattens toward 99 above and 40 below."""
    if ratio is None or ratio <= 0:
        return FLOOR
    t = math.tanh(CURVE[kind] * math.log(ratio))
    return int(round(max(FLOOR, min(TOP, AVG + (TOP - AVG if t > 0 else AVG - FLOOR) * t))))


def _needed(rating, kind):
    """The ratio to the team that a rating takes (the curve run backwards)."""
    t = (rating - AVG) / ((TOP - AVG) if rating >= AVG else (AVG - FLOOR))
    return math.exp(math.atanh(max(-0.999, min(0.999, t))) / CURVE[kind])


def _field_start(dates, upto):
    """First sit of the rep's current stretch as of `upto`: after their last gap of more than GAP_DAYS without a sit."""
    d = dates[dates <= upto].dropna().dt.normalize().sort_values().reset_index(drop=True)
    if not len(d):
        return None
    gaps = d.diff().dt.days
    late = gaps[gaps > GAP_DAYS]
    return d.iloc[late.index[-1]] if len(late) else d.iloc[0]


class _Cols:
    """The columns every window needs, read once."""
    def __init__(self, df, roster):
        self.rep = df["Primary Salesperson"]
        self.amt = df["Contract Amount"]
        self.parent = df["Parent Lead Source"].fillna("")
        self.sub_u = df["Sub Lead Source"].fillna("").str.upper()
        self.gap = (df["Approved Milestone Date"].dt.normalize() - df["Initial Appointment Date"].dt.normalize()).dt.days
        self.mine = {n: self.rep == n for n in roster}


def _window(rr, df, C, roster, a, b, sit_dates):
    """Cards for every rep with 30 demos since their start on day b, rated against each other, plus who is still on the way."""
    M = rr.masks(df, a, b)
    M30 = rr.masks(df, b - pd.Timedelta(days=PULSE_DAYS - 1), b)
    raw, coming = {}, []
    for n in roster:
        start = _field_start(sit_dates[n], b)
        if start is None:
            continue
        mine = C.mine[n]
        days_in = int((b - start).days + 1)
        sd = sit_dates[n].dropna().dt.normalize()
        demos = int(((sd >= start) & (sd <= b)).sum())
        if demos < MIN_DEMOS:
            coming.append({"rep": n, "since": start.strftime("%Y-%m-%d"), "days": days_in, "demos": demos, "needed": MIN_DEMOS,
                           "sits": int((M["sits"] & mine).sum()), "jobs_sold": int((M["jobs_sold"] & mine).sum())})
            continue
        g = C.gap[M["jobs_sold"] & mine].dropna()
        g = g[g >= 0]
        g30 = C.gap[M30["jobs_sold"] & mine].dropna()
        g30 = g30[g30 >= 0]
        raw[n] = {"sits": int((M["sits"] & mine).sum()), "close_sits": int((M["close_sits_team"] & mine).sum()),
                  "close_sold": int((M["close_sold_team"] & mine).sum()), "jobs_sold": int((M["jobs_sold"] & mine).sum()),
                  "sales": round(float(C.amt[M["sales"] & mine].sum()), 2),
                  "self_gen_leads": int((M["leads"] & (C.parent == config.SELF_GEN) & (mine | (C.sub_u == n.upper()))).sum()),
                  "fast": int((g <= 7).sum()), "timed": int(len(g)), "sit_to_sale_median": float(g.median()) if len(g) else None,
                  "same_day": int((M["close_sits_team"] & mine & (C.gap == 0)).sum()),
                  "days30": float(g30.sum()), "n30": int(len(g30)), "since": start.strftime("%Y-%m-%d"),
                  "demos": demos}
    if not raw:
        return [], coming, None
    T = {k: sum(r[k] for r in raw.values()) for k in ("close_sits", "close_sold", "jobs_sold", "sales", "sits", "self_gen_leads", "fast", "timed", "days30", "n30", "same_day")}
    k = len(raw)
    team = {"close": T["close_sold"] / T["close_sits"] if T["close_sits"] else 0,
            "avg_ticket": T["sales"] / T["jobs_sold"] if T["jobs_sold"] else 0,
            "sold_within_7": T["fast"] / T["timed"] if T["timed"] else 0,
            "days_to_close": T["days30"] / T["n30"] if T["n30"] else None,
            "same_day": T["same_day"] / T["close_sits"] if T["close_sits"] else 0,
            "sales": T["sales"] / k, "sits": T["sits"] / k, "self_gen_leads": T["self_gen_leads"] / k, "reps": k}

    def pulled(mine, n, avg, prior):
        """The rep's rate pulled toward the team's by `prior` worth of the team, over the team's rate."""
        return ((mine + prior * avg) / (n + prior)) / avg if avg else None

    cards = []
    for n, r in raw.items():
        ratio = {
            "closer": pulled(r["close_sold"], r["close_sits"], team["close"], PRIOR_SITS),
            "money": r["sales"] / team["sales"] if team["sales"] else None,
            "ticket": pulled(r["sales"], r["jobs_sold"], team["avg_ticket"], PRIOR_JOBS) if r["jobs_sold"] else None,
            "hustle": r["sits"] / team["sits"] if team["sits"] else None,
            "selfgen": (r["self_gen_leads"] + 1) / (team["self_gen_leads"] + 1),  # +1 keeps a handful of leads from swinging it
            # fewer days is better: the team's days over the rep's (pulled toward the team), +1 so same-day closers do not divide by zero
            "rapid": ((team["days_to_close"] + 1) / ((r["days30"] + PRIOR_SALES * team["days_to_close"]) / (r["n30"] + PRIOR_SALES) + 1)
                      if team["days_to_close"] is not None else None),
        }
        skills = {key: {"label": lab, "rating": _rating(ratio[key], kind), "vs_team": round(ratio[key], 2) if ratio[key] is not None else None}
                  for key, lab, _, kind in SKILLS}
        base = int(round(sum(skills[key]["rating"] * w for key, _, w, _ in SKILLS)))
        # same-day rates spread like volumes do (a few percent to a quarter of demos), so they use the volume curve
        sd_ratio = pulled(r["same_day"], r["close_sits"], team["same_day"], PRIOR_SITS)
        sd_rating = _rating(sd_ratio, "volume") if sd_ratio is not None else AVG
        mod = _modifier(sd_rating) if sd_ratio is not None else 0
        power = max(FLOOR, min(TOP, base + mod))
        top = sorted(skills.items(), key=lambda kv: -kv[1]["rating"])
        cards.append({
            "rep": n, "power": power, "base_power": base, "skills": skills,
            "same_day": {"n": r["same_day"], "of": r["close_sits"], "pct": round(r["same_day"] / r["close_sits"], 4) if r["close_sits"] else None,
                         "team": round(team["same_day"], 4), "rating": sd_rating, "modifier": mod},
            "power_ups": [s["label"] for _, s in top[:2] if s["rating"] >= 85],
            "stats": {"sits": r["sits"], "jobs_sold": r["jobs_sold"], "sales": r["sales"],
                      "close": {"n": r["close_sold"], "d": r["close_sits"], "pct": round(r["close_sold"] / r["close_sits"], 4) if r["close_sits"] else None},
                      "avg_ticket": round(r["sales"] / r["jobs_sold"], 2) if r["jobs_sold"] else None,
                      "sales_per_sit": round(r["sales"] / r["close_sits"], 2) if r["close_sits"] else None,
                      "self_gen_leads": r["self_gen_leads"], "sold_within_7": r["fast"], "timed": r["timed"],
                      "sit_to_sale_median": r["sit_to_sale_median"], "since": r["since"], "demos_since_start": r["demos"],
                      "days_to_close_30": round(r["days30"] / r["n30"], 1) if r["n30"] else None, "sales_30": r["n30"]},
        })
    cards.sort(key=lambda c: (-c["power"], -c["stats"]["sales"]))
    place, prev = 0, None
    for i, c in enumerate(cards):
        if c["power"] != prev:
            place, prev = i + 1, c["power"]
        c["rank"] = place
    return cards, coming, team


def _targets(team):
    """What an 85 (a power-up) and a 90 take right now, in plain numbers, from the team's 90 days. A 99 takes about
    2.5 times the team's rate or 4 times its volume, so it is not shown as a target."""
    out = []
    for key, lab, _, kind in SKILLS:
        base = {"closer": team["close"], "money": team["sales"], "ticket": team["avg_ticket"], "hustle": team["sits"],
                "selfgen": team["self_gen_leads"], "rapid": team["days_to_close"]}[key]
        if base is None:
            continue

        def at(r):
            x = _needed(r, kind)
            if key == "selfgen":
                return x * (base + 1) - 1
            if key == "rapid":
                return (base + 1) / x - 1  # days: fewer is better
            return x * base
        f85, f90 = at(85), at(90)
        ok = (lambda v: v <= 1.0) if key == "closer" else (lambda v: v >= 0) if key == "rapid" else (lambda v: True)
        out.append({"key": key, "label": lab, "kind": kind, "team": round(base, 4),
                    "for_85": round(f85, 4) if ok(f85) else None, "for_90": round(f90, 4) if ok(f90) else None})
    return out


def _rapid_board(rr, df, C, roster, as_of):
    """Appointment (sit) to signed contract, by rep, on sales signed in the last 30 days. Leadership only."""
    a, b = rr.rolling(as_of, PULSE_DAYS)
    M = rr.masks(df, a, b)
    rows = []
    for n in roster:
        g = C.gap[M["jobs_sold"] & C.mine[n]].dropna()
        g = g[g >= 0]
        if len(g):
            rows.append({"rep": n, "sales": int(len(g)), "average": round(float(g.mean()), 1), "median": float(g.median()),
                         "same_day": int((g == 0).sum()), "within_7": int((g <= 7).sum()), "over_30": int((g > 30).sum())})
    allg = C.gap[M["jobs_sold"] & C.rep.isin(roster)].dropna()
    allg = allg[allg >= 0]
    return {"start": a.strftime("%Y-%m-%d"), "end": b.strftime("%Y-%m-%d"), "rows": sorted(rows, key=lambda r: (r["sales"] < 5, r["average"], -r["sales"])),  # under 5 sales sits at the bottom
            "team": {"sales": int(len(allg)), "average": round(float(allg.mean()), 1) if len(allg) else None, "median": float(allg.median()) if len(allg) else None}}


def _record_book(rr, df, C, roster, as_of, sit_dates, now_cards):
    """Replay the card every Monday back to HISTORY_FROM, plus today: the highest POWER, each rep's best, the #1 streak.
    A week only counts when at least two reps had a card; one rep alone is #1 by default and rated against himself."""
    weeks = []
    d = HISTORY_FROM
    last_monday = as_of - pd.Timedelta(days=as_of.weekday())
    while d < last_monday:
        b = d - pd.Timedelta(days=1)  # the 90 days ending the Sunday before
        cards, _, _ = _window(rr, df, C, roster, b - pd.Timedelta(days=DAYS - 1), b, sit_dates)
        weeks.append({"week": d.strftime("%Y-%m-%d"), "cards": [(c["rep"], c["power"]) for c in cards]})
        d += pd.Timedelta(days=7)
    weeks.append({"week": as_of.strftime("%Y-%m-%d"), "cards": [(c["rep"], c["power"]) for c in now_cards], "today": True})
    weeks = [w for w in weeks if len(w["cards"]) >= 2]
    if not weeks:
        return None

    high, best, at_top = None, {}, {}
    for w in weeks:
        top = max(p for _, p in w["cards"])
        for rep, p in w["cards"]:
            if high is None or p > high["power"]:
                high = {"rep": rep, "power": p, "week": w["week"], "tied": []}
            elif p == high["power"] and rep != high["rep"] and rep not in [t["rep"] for t in high["tied"]]:
                high["tied"].append({"rep": rep, "week": w["week"]})
            if rep not in best or p > best[rep]["power"]:
                best[rep] = {"power": p, "week": w["week"]}
            if p == top:
                at_top[rep] = at_top.get(rep, 0) + 1
    high["standing_weeks"] = (as_of - pd.Timestamp(high["week"])).days // 7

    # weeks in a row at #1 for whoever holds it now (ties share the top)
    number_one = None
    if now_cards and weeks[-1].get("today"):
        holder, streak = now_cards[0]["rep"], 0
        for w in reversed(weeks):
            top = max(p for _, p in w["cards"])
            if any(r == holder and p == top for r, p in w["cards"]):
                streak += 1
            else:
                break
        number_one = {"rep": holder, "power": now_cards[0]["power"], "weeks": streak, "since": weeks[-streak]["week"]}
    return {
        "from": weeks[0]["week"], "weeks": len(weeks), "high": high,
        "best": [{"rep": r, **v} for r, v in sorted(best.items(), key=lambda kv: (-kv[1]["power"], kv[1]["week"]))],
        "number_one": number_one,
        "weeks_at_number_one": [{"rep": r, "weeks": n} for r, n in sorted(at_top.items(), key=lambda kv: -kv[1])],
        "note": "Replayed every Monday on the 90 days before it, current team only, counting weeks when two or more reps had a card. Ties share #1.",
    }


def build(rr, df, as_of, roster, slug):
    as_of = pd.Timestamp(as_of).normalize()
    C = _Cols(df, roster)
    all_sits = rr.masks(df, pd.Timestamp("2000-01-01"), as_of)["sits"]
    sit_dates = {n: df.loc[all_sits & C.mine[n], "Initial Appointment Date"] for n in roster}
    a, b = rr.rolling(as_of, DAYS)
    cards, coming, team = _window(rr, df, C, roster, a, b, sit_dates)
    for c in cards:
        c["slug"] = slug(c["rep"])
    for c in coming:
        c["slug"] = slug(c["rep"])
    win = {"start": a.strftime("%Y-%m-%d"), "end": b.strftime("%Y-%m-%d"), "cards": cards, "coming": coming,
           "rapid_board": _rapid_board(rr, df, C, roster, as_of),
           "team": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in (team or {}).items()},
           "targets": _targets(team) if team else []}
    return {"windows": {"90": win}, "weights": {k: w for k, _, w, _ in SKILLS}, "how": HOW,
            "record": _record_book(rr, df, C, roster, as_of, sit_dates, cards)}


def for_rep(cards, name):
    """What one rep sees: their own card (or when it unlocks), the top 3 power numbers, their place, and the record book."""
    w = cards["windows"]["90"]
    me = next((c for c in w["cards"] if c["rep"] == name), None)
    soon = next((c for c in w.get("coming", []) if c["rep"] == name), None)
    rec = cards.get("record")
    mine = next((x for x in rec["best"] if x["rep"] == name), None) if rec else None
    return {"windows": {"90": {"start": w["start"], "end": w["end"], "me": me, "coming": soon, "count": len(w["cards"]),
                               "top": [{"rank": c["rank"], "rep": c["rep"], "power": c["power"]} for c in w["cards"] if c["rank"] <= 3],
                               "targets": w.get("targets", [])}},
            "how": cards["how"],
            "record": {"high": rec.get("high"), "number_one": rec.get("number_one"), "my_best": mine, "from": rec.get("from")} if rec else None}
