"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Seg, usePersist } from "./ui";
import SecHelp from "./SecHelp";
import { dfmt, money, moneyK, n0, pct } from "@/lib/pulse/format";
import { county, OUTSIDE, REGIONS } from "@/lib/pulse/county";
import { CO, CONFIG } from "@/lib/pulse/config";
import ZIPS from "@/content/zips.json";

// The service-area map. A real dark basemap (OpenFreeMap, or MapTiler satellite when a key is set), every zip drawn
// as its Census boundary, glowing neon green where results are better and raised in 3D by volume. Hover a zip to light it
// up, click it for the full story: funnel, lead channels, open quotes and the size of the market there.
// The numbers come from the hourly snapshot (the company's rules). Market numbers are public Census estimates when the
// client adds them (content/zip_market.json). Zips outside the service area (region OUT in content/zips.json) are one
// flat gray block ("city" in the shapes file) with their numbers added together, left out of the colors, rankings and totals.

type S = { leads?: number; appointments?: number; sits?: number; sold?: number; jobs_sold?: number; sales?: number; sales_jobs?: number };
type Mk = { homes_owned?: number | null; housing_units?: number | null; median_value?: number | null; median_year_built?: number | null; median_income?: number | null };
type Ctx = { zip: string; name: string; s: S | null; sAll: S | null; open: { count: number; value: number } | null; mk: Mk | null; a?: number; b?: number };
type Metric = { key: string; label: string; val: (c: Ctx) => number | null; vol: (c: Ctx) => number; fmt: (v: number) => string; unit: string; market?: boolean; diverging?: boolean };

const ROOF_LIFE = 20; // years. Used only for the labeled roof market estimate.
const YEAR = 2026;
const NEON = "#39FF14", DEEP = "#0B5A1C", COLD = "#262626", RED = "#D22B2B", CITY_GRAY = "#3A3A3A";
const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;
// The service area's bounds, from the zip centers in content/zips.json.
const ZC = Object.entries((ZIPS as any).zips as Record<string, { lat: number; lng: number; region: string }>).filter(([, v]) => v.region !== "OUT").map(([, v]) => v);
const ISLAND: [[number, number], [number, number]] = ZC.length
  ? [[Math.min(...ZC.map((v) => v.lng)) - 0.04, Math.min(...ZC.map((v) => v.lat)) - 0.04], [Math.max(...ZC.map((v) => v.lng)) + 0.04, Math.max(...ZC.map((v) => v.lat)) + 0.04]]
  : [[CONFIG.map.center[0] - 0.5, CONFIG.map.center[1] - 0.3], [CONFIG.map.center[0] + 0.5, CONFIG.map.center[1] + 0.3]];
