// Country identity layer for the Macro Map.
//
// - Internal key: ISO 3166-1 alpha-3. Display names are never used as keys.
// - IMF WEO (since the Oct/2025 WEO) identifies countries by ISO-3, with two
//   explicit exceptions mapped in WEO_COUNTRY_CODE_OVERRIDES.
// - BIS identifies areas by ISO 3166-1 alpha-2 (plus BIS aggregates such as XM
//   = euro area). Mapping is an exact lookup on the iso2 column — no fuzzy
//   matching. Unknown codes are reported by the precompute, never guessed.
//
// Regions follow the Macro Map prototype grouping (Middle East and Central
// Asia inside "asia", Russia and Türkiye inside "europe", Mexico inside
// "latin_america"); the optional subregion refines it.
//
// The table covers every economy published in the IMF WEO (197 entries as of
// the Oct/2026 vintage).
//
// No @/ imports — also used by tsx scripts.

import type { MacroCountry, MacroRegionId, MacroSubregionId } from "./macro-types";

type Row = [iso3: string, iso2: string, namePt: string, region: MacroRegionId, subregion?: MacroSubregionId];

const NA: MacroRegionId = "north_america";
const LA: MacroRegionId = "latin_america";
const EU: MacroRegionId = "europe";
const AS: MacroRegionId = "asia";
const AF: MacroRegionId = "africa";
const OC: MacroRegionId = "oceania";

