"""Build every JSON file the Pulse site reads, from the company's rules and the latest CRM data.

Usage:
  python build.py --rules <rules repo>/rules --data <rules repo data branch>/data --sheets <dir> --out <pulse-data checkout>

  --rules   the rules folder (RULES.md, settings.json, pulse_metrics.py), read fresh on every run. Never copied here.
  --data    the data folder (job_export_raw_latest.csv, Revenue_In_Progress_latest.csv, status.json), see docs/DATA-CONTRACT.md
  --sheets  goals_Q1.json .. goals_Q4.json (rows A1:H30 of each quarter tab) and spend.json ({"spend": rows, "map": rows})
  --out     where the site's data lives. Writes latest/, weeks/<week_start>/ and weeks/index.json.

Leadership numbers come from snapshot.py, unchanged from the prototype. Rep, leaderboard and production
numbers come from people.py. Both use the rules' pulse_metrics.py for every count.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
import config  # noqa: E402  site/pulse.config.json
ET = config.TZ


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), default=str))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rules", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--sheets", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rules, data, sheets, out = Path(a.rules), Path(a.data), Path(a.sheets), Path(a.out)

    status = json.loads((data / "status.json").read_text())
    run_utc = datetime.fromisoformat(status["job_export_raw"]["runDate"][:19]).replace(tzinfo=timezone.utc)
    pulled = run_utc.astimezone(ET)
    quarter = (pulled.month - 1) // 3 + 1
    goals = sheets / f"goals_Q{quarter}.json"
    spend = sheets / "spend.json"
    if not goals.exists():
        sys.exit(f"Missing {goals}. Fetch the Q{quarter} tab of the goals sheet first.")

    # ---- leadership snapshot: the prototype script, run as-is
    with tempfile.TemporaryDirectory() as tmp:
        lead_path = Path(tmp) / "leadership.json"
        cmd = [sys.executable, str(HERE / "snapshot.py"), str(rules), str(data), str(goals), str(lead_path), "zips"]
        if spend.exists():
            cmd.append(str(spend))
        subprocess.run(cmd, check=True)
        leadership = json.loads(lead_path.read_text())
        geo = json.loads((Path(tmp) / "leadership_geo.json").read_text())

    # ---- people and production views
    sys.path.insert(0, str(rules))
    import pulse_metrics as rr  # noqa: E402  the certified math, from the rules repo
    import people  # noqa: E402
    import privacy  # noqa: E402
    import geo_more  # noqa: E402
    import facts as ledger  # noqa: E402
    import cycle  # noqa: E402
    import cards as player_cards  # noqa: E402
    import costs as job_costing  # noqa: E402
    import meter as hotcold  # noqa: E402
    import deals  # noqa: E402
    import scoreboard  # noqa: E402

    df = rr.load(str(data / "job_export_raw_latest.csv"))
    coords = config.zips()
    reps, team, production = people.build(rr, df, leadership["as_of"], coords)

    # Close rate shows as rolling 30 days wherever it appears, whatever period is picked (people.CLOSE_DAYS):
    # a short quarter-to-date window catches appointments before their sales come in.
    import pandas as pd  # noqa: E402
    c_e0 = pd.Timestamp(leadership["as_of"]).normalize()
    c_s, c_e = rr.rolling(c_e0, people.CLOSE_DAYS)
    yr = lambda t: (pd.Timestamp(t) - pd.DateOffset(years=1)).normalize()  # noqa: E731
    Mc, Ml = rr.masks(df, c_s, c_e), rr.masks(df, yr(c_s), yr(c_e))
    close_rate = lambda M: people.rate(M["close_sold_team"].sum(), M["close_sits_team"].sum())  # noqa: E731
    cw = {"days": people.CLOSE_DAYS, "start": people.d(c_s), "end": people.d(c_e), "ly_start": people.d(yr(c_s)), "ly_end": people.d(yr(c_e))}
    for row in leadership.get("board", {}).get("rows", []):
        if row["metric"] == "Close Rate":
            row["values"] = {k: close_rate(Mc) for k in row["values"]}
            row["ly"] = {k: close_rate(Ml) for k in row["ly"]}
            row["window"] = cw
    for row in leadership.get("scorecard", []):
        if row["metric"] == "Close Rate":
            row["last_week"] = row["qtd"] = close_rate(Mc)
            row["window"] = cw
    leadership["close_rule"] = cw
    leadership["production"] = production
    leadership["cycle"] = cycle.build(rr, df, leadership["as_of"])
    exp_path = data / "job_expenses_latest.csv"
    exp = rr.load_expenses(str(exp_path)) if exp_path.exists() and hasattr(rr, "load_expenses") else None
    if exp is not None:
        leadership["costs"] = job_costing.build(rr, df, exp, leadership["as_of"])
    leadership["cards"] = player_cards.build(rr, df, leadership["as_of"], [n for n in rr.SALES_TEAM if n not in rr.HIDDEN], people.slug)
    leadership["meter"] = hotcold.build(rr, df, leadership["as_of"], [n for n in rr.SALES_TEAM if n not in rr.HIDDEN], people.slug)
    # Leadership Scorecard. Its week boxes must equal the rules' scorecard() (RULES.md section 13), or it is left out.
    reviews_path = data / "google_reviews_latest.csv"
    leadership["scoreboard"] = scoreboard.build(rr, df, leadership["as_of"], leadership.get("scorecard", []), reviews_path)
    rip_path = data / "Revenue_In_Progress_latest.csv"
    if exp is not None and rip_path.exists():
        off = scoreboard.check(rr, df, exp, rip_path, leadership["as_of"], leadership["scoreboard"], reviews_path)
        if off:
            print("warning: the Scorecard is left out because it does not match the scorecard rule: " + "; ".join(off))
            leadership["scoreboard"] = None
    market = config.market()
    geo.update(geo_more.build(rr, df, leadership["as_of"], coords, market))
    for r in reps.values():
        r["geo"]["background"] = coords["background"]
        r["geo"].update(geo_more.for_rep(rr, df, leadership["as_of"], coords, market, r["rep"]))
        r["cycle"] = cycle.for_rep(rr, df, leadership["as_of"], r["rep"])
        r["card"] = player_cards.for_rep(leadership["cards"], r["rep"])
        r["meter"] = hotcold.for_rep(leadership["meter"], r["rep"])
        if exp is not None:
            r["costs"] = job_costing.for_rep(rr, df, exp, leadership["as_of"], r["rep"], leadership["costs"])
    # same-day closes and why deals got away on each rep's screen; one screen per CSR
    extras, leadership["same_day"], csrs, leadership["csr_cards"] = deals.build(rr, df, leadership["as_of"], [n for n in rr.SALES_TEAM if n not in rr.HIDDEN],
                                                        team, leadership.get("scorecard", []))
    for r in reps.values():
        r.update(extras.get(r["rep"], {}))

    meta = {"as_of": leadership["as_of"], "pulled_at": leadership["pulled_at"], "pulled_iso": run_utc.isoformat(),
            "schedule": status["job_export_raw"].get("schedule"), "generated_at": leadership["generated_at"],
            "week_start": leadership["week_start"], "week_end": leadership["week_end"], "quarter": leadership["quarter"],
            "rules_commit": os.environ.get("RULES_COMMIT", ""), "spend_months": (leadership.get("marketing", {}).get("spend") or {}).get("months", [])}
    if os.environ.get("RULES_FALLBACK"):  # the newest rules broke the build; these numbers use the last rules that worked
        meta["rules_fallback"] = {"newest": os.environ["RULES_FALLBACK"], "using": os.environ.get("RULES_COMMIT", "")}

    # ---- Report Builder ledger, proven equal to rr_metrics on a spread of date ranges before anything is written
    facts = ledger.build(rr, df, coords)
    bad = ledger.verify(rr, df, facts, leadership["as_of"])
    if bad:
        sys.exit("Stopped: the Report Builder ledger does not match rr_metrics.\n" + "\n".join(bad[:20]))
    rep_facts = {slug: ledger.build(rr, df, coords, rep=r["rep"]) for slug, r in reps.items()}

    # ---- privacy guard: no customer name may appear in anything we publish
    names = privacy.customer_names(df, privacy.allow_list(rr, df, coords))
    coaching_files = sorted((out / "coaching").glob("*.json")) if (out / "coaching").exists() else []
    checks = {"leadership": leadership, "geo": geo, "people": team, "meta": meta, **{f"rep {k}": v for k, v in reps.items()},
              **{f"csr {k}": v for k, v in csrs.items()},
              "facts dims": facts["dims"], **{f"rep facts {k}": v["dims"] for k, v in rep_facts.items()},
              **{f"coaching {p.name}": json.loads(p.read_text()) for p in coaching_files}}
    leaks = [f"{k}: {p}" for k, v in checks.items() for p in privacy.find(v, names)]
    if leaks:
        sys.exit("Stopped: customer names found in the output. Nothing was written.\n" + "\n".join(leaks[:20]))

    # ---- write latest, and this week's archive (the folder freezes when the week rolls over)
    for base in (out / "latest", out / "weeks" / leadership["week_start"]):
        dump(base / "meta.json", meta)
        dump(base / "leadership.json", leadership)
        dump(base / "geo.json", geo)
        dump(base / "people.json", team)
        for slug, r in reps.items():
            dump(base / "reps" / f"{slug}.json", r)
    dump(out / "latest" / "facts.json", facts)
    for slug, c in csrs.items():
        dump(out / "latest" / "csrs" / f"{slug}.json", c)
    for slug, f in rep_facts.items():
        dump(out / "latest" / "rep-facts" / f"{slug}.json", f)
    weeks = sorted((p.name for p in (out / "weeks").iterdir() if p.is_dir()), reverse=True)
    index = []
    for w in weeks:
        m = json.loads((out / "weeks" / w / "meta.json").read_text())
        index.append({"week_start": w, "week_end": m["week_end"], "pulled_at": m["pulled_at"]})
    dump(out / "weeks" / "index.json", index)
    print(json.dumps({"as_of": meta["as_of"], "pulled_at": meta["pulled_at"], "week_start": meta["week_start"],
                      "reps": list(reps), "csrs": list(csrs), "weeks": len(index), "names_checked": len(names), "ledger_rows": facts["rows"]}))


if __name__ == "__main__":
    main()
