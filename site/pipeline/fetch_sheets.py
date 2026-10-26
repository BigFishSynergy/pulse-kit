"""Get the quarterly goals (and the optional marketing spend sheet) ready for the data job.

Usage: python fetch_sheets.py --rules <rules folder> --out <sheets dir> [--cache <pulse-data>/inputs]

Where the goals come from is set in site/pulse.config.json (goals.source):
  file    site/content/goals.json, one block per quarter (see docs/SETUP.md step 7). No Google account needed.
  sheet   the Google Sheet whose id is in rules/settings.json goals.sheet_id: tabs Q1 to Q4, rows A1:H30, columns
          Metric | Quarter goal | Weekly goal | Actual | (anything) | Owner initials. Needs GOOGLE_SA_JSON, a service
          account key the sheet is shared with as Viewer. Without it, the last cached copy is used.
The spend sheet (goals.spend_sheet_id, optional) has a "Spend" tab (Month, then one column per spend line) and a
"Source map" tab (spend line, Parent Lead Source, Sub Lead Sources comma separated).
Writes goals_Q1.json .. goals_Q4.json (rows, the shape snapshot.py reads) and spend.json.
"""
import argparse
import json
import os
import shutil
from pathlib import Path

import config

# The metric names the Pulse looks up on the goals rows, in the order a goals sheet usually lists them.
GOAL_METRICS = ["Contacts", "Leads", "Appointments", "Sits", "Sales", "Total Jobs", "Revenue", "Upgrades ($)", "AVG Ticket",
                "Close Rate", "Booking Rate", "Sit Rate", "UG % of Rev", "GP%", "Net Profit", "5 Star Reviews"]


def rows_from_file(block):
    """{"Leads": {"quarter": 600, "weekly": 46, "actual": null, "owner": "SS"}} -> sheet-style rows."""
    rows = [["Metric", "Quarter goal", "Weekly goal", "Actual", "", "Owner"]]
    for name, g in block.items():
        if name.startswith("_"):
            continue
        fmt = lambda v: "" if v is None else (f"{v * 100:g}%" if isinstance(v, float) and v < 1 and name in ("Close Rate", "Booking Rate", "Sit Rate", "UG % of Rev", "GP%") else str(v))  # noqa: E731
        rows.append([name, fmt(g.get("quarter")), fmt(g.get("weekly")), fmt(g.get("actual")), "", g.get("owner", "")])
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rules", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cache")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cache = Path(a.cache) if a.cache else None
    G = config.C.get("goals", {})

    if G.get("source", "file") == "file":
        goals = json.loads((config.SITE / G.get("file", "content/goals.json")).read_text())
        for q in (1, 2, 3, 4):
            (out / f"goals_Q{q}.json").write_text(json.dumps(rows_from_file(goals.get(f"Q{q}", {}))))
        print("goals from", G.get("file", "content/goals.json"))
        if not G.get("spend_sheet_id"):
            return

    key = os.environ.get("GOOGLE_SA_JSON")
    if not key:
        if cache and cache.exists():
            for f in cache.glob("*.json"):
                if G.get("source") == "file" and f.name.startswith("goals_"):
                    continue
                shutil.copy(f, out / f.name)
            print(f"no GOOGLE_SA_JSON: using cached sheets ({', '.join(sorted(p.name for p in cache.glob('*.json')))})")
        else:
            print("no GOOGLE_SA_JSON and no cache: sheets are missing")
        return

    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession

    creds = service_account.Credentials.from_service_account_info(json.loads(key), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    http = AuthorizedSession(creds)

    def values(sheet, rng):
        r = http.get(f"https://sheets.googleapis.com/v4/spreadsheets/{sheet}/values/{rng}")
        r.raise_for_status()
        return r.json().get("values", [])

    if G.get("source") == "sheet":
        goals_id = json.loads((Path(a.rules) / "settings.json").read_text())["goals"]["sheet_id"]
        for q in (1, 2, 3, 4):
            (out / f"goals_Q{q}.json").write_text(json.dumps(values(goals_id, f"Q{q}!A1:H30")))
    if G.get("spend_sheet_id"):
        sid = G["spend_sheet_id"]
        (out / "spend.json").write_text(json.dumps({"spend": values(sid, "Spend!A1:Z40"), "map": values(sid, "'Source map'!A1:E60")}))
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        for f in out.glob("*.json"):
            shutil.copy(f, cache / f.name)
    print("sheets fetched live")


if __name__ == "__main__":
    main()
