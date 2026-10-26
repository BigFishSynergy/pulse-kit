"""Last line of defense: fail the build if a customer name from the export shows up anywhere in the output.

Customer names come from the export's Primary Contact: Name column (and Job Name, "JOB-1234: First Last", when the
export carries it). The CRM data stays inside the data job; only these checks read the name columns. Nothing should ever read them out, but if a future change or a Claude-written note
slips one through, the build stops and the site keeps the last good data.
"""
import re

import pandas as pd
import config

MAX_WORDS = 6


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(s).lower())).strip()


def customer_names(df, allow):
    allow = {norm(a) for a in allow}
    names = set()
    cols = [c for c in ("Primary Contact: Name", "Job Name") if c in df.columns]
    for v in pd.concat([df[c] for c in cols]).dropna().astype(str) if cols else []:
        v = norm(re.sub(r"^\s*[A-Za-z]{0,6}-?\d+\s*:\s*", "", v))
        words = v.split(" ")
        if len(v) >= 5 and 2 <= len(words) <= MAX_WORDS and v not in allow:
            names.add(v)
    return names


def strings(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def find(obj, names):
    """Paths whose text contains a customer name as a whole run of words."""
    hits = []
    for path, s in strings(obj):
        words = norm(s).split(" ")
        for size in range(2, MAX_WORDS + 1):
            for i in range(len(words) - size + 1):
                if " ".join(words[i:i + size]) in names:
                    hits.append(path)
                    break
            else:
                continue
            break
    return hits


def allow_list(rr, df, coords):
    """Names that are allowed to appear: staff (and their nicknames), lead sources, towns. Every other contact name is a customer."""
    S = rr.S
    allow = set(df["Primary Salesperson"].dropna()) | set(df["Appointment Set By"].dropna())
    allow |= set(df["Parent Lead Source"].dropna()) | set(df["Sub Lead Source"].dropna())
    allow |= {k for k in S["sales_team"] if not k.startswith("_")} | {k for k in S["not_sales_team"] if not k.startswith("_")}
    allow |= {n for k, v in S["sales_team"].items() if not k.startswith("_") and isinstance(v, list) for n in v}
    allow |= {z[2] for z in coords["zips"].values()} | {"Production team"}
    allow |= {p["name"] for p in config.C.get("people", {}).get("leadership", [])} | set(config.NICKNAMES.values())
    return allow
