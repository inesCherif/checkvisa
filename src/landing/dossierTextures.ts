// The specimen dossier on the landing page, drawn in code.
// Each document gets two canvases:
//   - `visible`: what you see in room light (paper, print, faint security guilloche);
//   - `uv`: what only the UV lamp reveals (fluorescent fibres, hidden rosettes, and the problem the
//     rule engine found, outlined). Black = nothing glows.
// All data is the app's fictional sample applicant; every document is stamped SPECIMEN.

import type { Sample } from '../core/sample/sampleDossier';
import type { Finding } from '../core/rules/checks';
import { pretty } from '../core/rules/dates';

/** The sample always fills every field. */
type Full<K extends keyof Sample['dossier']> = Required<NonNullable<Sample['dossier'][K]>>;

export type DocId = 'passport' | 'insurance' | 'statements' | 'booking';

export interface DocTexture {
  id: DocId;
  /** width / height of the paper */
  aspect: number;
  visible: HTMLCanvasElement;
  uv: HTMLCanvasElement;
  /** The problem area, in 0..1 texture coordinates (origin top-left). */
  hotspot: { x: number; y: number; w: number; h: number };
  finding?: Finding;
}

const UV_GREEN = '#c6f19d';
const INK = '#23251f';
const FAINT = '#6f7468';
const PX = 1024; // long side of every canvas

const upper = (d: string) => pretty(d).toUpperCase();

function canvas(aspect: number) {
  const c = document.createElement('canvas');
  if (aspect >= 1) {
    c.width = PX;
    c.height = Math.round(PX / aspect);
  } else {
    c.height = PX;
    c.width = Math.round(PX * aspect);
  }
  return { c, g: c.getContext('2d')! };
}