const AREA = REGIONS.join(" and ") || CO.service_area;
const CITY = "city";
const fid = (z: string) => (z === CITY ? 1 : Number(z)); // map feature ids are numbers; no zip is 00001
// leave room on the right for the floating detail panel on wide screens
const pad = () => (typeof window !== "undefined" && window.innerWidth > 860 ? { top: 90, bottom: 30, left: 30, right: 30 } : { top: 60, bottom: 20, left: 10, right: 10 });
// phones get less tilt so the long, thin island fills the narrow frame instead of shrinking under the sky
const narrow = () => typeof window !== "undefined" && window.innerWidth < 600;
const tilt = () => (narrow() ? 35 : 55);
const STYLES: Record<string, string> = {
  night: "https://tiles.openfreemap.org/styles/dark",
  ...(MAPTILER ? { satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER}` } : {}),
};

const perK = (c: Ctx) => (c.mk?.homes_owned && c.mk.homes_owned >= 200 && c.s?.leads != null ? (1000 * (c.s.leads || 0)) / c.mk.homes_owned : null);

function metricList(rep: boolean, channel: string, ticket: number): Metric[] {
  const minSits = rep ? 3 : channel === "all" ? 5 : 3;
  const minJobs = rep ? 2 : 3;
  const ms: Metric[] = [
    { key: "close", label: "Demo conversion", unit: "sits", val: (c) => ((c.s?.sits ?? 0) >= minSits ? (c.s!.sold ?? 0) / c.s!.sits! : null), vol: (c) => c.s?.sits ?? 0, fmt: (v) => pct(v, 0) },
    { key: "booking", label: "Booking rate", unit: "leads", val: (c) => ((c.s?.leads ?? 0) >= 5 ? Math.min((c.s!.appointments ?? 0) / c.s!.leads!, 1.5) : null), vol: (c) => c.s?.leads ?? 0, fmt: (v) => pct(v, 0) },
    { key: "ticket", label: "Avg ticket", unit: "jobs", val: (c) => ((c.s?.jobs_sold ?? 0) >= minJobs ? (c.s!.sales_jobs ?? c.s!.sales ?? 0) / c.s!.jobs_sold! : null), vol: (c) => c.s?.jobs_sold ?? 0, fmt: (v) => money(v) },
    { key: "sales", label: "Sales", unit: "sales dollars", val: (c) => ((c.s?.sales ?? 0) > 0 ? c.s!.sales! : null), vol: (c) => c.s?.sales ?? 0, fmt: (v) => moneyK(v) },
    { key: "spl", label: "Sales per lead", unit: "leads", val: (c) => ((c.s?.leads ?? 0) >= 5 ? (c.s!.sales ?? 0) / c.s!.leads! : null), vol: (c) => c.s?.leads ?? 0, fmt: (v) => money(v) },
    { key: "leads", label: "Leads", unit: "leads", val: (c) => ((c.s?.leads ?? 0) > 0 ? c.s!.leads! : null), vol: (c) => c.s?.leads ?? 0, fmt: (v) => n0(v) },
    { key: "sits", label: "Sits", unit: "sits", val: (c) => ((c.s?.sits ?? 0) > 0 ? c.s!.sits! : null), vol: (c) => c.s?.sits ?? 0, fmt: (v) => n0(v) },
    { key: "open", label: "Open quotes", unit: "open quote dollars", val: (c) => (c.open?.value ? c.open.value : null), vol: (c) => c.open?.value ?? 0, fmt: (v) => moneyK(v) },
    { key: "growth", label: "Growth", unit: "sales dollars", diverging: true, val: (c) => (c.a || c.b ? (c.a ?? 0) - (c.b ?? 0) : null), vol: (c) => Math.max(c.a ?? 0, c.b ?? 0), fmt: (v) => (v >= 0 ? "+" : "") + moneyK(v) },
    { key: "reach", label: "Leads per 1,000 homes", unit: "owned homes", market: true, val: perK, vol: (c) => c.mk?.homes_owned ?? 0, fmt: (v) => v.toFixed(1) },
    { key: "roofs", label: "Roof market", unit: "owned homes", market: true, val: (c) => (c.mk?.homes_owned ? (c.mk.homes_owned / ROOF_LIFE) * ticket : null), vol: (c) => c.mk?.homes_owned ?? 0, fmt: (v) => moneyK(v) },
    { key: "value", label: "Home value", unit: "owned homes", market: true, val: (c) => c.mk?.median_value ?? null, vol: (c) => c.mk?.homes_owned ?? 0, fmt: (v) => moneyK(v) },
    { key: "age", label: "Home age", unit: "owned homes", market: true, val: (c) => (c.mk?.median_year_built ? YEAR - c.mk.median_year_built : null), vol: (c) => c.mk?.homes_owned ?? 0, fmt: (v) => `${Math.round(v)} yrs` },
  ];
  const keys = rep ? ["close", "ticket", "sales", "sits", "open", "value", "age"]
    : channel === "all" ? ["close", "booking", "ticket", "sales", "spl", "leads", "open", "growth", "reach", "roofs", "value", "age"]
    : ["close", "booking", "ticket", "sales", "spl", "leads", "reach"];
  return keys.map((k) => ms.find((m) => m.key === k)!);
}

const small = (v?: number) => (!v ? "–" : v < 1000 ? money(v) : moneyK(v));

function quantile(sorted: number[], q: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
}

export default function IslandMap({ geo, rep, title, subtitle }: { geo: any; rep?: boolean; title: string; subtitle: string }) {
  const winOpts: [string, string][] = rep ? [["90", "90 days"], ["365", "12 months"], ["all", "All time"]] : [["30", "30 days"], ["90", "90 days"], ["365", "12 months"], ["all", "All time"]];
  const [win, setWin] = usePersist(rep ? "repMapWin" : "mapWin", "365", winOpts.map((w) => w[0]));
  const [channel, setChannel] = useState("all");
  const ticket = useMemo(() => {
    const zs: Record<string, S> = geo?.windows?.["365"]?.zips ?? {};
    let s = 0, j = 0;
    Object.values(zs).forEach((z) => { s += z.sales_jobs ?? 0; j += z.jobs_sold ?? 0; });
    return j ? s / j : 15000;
  }, [geo]);
  const M = metricList(!!rep, channel, ticket);
  const [mkey, setMkey] = usePersist(rep ? "repMapMetric" : "mapMetric", "close", ["close", "booking", "ticket", "sales", "spl", "leads", "sits", "open", "growth", "reach", "roofs", "value", "age"]);
  const m = M.find((x) => x.key === mkey) ?? M[0];
  const [view, setView] = usePersist("mapView", "3d", ["3d", "flat"]);
  const [base, setBase] = usePersist("mapBase", "night", Object.keys(STYLES));
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [shapes, setShapes] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const ready = useRef(false);
  const wired = useRef(false);
  const [mapReady, setMapReady] = useState(0);

  const W = geo?.windows?.[m.key === "growth" ? "365" : win] ?? geo?.windows?.["365"];
  const names: Record<string, string> = { ...(geo?.names ?? {}), ...Object.fromEntries(Object.entries(geo?.places ?? {}).map(([z, p]: [string, any]) => [z, p[2]])) };

  // every service-area zip on the map, with this window's (and channel's) numbers; the city block added up on its own
  const [ctx, city] = useMemo((): [Record<string, Ctx>, Ctx | null] => {
    const out: Record<string, Ctx> = {};
    let cityCtx: Ctx | null = null;
    if (!shapes || !W) return [out, cityCtx];
    const cur = geo.windows["365"]?.zips ?? {}, pri = geo.prior_365?.zips ?? {};
    const one = (z: string) => (channel === "all" ? W.zips[z] ?? null : geo.by_source?.[win]?.[z]?.[channel] ?? null);
    for (const f of shapes.features) {
      const z = f.properties.zip;
      if (z === CITY) {
        const zs: string[] = f.properties.zips ?? [];
        const add = (rows: (S | null)[]) => {
          const t: S = {};
          rows.forEach((r) => r && (Object.keys(r) as (keyof S)[]).forEach((k) => (t[k] = (t[k] ?? 0) + (r[k] ?? 0))));
          return Object.keys(t).length ? t : null;
        };
        const opens = zs.map((x) => geo.open?.[x]).filter(Boolean);
        cityCtx = { zip: CITY, name: f.properties.name ?? OUTSIDE, s: add(zs.map(one)), sAll: add(zs.map((x) => W.zips[x] ?? null)), mk: null,
          open: opens.length ? { count: opens.reduce((a: number, o: any) => a + o.count, 0), value: opens.reduce((a: number, o: any) => a + o.value, 0) } : null };
        continue;
      }
      out[z] = { zip: z, name: names[z] ?? `Zip ${z}`, s: one(z), sAll: W.zips[z] ?? null, open: geo.open?.[z] ?? null, mk: geo.market?.[z] ?? null, a: cur[z]?.sales, b: pri[z]?.sales };
    }
    return [out, cityCtx];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, W, channel, win, geo]);

  const scale = useMemo(() => {
    const vals = Object.values(ctx).map((c) => m.val(c)).filter((v): v is number => v != null).sort((a, b) => a - b);
    if (m.diverging) { const a = Math.max(1, ...vals.map(Math.abs)); return { lo: -a, hi: a }; }
    let lo = quantile(vals, 0.1), hi = quantile(vals, 0.9);
    if (hi <= lo) hi = lo + 1;
    return { lo, hi };
  }, [ctx, m]);

  // load the zip shapes once
  useEffect(() => {
    fetch(CONFIG.map.shapes_file).then((r) => r.json()).then(setShapes).catch(() => setFailed(true));
  }, []);

  // build the map once, rebuild the basemap when the style changes
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!box.current) return;
      const maplibregl = (await import("maplibre-gl")).default;
      if (dead) return;
      if (mapRef.current) { ready.current = false; mapRef.current.setStyle(STYLES[base] ?? STYLES.night); mapRef.current.once("style.load", () => setMapReady((n) => n + 1)); return; }
      const map = new maplibregl.Map({
        container: box.current, style: STYLES[base] ?? STYLES.night,
        center: CONFIG.map.center, zoom: CONFIG.map.zoom, pitch: view === "3d" ? tilt() : 0, bearing: view === "3d" ? -14 : 0,
        maxBounds: [[ISLAND[0][0] - 1.5, ISLAND[0][1] - 1], [ISLAND[1][0] + 1.5, ISLAND[1][1] + 1]], attributionControl: { compact: true }, maxPitch: 75,
        // keeps the last frame so screenshots (and screen recordings) of the map are not blank
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      mapRef.current = map;
      if (process.env.NODE_ENV !== "production") (window as any).__rrmap = map;
      map.on("error", () => {});
      map.once("load", () => {
        map.fitBounds(ISLAND, { pitch: view === "3d" ? tilt() : 0, bearing: view === "3d" ? -12 : 0, padding: pad(), duration: 0 });
        setMapReady((n) => n + 1);
      });
    })().catch(() => setFailed(true));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  // feature properties for the current metric: t = 0..1 color position (-1 = not enough to judge), h = height
  const data = useMemo(() => {
    if (!shapes) return null;
    const maxVol = Math.max(1, ...Object.values(ctx).map((c) => m.vol(c)));
    return {
      type: "FeatureCollection",
      features: shapes.features.map((f: any) => {
        if (f.properties.zip === CITY) return { ...f, id: fid(CITY), properties: { zip: CITY, c: 1, t: -1, n: 0, d: 0, h: 0 } };
        const c = ctx[f.properties.zip];
        const v = c ? m.val(c) : null;
        let t = -1;
        if (v != null) t = m.diverging ? Math.max(-1, Math.min(1, v / scale.hi)) : Math.max(0, Math.min(1, (v - scale.lo) / (scale.hi - scale.lo)));
        const vol = c ? m.vol(c) : 0;
        return { ...f, id: fid(f.properties.zip), properties: { zip: f.properties.zip, c: 0, t, n: v == null ? 1 : 0, d: m.diverging ? 1 : 0, h: v == null && !vol ? 0 : 100 + 5200 * Math.sqrt(vol / maxVol) } };
      }),
    };
  }, [shapes, ctx, m, scale]);

  // draw or update the zip layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const apply = () => {
      const src = map.getSource("zips");
      if (src) { src.setData(data); return; }
      // draw above every road and boundary line, below the trailing run of place labels
      const layers: any[] = map.getStyle().layers;
      let cut = layers.length;
      while (cut > 0 && layers[cut - 1].type === "symbol") cut--;
      const firstLabel = layers[cut]?.id;
      map.addSource("zips", { type: "geojson", data });
      const isCity: any = ["==", ["get", "c"], 1];
      const color: any = ["case",
        isCity, CITY_GRAY,
        ["==", ["get", "n"], 1], "rgba(90,90,90,0.30)",
        ["==", ["get", "d"], 1], ["interpolate", ["linear"], ["get", "t"], -1, RED, 0, "#1A1A1A", 1, NEON],
        ["interpolate", ["linear"], ["get", "t"], 0, COLD, 0.45, DEEP, 1, NEON]];
      map.addLayer({ id: "zips-3d", type: "fill-extrusion", source: "zips", paint: {
        "fill-extrusion-color": ["case",
          ["boolean", ["feature-state", "hover"], false], ["case", isCity, "#5A5A5A", "#FFFFFF"],
          ["boolean", ["feature-state", "sel"], false], ["case", isCity, "#4A4A4A", "#E6E6E6"], color],
        "fill-extrusion-height": ["*", ["get", "h"], ["case", ["boolean", ["feature-state", "flat"], false], 0, 1]],
        "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.86, "fill-extrusion-vertical-gradient": true,
      } }, firstLabel);
      map.addLayer({ id: "zips-line", type: "line", source: "zips", paint: {
        "line-color": ["case", ["boolean", ["feature-state", "sel"], false], ["case", isCity, "#8A8A8A", NEON], isCity, "rgba(255,255,255,0.18)", "rgba(57,255,20,0.22)"],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.5, 0.6],
      } }, firstLabel);
      if (!STYLES.satellite || base === "night") {
        const set = (id: string, prop: string, v: any) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, v); } catch {} };
        layers.forEach((l: any) => {
          if (l.id === "water" || l.id.startsWith("water")) { if (l.type === "fill") set(l.id, "fill-color", "#050505"); }
          if (l.type === "background") set(l.id, "background-color", "#161616");
          if (l.type === "symbol") set(l.id, "text-color", "#8A8F96");
        });
      }
      try {
        map.setSky({ "sky-color": "#0A0A0A", "horizon-color": "#1A1A1A", "fog-color": "#0A0A0A", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.35, "atmosphere-blend": 0.9 });
        map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.45, position: [1.4, 200, 35] });
      } catch {}
      ready.current = true;
      flatten();
      if (wired.current) return;
      wired.current = true;
      let hov: number | null = null;
      map.on("mousemove", "zips-3d", (e: any) => {
        const f = e.features?.[0]; if (!f) return;
        if (hov != null && hov !== f.id) map.setFeatureState({ source: "zips", id: hov }, { hover: false });
        hov = f.id; map.setFeatureState({ source: "zips", id: hov }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
        setHovered(f.properties.zip);
      });
      map.on("mouseleave", "zips-3d", () => {
        if (hov != null) map.setFeatureState({ source: "zips", id: hov }, { hover: false });
        hov = null; map.getCanvas().style.cursor = ""; setHovered(null);
      });
      map.on("click", "zips-3d", (e: any) => { const f = e.features?.[0]; if (f) setSelected(f.properties.zip); });
    };
    if (!mapReady) return;
    const run = () => {
      try {
        apply();
      } catch {
        map.once("styledata", run); // style still settling after a basemap switch
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mapReady]);

  // 3D or flat
  const flatten = () => {
    const map = mapRef.current; if (!map || !shapes || !map.getSource("zips")) return;
    for (const f of shapes.features) map.setFeatureState({ source: "zips", id: fid(f.properties.zip) }, { flat: view === "flat" });
  };
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    map.easeTo({ pitch: view === "3d" ? tilt() : 0, bearing: view === "3d" ? -12 : 0, duration: 900 });
    flatten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // selected zip outline, and fly there
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.getSource("zips")) return;
    if (prevSel.current) map.setFeatureState({ source: "zips", id: fid(prevSel.current) }, { sel: false });
    if (selected) map.setFeatureState({ source: "zips", id: fid(selected) }, { sel: true });
    prevSel.current = selected;
  }, [selected, data]);
  const flyTo = (z: string) => {
    setSelected(z);
    const f = shapes?.features.find((x: any) => x.properties.zip === z);
    const map = mapRef.current;
    if (!f || !map) return;
    const pts: number[][] = (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat()).flat();
    const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: narrow() ? 40 : 120, maxZoom: 12, pitch: view === "3d" ? tilt() : 0, duration: 1200 });
  };

  if (!geo) return null;
  const look = (z: string | null) => (!z ? null : z === CITY ? city : ctx[z] ?? null);
  const pinned = look(selected), hov = look(hovered);
  const lists = buildLists(ctx, m, !!rep, channel, ticket);
  const chOpts: [string, string][] = [["all", "All channels"], ...((geo.sources ?? []) as string[]).map((s) => [s, s] as [string, string])];
  const scaleTxt = m.diverging ? "Green zips grew, red zips shrank: last 12 months of sales against the 12 months before."
    : `Brighter green is ${m.key === "age" ? "older homes" : m.key === "value" ? "pricier homes" : "better"}. Height is ${m.unit}. Gray zips have too little to judge.`;

  return (
    <section id="map" className="island">
      <div className="sechead">
        <h2>{title} <small>{subtitle}</small> <SecHelp k="map" role={rep ? "rep" : "lead"} /></h2>
        <div className="seg-row">
          <Seg label="Map view" value={view} options={[["3d", "3D"], ["flat", "Flat"]]} onChange={setView} />
          {Object.keys(STYLES).length > 1 ? <Seg label="Basemap" value={base} options={[["night", "Night"], ["satellite", "Satellite"]]} onChange={setBase} /> : null}
        </div>
      </div>
      <div className="seg-row">
        <Seg label="Time window" value={win} options={winOpts} onChange={setWin} disabled={m.key === "growth" || !!m.market && m.key !== "reach"} />
        {!rep && geo.sources?.length ? (
          <label className="chan">Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>{chOpts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
        ) : null}
      </div>
      <Seg label="Map metric" value={m.key} options={M.map((x) => [x.key, x.label] as [string, string])} onChange={setMkey} />
      <div className="stage">
        <div className="canvas">
          <div ref={box} className="gl" />
          <div className="hud">
            <span>{rep ? "My territory" : CO.service_area}</span>
            <span>{m.market ? "Census 2020-2024" : m.key === "growth" ? "12 months vs prior 12" : winOpts.find((w) => w[0] === win)?.[1]}</span>
            <span>{m.label}</span>
            {!rep ? <span>{channel === "all" ? "All channels" : channel}</span> : null}
          </div>
          <div className="legend-bar">
            <div className={`ramp ${m.diverging ? "div" : ""}`} />
            <div className="ends"><span>{m.fmt(scale.lo)}</span><span>{m.fmt(scale.hi)}</span></div>
          </div>
          {failed ? <div className="maperr">The map could not load. Check the connection and reload.</div> : null}
          {hov ? (hov.zip === CITY ? <CityCard c={hov} rep={!!rep} /> : <HoverCard c={hov} m={m} rep={!!rep} />) : null}
        </div>
        <div className="detail" aria-live="polite">
          {pinned ? <ZipPanel c={pinned} rep={!!rep} channel={channel} win={W} ticket={ticket} bySrc={rep ? null : geo.by_source?.[win]?.[pinned.zip]} openDays={geo.open_days} onClear={() => setSelected(null)} />
            : <IslandSummary ctx={ctx} rep={!!rep} channel={channel} ticket={ticket} openDays={geo.open_days} />}
        </div>
      </div>
      <p className="sub">{W && !m.market && m.key !== "growth" ? `${dfmt(W.start)} ${W.start.slice(0, 4)} to ${dfmt(W.end)} ${W.end.slice(0, 4)}. ` : ""}{scaleTxt} Drag to pan, right-drag or two fingers to tilt, click a zip for details.{rep ? " Close rate here counts your sits." : " Close rate here is company-wide."}</p>
      <div className="geolists">
        {lists.map((l) => (
          <div key={l.title}>
            <span className="label">{l.title}</span>
            {l.note ? <span className="sub">{l.note}</span> : null}
            <ul className="mini">
              {l.rows.length ? l.rows.map((r) => (
                <li key={r.zip}><button type="button" className="ziplink" onClick={() => flyTo(r.zip)}>{r.name} <span className="sub">{r.zip}{county(r.zip) ? ` · ${county(r.zip)}` : ""}</span></button><span className="num">{r.value}</span></li>
              )) : <li><span className="sub">Nothing qualifies in this view.</span></li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="explain">
        Roof market is an estimate, not a count: owner-occupied homes divided by a {ROOF_LIFE}-year roof life, times the company&apos;s 12-month average ticket ({money(ticket)}). Homes, home values, home age and income are U.S. Census American Community Survey 2020-2024 estimates by zip. Ad spend is tracked by vendor and month, not by zip, so pull-back calls here come from what each zip&apos;s leads turned into.
        {" "}{OUTSIDE} is one gray block: the company works {AREA}, so those zips&apos; numbers are added together there and left out of the colors, rankings and totals.
        {!rep && geo.no_zip_records != null ? ` ${n0(geo.no_zip_records)} records have no zip code and ${n0(geo.outside_records)} have a zip not on the zip list, so they are left off the map.` : ""}
      </p>
    </section>
  );
}

type ListRow = { zip: string; name: string; value: React.ReactNode };

function buildLists(ctx: Record<string, Ctx>, m: Metric, rep: boolean, channel: string, ticket: number): { title: string; note?: string; rows: ListRow[] }[] {
  const all = Object.values(ctx);
  const row = (c: Ctx, value: React.ReactNode): ListRow => ({ zip: c.zip, name: c.name, value });
  const top = all.map((c) => ({ c, v: m.val(c) })).filter((x) => x.v != null).sort((a, b) => b.v! - a.v!).slice(0, 5).map((x) => row(x.c, m.fmt(x.v!)));
  const cr = (c: Ctx) => (c.s?.sits ? (c.s.sold ?? 0) / c.s.sits : null);
  if (rep) {
    const best = all.filter((c) => (c.s?.sits ?? 0) >= 3).sort((a, b) => cr(b)! - cr(a)! || (b.s?.sales ?? 0) - (a.s?.sales ?? 0)).slice(0, 5).map((c) => row(c, <>{pct(cr(c), 0)} <span className="sub">({c.s!.sold ?? 0} of {c.s!.sits})</span></>));
    const open = all.filter((c) => c.open?.value).sort((a, b) => b.open!.value - a.open!.value).slice(0, 5).map((c) => row(c, <>{money(c.open!.value)} <span className="sub">({c.open!.count})</span></>));
    return [{ title: `Top 5 by ${m.label.toLowerCase()}`, rows: top }, { title: "Where you close best", note: "At least 3 sits", rows: best }, { title: "Open quotes by town", note: "Money still on the table", rows: open }];
  }
  const minSits = channel === "all" ? 8 : 5;
  const withCr = all.filter((c) => (c.s?.sits ?? 0) >= minSits);
  const leadsSorted = all.map((c) => c.s?.leads ?? 0).filter(Boolean).sort((a, b) => a - b);
  const med = quantile(leadsSorted, 0.5);
  const sitsAll = all.reduce((a, c) => a + (c.s?.sits ?? 0), 0), soldAll = all.reduce((a, c) => a + (c.s?.sold ?? 0), 0);
  const base = sitsAll ? soldAll / sitsAll : 0;
  const dbl = withCr.filter((c) => (c.s?.leads ?? 0) <= Math.max(med * 2, 10) && cr(c)! > base).sort((a, b) => cr(b)! - cr(a)! || (b.s?.sales ?? 0) - (a.s?.sales ?? 0)).slice(0, 5)
    .map((c) => row(c, <>{pct(cr(c), 0)} <span className="sub">({c.s!.sold ?? 0} of {c.s!.sits})</span></>));
  const fix = withCr.filter((c) => (c.s?.sits ?? 0) >= minSits + 2).sort((a, b) => cr(a)! - cr(b)!).slice(0, 5)
    .map((c) => row(c, <>{pct(cr(c), 0)} <span className="sub">({c.s!.sold ?? 0} of {c.s!.sits})</span></>));
  const minLeads = channel === "all" ? 15 : 8;
  const spl = (c: Ctx) => (c.s?.sales ?? 0) / (c.s?.leads || 1);
  const pull = all.filter((c) => (c.s?.leads ?? 0) >= minLeads).sort((a, b) => spl(a) - spl(b) || (b.s!.leads ?? 0) - (a.s!.leads ?? 0)).slice(0, 5)
    .map((c) => row(c, <>{money(spl(c))}/lead <span className="sub">({c.s!.leads} leads, {c.s!.jobs_sold ?? 0} sold)</span></>));
  const reach = all.map((c) => ({ c, r: perK({ ...c, s: c.sAll }) })).filter((x) => x.r != null);
  const medReach = quantile(reach.map((x) => x.r!).sort((a, b) => a - b), 0.5);
  const untapped = reach.filter((x) => x.r! < medReach && (x.c.mk?.homes_owned ?? 0) >= 2000)
    .sort((a, b) => (b.c.mk!.homes_owned ?? 0) * (YEAR - (b.c.mk!.median_year_built ?? YEAR)) - (a.c.mk!.homes_owned ?? 0) * (YEAR - (a.c.mk!.median_year_built ?? YEAR))).slice(0, 5)
    .map((x) => row(x.c, <>{moneyK(((x.c.mk!.homes_owned ?? 0) / ROOF_LIFE) * ticket)}/yr <span className="sub">({n0(x.c.mk!.homes_owned)} homes, {x.r!.toFixed(1)} leads per 1,000)</span></>));
  const ch = channel === "all" ? "" : ` (${channel})`;
  return [
    { title: `Top 5 by ${m.label.toLowerCase()}${ch}`, rows: top },
    { title: `Double down${ch}`, note: `Close rate above the map's ${pct(base, 0)}, room for more leads`, rows: dbl },
    { title: `Look closer${ch}`, note: "Lots of sits, low close rate", rows: fix },
    { title: `Pull back${ch}`, note: `At least ${minLeads} leads, lowest sales per lead. Candidates to drop from zip-targeted ads.`, rows: pull },
    { title: "Untapped", note: "Lots of owned, older homes, few leads from any channel. Room to grow.", rows: untapped },
  ];
}

