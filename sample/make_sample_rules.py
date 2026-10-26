"""Fill in the template rulebook for the made-up sample company, so the sample run shows a finished client's rules.

Usage: python sample/make_sample_rules.py      writes sample/rules/RULES.md and MARKETING_PHILOSOPHY.md from rules/
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
s = (ROOT / "rules" / "RULES.md").read_text()
S = json.loads((ROOT / "sample" / "rules" / "settings.json").read_text())
names = {"PO": "Pat Owner", "SS": "Sam Sales", "DO": "Dana Ops", "LB": "Lee Books"}

s = s.replace("# FILL_IN: Company Name Metrics Rulebook", "# Summit Sample Roofing Metrics Rulebook")
s = re.sub(r"> Setup note:.*\n\n", "> Sample rulebook for a made-up company (Pulse Kit sample run). Every name and number is invented.\n\n", s)
s = s.replace("Our CRM: FILL_IN (the system the numbers come from, for example AccuLynx).", "Our CRM: AccuLynx (sample).")
s = s.replace("| FILL_IN: your goals sheet name. Read it live with the Google Sheets connector. Quarterly goals are the targets. |",
              "| Sample goals file (`site/content/goals.json`). Quarterly goals are the targets. |")
s = s.replace("(FILL_IN: your schedule times, or how often exports are uploaded)", "(6 AM, 10 AM, 2 PM and 5 PM Central)")
s = s.replace("**Discounts.** FILL_IN: describe your allowed discounts here, or delete this section if you don't police discounts.",
              "**Discounts.** Reps may stack Pre-season 8%, Pay in full 7% and Referral 5%, up to 20% in all. Over 20%, the rep pays half the overage.")
s = s.replace("- Goal sheet owners: FILL_IN (who owns which goal).", "- Goal owners: Sam Sales (sales goals), Dana Ops (production goals), Lee Books (money goals).")
s = s.replace("(FILL_IN: your managers, or delete)", "(Pat Owner)")
s = s.replace("FILL_IN: once your numbers match your CRM reports, record them here",
              "Sample numbers, recorded the way a client records them once their numbers match the CRM. Record them here")
s = s.replace("Owners: FILL_IN (initials = names).", "Owners: " + ", ".join(f"{k} = {v}" for k, v in names.items()) + ".")
for m in S["leadership_scorecard"]["metrics"]:
    op, g = m["goal"]
    goal = f"{g[0]:,} to {g[1]:,}" if op == "between" else f"{op} {g:,}"
    s = s.replace(f"| {m['name']} | FILL_IN | FILL_IN |", f"| {m['name']} | {m['owner']} | {goal} |")
left = [l for l in s.splitlines() if "FILL_IN" in l]
if left:
    raise SystemExit("Still FILL_IN in the sample rulebook:\n" + "\n".join(left))
(ROOT / "sample" / "rules" / "RULES.md").write_text(s)
(ROOT / "sample" / "rules" / "MARKETING_PHILOSOPHY.md").write_text(
    "# Marketing Philosophy (sample)\n\nWe judge a channel by gross profit per customer against what it costs to get one (GPPC:CAC), never by revenue. "
    "A channel needs 6 to 8 weeks, 20 to 30 sits and 10 closed jobs before we call it. Sales and marketing are one system: point to where the funnel drops, not at people.\n")
print("wrote sample/rules/RULES.md")
