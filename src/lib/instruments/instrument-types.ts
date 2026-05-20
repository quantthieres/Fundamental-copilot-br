export type InformationalInstrumentType =
  | "etf"
  | "bdr"
  | "fund"
  | "unknown";

export type InstrumentInfoResponse = {
  ticker: string;
  source: "instrument_info";
  sourceDetail: "informational_layer";
  available: boolean;
  instrumentType: InformationalInstrumentType;
  name: string;
  description: string;
  whyNoFundamentalAnalysis: string;
  marketDataAvailable: boolean;
  warnings: string[];
  updatedAt: string;
};