const ROWS: Row[] = [
  // North America
  ["CAN", "CA", "Canadá", NA],
  ["USA", "US", "Estados Unidos", NA],

  // Latin America and the Caribbean
  ["ARG", "AR", "Argentina", LA, "south_america"],
  ["BOL", "BO", "Bolívia", LA, "south_america"],
  ["BRA", "BR", "Brasil", LA, "south_america"],
  ["CHL", "CL", "Chile", LA, "south_america"],
  ["COL", "CO", "Colômbia", LA, "south_america"],
  ["ECU", "EC", "Equador", LA, "south_america"],
  ["GUY", "GY", "Guiana", LA, "south_america"],
  ["PRY", "PY", "Paraguai", LA, "south_america"],
  ["PER", "PE", "Peru", LA, "south_america"],
  ["SUR", "SR", "Suriname", LA, "south_america"],
  ["URY", "UY", "Uruguai", LA, "south_america"],
  ["VEN", "VE", "Venezuela", LA, "south_america"],
  ["MEX", "MX", "México", LA],
  ["BLZ", "BZ", "Belize", LA, "central_america"],
  ["CRI", "CR", "Costa Rica", LA, "central_america"],
  ["SLV", "SV", "El Salvador", LA, "central_america"],
  ["GTM", "GT", "Guatemala", LA, "central_america"],
  ["HND", "HN", "Honduras", LA, "central_america"],
  ["NIC", "NI", "Nicarágua", LA, "central_america"],
  ["PAN", "PA", "Panamá", LA, "central_america"],
  ["ATG", "AG", "Antígua e Barbuda", LA, "caribbean"],
  ["ABW", "AW", "Aruba", LA, "caribbean"],
  ["BHS", "BS", "Bahamas", LA, "caribbean"],
  ["BRB", "BB", "Barbados", LA, "caribbean"],
  ["DMA", "DM", "Dominica", LA, "caribbean"],
  ["DOM", "DO", "República Dominicana", LA, "caribbean"],
  ["GRD", "GD", "Granada", LA, "caribbean"],
  ["HTI", "HT", "Haiti", LA, "caribbean"],
  ["JAM", "JM", "Jamaica", LA, "caribbean"],
  ["PRI", "PR", "Porto Rico", LA, "caribbean"],
  ["KNA", "KN", "São Cristóvão e Névis", LA, "caribbean"],
  ["LCA", "LC", "Santa Lúcia", LA, "caribbean"],
  ["VCT", "VC", "São Vicente e Granadinas", LA, "caribbean"],
  ["TTO", "TT", "Trinidad e Tobago", LA, "caribbean"],

  // Europe
  ["ALB", "AL", "Albânia", EU],
  ["AND", "AD", "Andorra", EU],
  ["AUT", "AT", "Áustria", EU],
  ["BLR", "BY", "Belarus", EU],
  ["BEL", "BE", "Bélgica", EU],
  ["BIH", "BA", "Bósnia e Herzegovina", EU],
  ["BGR", "BG", "Bulgária", EU],
  ["HRV", "HR", "Croácia", EU],
  ["CYP", "CY", "Chipre", EU],
  ["CZE", "CZ", "Tchéquia", EU],
  ["DNK", "DK", "Dinamarca", EU],
  ["EST", "EE", "Estônia", EU],
  ["FIN", "FI", "Finlândia", EU],
  ["FRA", "FR", "França", EU],
  ["DEU", "DE", "Alemanha", EU],
  ["GRC", "GR", "Grécia", EU],
  ["HUN", "HU", "Hungria", EU],
  ["ISL", "IS", "Islândia", EU],
  ["IRL", "IE", "Irlanda", EU],
  ["ITA", "IT", "Itália", EU],
  ["LVA", "LV", "Letônia", EU],
  ["LIE", "LI", "Liechtenstein", EU],
  ["LTU", "LT", "Lituânia", EU],
  ["LUX", "LU", "Luxemburgo", EU],
  ["MLT", "MT", "Malta", EU],
  ["MDA", "MD", "Moldávia", EU],
  ["MNE", "ME", "Montenegro", EU],
  ["NLD", "NL", "Países Baixos", EU],
  ["MKD", "MK", "Macedônia do Norte", EU],
  ["NOR", "NO", "Noruega", EU],
  ["POL", "PL", "Polônia", EU],
  ["PRT", "PT", "Portugal", EU],
  ["ROU", "RO", "Romênia", EU],
  ["RUS", "RU", "Rússia", EU],
  ["SMR", "SM", "San Marino", EU],
  ["SRB", "RS", "Sérvia", EU],
  ["SVK", "SK", "Eslováquia", EU],
  ["SVN", "SI", "Eslovênia", EU],
  ["ESP", "ES", "Espanha", EU],
  ["SWE", "SE", "Suécia", EU],
  ["CHE", "CH", "Suíça", EU],
  ["TUR", "TR", "Turquia", EU],
  ["UKR", "UA", "Ucrânia", EU],
  ["GBR", "GB", "Reino Unido", EU],

  // Asia — East
  ["CHN", "CN", "China", AS, "east_asia"],
  ["HKG", "HK", "Hong Kong", AS, "east_asia"],
  ["JPN", "JP", "Japão", AS, "east_asia"],
  ["KOR", "KR", "Coreia do Sul", AS, "east_asia"],
  ["MAC", "MO", "Macau", AS, "east_asia"],
  ["MNG", "MN", "Mongólia", AS, "east_asia"],
  ["TWN", "TW", "Taiwan", AS, "east_asia"],
  // Asia — Southeast
  ["BRN", "BN", "Brunei", AS, "southeast_asia"],
  ["KHM", "KH", "Camboja", AS, "southeast_asia"],
  ["IDN", "ID", "Indonésia", AS, "southeast_asia"],
  ["LAO", "LA", "Laos", AS, "southeast_asia"],
  ["MYS", "MY", "Malásia", AS, "southeast_asia"],
  ["MMR", "MM", "Mianmar", AS, "southeast_asia"],
  ["PHL", "PH", "Filipinas", AS, "southeast_asia"],
  ["SGP", "SG", "Singapura", AS, "southeast_asia"],
  ["THA", "TH", "Tailândia", AS, "southeast_asia"],
  ["TLS", "TL", "Timor-Leste", AS, "southeast_asia"],
  ["VNM", "VN", "Vietnã", AS, "southeast_asia"],
  // Asia — South
  ["AFG", "AF", "Afeganistão", AS, "south_asia"],
  ["BGD", "BD", "Bangladesh", AS, "south_asia"],
  ["BTN", "BT", "Butão", AS, "south_asia"],
  ["IND", "IN", "Índia", AS, "south_asia"],
  ["MDV", "MV", "Maldivas", AS, "south_asia"],
  ["NPL", "NP", "Nepal", AS, "south_asia"],
  ["PAK", "PK", "Paquistão", AS, "south_asia"],
  ["LKA", "LK", "Sri Lanka", AS, "south_asia"],
  // Asia — Central Asia and Caucasus
  ["ARM", "AM", "Armênia", AS, "central_asia"],
  ["AZE", "AZ", "Azerbaijão", AS, "central_asia"],
  ["GEO", "GE", "Geórgia", AS, "central_asia"],
  ["KAZ", "KZ", "Cazaquistão", AS, "central_asia"],
  ["KGZ", "KG", "Quirguistão", AS, "central_asia"],
  ["TJK", "TJ", "Tajiquistão", AS, "central_asia"],
  ["TKM", "TM", "Turcomenistão", AS, "central_asia"],
  ["UZB", "UZ", "Uzbequistão", AS, "central_asia"],
  // Asia — Middle East
  ["BHR", "BH", "Bahrein", AS, "middle_east"],
  ["IRN", "IR", "Irã", AS, "middle_east"],
  ["IRQ", "IQ", "Iraque", AS, "middle_east"],
  ["ISR", "IL", "Israel", AS, "middle_east"],
  ["JOR", "JO", "Jordânia", AS, "middle_east"],
  ["KWT", "KW", "Kuwait", AS, "middle_east"],
  ["LBN", "LB", "Líbano", AS, "middle_east"],
  ["OMN", "OM", "Omã", AS, "middle_east"],
  ["PSE", "PS", "Cisjordânia e Gaza", AS, "middle_east"],
  ["QAT", "QA", "Catar", AS, "middle_east"],
  ["SAU", "SA", "Arábia Saudita", AS, "middle_east"],
  ["SYR", "SY", "Síria", AS, "middle_east"],
  ["ARE", "AE", "Emirados Árabes Unidos", AS, "middle_east"],
  ["YEM", "YE", "Iêmen", AS, "middle_east"],

  // Africa — North
  ["DZA", "DZ", "Argélia", AF, "north_africa"],
  ["EGY", "EG", "Egito", AF, "north_africa"],
  ["LBY", "LY", "Líbia", AF, "north_africa"],
  ["MAR", "MA", "Marrocos", AF, "north_africa"],
  ["SDN", "SD", "Sudão", AF, "north_africa"],
  ["TUN", "TN", "Tunísia", AF, "north_africa"],
  // Africa — Sub-Saharan
  ["AGO", "AO", "Angola", AF, "sub_saharan_africa"],
  ["BEN", "BJ", "Benin", AF, "sub_saharan_africa"],
  ["BWA", "BW", "Botsuana", AF, "sub_saharan_africa"],
  ["BFA", "BF", "Burkina Faso", AF, "sub_saharan_africa"],
  ["BDI", "BI", "Burundi", AF, "sub_saharan_africa"],
  ["CPV", "CV", "Cabo Verde", AF, "sub_saharan_africa"],
  ["CMR", "CM", "Camarões", AF, "sub_saharan_africa"],
  ["CAF", "CF", "República Centro-Africana", AF, "sub_saharan_africa"],
  ["TCD", "TD", "Chade", AF, "sub_saharan_africa"],
  ["COM", "KM", "Comores", AF, "sub_saharan_africa"],
  ["COD", "CD", "República Democrática do Congo", AF, "sub_saharan_africa"],
  ["COG", "CG", "República do Congo", AF, "sub_saharan_africa"],
  ["CIV", "CI", "Costa do Marfim", AF, "sub_saharan_africa"],
  ["DJI", "DJ", "Djibuti", AF, "sub_saharan_africa"],
  ["GNQ", "GQ", "Guiné Equatorial", AF, "sub_saharan_africa"],
  ["ERI", "ER", "Eritreia", AF, "sub_saharan_africa"],
  ["SWZ", "SZ", "Essuatíni", AF, "sub_saharan_africa"],
  ["ETH", "ET", "Etiópia", AF, "sub_saharan_africa"],
  ["GAB", "GA", "Gabão", AF, "sub_saharan_africa"],
  ["GMB", "GM", "Gâmbia", AF, "sub_saharan_africa"],
  ["GHA", "GH", "Gana", AF, "sub_saharan_africa"],
  ["GIN", "GN", "Guiné", AF, "sub_saharan_africa"],
  ["GNB", "GW", "Guiné-Bissau", AF, "sub_saharan_africa"],
  ["KEN", "KE", "Quênia", AF, "sub_saharan_africa"],
  ["LSO", "LS", "Lesoto", AF, "sub_saharan_africa"],
  ["LBR", "LR", "Libéria", AF, "sub_saharan_africa"],
  ["MDG", "MG", "Madagascar", AF, "sub_saharan_africa"],
  ["MWI", "MW", "Malawi", AF, "sub_saharan_africa"],
  ["MLI", "ML", "Mali", AF, "sub_saharan_africa"],
  ["MRT", "MR", "Mauritânia", AF, "sub_saharan_africa"],
  ["MUS", "MU", "Maurício", AF, "sub_saharan_africa"],
  ["MOZ", "MZ", "Moçambique", AF, "sub_saharan_africa"],
  ["NAM", "NA", "Namíbia", AF, "sub_saharan_africa"],
  ["NER", "NE", "Níger", AF, "sub_saharan_africa"],
  ["NGA", "NG", "Nigéria", AF, "sub_saharan_africa"],
  ["RWA", "RW", "Ruanda", AF, "sub_saharan_africa"],
  ["STP", "ST", "São Tomé e Príncipe", AF, "sub_saharan_africa"],
  ["SEN", "SN", "Senegal", AF, "sub_saharan_africa"],
  ["SYC", "SC", "Seicheles", AF, "sub_saharan_africa"],
  ["SLE", "SL", "Serra Leoa", AF, "sub_saharan_africa"],
  ["SOM", "SO", "Somália", AF, "sub_saharan_africa"],
  ["ZAF", "ZA", "África do Sul", AF, "sub_saharan_africa"],
  ["SSD", "SS", "Sudão do Sul", AF, "sub_saharan_africa"],
  ["TZA", "TZ", "Tanzânia", AF, "sub_saharan_africa"],
  ["TGO", "TG", "Togo", AF, "sub_saharan_africa"],
  ["UGA", "UG", "Uganda", AF, "sub_saharan_africa"],
  ["ZMB", "ZM", "Zâmbia", AF, "sub_saharan_africa"],
  ["ZWE", "ZW", "Zimbábue", AF, "sub_saharan_africa"],

  // Oceania
  ["AUS", "AU", "Austrália", OC],
  ["FJI", "FJ", "Fiji", OC],
  ["KIR", "KI", "Kiribati", OC],
  ["MHL", "MH", "Ilhas Marshall", OC],
  ["FSM", "FM", "Micronésia", OC],
  ["NRU", "NR", "Nauru", OC],
  ["NZL", "NZ", "Nova Zelândia", OC],
  ["PLW", "PW", "Palau", OC],
  ["PNG", "PG", "Papua-Nova Guiné", OC],
  ["WSM", "WS", "Samoa", OC],
  ["SLB", "SB", "Ilhas Salomão", OC],
  ["TON", "TO", "Tonga", OC],
  ["TUV", "TV", "Tuvalu", OC],
  ["VUT", "VU", "Vanuatu", OC],
];

