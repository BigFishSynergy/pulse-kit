"""Build the map files for a company's service area: site/content/zips.json (each zip's town, region and center) and
site/public/pulse/zips.geojson (each zip's boundary), from the U.S. Census.

Usage:
  python scripts/make_zip_files.py --zips zips.csv          a CSV with columns zip,town,region (region OUT = zips the
                                                            company gets leads from but does not serve)
  python scripts/make_zip_files.py --sample                 the made-up sample area (no network needed)

Boundaries come from the Census TIGERweb service (2020 ZIP Code Tabulation Areas), public data, read only.
Optional: --market adds owner-occupied homes, home value, year built and income per zip from the Census ACS 5-year
estimates (needs a free Census API key in the CENSUS_API_KEY environment variable) into site/content/zip_market.json.
"""
import argparse
import csv
import json
import math
import os
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "site" / "content"
PUBLIC = ROOT / "site" / "public" / "pulse"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query"


def write(zips, features, regions, outside_label="Outside the service area"):
    CONTENT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (CONTENT / "zips.json").write_text(json.dumps({"regions": regions, "outside_label": outside_label, "region_word": "County",
                                                   "zips": zips, "background": []}, indent=1) + "\n")
    (PUBLIC / "zips.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"wrote {len(zips)} zips in {len(regions)} regions, {len(features)} map shapes")


def sample():
    """A hex grid of made-up zips around a made-up metro (centered near Austin, Texas, so the basemap has streets)."""
    towns = ["Cedar Hollow", "Pecan Ridge", "Bluebonnet", "Mesa Verde", "Stone Creek", "Oak Bend", "Willow Park", "Granite Falls",
             "Sunset Valley", "Prairie View", "Elm Crossing", "Red Rock", "Mill Creek", "Brushy Springs", "Lakeway Point", "Hill Top",
             "Fox Run", "Quail Hollow", "River Oaks", "Sandy Bend", "Copper Ridge", "Thistle Gap", "Deer Park", "Juniper Flats",
             "Maple Grove", "Pine Knoll", "Coyote Wells", "Shady Acres", "North Fork", "Iron Gate"]
    lat0, lng0, r = 30.27, -97.74, 0.045
    zips, feats = {}, []
    k = 0
    for row in range(6):
        for col in range(6):
            if k >= len(towns) + 2:
                break
            lat = lat0 + (2.5 - row) * r * 1.5
            lng = lng0 + (col - 2.5) * r * math.sqrt(3) * 1.15 + (r * 0.98 if row % 2 else 0)
            z = f"{99001 + k}"
            region = "OUT" if k >= len(towns) else ("North County" if row < 3 else "South County")
            town = towns[k] if k < len(towns) else f"Outside {k - len(towns) + 1}"
            zips[z] = {"town": town, "region": region, "lat": round(lat, 4), "lng": round(lng, 4)}
            ring = [[round(lng + r * 1.15 * math.cos(math.radians(a + 30)), 5), round(lat + r * math.sin(math.radians(a + 30)), 5)] for a in range(0, 361, 60)]
            feats.append({"type": "Feature", "properties": {"zip": z, "name": town}, "geometry": {"type": "Polygon", "coordinates": [ring]}})
            k += 1
    # zips outside the service area become one gray block
    out = [f for f in feats if zips[f["properties"]["zip"]]["region"] == "OUT"]
    feats = [f for f in feats if f not in out]
    if out:
        feats.append({"type": "Feature", "properties": {"zip": "city", "name": "Outside the service area", "zips": [f["properties"]["zip"] for f in out]},
                      "geometry": {"type": "MultiPolygon", "coordinates": [f["geometry"]["coordinates"] for f in out]}})
    write(zips, feats, ["North County", "South County"])
    market = {"source": "Made-up sample numbers (not Census data)", "zips": {}}
    for i, z in enumerate(zips):
        homes = 3000 + (i * 977) % 9000
        market["zips"][z] = {"homes_owned": homes, "housing_units": int(homes * 1.4), "median_value": 260000 + (i * 15731) % 380000,
                             "median_year_built": 1965 + (i * 7) % 50, "median_income": 58000 + (i * 6113) % 90000}
    (CONTENT / "zip_market.json").write_text(json.dumps(market, indent=1) + "\n")


def census(rows):
    zips, feats, regions = {}, [], []
    out_shapes = []
    for i in range(0, len(rows), 40):
        chunk = rows[i:i + 40]
        where = "ZCTA5 IN (" + ",".join(f"'{r['zip']}'" for r in chunk) + ")"
        q = urllib.parse.urlencode({"where": where, "outFields": "ZCTA5,CENTLAT,CENTLON", "outSR": 4326, "f": "geojson", "geometryPrecision": 5})
        with urllib.request.urlopen(f"{TIGER}?{q}", timeout=120) as resp:
            got = {f["properties"]["ZCTA5"]: f for f in json.load(resp)["features"]}
        for r in chunk:
            f = got.get(r["zip"])
            if not f:
                print(f"no Census boundary for {r['zip']} (a PO box zip?); left off the map")
                continue
            zips[r["zip"]] = {"town": r["town"], "region": r["region"], "lat": float(f["properties"]["CENTLAT"]), "lng": float(f["properties"]["CENTLON"])}
            if r["region"] != "OUT" and r["region"] not in regions:
                regions.append(r["region"])
            shape = {"type": "Feature", "properties": {"zip": r["zip"], "name": r["town"]}, "geometry": f["geometry"]}
            (out_shapes if r["region"] == "OUT" else feats).append(shape)
    if out_shapes:
        polys = []
        for f in out_shapes:
            g = f["geometry"]
            polys += [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        feats.append({"type": "Feature", "properties": {"zip": "city", "name": "Outside the service area", "zips": [f["properties"]["zip"] for f in out_shapes]},
                      "geometry": {"type": "MultiPolygon", "coordinates": polys}})
    write(zips, feats, regions)
    return zips


def market(zips):
    key = os.environ.get("CENSUS_API_KEY")
    if not key:
        print("CENSUS_API_KEY not set: skipping market numbers")
        return
    fields = "B25003_002E,B25001_001E,B25077_001E,B25035_001E,B19013_001E"
    out = {"source": "U.S. Census Bureau, American Community Survey 5-year estimates (B25003, B25001, B25077, B25035, B19013)", "zips": {}}
    for z in zips:
        url = f"https://api.census.gov/data/2023/acs/acs5?get={fields}&for=zip%20code%20tabulation%20area:{z}&key={key}"
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                v = json.load(resp)[1]
        except Exception as e:  # noqa: BLE001
            print(f"{z}: no market numbers ({e})")
            continue
        n = lambda x: None if x in (None, "") or float(x) < 0 else int(float(x))  # noqa: E731
        out["zips"][z] = {"homes_owned": n(v[0]), "housing_units": n(v[1]), "median_value": n(v[2]), "median_year_built": n(v[3]), "median_income": n(v[4])}
    (CONTENT / "zip_market.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"market numbers for {len(out['zips'])} zips")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--zips")
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--market", action="store_true")
    a = ap.parse_args()
    if a.sample:
        sample()
    else:
        rows = list(csv.DictReader(open(a.zips, newline="")))
        z = census(rows)
        if a.market:
            market(z)
