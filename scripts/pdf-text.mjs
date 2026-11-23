// Print the text of a PDF, page by page (used by the data pipeline to read official PDFs).
// Usage: node scripts/pdf-text.mjs <file.pdf> [firstPage] [lastPage]
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [file, first = '1', last] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/pdf-text.mjs <file.pdf> [firstPage] [lastPage]');
  process.exit(1);
}
const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true }).promise;
const end = Math.min(Number(last ?? pdf.numPages), pdf.numPages);
console.log(`# ${file} — ${pdf.numPages} pages`);
for (let n = Number(first); n <= end; n++) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  let line = '';
  const lines = [];
  let lastY;
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const y = Math.round(item.transform[5]);
    if (lastY !== undefined && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
    line += item.str + (item.hasEOL ? ' ' : '');
    lastY = y;
  }
  if (line.trim()) lines.push(line.trim());
  console.log(`\n--- page ${n} ---\n${lines.filter(Boolean).join('\n')}`);
}
