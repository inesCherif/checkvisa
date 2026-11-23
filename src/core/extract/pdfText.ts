// Turns a PDF into text locally with pdf.js (nothing is uploaded). Lines are rebuilt from the
// text items' vertical positions so labels and values stay on the same line.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = '';
    let lastY: number | undefined;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== undefined && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = '';
      }
      line += (line && !line.endsWith(' ') ? ' ' : '') + item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}

export async function fileToText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return pdfToText(await file.arrayBuffer());
  if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) return file.text();
  throw new Error('Please use a PDF (text PDF from your bank, insurer or airline) or a .txt file.');
}