function HoverCard({ c, m, rep }: { c: Ctx; m: Metric; rep: boolean }) {
  const v = m.val(c);
  return (
    <div className="hovercard">
      <span className="label">{c.zip}{county(c.zip) ? ` · ${county(c.zip)}` : ""}</span>
      <strong>{c.name}</strong>
      <span className="big num">{v == null ? "–" : m.fmt(v)}</span>
      <span className="sub">{m.label}</span>
      <span className="sub">
        {!rep ? `${n0(c.s?.leads ?? 0)} leads · ` : ""}{n0(c.s?.sold ?? 0)} of {n0(c.s?.sits ?? 0)} sits sold · {moneyK(c.s?.sales ?? 0)} sales
        {c.open?.value ? ` · ${moneyK(c.open.value)} open` : ""}
      </span>
      <span className="sub">Click for the full story</span>
    </div>
  );
}

function Funnel({ s }: { s: S | null }) {
  if (!s) return <p className="sub">No leads here in this window.</p>;
  const rows: [string, React.ReactNode][] = [
    ["Leads", n0(s.leads ?? 0)],
    ["Appointments", <>{n0(s.appointments ?? 0)} <span className="sub">{s.leads ? pct((s.appointments ?? 0) / s.leads, 0) + " booked" : ""}</span></>],
    ["Sits", n0(s.sits ?? 0)],
    ["Sold", <>{n0(s.sold ?? 0)} <span className="sub">{s.sits ? pct((s.sold ?? 0) / s.sits, 0) + " close" : ""}</span></>],
    ["Sales", money(s.sales ?? 0)],
    ["Avg ticket", s.jobs_sold ? money((s.sales_jobs ?? s.sales ?? 0) / s.jobs_sold) : "–"],
    ["Sales per lead", s.leads ? money((s.sales ?? 0) / s.leads) : "–"],
  ];
  return <dl className="facts2">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>;
}