/** Kosovo uses the user-assigned XKX/XK codes (not in the official ISO list). */
const USER_ASSIGNED: ReadonlySet<string> = new Set(["XKX"]);

const KOSOVO: Row = ["XKX", "XK", "Kosovo", EU];

function toCountry([iso3, iso2, namePt, region, subregion]: Row): MacroCountry {
  const country: MacroCountry = { iso3, iso2, namePt, region };
  if (subregion) country.subregion = subregion;
  if (USER_ASSIGNED.has(iso3)) country.userAssignedCode = true;
  return country;
}

export const MACRO_COUNTRIES: readonly MacroCountry[] = [...ROWS, KOSOVO]
  .map(toCountry)
  .sort((a, b) => a.iso3.localeCompare(b.iso3));

const BY_ISO3 = new Map(MACRO_COUNTRIES.map(c => [c.iso3, c]));
const BY_ISO2 = new Map(MACRO_COUNTRIES.map(c => [c.iso2, c]));

/**
 * IMF WEO COUNTRY codes that are not the ISO 3166-1 alpha-3 of the economy.
 * Verified against IMF.RES:CL_WEO_COUNTRY(1.0.1):
 *   KOS = "Kosovo, Republic of"   → XKX (user-assigned)
 *   WBG = "West Bank and Gaza"    → PSE
 */
