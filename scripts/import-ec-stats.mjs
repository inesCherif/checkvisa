// Import the European Commission's yearly "Visa statistics for consulates" workbook and keep the rows
// for consulates located in one country (default: TUNISIA). Writes data/stats/ec-consulates-<country>-<year>.json
//
// Usage: node scripts/import-ec-stats.mjs <workbook.xlsx> <year> <sourceUrl> [COUNTRY]
// Source page: https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/short-stay-visas-issued-schengen-countries_en

import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [file, yearArg, sourceUrl, countryArg = 'TUNISIA'] = process.argv.slice(2);
if (!file || !yearArg || !sourceUrl) {
  console.error('Usage: node scripts/import-ec-stats.mjs <workbook.xlsx> <year> <sourceUrl> [COUNTRY]');
  process.exit(1);
}
const year = Number(yearArg);
const country = countryArg.toUpperCase();

const cellValue = (v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? null) : v);
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.getWorksheet('Data for consulates');
if (!ws) throw new Error('Sheet "Data for consulates" not found');

// Find columns by header text, so the script survives column re-ordering between years.
// ExcelJS row.values is 1-based with an empty slot at index 0; Array.from turns holes into values.
const header = Array.from(ws.getRow(1).values, norm);
const col = (startsWith) => {
  const index = header.findIndex((h) => h.startsWith(startsWith));
  if (index < 0) throw new Error(`Column starting with "${startsWith}" not found`);
  return index;
};
const C = {
  state: col('schengen state'),
  country: col('country where consulate is located'),
  consulate: col('consulate'),
  applied: col('uniform visas applied for'),
  issued: col('total uniform visas issued'),
  mev: col('multiple entry uniform visas'),
  ltv: col('total ltvs issued'),
  notIssued: col('uniform visas not issued'),
};

const rows = [];
ws.eachRow((row, n) => {
  if (n === 1) return;
  const v = Array.from(row.values, cellValue);
  if (norm(v[C.country]) !== country.toLowerCase()) return;
  const applied = Number(v[C.applied]) || 0;
  const issued = Number(v[C.issued]) || 0;
  const ltv = Number(v[C.ltv]) || 0;
  const notIssued = Number(v[C.notIssued]) || 0;
  const decided = issued + ltv + notIssued;
  rows.push({
    schengenState: String(v[C.state]).trim(),
    consulate: String(v[C.consulate]).trim(),
    applied,
    issued,
    multipleEntryIssued: Number(v[C.mev]) || 0,
    ltvIssued: ltv,
    notIssued,
    notIssuedRate: decided ? Math.round((notIssued / decided) * 10000) / 10000 : null,
  });
});
rows.sort((a, b) => b.applied - a.applied);

const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
const totals = { applied: sum('applied'), issued: sum('issued'), ltvIssued: sum('ltvIssued'), notIssued: sum('notIssued') };
totals.notIssuedRate = Math.round((totals.notIssued / (totals.issued + totals.ltvIssued + totals.notIssued)) * 10000) / 10000;

const out = {
  dataset: 'ec-visa-statistics-consulates',
  year,
  country,
  sourceId: 'ec-visa-statistics',
  sourceUrl,
  sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  retrievedAt: new Date().toISOString().slice(0, 10),
  definitions: {
    notIssued: 'Not issued visas include refused visas and applications where the examination has been discontinued (European Commission, visa statistics metadata).',
    notIssuedRate: 'notIssued / (issued + ltvIssued + notIssued)',
  },
  totals,
  rows,
};

mkdirSync('data/stats', { recursive: true });
const target = `data/stats/ec-consulates-${country.toLowerCase()}-${year}.json`;
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`${target}: ${rows.length} consulates, applied ${totals.applied}, not issued ${totals.notIssued} (${(totals.notIssuedRate * 100).toFixed(1)}%)`);
