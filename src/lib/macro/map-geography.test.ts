import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { feature } from "topojson-client";
import { geoCentroid } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection } from "geojson";
import { MACRO_COUNTRIES } from "./country-metadata";
import { ISO3_TO_ISO_NUMERIC, geometryIdToIso3, iso3ToGeometryId } from "./map-geography";
import { COUNTRIES_WITHOUT_GEOMETRY, MAP_POINT_MARKERS } from "./map-markers";

const require = createRequire(import.meta.url);
const atlas110 = require("world-atlas/countries-110m.json") as Topology;
const atlas50 = require("world-atlas/countries-50m.json") as Topology;

function names(t: Topology): Map<string, string> {
  const g = (t.objects.countries as GeometryCollection<{ name: string }>).geometries;
  return new Map(g.filter(x => x.id !== undefined).map(x => [String(x.id), (x.properties as { name: string }).name]));
}

const N110 = names(atlas110);

describe("ISO-3 ↔ map geometry join", () => {
  it.each([
    ["BRA", "076", "Brazil"],
    ["USA", "840", "United States of America"],
    ["GBR", "826", "United Kingdom"],
    ["DEU", "276", "Germany"],
    ["FRA", "250", "France"],
    ["JPN", "392", "Japan"],
    ["CHN", "156", "China"],
    ["IND", "356", "India"],
    ["MEX", "484", "Mexico"],
    ["ZAF", "710", "South Africa"],
    ["PSE", "275", "Palestine"],
  ])("%s → %s (%s)", (iso3, id, atlasName) => {
    expect(iso3ToGeometryId(iso3)).toBe(id);
    expect(geometryIdToIso3(id)).toBe(iso3);
    expect(N110.get(id)).toBe(atlasName);
  });

  it("uses unique 3-digit codes and covers every country except Kosovo", () => {
    const codes = Object.values(ISO3_TO_ISO_NUMERIC);
    for (const c of codes) expect(c).toMatch(/^\d{3}$/);
    expect(new Set(codes).size).toBe(codes.length);
    const unmapped = MACRO_COUNTRIES.filter(c => !ISO3_TO_ISO_NUMERIC[c.iso3]).map(c => c.iso3);
    expect(unmapped).toEqual(["XKX"]);
  });

  it("leaves Kosovo without geometry instead of inventing a numeric code", () => {
    expect(iso3ToGeometryId("XKX")).toBeNull();
    // The 110m Kosovo feature has no id, so it cannot join to any country.
    const kosovo = (atlas110.objects.countries as GeometryCollection<{ name: string }>).geometries
      .find(g => (g.properties as { name?: string } | undefined)?.name === "Kosovo");
    expect(kosovo?.id).toBeUndefined();
    expect(geometryIdToIso3(kosovo?.id)).toBeNull();
  });

  it("ignores geometries outside the country table and malformed ids", () => {
    expect(geometryIdToIso3("010")).toBeNull(); // Antarctica
    expect(geometryIdToIso3("304")).toBeNull(); // Greenland
    expect(geometryIdToIso3(undefined)).toBeNull();
    expect(geometryIdToIso3("")).toBeNull();
    expect(geometryIdToIso3(76)).toBe("BRA");
  });

  it("every mapped code exists in world-atlas (50m) — no typos", () => {
    const n50 = names(atlas50);
    const missing = Object.entries(ISO3_TO_ISO_NUMERIC).filter(([, id]) => !n50.has(id)).map(([iso3]) => iso3);
    expect(missing).toEqual(["TUV"]);
  });
});

describe("point markers for small economies", () => {
  it("cover exactly the mapped countries without a 110m polygon (except Tuvalu)", () => {
    const without110 = Object.entries(ISO3_TO_ISO_NUMERIC)
      .filter(([, id]) => !N110.has(id))
      .map(([iso3]) => iso3)
      .filter(iso3 => iso3 !== "TUV")
      .sort();
    expect(Object.keys(MAP_POINT_MARKERS).sort()).toEqual(without110);
    expect([...COUNTRIES_WITHOUT_GEOMETRY].sort()).toEqual(["TUV", "XKX"]);
  });

  it("match the centroids recomputed from world-atlas 50m", () => {
    const fc = feature(atlas50, atlas50.objects.countries as GeometryCollection) as FeatureCollection;
    for (const [iso3, [lon, lat]] of Object.entries(MAP_POINT_MARKERS)) {
      const f = fc.features.filter((x: Feature) => x.id === ISO3_TO_ISO_NUMERIC[iso3]);
      expect(f, iso3).toHaveLength(1);
      const [clon, clat] = geoCentroid(f[0]);
      expect(Math.abs(clon - lon), iso3).toBeLessThan(0.006);
      expect(Math.abs(clat - lat), iso3).toBeLessThan(0.006);
    }
  });
});
