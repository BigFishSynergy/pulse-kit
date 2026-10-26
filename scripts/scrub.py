"""Clean the data folder before anything is saved: drop customer name and contact columns, and mask phone numbers,
emails and street addresses inside notes. Runs in every connector's workflow right before the save step.

Usage: python scripts/scrub.py path/to/data
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_contract import FILES, scrub_csv  # noqa: E402

folder = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
for name in FILES:
    p = folder / name
    if p.exists():
        before = p.read_text(encoding="utf-8-sig")
        after = scrub_csv(before)
        if after != before:
            p.write_text(after, encoding="utf-8")
            print(f"{name}: cleaned")
        else:
            print(f"{name}: already clean")
