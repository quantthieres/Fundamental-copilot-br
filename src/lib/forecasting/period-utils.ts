export type QuarterPeriod = { year: number; quarter: 1 | 2 | 3 | 4 };

export function parseQuarterPeriod(period: string): QuarterPeriod {
  const match = /^(\d{4})Q([1-4])$/.exec(period);
  if (!match) throw new Error(`Invalid quarter period: "${period}"`);
  return {
    year: parseInt(match[1], 10),
    quarter: parseInt(match[2], 10) as 1 | 2 | 3 | 4,
  };
}

export function compareQuarterPeriods(a: string, b: string): number {
  const pa = parseQuarterPeriod(a);
  const pb = parseQuarterPeriod(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.quarter - pb.quarter;
}

export function addQuarters(period: string, n: number): string {
  const { year, quarter } = parseQuarterPeriod(period);
  // Convert to a flat quarter index (0-based), add n, convert back
  const flat = year * 4 + (quarter - 1) + n;
  const newYear = Math.floor(flat / 4);
  const newQuarter = ((flat % 4) + 4) % 4 + 1; // +4 handles negative modulo in JS
  return `${newYear}Q${newQuarter}`;
}

export function nextQuarterPeriod(period: string): string {
  return addQuarters(period, 1);
}

export function generateFuturePeriods(lastObservedPeriod: string, horizon: number): string[] {
  const result: string[] = [];
  let current = lastObservedPeriod;
  for (let h = 0; h < horizon; h++) {
    current = addQuarters(current, 1);
    result.push(current);
  }
  return result;
}
