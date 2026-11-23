// Show sheet names, header rows and a few matching rows of an XLSX file.
// Usage: node scripts/xlsx-peek.mjs <file.xlsx> [filterText]
import ExcelJS from 'exceljs';
const [file, filter] = process.argv.slice(2);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
for (const ws of wb.worksheets) {
  console.log(`\n=== sheet "${ws.name}" (${ws.rowCount} rows x ${ws.columnCount} cols)`);
  let shown = 0;
  ws.eachRow((row, n) => {
    const cells = row.values.slice(1).map((v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? JSON.stringify(v)) : v));
    const line = cells.join(' | ');
    if (n <= 3 || (filter && line.toLowerCase().includes(filter.toLowerCase()) && shown++ < 25)) console.log(`${n}: ${line}`);
  });
}