export const WEO_COUNTRY_CODE_OVERRIDES: Readonly<Record<string, string>> = {
  KOS: "XKX",
  WBG: "PSE",
};

const ISO3_PATTERN = /^[A-Z]{3}$/;

/** Syntactic ISO-3 check (three uppercase ASCII letters). */
export function isIso3Format(code: string): boolean {
  return ISO3_PATTERN.test(code);
}

/** True only for codes present in the Macro Map country table. */
export function isKnownIso3(code: string): boolean {
  return BY_ISO3.has(code);
}

export function getMacroCountry(iso3: string): MacroCountry | null {
  return BY_ISO3.get(iso3) ?? null;
}

/**
 * Normalizes a user-supplied ISO-3 (trim + uppercase). Returns null unless the
 * result is a known country.
 */
export function normalizeIso3(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return isIso3Format(code) && BY_ISO3.has(code) ? code : null;
}

/** IMF WEO COUNTRY code → ISO-3, or null (aggregates such as G001, unknown codes). */
export function weoCountryToIso3(code: string): string | null {
  const iso3 = WEO_COUNTRY_CODE_OVERRIDES[code] ?? code;
  return BY_ISO3.has(iso3) ? iso3 : null;
}

/** BIS REF_AREA (ISO 3166-1 alpha-2) → ISO-3, or null (aggregates such as XM, unknown codes). */
export function bisRefAreaToIso3(code: string): string | null {
  return BY_ISO2.get(code)?.iso3 ?? null;
}
