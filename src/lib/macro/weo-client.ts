// IMF World Economic Outlook client (IMF Data Portal SDMX 2.1 REST API).
//
// Verified 2026-11-02:
//   Dataflow   IMF.RES:WEO(9.0.0) — "World Economic Outlook (WEO)", the live
//              vintage (earlier vintages are separate dataflows such as
//              WEO_2026_APR_VINTAGE).
//   DSD        IMF.RES:DSD_WEO(9.0.0); dimensions COUNTRY.INDICATOR.FREQUENCY,
//              time dimension TIME_PERIOD (annual "YYYY").
//   COUNTRY    ISO-3 for economies (since the Oct/2025 WEO), G***/named codes for
//              aggregates, plus KOS/WBG (see country-metadata.ts).
//   Attribute  LATEST_ACTUAL_ANNUAL_DATA on the COUNTRY×INDICATOR group, e.g.
//              "2025" or "FY2024/25". DERIVATION_TYPE (SE/SP codes) exists in
//              the DSD but is not populated for these series.
//   Formats    Data: SDMX-ML 2.1 StructureSpecificData (default). SDMX-JSON is
//              not served; SDMX-CSV repeats long methodology notes per row.
//   Auth       None required (public API).
//
// No @/ imports — also used by tsx scripts.

import { fetchTextWithRetry } from "./macro-http";

export const IMF_SDMX_BASE = "https://api.imf.org/external/sdmx/2.1";
export const WEO_AGENCY = "IMF.RES";
export const WEO_DATAFLOW_ID = "WEO";

export function buildWeoDataUrl(indicatorCodes: readonly string[], startYear: number): string {
  if (indicatorCodes.length === 0) throw new Error("buildWeoDataUrl: no indicator codes");
  for (const code of indicatorCodes) {
    if (!/^[A-Z0-9_]+$/.test(code)) throw new Error(`buildWeoDataUrl: invalid indicator code ${code}`);
  }
  // Key: COUNTRY (all) . INDICATOR (OR-list) . FREQUENCY
  const key = `.${indicatorCodes.join("+")}.A`;
  return `${IMF_SDMX_BASE}/data/${WEO_AGENCY},${WEO_DATAFLOW_ID}/${key}?startPeriod=${startYear}`;
}

export interface WeoRawObservation {
  period: string;
  /** Raw OBS_VALUE string; may be missing or non-numeric. */
  value: string | undefined;
}

export interface WeoRawSeries {
  country: string;
  indicator: string;
  frequency: string;
  observations: WeoRawObservation[];
}

export interface WeoParsedResponse {
  /** e.g. "IMF.RES:WEO(9.0.0)" from the message header. */
  dataflow: string | null;
  publicationDate: string | null;
  updateDate: string | null;
  series: WeoRawSeries[];
  /** "COUNTRY|INDICATOR" → raw LATEST_ACTUAL_ANNUAL_DATA label. */
  latestActual: Map<string, string>;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[e];
  });
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) attrs[m[1]] = decodeXmlEntities(m[2]);
  return attrs;
}

export function latestActualKey(country: string, indicator: string): string {
  return `${country}|${indicator}`;
}

/**
 * Minimal reader for SDMX-ML 2.1 StructureSpecificData as served by the IMF.
 * Only element/attribute structure is used (all data lives in attributes of
 * Group, Series and Obs elements), so no general XML parser is needed.
 * Throws when the document is not a StructureSpecificData message.
 */
export function parseWeoStructureSpecificXml(xml: string): WeoParsedResponse {
  if (!/<(?:\w+:)?StructureSpecificData\b/.test(xml)) {
    if (/<(?:\w+:)?Error\b/.test(xml)) {
      throw new Error("IMF SDMX returned an error message instead of data");
    }
    throw new Error("Unexpected IMF response: not SDMX StructureSpecificData");
  }

  const refMatch = /<(?:\w+:)?StructureUsage>\s*<Ref\b([^>]*)\/>/.exec(xml);
  const ref = refMatch ? parseAttributes(refMatch[1]) : null;
  const dataflow = ref?.agencyID && ref.id && ref.version ? `${ref.agencyID}:${ref.id}(${ref.version})` : null;

  const dataSetMatch = /<(?:\w+:)?DataSet\b([^>]*)>/.exec(xml);
  const dataSetAttrs = dataSetMatch ? parseAttributes(dataSetMatch[1]) : {};

  const series: WeoRawSeries[] = [];
  const latestActual = new Map<string, string>();
  let current: WeoRawSeries | null = null;

  const tagRe = /<(\/?)(Group|Series|Obs)\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml)) !== null) {
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) {
      if (tag === "Series") current = null;
      continue;
    }
    const attrs = parseAttributes(rawAttrs);
    if (tag === "Group") {
      if (attrs.COUNTRY && attrs.INDICATOR && attrs.LATEST_ACTUAL_ANNUAL_DATA !== undefined) {
        latestActual.set(latestActualKey(attrs.COUNTRY, attrs.INDICATOR), attrs.LATEST_ACTUAL_ANNUAL_DATA);
      }
    } else if (tag === "Series") {
      const s: WeoRawSeries = {
        country: attrs.COUNTRY ?? "",
        indicator: attrs.INDICATOR ?? "",
        frequency: attrs.FREQUENCY ?? "",
        observations: [],
      };
      series.push(s);
      current = selfClosing ? null : s;
    } else if (tag === "Obs") {
      if (!current) throw new Error("Malformed IMF response: <Obs> outside <Series>");
      if (!attrs.TIME_PERIOD) throw new Error("Malformed IMF response: <Obs> without TIME_PERIOD");
      current.observations.push({ period: attrs.TIME_PERIOD, value: attrs.OBS_VALUE });
    }
  }

  return {
    dataflow,
    publicationDate: dataSetAttrs.PUBLICATION_DATE ?? null,
    updateDate: dataSetAttrs.UPDATE_DATE ?? null,
    series,
    latestActual,
  };
}

export async function fetchWeo(indicatorCodes: readonly string[], startYear: number): Promise<WeoParsedResponse> {
  const xml = await fetchTextWithRetry(buildWeoDataUrl(indicatorCodes, startYear), {
    accept: "application/xml",
  });
  return parseWeoStructureSpecificXml(xml);
}
