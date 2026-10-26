"""The company's Pulse settings (site/pulse.config.json), for the data job. Same file the site reads."""
import json
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
C = json.loads((SITE / "pulse.config.json").read_text())

COMPANY = C["company"]
NAME = COMPANY["name"]
CRM = C["crm"]["name"]
TZ_NAME = C.get("timezone") or "America/New_York"
TZ = ZoneInfo(TZ_NAME)
P = C.get("pipeline", {})
SELF_GEN = P.get("self_gen_source", "SELF GEN")
AT_RISK = P.get("at_risk_statuses", [])
MAIN_TRADE_WORD = P.get("main_trade_word", "main trade")
CSR_MIN = int(P.get("csr_min_appointments", 20))
OWNERS = {p["initials"]: p["name"] for p in C.get("people", {}).get("leadership", [])}
NICKNAMES = {k: v for k, v in C.get("people", {}).get("nicknames", {}).items() if not k.startswith("_")}


def page_on(key):
    return C.get("pages", {}).get(key, True) is not False


def zips():
    """content/zips.json in the shape the pipeline has always used: {"zips": {zip: [lat, lng, town]}, "background": [...],
    "regions": {zip: region}}. Zips with region OUT are outside the service area."""
    z = json.loads((SITE / C["map"]["zips_file"]).read_text())
    out = {"zips": {k: [v["lat"], v["lng"], v["town"]] for k, v in z["zips"].items()},
           "regions": {k: v["region"] for k, v in z["zips"].items()},
           "region_names": z.get("regions", []),
           "background": z.get("background", [])}
    return out


def market():
    """Optional Census market numbers by zip (content/zip_market.json). Empty when the client has none."""
    f = SITE / "content" / "zip_market.json"
    return json.loads(f.read_text()) if f.exists() else {}


def tz_short(dt):
    s = dt.strftime("%Z")
    return s[0] + "T" if len(s) == 3 and s[1] in "SD" else s