/** Deterministic pseudo-random, so the dossier looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Security-print rosette: an epitrochoid repeated around a centre, like banknote guilloche. */
function rosette(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string, alpha: number, lines = 18, lw = 0.7) {
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = lw;
  for (let k = 0; k < lines; k++) {
    const phase = (k / lines) * Math.PI * 2;
    g.beginPath();
    for (let i = 0; i <= 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const r = R * (0.62 + 0.38 * Math.cos(7 * t + phase)) * (0.85 + 0.15 * Math.sin(3 * t));
      const x = cx + r * Math.cos(t);
      const y = cy + r * Math.sin(t);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

/** Wavy guilloche band across the paper (the "background print"). */
function waves(g: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number, count = 34, seed = 1) {
  const rand = rng(seed);
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = 0.6;
  const f1 = 2 + rand() * 2;
  const f2 = 5 + rand() * 3;
  for (let k = 0; k < count; k++) {
    const y0 = (k / count) * h;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = y0 + Math.sin((x / w) * Math.PI * f1 + k * 0.35) * h * 0.035 + Math.sin((x / w) * Math.PI * f2 + k) * h * 0.012;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

/** Paper fibres: short curved strands. In UV they glow; in room light they are invisible. */
function fibres(g: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number) {
  const rand = rng(seed);
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 6 + rand() * 18;
    const a = rand() * Math.PI;
    g.strokeStyle = rand() > 0.82 ? '#8fd3ff' : rand() > 0.5 ? UV_GREEN : '#f3ffcf';
    g.globalAlpha = 0.55 + rand() * 0.45;
    g.lineWidth = 1.4 + rand() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 4, y + Math.sin(a) * len * 0.5 - 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  g.restore();
}

function paper(g: CanvasRenderingContext2D, w: number, h: number, tint: string, seed: number) {
  g.fillStyle = tint;
  g.fillRect(0, 0, w, h);
  // Grain: tiny dots, darker and lighter than the paper.
  const rand = rng(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)';
    g.fillRect(rand() * w, rand() * h, 1.2, 1.2);
  }
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, opts: { weight?: number; color?: string; font?: string; align?: CanvasTextAlign; spacing?: number } = {}) {
  g.save();
  g.fillStyle = opts.color ?? INK;
  g.textAlign = opts.align ?? 'left';
  g.textBaseline = 'alphabetic';
  g.font = `${opts.weight ?? 400} ${size}px ${opts.font ?? '"Helvetica Neue", Arial, sans-serif'}`;
  if (opts.spacing) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.spacing}px`;
  g.fillText(s, x, y);
  g.restore();
}

function field(g: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, s: number) {
  text(g, label, x, y, s * 0.42, { color: FAINT });
  text(g, value, x, y + s * 0.62, s * 0.62, { weight: 600 });
}

function specimen(g: CanvasRenderingContext2D, w: number, h: number) {
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.38);
  text(g, 'SPECIMEN', 0, 0, Math.min(w, h) * 0.16, { weight: 700, color: 'rgba(170,40,30,0.13)', align: 'center', spacing: 8 });
  g.restore();
}

/** Glowing outline + wash around the problem, on the UV canvas. */
function uvMark(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.shadowColor = UV_GREEN;
  g.shadowBlur = 22;
  g.strokeStyle = UV_GREEN;
  g.lineWidth = 5;
  g.globalAlpha = 1;
  g.strokeRect(x, y, w, h);
  g.globalAlpha = 0.22;
  g.fillStyle = UV_GREEN;
  g.fillRect(x, y, w, h);
  g.restore();
}

function blank(c: HTMLCanvasElement) {
  const u = document.createElement('canvas');
  u.width = c.width;
  u.height = c.height;
  const g = u.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, u.width, u.height);
  return { u, ug: g };
}

function hs(c: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  return { x: x / c.width, y: y / c.height, w: w / c.width, h: h / c.height };
}

function mrzLine(s: string) {
  return (s + '<'.repeat(44)).slice(0, 44);
}

// ------------------------------------------------------------------ documents

function passport(sample: Sample, finding?: Finding): DocTexture {
  const p = sample.dossier.passport as Full<'passport'>;
  const aspect = 125 / 88;
  const { c, g } = canvas(aspect);
  const { width: w, height: h } = c;
  paper(g, w, h, '#e6ebe1', 11);
  waves(g, w, h, '#7fa38e', 0.28, 46, 3);
  rosette(g, w * 0.78, h * 0.42, h * 0.3, '#86a7c4', 0.22, 24);
  // Photo window: a guilloche-filled frame (no face: specimen).
  g.save();
  g.fillStyle = '#d9dfd5';
  g.fillRect(w * 0.05, h * 0.2, w * 0.25, h * 0.52);
  rosette(g, w * 0.175, h * 0.46, h * 0.2, '#6b8b7a', 0.35, 14);
  g.restore();
  text(g, 'PASSPORT · PASSEPORT', w * 0.05, h * 0.12, h * 0.055, { weight: 700, spacing: 3 });
  text(g, 'TUN', w * 0.93, h * 0.12, h * 0.055, { weight: 700, align: 'right' });
  const s = h * 0.085;
  const x1 = w * 0.35;
  const x2 = w * 0.66;
  field(g, 'Type', 'P', x1, h * 0.22, s);
  field(g, 'Passport No.', p.number, x2, h * 0.22, s);
  field(g, 'Surname', 'BEN SALAH', x1, h * 0.34, s);
  field(g, 'Given names', 'YASMINE', x1, h * 0.46, s);
  field(g, 'Nationality', 'TUNISIAN', x2, h * 0.46, s);
  field(g, 'Date of issue', upper(p.issueDate), x1, h * 0.58, s);
  const ex = { x: x2 - w * 0.012, y: h * 0.535, w: w * 0.3, h: h * 0.105 };
  field(g, 'Date of expiry', upper(p.expiryDate), x2, h * 0.58, s);
  specimen(g, w, h);
  // Machine-readable zone.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, h * 0.76, w, h * 0.24);
  const mrz = { font: '"OCR B", "OCR-B", Consolas, "Courier New", monospace', weight: 600, spacing: 2 };
  text(g, mrzLine('P<TUNBEN<SALAH<<YASMINE'), w * 0.04, h * 0.86, h * 0.062, mrz);
  text(g, mrzLine(`${p.number}<0TUN9705129F${p.expiryDate.slice(2).replaceAll('-', '')}<<<<<<<<`), w * 0.04, h * 0.95, h * 0.062, mrz);

  const { u, ug } = blank(c);
  fibres(ug, w, h, 160, 5);
  rosette(ug, w * 0.78, h * 0.42, h * 0.3, '#7fd6ff', 0.5, 24, 1.1);
  rosette(ug, w * 0.175, h * 0.46, h * 0.2, UV_GREEN, 0.55, 14, 1);
  text(ug, 'TUN', w * 0.52, h * 0.72, h * 0.16, { weight: 700, color: 'rgba(198,241,157,0.35)', align: 'center', spacing: 18 });
  uvMark(ug, ex.x, ex.y, ex.w, ex.h);
  return { id: 'passport', aspect, visible: c, uv: u, hotspot: hs(c, ex.x, ex.y, ex.w, ex.h), finding };
}

function a4(tint: string, seed: number) {
  const { c, g } = canvas(210 / 297);
  paper(g, c.width, c.height, tint, seed);
  return { c, g, w: c.width, h: c.height };
}

function insurance(sample: Sample, finding?: Finding): DocTexture {
  const ins = sample.dossier.insurance as Full<'insurance'>;
  const { c, g, w, h } = a4('#efede6', 21);
  rosette(g, w * 0.82, h * 0.1, w * 0.12, '#b08a5a', 0.3, 16);
  text(g, 'Certificate of travel', w * 0.08, h * 0.1, w * 0.06, { weight: 700 });
  text(g, 'medical insurance', w * 0.08, h * 0.15, w * 0.06, { weight: 700 });
  text(g, 'Schengen visa · Policy SPEC-0000-2026', w * 0.08, h * 0.195, w * 0.03, { color: FAINT });
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(w * 0.08, h * 0.22, w * 0.84, 2);
  const s = w * 0.07;
  field(g, 'Insured person', ins.holderName, w * 0.08, h * 0.28, s);
  field(g, 'Territory', 'All Schengen states', w * 0.08, h * 0.36, s);
  field(g, 'Medical cover', `EUR ${ins.coverEur.toLocaleString('en-GB')}`, w * 0.08, h * 0.44, s);
  field(g, 'Repatriation', 'Included', w * 0.55, h * 0.44, s);
  const pr = { x: w * 0.065, y: h * 0.485, w: w * 0.87, h: h * 0.075 };
  field(g, 'Period of cover', `${pretty(ins.startDate)}  →  ${pretty(ins.endDate)}`, w * 0.08, h * 0.52, s);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = 'rgba(35,37,31,0.12)';
    g.fillRect(w * 0.08, h * (0.62 + i * 0.03), w * (0.5 + ((i * 37) % 30) / 100), h * 0.008);
  }
  // Round company stamp.
  g.save();
  g.strokeStyle = 'rgba(40,60,140,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w * 0.74, h * 0.86, w * 0.1, 0, Math.PI * 2);
  g.stroke();
  text(g, 'SPECIMEN', w * 0.74, h * 0.866, w * 0.032, { weight: 700, color: 'rgba(40,60,140,0.55)', align: 'center' });
  g.restore();
  specimen(g, w, h);

  const { u, ug } = blank(c);
  fibres(ug, w, h, 120, 9);
  rosette(ug, w * 0.82, h * 0.1, w * 0.12, '#7fd6ff', 0.6, 16, 1.1);
  uvMark(ug, pr.x, pr.y, pr.w, pr.h);
  return { id: 'insurance', aspect: 210 / 297, visible: c, uv: u, hotspot: hs(c, pr.x, pr.y, pr.w, pr.h), finding };
}

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function statements(sample: Sample, finding?: Finding): DocTexture {
  const st = sample.dossier.statements as Full<'statements'>;
  const { c, g, w, h } = a4('#f1efe9', 31);
  waves(g, w, h * 0.16, '#9aa6b5', 0.3, 16, 7);
  text(g, 'Relevé de compte', w * 0.08, h * 0.08, w * 0.06, { weight: 700 });
  text(g, 'Account statement · Specimen bank', w * 0.08, h * 0.12, w * 0.03, { color: FAINT });
  field(g, 'Holder', st.holderName, w * 0.08, h * 0.2, w * 0.065);
  const box = { x: w * 0.065, y: h * 0.255, w: w * 0.87, h: h * 0.085 };
  field(g, 'Statements enclosed', st.months.map(monthName).join(' · '), w * 0.08, h * 0.29, w * 0.065);
  // Ledger rows.
  const rand = rng(77);
  for (let i = 0; i < 16; i++) {
    const y = h * (0.38 + i * 0.032);
    g.fillStyle = i % 2 ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0)';
    g.fillRect(w * 0.08, y - h * 0.02, w * 0.84, h * 0.032);
    g.fillStyle = 'rgba(35,37,31,0.22)';
    g.fillRect(w * 0.08, y - h * 0.008, w * (0.25 + rand() * 0.25), h * 0.007);
    text(g, (rand() * 900 + 20).toFixed(3), w * 0.92, y, w * 0.026, { align: 'right', color: FAINT });
  }
  text(g, 'Closing balance', w * 0.08, h * 0.93, w * 0.035, { weight: 600 });
  text(g, `${st.closingBalance.toLocaleString('en-GB', { minimumFractionDigits: 3 })} TND`, w * 0.92, h * 0.93, w * 0.035, { weight: 700, align: 'right' });
  specimen(g, w, h);

  const { u, ug } = blank(c);
  fibres(ug, w, h, 110, 13);
  waves(ug, w, h * 0.16, '#7fd6ff', 0.55, 16, 7);
  uvMark(ug, box.x, box.y, box.w, box.h);
  return { id: 'statements', aspect: 210 / 297, visible: c, uv: u, hotspot: hs(c, box.x, box.y, box.w, box.h), finding };
}

function booking(sample: Sample, finding?: Finding): DocTexture {
  const b = sample.dossier.booking as Full<'booking'>;
  const aspect = 2.1;
  const { c, g } = canvas(aspect);
  const { width: w, height: h } = c;
  paper(g, w, h, '#f3f1ec', 41);
  g.fillStyle = '#2b3a33';
  g.fillRect(0, 0, w, h * 0.2);
  text(g, 'E-TICKET · FLIGHT BOOKING', w * 0.04, h * 0.13, h * 0.07, { weight: 700, color: '#eef0e8', spacing: 3 });
  text(g, 'TUN', w * 0.05, h * 0.45, h * 0.2, { weight: 700 });
  text(g, 'Tunis-Carthage', w * 0.05, h * 0.53, h * 0.05, { color: FAINT });
  text(g, 'CDG', w * 0.38, h * 0.45, h * 0.2, { weight: 700 });
  text(g, 'Paris-Charles de Gaulle', w * 0.38, h * 0.53, h * 0.05, { color: FAINT });
  g.fillStyle = INK;
  g.fillRect(w * 0.235, h * 0.37, w * 0.1, 3);
  const nm = { x: w * 0.035, y: h * 0.6, w: w * 0.5, h: h * 0.16 };
  field(g, 'Passenger', b.passengerName, w * 0.05, h * 0.66, h * 0.11);
  field(g, 'Outbound', upper(b.outboundDate), w * 0.05, h * 0.86, h * 0.09);
  field(g, 'Return', upper(b.returnDate), w * 0.3, h * 0.86, h * 0.09);
  // Barcode.
  const rand = rng(99);
  for (let x = w * 0.72; x < w * 0.95; x += 3 + Math.floor(rand() * 5)) {
    g.fillStyle = INK;
    g.fillRect(x, h * 0.32, 1 + Math.floor(rand() * 3), h * 0.5);
  }
  specimen(g, w, h);

  const { u, ug } = blank(c);
  fibres(ug, w, h, 90, 17);
  uvMark(ug, nm.x, nm.y, nm.w, nm.h);
  return { id: 'booking', aspect, visible: c, uv: u, hotspot: hs(c, nm.x, nm.y, nm.w, nm.h), finding };
}

const FINDING_DOC: Record<string, DocId> = {
  'passport.validity': 'passport',
  'insurance.period': 'insurance',
  'statements.months': 'statements',
  'identity.names': 'booking',
};

export function buildDossier(sample: Sample, findings: Finding[]): DocTexture[] {
  const byDoc = (id: DocId) => findings.find((f) => FINDING_DOC[f.id] === id && f.status === 'fail');
  return [insurance(sample, byDoc('insurance')), statements(sample, byDoc('statements')), passport(sample, byDoc('passport')), booking(sample, byDoc('booking'))];
}