function MarketFacts({ mk, s, ticket }: { mk: Mk | null; s: S | null; ticket: number }) {
  if (!mk) return null;
  const roofs = mk.homes_owned ? (mk.homes_owned / ROOF_LIFE) * ticket : null;
  const rows: [string, string][] = [
    ["Owned homes", n0(mk.homes_owned)],
    ["Median home value", money(mk.median_value)],
    ["Median year built", mk.median_year_built ? `${mk.median_year_built} (${YEAR - mk.median_year_built} yrs)` : "–"],
    ["Median household income", money(mk.median_income)],
    ["Roof market, estimate", roofs ? `${moneyK(roofs)} a year` : "–"],
  ];
  if (mk.homes_owned && s?.leads != null) rows.push(["Leads per 1,000 homes", ((1000 * (s.leads || 0)) / mk.homes_owned).toFixed(1)]);
  return <dl className="facts2">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>;
}

function ZipPanel({ c, rep, channel, win, ticket, bySrc, openDays, onClear }: { c: Ctx; rep: boolean; channel: string; win: any; ticket: number; bySrc: Record<string, S> | null; openDays: number; onClear: () => void }) {
  const chans = bySrc ? Object.entries(bySrc).filter(([, v]) => (v.leads ?? 0) > 0).sort((a, b) => (b[1].sales ?? 0) - (a[1].sales ?? 0) || (b[1].leads ?? 0) - (a[1].leads ?? 0)) : [];
  const isCity = c.zip === CITY;
  return (
    <div className="zp">
      <div>
        <span className="label">{isCity ? "Outside the service area" : `${c.zip}${county(c.zip) ? ` · ${county(c.zip)}` : ""}`}</span><h3>{c.name}</h3>
        {win ? <span className="sub">{dfmt(win.start)} {win.start.slice(0, 4)} to {dfmt(win.end)} {win.end.slice(0, 4)}{channel !== "all" ? ` · ${channel} only` : ""}</span> : null}
        <Funnel s={c.s} />
        <button type="button" className="link" onClick={onClear}>Back to the whole map</button>
      </div>
      {c.open?.value ? <div className="openq"><span className="label">Open quotes</span><span className="big num">{money(c.open.value)}</span><span className="sub">{c.open.count} quoted appointment{c.open.count === 1 ? "" : "s"} from the last {openDays} days, not sold yet</span></div> : null}
      {!rep && chans.length ? (
        <div>
          <span className="label">Lead channels here</span>
          <table className="tight"><thead><tr><th>Channel</th><th className="r">Leads</th><th className="r">Close</th><th className="r">Sales</th></tr></thead>
            <tbody>{chans.slice(0, 8).map(([k, v]) => (
              <tr key={k} className={k === channel ? "on" : ""}><td>{k}</td><td className="r num">{n0(v.leads)}</td><td className="r num">{v.sits ? `${n0(v.sold ?? 0)}/${n0(v.sits)}` : "–"}</td><td className="r num">{small(v.sales)}</td></tr>
            ))}</tbody></table>
        </div>
      ) : null}
      {isCity ? <div><span className="label">Why it is gray</span><p className="sub">The company works {AREA}. These zips are added together here, kept off the colors, rankings and totals.</p></div>
        : <div><span className="label">The market here</span><MarketFacts mk={c.mk} s={c.s} ticket={ticket} /></div>}
    </div>
  );
}

