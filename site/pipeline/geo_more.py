"""More for the Long Island map: results by zip and lead channel, open quote dollars by zip, and Census market size.

Counts start from rr_metrics.masks(), like everything else. The map's rate is company-wide Demo Conversion (demos held
there that signed), which the rules use to judge towns. Census numbers come from zip_market.json (ACS 2020-2024, refreshed yearly by hand).
"""
import pandas as pd
import config

OPEN_DAYS = 180


def _zip_col(df, zips):
    zcol = df["Job: Location Zip Code"].astype(str).str.extract(r"(\d{5})")[0]
    inbox = zcol.map(lambda z: z in zips)  # every listed zip; OUT zips are drawn as the gray block (content/zips.json)
    return zcol, inbox.fillna(False).astype(bool)


def open_quotes(rr, df, as_of, extra=None):
    """Quoted appointments still open (Prospect, never approved) from the last OPEN_DAYS days."""
    as_of = pd.Timestamp(as_of)
    m = ((df["Current Milestone"] == "Prospect") & (df["Primary Estimate Total"] > 0) & df["Initial Appointment Date"].notna()
         & df["Approved Milestone Date"].isna() & ~df["_cb"] & ~df["_wt"].isin(rr.WT["contacts_leads_appointments_exclude"])
         & (df["Initial Appointment Date"] >= as_of - pd.Timedelta(days=OPEN_DAYS)) & (df["Initial Appointment Date"] <= as_of))
    return m if extra is None else m & extra


def build(rr, df, as_of, coords, market):
    zips = coords["zips"]
    zcol, inbox = _zip_col(df, zips)
    src = df["Parent Lead Source"].fillna("(blank)")
    amt = df["Contract Amount"]
    windows = {"30": rr.rolling(as_of, 30), "90": rr.rolling(as_of, 90), "365": rr.rolling(as_of, 365), "all": (df["Lead Milestone Date"].min(), as_of)}

    by_source = {}
    for k, (a, b) in windows.items():
        M = rr.masks(df, a, b)
        out = {}
        for key, m in (("leads", M["leads"]), ("appointments", M["appointments"]), ("sits", M["close_sits_company"]),
                       ("sold", M["demo_conv_sold_company"]), ("jobs_sold", M["jobs_sold"])):
            for (z, s), c in df[m & inbox].groupby([zcol[m & inbox], src[m & inbox]]).size().items():
                out.setdefault(z, {}).setdefault(s, {})[key] = int(c)
        sm = M["sales"] & inbox
        for (z, s), v in amt[sm].groupby([zcol[sm], src[sm]]).sum().items():
            out.setdefault(z, {}).setdefault(s, {})["sales"] = round(float(v), 2)
        by_source[k] = out

    # channels worth a filter button: every parent source with real volume in the last 12 months
    M365 = rr.masks(df, *windows["365"])
    vol = src[M365["leads"] & inbox].value_counts()
    sources = [s for s, c in vol.items() if c >= 20 and s != "(blank)"]

    om = open_quotes(rr, df, as_of) & inbox
    open_by_zip = {}
    for z, g in df[om].groupby(zcol[om]):
        open_by_zip[z] = {"count": int(len(g)), "value": round(float(g["Primary Estimate Total"].sum()), 2)}

    names = {z: v[2] for z, v in zips.items()}
    return {"by_source": by_source, "sources": sources, "open": open_by_zip, "open_days": OPEN_DAYS,
            "market": market["zips"], "market_source": market["source"], "names": names}


def for_rep(rr, df, as_of, coords, market, name):
    """What one rep's map adds: their open quote dollars by zip, plus the public Census numbers."""
    zips = coords["zips"]
    zcol, inbox = _zip_col(df, zips)
    om = open_quotes(rr, df, as_of, df["Primary Salesperson"] == name) & inbox
    open_by_zip = {}
    for z, g in df[om].groupby(zcol[om]):
        open_by_zip[z] = {"count": int(len(g)), "value": round(float(g["Primary Estimate Total"].sum()), 2)}
    return {"open": open_by_zip, "open_days": OPEN_DAYS, "market": market["zips"], "market_source": market["source"],
            "names": {z: v[2] for z, v in zips.items()}}
