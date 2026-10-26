"""The hot and cold meter: how many of a rep's last 10 demos turned into a sale, as a temperature.

The lines (Oct 11 2026), out of the last 10 demos:
  6 or more  On fire   (60%+)
  5          Hot       (50%)
  3 or 4     Warm      (30 to 40%, either side of the 35% close-rate goal)
  2          Cold
  0 or 1     Ice cold
  On break   no demo in the last 10 days, so a vacation never freezes someone at a level
Ten demos, not twenty and not by week: it stays current, and one signed deal moves a rep up right away.
A sale counts the way the rules count close rate: every contract signed since the 10th most recent demo, whatever day that
homeowner's demo was, capped at 10. So a rep heats up the day they sign, and never waits on recent demos to close.
Demos and sales use the rules' pulse_metrics close-rate rules (sales team, the same left-out appointment types), so the
meter matches the close rate. Days off, rain and slow weeks change nothing; only demos move it.
A rep needs 10 demos before the meter starts. Leadership sees every rep; a rep's own file only ever holds their own.
"""
import pandas as pd

WINDOW, HISTORY_DAYS, BREAK_DAYS = 10, 120, 10
LEVELS = [  # key, label, lowest count out of 10
    ("fire", "On fire", 6),
    ("hot", "Hot", 5),
    ("warm", "Warm", 3),
    ("cold", "Cold", 2),
    ("ice", "Ice cold", 0),
]
CODE = {k: str(i) for i, (k, _, _) in enumerate(reversed(LEVELS))}  # ice 0 .. fire 4, for the day strip
CODE["break"] = "b"


def level(n):
    return next(k for k, _, low in LEVELS if n >= low)


def build(rr, df, as_of, roster, slug):
    as_of = pd.Timestamp(as_of).normalize()
    m = rr.masks(df, pd.Timestamp("2000-01-01"), as_of)
    eligible = m["close_sits_team"]  # a close-rate demo, any date
    rep_col = df["Primary Salesperson"]
    signed = df["Approved Milestone Date"].dt.normalize()
    sat = df["Initial Appointment Date"].dt.normalize()
    days = pd.date_range(as_of - pd.Timedelta(days=HISTORY_DAYS - 1), as_of)
    reps = []
    for n in roster:
        mine = eligible & (rep_col == n)
        sales = signed[mine].dropna().sort_values().to_numpy()
        demos = sat[mine].dropna().sort_values().to_numpy()

        def at(day):
            upto = demos[demos <= day.to_datetime64()]
            if len(upto) < WINDOW:
                return None, len(upto), None, False
            start = upto[-WINDOW]
            sold = int(((sales >= start) & (sales <= day.to_datetime64())).sum())
            away = (day - pd.Timestamp(upto[-1])).days >= BREAK_DAYS
            return min(WINDOW, sold), len(upto), pd.Timestamp(start), away

        sold, total, start, away = at(as_of)
        strip = []
        fire_run = best_run = 0
        for d in days:
            s, _, _, off = at(d)
            k = ("break" if off else level(s)) if s is not None else None
            strip.append(CODE[k] if k else "-")
            fire_run = fire_run + 1 if k == "fire" else 0
            best_run = max(best_run, fire_run)
        row = {"rep": n, "slug": slug(n), "demos": total}
        if sold is None:
            row.update({"level": None, "needs": WINDOW - total})
        else:
            # how many days in a row they have been at today's level
            k = "break" if away else level(sold)
            run = 0
            for c in reversed(strip):
                if c != CODE[k]:
                    break
                run += 1
            row.update({"level": k, "sold": sold, "since": start.strftime("%Y-%m-%d"), "days_at_level": run})
        row.update({"strip": "".join(strip), "on_fire_days": strip.count(CODE["fire"]), "longest_on_fire": best_run})
        reps.append(row)
    order = {k: i for i, (k, _, _) in enumerate(LEVELS)} | {"break": len(LEVELS)}
    reps.sort(key=lambda r: (r["level"] is None, order.get(r["level"], 9), -(r.get("sold") or 0)))
    return {
        "as_of": as_of.strftime("%Y-%m-%d"), "window": WINDOW, "strip_start": days[0].strftime("%Y-%m-%d"),
        "levels": [{"key": k, "label": lab, "from": low} for k, lab, low in LEVELS],
        "reps": reps,
        "how": ("Out of each rep's last 10 demos, how many sold: 6 or more is On fire, 5 Hot, 3 or 4 Warm (either side of the "
                "35% goal), 2 Cold, 0 or 1 Ice cold. Every contract signed since the 10th most recent demo counts, so a rep heats "
                "up the day they sign. Only demos move it, so days off and slow weeks never cool anyone down; after 10 days "
                "with no demos it shows On break. It needs 10 demos to start."),
    }


def for_rep(meter, name):
    """A rep's own meter only. Never anyone else's level."""
    me = next((r for r in meter["reps"] if r["rep"] == name), None)
    return {k: v for k, v in meter.items() if k != "reps"} | {"me": me}