function CityCard({ c, rep }: { c: Ctx; rep: boolean }) {
  return (
    <div className="hovercard">
      <span className="label">Outside the service area</span>
      <strong>{c.name}</strong>
      <span className="sub">
        {!rep ? `${n0(c.s?.leads ?? 0)} leads · ` : ""}{n0(c.s?.sold ?? 0)} of {n0(c.s?.sits ?? 0)} sits sold · {moneyK(c.s?.sales ?? 0)} sales
      </span>
      <span className="sub">All five boroughs together. Click for the numbers.</span>
    </div>
  );
}

function IslandSummary({ ctx, rep, channel, ticket, openDays }: { ctx: Record<string, Ctx>; rep: boolean; channel: string; ticket: number; openDays: number }) {
  const all = Object.values(ctx);
  const sum = (f: (c: Ctx) => number) => all.reduce((a, c) => a + f(c), 0);
  const leads = sum((c) => c.s?.leads ?? 0), sales = sum((c) => c.s?.sales ?? 0), sits = sum((c) => c.s?.sits ?? 0), sold = sum((c) => c.s?.sold ?? 0);
  const open = sum((c) => c.open?.value ?? 0), openN = sum((c) => c.open?.count ?? 0);
  const active = all.filter((c) => (c.s?.leads ?? c.s?.sits ?? 0) > 0);
  const homes = sum((c) => (c.s ? c.mk?.homes_owned ?? 0 : 0));
  return (
    <div className="zp">
      <div><span className="label">{rep ? "Your territory" : channel === "all" ? AREA : `${channel}, ${AREA}`}</span><h3>Tap a zip</h3><span className="sub">Hover for a quick look, click for the full story here.</span>
      <dl className="facts2">
        <div><dt>Zips with activity</dt><dd className="num">{n0(active.length)}</dd></div>
        {!rep ? <div><dt>Leads</dt><dd className="num">{n0(leads)}</dd></div> : null}
        <div><dt>Close rate</dt><dd className="num">{sits ? <>{pct(sold / sits)} <span className="sub">({n0(sold)} of {n0(sits)})</span></> : "–"}</dd></div>
        <div><dt>Sales</dt><dd className="num">{money(sales)}</dd></div>
      </dl></div>
      {open ? <div className="openq"><span className="label">Open quotes</span><span className="big num">{money(open)}</span><span className="sub">{n0(openN)} quoted appointments from the last {openDays} days, not sold yet</span></div> : null}
      {!rep ? <div className="openq"><span className="label">Roof market where the company works</span><span className="big num">{moneyK((homes / ROOF_LIFE) * ticket)}</span><span className="sub">a year, estimated from {n0(homes)} owned homes in zips with activity</span></div> : null}
    </div>
  );
}
