"""The any-CRM connector: turn a CRM's own CSV exports into the data contract files (docs/DATA-CONTRACT.md).

Usage: python connectors/csv/convert.py --inbox <folder with the exports> --map connectors/csv/mapping.json --out <data>

mapping.json says, for each contract file, which export to read (a file name pattern) and which export column feeds
each contract column. Values can be translated (the CRM's "Sold" stage -> "Approved"), dates are turned into M/D/YY,
and money is cleaned ($ and commas). Only contract columns are written, so anything else in the export (customer
names, phones, emails, addresses) never reaches the data branch. scripts/scrub.py then masks contact details in notes.
Read only: it never talks to the CRM.
"""
import argparse
import csv
import fnmatch
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from data_contract import FILES  # noqa: E402

DATE_FORMATS = ["%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M", "%m/%d/%Y %I:%M %p",
                "%m/%d/%y %I:%M %p", "%d-%b-%Y", "%b %d, %Y"]


def to_date(v, fmt=None):
    v = (v or "").strip()
    if not v:
        return ""
    if re.match(r"^\d{1,2}/\d{1,2}/\d{2}(\s.*)?$", v) and not fmt:
        return v  # already M/D/YY, time kept
    for f in ([fmt] if fmt else []) + DATE_FORMATS:
        try:
            return datetime.strptime(v, f).strftime("%m/%d/%y")
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")).strftime("%m/%d/%y")
    except ValueError:
        raise SystemExit(f'Could not read the date "{v}". Set "date_format" for this file in mapping.json.')


def to_money(v):
    v = (v or "").strip()
    if not v:
        return ""
    neg = v.startswith("(") and v.endswith(")")
    s = re.sub(r"[^\d.\-]", "", v)
    return ("-" if neg and not s.startswith("-") else "") + s


def newest(inbox, pattern):
    hits = sorted((p for p in inbox.rglob("*") if p.is_file() and fnmatch.fnmatch(p.name.lower(), pattern.lower())), key=lambda p: p.name)
    return hits[-1] if hits else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inbox", required=True)
    ap.add_argument("--map", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    inbox, out = Path(a.inbox), Path(a.out)
    M = json.loads(Path(a.map).read_text())
    out.mkdir(parents=True, exist_ok=True)
    status_path = out / "status.json"
    status = json.loads(status_path.read_text()) if status_path.exists() else {}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    done = 0
    for target, spec in FILES.items():
        fm = M["files"].get(target)
        if not fm:
            continue
        src = newest(inbox, fm["match"])
        if not src:
            print(f"{target}: no export matching {fm['match']} in this upload, keeping the last one")
            continue
        cols = {k: v for k, v in fm.get("columns", {}).items() if not k.startswith("_")}
        kinds = {n: k for n, k, _ in spec["required"] + spec["optional"]}
        values = {k: {a: b for a, b in v.items() if not a.startswith("_")} for k, v in {**M.get("values", {}), **fm.get("values", {})}.items() if not k.startswith("_")}
        with open(src, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            raise SystemExit(f"{src.name} is empty")
        have = set(rows[0].keys())
        out_cols, missing = [], []
        for name in kinds:
            source = cols.get(name, name)
            if source in have:
                out_cols.append(name)
            elif (name, kinds[name]) in [(n, k) for n, k, _ in spec["required"]]:
                missing.append(f'"{name}" (looked for "{source}")')
                out_cols.append(name)
        if missing:
            print(f"{target}: the export has no column for " + ", ".join(missing) + ". Add them to mapping.json or the export. They are left blank.")
        with open(out / target, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(out_cols)
            for r in rows:
                line = []
                for name in out_cols:
                    v = r.get(cols.get(name, name), "") or ""
                    v = values.get(name, {}).get(v, v)
                    k = kinds[name]
                    if k == "date":
                        v = to_date(v, fm.get("date_format"))
                    elif k == "money":
                        v = to_money(v)
                    elif k == "number" and str(v).strip().endswith("%"):
                        v = str(float(str(v).strip()[:-1]) / 100)
                    line.append(v)
                w.writerow(line)
        key = {"job_export_raw_latest.csv": "job_export_raw", "Revenue_In_Progress_latest.csv": "revenue_in_progress",
               "job_expenses_latest.csv": "job_expenses_raw"}[target]
        status[key] = {"runDate": fm.get("run_date") or now, "schedule": "CSV import", "pulledAt": now, "rows": len(rows),
                       "file": "data/" + target, "source": src.name}
        print(f"{target}: {len(rows)} rows from {src.name}")
        done += 1
    if not done:
        raise SystemExit("No exports matched mapping.json. Nothing changed.")
    status_path.write_text(json.dumps(status, indent=2) + "\n")


if __name__ == "__main__":
    main()
