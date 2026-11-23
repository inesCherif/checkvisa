import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildMrz, checkDigit, parseMrz } from '../../src/core/extract/mrz';
import { normalize, parseJsonLoose } from '../../src/core/extract/schemas';
import { samplePdf, SAMPLE_FILES } from '../../src/core/sample/samplePdfs';
import { sampleDossier } from '../../src/core/sample/sampleDossier';
import type { DocKind } from '../../src/core/rules/dossier';

async function text(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const c = await page.getTextContent();
  const lines: string[] = [];
  let line = '';
  let lastY: number | undefined;
  for (const item of c.items) {
    if (!('str' in item)) continue;
    const y = Math.round(item.transform[5]);
    if (lastY !== undefined && Math.abs(y - lastY) > 2) {
      lines.push(line.trim());
      line = '';
    }
    line += (line && !line.endsWith(' ') ? ' ' : '') + item.str;
    lastY = y;
  }
  lines.push(line.trim());
  return lines.join('\n');
}

describe('MRZ (ICAO 9303)', () => {
  it('computes the ICAO example check digit', () => expect(checkDigit('L898902C3')).toBe(6));
  it('round-trips a generated MRZ', () => {
    const [l1, l2] = buildMrz({ surname: 'BEN SALAH', given: 'YASMINE', number: 'Z1234567', birth: '1997-11-14', expiry: '2031-11-23', sex: 'F' });
    expect(l1).toHaveLength(44);
    expect(l2).toHaveLength(44);
    const p = parseMrz(`${l1}\n${l2}`)!;
    expect(p).toMatchObject({ fullName: 'YASMINE BEN SALAH', number: 'Z1234567', expiryDate: '2031-11-23', mrzValid: true });
  });
  it('detects a corrupted MRZ', () => {
    const [l1, l2] = buildMrz({ surname: 'X', given: 'Y', number: 'Z1234567', birth: '1997-11-14', expiry: '2031-11-23', sex: 'F' });
    expect(parseMrz(`${l1}\n${l2.replace('Z1234567', 'Z1234568')}`)?.mrzValid).toBe(false);
  });
});

describe('normalize AI output', () => {
  it('keeps valid values and drops empties / bad dates', () => {
    expect(normalize('insurance', { holderName: ' A B ', startDate: '2027-01-10', endDate: '10/01/2027', coverEur: '30 000', allSchengen: true, repatriation: 'yes' })).toEqual({
      holderName: 'A B',
      startDate: '2027-01-10',
      coverEur: 30000,
      allSchengen: true,
    });
  });
  it('parses fenced JSON', () => expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
});

describe('sample PDFs', () => {
  it('renders all 7 documents and the passport MRZ survives text extraction', async () => {
    const day = '2026-11-23';
    for (const kind of Object.keys(SAMPLE_FILES) as DocKind[]) {
      const t = await text(await samplePdf(kind, day));
      expect(t).toContain('SPECIMEN');
      if (kind === 'passport') {
        const mrz = parseMrz(t);
        expect(mrz?.mrzValid).toBe(true);
        expect(mrz?.expiryDate).toBe(sampleDossier(day).dossier.passport!.expiryDate);
      }
      if (kind === 'booking') expect(t).toContain('BEN SALEM');
    }
  });
});
