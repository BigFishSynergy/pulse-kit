"""Start a company's rules from their own CRM data, so they can go live on the defaults the same day.

Reads the job export on the data branch and the company settings (site/pulse.config.json), then fills in
rules/settings.json, rules/RULES.md and rules/MARKETING_PHILOSOPHY.md with the starting defaults applied to the names that
really exist in their CRM: the sales roster, former reps, dead reasons, work types, categories, the main trade, the job
number prefix. Every guess is written to rules/STARTING-RULES.md as a short list of plain questions for the owner to
confirm (the setup skill walks them through it). Nothing is ever sent anywhere; it only writes files in this repo.

Usage: python scripts/rules_from_data.py path/to/job_export_raw_latest.csv [--rules rules]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
RULES = Path(sys.argv[sys.argv.index("--rules") + 1]) if "--rules" in sys.argv else ROOT / "rules"
if "--rules" in sys.argv:
    args.remove(str(RULES))
export = Path(args[0])

import pandas as pd  # noqa: E402

CFG = json.loads((ROOT / "site" / "pulse.config.json").read_text())
S = json.loads((RULES / "settings.json").read_text())
sys.path.insert(0, str(RULES))
import pulse_metrics as rr  # noqa: E402  (its repaired CSV reader handles notes that spill across lines)

df = rr.load(str(export))
as_of = df["Lead Milestone Date"].max()
asked = []  # (topic, what we did, the question for the owner)


def present(col):
    return df[col].dropna().astype(str).value_counts()


# ---- people
recent = df[df["Initial Appointment Date"] >= as_of - pd.Timedelta(days=180)]
sits = recent[recent["Primary Estimate Total"] > 0]["Primary Salesperson"].dropna().value_counts()
leaders = {p["name"] for p in CFG.get("people", {}).get("leadership", [])}
team = [n for n, c in sits.items() if c >= 10 and n not in leaders]
part = [n for n, c in sits.items() if c < 10 or n in leaders]
ever = set(df["Primary Salesperson"].dropna())
former = sorted(ever - set(sits.index))
nick = {k: v for k, v in CFG.get("people", {}).get("nicknames", {}).items() if not k.startswith("_")}
S["sales_team"] = {n: [n.split(" ")[0]] + ([nick[n]] if n in nick else []) for n in team}
S["not_sales_team"] = {n: ("Leadership" if n in leaders else "Sells now and then") for n in part}
S["hidden_former_reps"] = {"_note": "Former reps. Never shown by name in rep views. Their past deals still count in company totals.", "names": former}
S["new_reps_not_in_acculynx_yet"] = {"_note": S["new_reps_not_in_acculynx_yet"].get("_note", ""), "names": []}
asked.append(("Sales roster", f"{len(team)} people with 10 or more quoted appointments in the last 180 days: {', '.join(team) or 'none'}",
              "Is everyone on this list a sales rep, and is anyone missing?"))
if part:
    asked.append(("Sells sometimes", f"Left out of close rate and rep views: {', '.join(part)}", "Should any of these count as sales reps?"))
if former:
    asked.append(("Former reps", f"No appointments in 180 days, so hidden by name (their deals still count in totals): {', '.join(former[:12])}{'...' if len(former) > 12 else ''}",
                  "Anyone here who still works for you?"))

# ---- dead reasons: the template's lists, kept only for names that exist, plus keyword matches for this CRM's own names
reasons = list(present("Dead Lead Reason").index)
T = {k: set(v) for k, v in S["dead_reasons"].items() if not k.startswith("_")}
KW = {
    "dup": re.compile(r"(?i)duplicate|dupe"),
    "test": re.compile(r"(?i)\btest\b"),
    "area": re.compile(r"(?i)area not|out of (area|service)|outside.*area|too far"),
    "trade": re.compile(r"(?i)trade not|don.?t (do|offer)|not a service we|wrong (trade|service)"),
    "bad": re.compile(r"(?i)bad lead|spam|junk|fake|wrong number|invalid"),
    "nomeet": re.compile(r"(?i)no chance to meet|no.?show|cancel+ed appointment|never met"),
    "nodmg": re.compile(r"(?i)no damage|not needed|nothing wrong"),
}


def kinds(r):
    return {k for k, rx in KW.items() if rx.search(r)}


lists = {"contacts_exclude": [], "leads_and_appointments_exclude": [], "sits_exclude": [], "close_rate_exclude": []}
unsure = []
for r in reasons:
    k = kinds(r)
    sales_side = "(sales)" in r.lower()
    put = {name for name, vals in T.items() if r in vals}
    if not put:
        if k & {"dup", "test"}:
            put |= {"contacts_exclude", "leads_and_appointments_exclude"}
        if "test" in k:
            put.add("sits_exclude")
        if k & {"area", "bad"} or ("trade" in k and not sales_side):
            put.add("leads_and_appointments_exclude")
        if "trade" in k:
            put.add("sits_exclude")
        if k & {"dup", "area", "bad", "nomeet", "nodmg"} or ("trade" in k and not sales_side):
            put.add("close_rate_exclude")
    if put and not any(r in vals for vals in T.values()):
        unsure.append(r)
    for name in put:
        lists[name].append(r)
S["dead_reasons"] = {"_note": "Matched by EXACT name. Started from the data by scripts/rules_from_data.py; see rules/STARTING-RULES.md.", **{k: sorted(v) for k, v in lists.items()}}
counted = [r for r in reasons if not any(r in v for v in lists.values())]
asked.append(("Dead reasons left out", "; ".join(f"{k.replace('_', ' ')}: {', '.join(v) or 'none'}" for k, v in lists.items()),
              "Do these look right? A reason left out of leads means those records never count as leads."))
if counted:
    asked.append(("Dead reasons that still count", ", ".join(counted[:20]), "These are real opportunities that were lost (they count everywhere). Is any of them really a bad lead, a duplicate or outside your area?"))
if unsure:
    asked.append(("Guessed from the name", ", ".join(unsure), "I placed these by their wording. Check each one."))

# ---- work types and categories
wts = list(present("Work Type").index)
upg = next((w for w in wts if re.search(r"(?i)upsell|change order|upgrade|add.?on", w)), None)
S["work_types"]["upgrade"] = upg or S["work_types"]["upgrade"]
S["work_types"]["contacts_leads_appointments_exclude"] = sorted({w for w in wts if re.search(r"(?i)^service$|service call", w)} | ({upg} if upg else set()))
S["work_types"]["close_rate_exclude"] = sorted(w for w in wts if w in set(S["work_types"]["close_rate_exclude"]) or re.search(r"(?i)^(insurance|inspection|retail|service|warranty)$", w))
S["work_types"].pop("_note", None)
asked.append(("Work types", f"Upgrade work type: {upg or 'none found'}. Left out of contacts, leads and appointments: {', '.join(S['work_types']['contacts_leads_appointments_exclude']) or 'none'}. Left out of close rate: {', '.join(S['work_types']['close_rate_exclude']) or 'none'}. All work types in the CRM: {', '.join(wts)}",
              "Which work type do you use for upsells and change orders, and which kinds of work should not count as a sales demo?"))
cats = list(present("Job Category").index)
S["job_categories"] = {"close_rate_exclude": [c for c in cats if re.search(r"(?i)property", c)]}
if not upg:
    # the rules need an upgrade work type that exists; with none, point it at a name no record has and say so
    S["work_types"]["upgrade"] = "(none)"

# ---- flags, prefix, time zone, goals, discounts, expenses, scorecard, marketing
trades = df["Job Trade Type"].dropna().astype(str).str.split(",").explode().str.strip()
main = trades[~trades.str.contains(S["call_back_text"], case=False)].value_counts().index[0] if len(trades) else S["flags"]["main_trade"]
S["flags"]["main_trade"] = main
for key in ("quoted_but_marked_not_serviced", "booked_but_should_not_be"):
    S["flags"][key] = [r for r in reasons if kinds(r) & {"area", "bad", "trade"} and "(sales)" not in r.lower()]
S["flags"].pop("_note", None)
jn = df["Job Number"].dropna().astype(str)
prefix = jn.str.extract(r"^(\D*)")[0].value_counts().index[0] if len(jn) else S["job_number_prefix"]["value"]
S["job_number_prefix"] = {"value": prefix}
S["timezone"] = {"value": CFG.get("timezone", "America/New_York")}
S["goals"] = {"sheet_id": S["goals"].get("sheet_id", ""), "original_yearly_sales_goal": S["goals"].get("original_yearly_sales_goal", 0)}
S["expenses"]["gp_goal_pct"] = S["expenses"].get("gp_goal_pct") or 35
S["expenses"].pop("_note", None)
S["discounts"] = {"_read_me": S["discounts"]["_read_me"], "allowed_pct": {}, "max_total_pct": 0, "rep_pays_share_of_overage": 0}
owners = {p["initials"] for p in CFG.get("people", {}).get("leadership", [])}
for m in S["leadership_scorecard"]["metrics"]:
    m["owner"] = m["owner"] if m["owner"] in owners else ""
S["leadership_scorecard"].pop("_note", None)
S["marketing"].pop("_note", None)
S["marketing"]["campaign_map"] = [x for x in S["marketing"]["campaign_map"] if "YOUR-SUB-LEAD-SOURCE" not in x[2]]
for k in ("sales_team", "not_sales_team"):
    S[k].pop("_note", None)
S["_read_me"] = S["_read_me"].replace("Every spot with the fill-in tag needs your company's info: replace the value, then delete that note. The check-rules Action stays red until every fill-in tag is gone. ", "")
asked += [("Gross profit goal", f"{S['expenses']['gp_goal_pct']}%", "What GP % do you aim for?"),
          ("Discounts", "Not policed", "Do reps have a discount limit? If so, which discounts and how much each?"),
          ("Main trade", main, "Is this the trade you do most?"),
          ("Scorecard goals", "No goals yet, so the scorecard shows numbers without colors", "What are your weekly goals, and who owns each scorecard line?")]
(RULES / "settings.json").write_text(json.dumps(S, indent=2, ensure_ascii=False) + "\n")

# ---- the rulebook and the marketing philosophy: fill each FILL_IN with the starting choice
co, crm = CFG["company"]["name"], CFG["crm"]["name"]
md = (RULES / "RULES.md").read_text()
md = md.replace("# FILL_IN: Company Name Metrics Rulebook", f"# {co} Metrics Rulebook")
md = re.sub(r"> Setup note:.*\n\n", "> Started from this company's own data with the Pulse Kit defaults (scripts/rules_from_data.py). Open questions: rules/STARTING-RULES.md.\n\n", md)
md = md.replace("Our CRM: FILL_IN (the system the numbers come from, for example AccuLynx).", f"Our CRM: {crm}.")
md = md.replace("| FILL_IN: your goals sheet name. Read it live with the Google Sheets connector. Quarterly goals are the targets. |",
                "| The quarterly goals (site/content/goals.json, or the goals sheet). Quarterly goals are the targets. |")
md = md.replace("(FILL_IN: your schedule times, or how often exports are uploaded)", "(the times the CRM reports run, or the uploads)")
md = md.replace("**Discounts.** FILL_IN: describe your allowed discounts here, or delete this section if you don't police discounts.", "**Discounts.** Not policed yet.")
md = md.replace("- Goal sheet owners: FILL_IN (who owns which goal).", "- Goal owners: the owner initials on each goal.")
md = md.replace("(FILL_IN: your managers, or delete)", "(leadership)")
md = md.replace("FILL_IN: once your numbers match your CRM reports, record them here", "Not recorded yet. Once your numbers match your CRM reports (scripts/prove_it.py), record them here")
md = md.replace("Owners: FILL_IN (initials = names).", "Owners: " + (", ".join(f"{p['initials']} = {p['name']}" for p in CFG["people"]["leadership"]) or "not set") + ".")
for m in S["leadership_scorecard"]["metrics"]:
    op, g = m["goal"]
    goal = "not set" if (g == 0 or g == [0, 0]) else (f"{g[0]:,} to {g[1]:,}" if op == "between" else f"{op} {g:,}")
    md = md.replace(f"| {m['name']} | FILL_IN | FILL_IN |", f"| {m['name']} | {m['owner'] or 'not set'} | {goal} |")
(RULES / "RULES.md").write_text(md)
mk = (RULES / "MARKETING_PHILOSOPHY.md").read_text()
mk = re.sub(r"FILL_IN:[^\n]*\n", "We judge a channel by gross profit per customer against what it costs to get one (GPPC:CAC), never by revenue. A channel needs 6 to 8 weeks, 20 to 30 sits and 10 closed jobs before we call it working or not. Sales and marketing are one system: point to where the funnel drops, not at people.\n", mk)
(RULES / "MARKETING_PHILOSOPHY.md").write_text(mk)

left = [f"{f.name}: {l.strip()[:100]}" for f in RULES.glob("*") if f.is_file() for l in f.read_text().splitlines() if "FILL_IN" in l]
out = [f"# Starting rules for {co}", "",
       f"Drafted from the CRM data ({len(df):,} records, newest lead {as_of.date()}) with the Pulse Kit defaults. The Pulse can go live on these. Each line below is one question for the owner; change the rule if the answer is different, then the rules check runs again.", "",
       "| Topic | What the starting rules do | Question for the owner |", "|---|---|---|"]
out += [f"| {a} | {b} | {c} |" for a, b, c in asked]
if left:
    out += ["", "Still open:", ""] + [f"- {x}" for x in left]
(RULES / "STARTING-RULES.md").write_text("\n".join(out) + "\n")
print(f"Wrote rules/settings.json, RULES.md, MARKETING_PHILOSOPHY.md and STARTING-RULES.md ({len(asked)} questions for the owner).")
if left:
    print("Still FILL_IN:\n" + "\n".join(left))
