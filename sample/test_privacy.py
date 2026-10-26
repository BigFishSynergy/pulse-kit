"""Prove the two privacy guards work, on made-up records.

1. scripts/scrub.py drops customer name and contact columns and masks phones, emails and street addresses in notes.
2. site/pipeline/privacy.py (run inside every build) finds a customer name that slipped into the output, so the
   build stops before anything is published.
Usage: python sample/test_privacy.py      (needs pandas)
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "site" / "pipeline"))
from data_contract import scrub_csv  # noqa: E402
import privacy  # noqa: E402

raw = ("Job Number,Primary Contact: Name,Primary Contact: Phone,Customer Email,Job: Location Street,Job: Location Zip Code,Initial Lead Notes\n"
       'JOB-1,Testy Mctestface,512-555-0100,testy@example.com,12 Sample Lane,99001,"Call 512-555-0199 or mail me at a@b.com, 44 Fake Street"\n')
clean = scrub_csv(raw)
assert "Testy" not in clean and "555" not in clean and "example.com" not in clean and "Fake Street" not in clean and "Sample Lane" not in clean, clean
assert "Job: Location Zip Code" in clean and "99001" in clean
print("scrub: name, phone, email and street columns dropped; notes masked:", clean.splitlines()[1])

df = pd.DataFrame({"Primary Contact: Name": ["Testy Mctestface", "Sample Person"], "Primary Salesperson": ["Alex Rivera", "Alex Rivera"],
                   "Appointment Set By": ["Jamie Ortiz", None], "Parent Lead Source": ["GOOGLE", "META"], "Sub Lead Source": ["Google Ads", "Facebook Ads"]})
names = privacy.customer_names(df, {"Alex Rivera", "Jamie Ortiz", "GOOGLE", "META"})
leak = {"coaching": {"team": [{"who": "Alex", "win": "Closed the Testy Mctestface roof in one visit."}]}}
hits = privacy.find(leak, names)
assert hits == ["$.coaching.team[0].win"], hits
assert privacy.find({"note": "Alex Rivera closed 5 jobs."}, names) == []
print("privacy guard: a planted customer name is caught at", hits[0], "and staff names pass")
print("Privacy tests passed.")
