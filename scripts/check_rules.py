"""Safety check that runs whenever the rules change.

Fails (red X in Actions, plus an email) if:
  - settings.json is broken, or the calculation code errors, or
  - a name in settings.json does not exist anywhere in the CRM data (almost always a typo,
    which would otherwise silently match nothing and quietly change the numbers), or
  - the data files do not follow docs/DATA-CONTRACT.md (a missing column).
Usage: python scripts/check_rules.py path/to/job_export_raw_latest.csv [--rules path/to/rules]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
RULES = Path(sys.argv[sys.argv.index("--rules") + 1]) if "--rules" in sys.argv else ROOT / "rules"
if "--rules" in sys.argv:
    args.remove(str(RULES))
sys.path.insert(0, str(RULES))
sys.path.insert(0, str(ROOT / "scripts"))
import pulse_metrics as rr  # noqa: E402  (also proves settings.json is valid)
import data_contract  # noqa: E402

problems = data_contract.check_folder(Path(args[0]).parent)
df = rr.load(args[0])
S = rr.S

# Setup check: list every spot that still needs your company's info: the rules, and the connector this company uses.
connector = json.loads((ROOT / "site" / "pulse.config.json").read_text())["crm"]["connector"]
for f in sorted(list(RULES.glob("*")) + list((ROOT / "connectors" / connector).glob("*"))):
    if not f.is_file() or f.suffix not in (".md", ".json", ".py", ".mjs", ".yml"):
        continue
    for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if "FILL_IN" in line:
            problems.append(f"Still needs your info: {f.relative_to(ROOT) if f.is_relative_to(ROOT) else f} line {n}: {line.strip()[:140]}")


def must_exist(values, column, label):
    present = set(df[column].dropna().astype(str))
    for v in values:
        if v not in present:
            problems.append(f'{label}: "{v}" is not in the CRM data "{column}" column (typo?)')


NEW_REPS = set(S.get("new_reps_not_in_acculynx_yet", {}).get("names", []))
must_exist([r for r in rr.SALES_TEAM if r not in NEW_REPS], "Primary Salesperson", "sales_team")
_sp = set(df["Primary Salesperson"].dropna().astype(str))
for r in sorted(NEW_REPS):
    if r in _sp:
        print(f'NOTE: new rep "{r}" now shows up in the CRM data. Take them off new_reps_not_in_acculynx_yet.')
    elif r not in rr.SALES_TEAM:
        problems.append(f'new_reps_not_in_acculynx_yet: "{r}" is not on sales_team')
for key, values in S["dead_reasons"].items():
    if not key.startswith("_"):
        must_exist(values, "Dead Lead Reason", f"dead_reasons.{key}")
for key in ["contacts_leads_appointments_exclude", "close_rate_exclude"]:
    must_exist(S["work_types"][key], "Work Type", f"work_types.{key}")
must_exist([S["work_types"]["upgrade"]], "Work Type", "work_types.upgrade")
must_exist(S["job_categories"]["close_rate_exclude"], "Job Category", "job_categories.close_rate_exclude")
for key, values in S["flags"].items():
    if isinstance(values, list):
        must_exist(values, "Dead Lead Reason", f"flags.{key}")

# Run the math end to end so a code error shows up here, not in someone's chat.
end = df["Lead Milestone Date"].max()
start, end = rr.rolling(end, 90)
m = rr.metrics(df, start, end)
rr.flags(df, start, end)
print(f"Rolling 90 ending {end.date()}: {m}")

# Job Expenses report, if present next to the job export.
exp_path = Path(args[0]).with_name("job_expenses_latest.csv")
if exp_path.exists():
    ex = rr.load_expenses(exp_path)
    jc = rr.job_costs(ex, df, start, end)
    print(rr.cost_summary(jc)[["Jobs", "Job Value", "GP %", "Material %", "Labor %"]].to_string())
    rr.expense_flags(ex, df, start, end)
    unknown = sorted(set(ex["Job Number"]) - set(df["Job Number"].dropna()))
    if unknown:
        problems.append(f"{len(unknown)} jobs in the expenses report are missing from the job export, e.g. {unknown[:3]}")

if problems:
    print("\nPROBLEMS FOUND:\n" + "\n".join(problems))
    sys.exit(1)
print("\nRules check passed.")
