// Explicit join between Macro Map countries (ISO 3166-1 alpha-3) and map
// geometry (world-atlas@2.0.2, Natural Earth, features keyed by ISO 3166-1
// numeric as a 3-digit string, e.g. "076").
//
// - No name matching: the join is this table only.
// - Kosovo (XKX) has no ISO 3166-1 numeric code and its world-atlas feature
//   has no id, so it is deliberately left without geometry (it stays
//   available through ranking, search and the country panel).
// - Economies too small for the 110m geometry (e.g. Singapore, Malta,
//   Bahrain) are drawn as point markers; see map-markers.ts.
//
// No @/ imports — pure data, safe for client and server.

export const ISO3_TO_ISO_NUMERIC: Readonly<Record<string, string>> = {
  ABW: "533", AFG: "004", AGO: "024", ALB: "008", AND: "020", ARE: "784", ARG: "032", ARM: "051",
  ATG: "028", AUS: "036", AUT: "040", AZE: "031", BDI: "108", BEL: "056", BEN: "204", BFA: "854",
  BGD: "050", BGR: "100", BHR: "048", BHS: "044", BIH: "070", BLR: "112", BLZ: "084", BOL: "068",
  BRA: "076", BRB: "052", BRN: "096", BTN: "064", BWA: "072", CAF: "140", CAN: "124", CHE: "756",
  CHL: "152", CHN: "156", CIV: "384", CMR: "120", COD: "180", COG: "178", COL: "170", COM: "174",
  CPV: "132", CRI: "188", CYP: "196", CZE: "203", DEU: "276", DJI: "262", DMA: "212", DNK: "208",
  DOM: "214", DZA: "012", ECU: "218", EGY: "818", ERI: "232", ESP: "724", EST: "233", ETH: "231",
  FIN: "246", FJI: "242", FRA: "250", FSM: "583", GAB: "266", GBR: "826", GEO: "268", GHA: "288",
  GIN: "324", GMB: "270", GNB: "624", GNQ: "226", GRC: "300", GRD: "308", GTM: "320", GUY: "328",
  HKG: "344", HND: "340", HRV: "191", HTI: "332", HUN: "348", IDN: "360", IND: "356", IRL: "372",
  IRN: "364", IRQ: "368", ISL: "352", ISR: "376", ITA: "380", JAM: "388", JOR: "400", JPN: "392",
  KAZ: "398", KEN: "404", KGZ: "417", KHM: "116", KIR: "296", KNA: "659", KOR: "410", KWT: "414",
  LAO: "418", LBN: "422", LBR: "430", LBY: "434", LCA: "662", LIE: "438", LKA: "144", LSO: "426",
  LTU: "440", LUX: "442", LVA: "428", MAC: "446", MAR: "504", MDA: "498", MDG: "450", MDV: "462",
  MEX: "484", MHL: "584", MKD: "807", MLI: "466", MLT: "470", MMR: "104", MNE: "499", MNG: "496",
  MOZ: "508", MRT: "478", MUS: "480", MWI: "454", MYS: "458", NAM: "516", NER: "562", NGA: "566",
  NIC: "558", NLD: "528", NOR: "578", NPL: "524", NRU: "520", NZL: "554", OMN: "512", PAK: "586",
  PAN: "591", PER: "604", PHL: "608", PLW: "585", PNG: "598", POL: "616", PRI: "630", PRT: "620",
  PRY: "600", PSE: "275", QAT: "634", ROU: "642", RUS: "643", RWA: "646", SAU: "682", SDN: "729",
  SEN: "686", SGP: "702", SLB: "090", SLE: "694", SLV: "222", SMR: "674", SOM: "706", SRB: "688",
  SSD: "728", STP: "678", SUR: "740", SVK: "703", SVN: "705", SWE: "752", SWZ: "748", SYC: "690",
  SYR: "760", TCD: "148", TGO: "768", THA: "764", TJK: "762", TKM: "795", TLS: "626", TON: "776",
  TTO: "780", TUN: "788", TUR: "792", TUV: "798", TWN: "158", TZA: "834", UGA: "800", UKR: "804",
  URY: "858", USA: "840", UZB: "860", VCT: "670", VEN: "862", VNM: "704", VUT: "548", WSM: "882",
  YEM: "887", ZAF: "710", ZMB: "894", ZWE: "716",
};

const ISO_NUMERIC_TO_ISO3: ReadonlyMap<string, string> = new Map(
  Object.entries(ISO3_TO_ISO_NUMERIC).map(([iso3, num]) => [num, iso3]),
);

/** ISO-3 → world-atlas feature id, or null (e.g. Kosovo). */
export function iso3ToGeometryId(iso3: string): string | null {
  return ISO3_TO_ISO_NUMERIC[iso3] ?? null;
}

/**
 * world-atlas feature id → ISO-3, or null for geometries outside the Macro
 * Map country table (Antarctica, Greenland, W. Sahara, N. Cyprus, Kosovo…).
 */
export function geometryIdToIso3(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined || id === "") return null;
  const key = typeof id === "number" ? String(id).padStart(3, "0") : id;
  return ISO_NUMERIC_TO_ISO3.get(key) ?? null;
}
