/**
 * Sanity-check script for src/lib/cvm/company-map.ts.
 * Usage: tsx scripts/verify-company-map.ts
 *
 * Checks:
 *   - duplicate ticker keys
 *   - hasCvmMapping true but cvmCode missing/empty
 *   - hasCvmMapping true but cnpj missing (warning, not error)
 *   - suspicious/placeholder cvmCode patterns
 */
import { CVM_COMPANY_MAP } from "../src/lib/cvm/company-map";

let errors = 0;
let warnings = 0;
const seen = new Set<string>();

for (const [key, entry] of Object.entries(CVM_COMPANY_MAP)) {
  // Duplicate key detection (object keys are unique by JS spec, but check anyway)
  if (seen.has(key)) {
    console.error(`ERROR: duplicate key "${key}"`);
    errors++;
  }
  seen.add(key);

  if (entry.hasCvmMapping) {
    if (!entry.cvmCode || entry.cvmCode.trim() === "") {
      console.error(`ERROR: ${key} hasCvmMapping=true but cvmCode is missing`);
      errors++;
    }
    if (!entry.cnpj || entry.cnpj.trim() === "") {
      console.warn(`WARN:  ${key} hasCvmMapping=true but cnpj is missing`);
      warnings++;
    }
  }

  // Detect obvious placeholder patterns
  if (entry.cvmCode && /[a-zA-Z]/.test(entry.cvmCode)) {
    console.error(`ERROR: ${key} cvmCode contains non-numeric chars: ${entry.cvmCode}`);
    errors++;
  }
  if (entry.cnpj && /quatro|res\/|dfj|TR7/.test(entry.cnpj)) {
    console.error(`ERROR: ${key} cnpj looks like a placeholder: ${entry.cnpj}`);
    errors++;
  }
}

console.log(`\nCompany map: ${seen.size} entries`);
console.log(`Errors:   ${errors}`);
console.log(`Warnings: ${warnings}`);
if (errors > 0) process.exit(1);
