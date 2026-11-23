// Renders the fictional sample dossier as real text PDFs (pdf-lib), in French like most Tunisian
// documents, each stamped "SPECIMEN — fictional". Generated in the browser from today's date, so
// judges can download them, drop them back in, and watch Gemini Nano read them on-device.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { addYears, type ISODate } from '../rules/dates';
import type { DocKind } from '../rules/dossier';
import { buildMrz } from '../extract/mrz';
import { sampleDossier } from './sampleDossier';

const fr = (d?: ISODate) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthFr = (ym: string) => `${MONTHS_FR[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export const SAMPLE_FILES: Record<DocKind, string> = {
  passport: 'sample-1-passeport.pdf',
  insurance: 'sample-2-assurance-voyage.pdf',
  statements: 'sample-3-releves-bancaires.pdf',
  payslips: 'sample-4-fiches-de-paie.pdf',
  booking: 'sample-5-reservation-vol.pdf',
  accommodation: 'sample-6-reservation-hotel.pdf',
  leave: 'sample-7-titre-de-conge.pdf',
};

export function sampleTexts(applicationDate: ISODate, fixed = false): Record<DocKind, { title: string; lines: string[] }> {
  const { dossier: d } = sampleDossier(applicationDate, fixed);
  const p = d.passport!;
  const [mrz1, mrz2] = buildMrz({ surname: 'BEN SALAH', given: 'YASMINE', number: p.number!, birth: addYears(applicationDate, -29).slice(0, 8) + '14', expiry: p.expiryDate!, sex: 'F' });
  return {
    passport: {
      title: 'RÉPUBLIQUE TUNISIENNE — PASSEPORT / PASSPORT',
      lines: [
        'Type / Type: P    Code / Code: TUN',
        `N° du passeport / Passport No.: ${p.number}`,
        'Nom / Surname: BEN SALAH',
        'Prénoms / Given names: YASMINE',
        'Nationalité / Nationality: TUNISIENNE',
        `Date de délivrance / Date of issue: ${fr(p.issueDate)}`,
        `Date d'expiration / Date of expiry: ${fr(p.expiryDate)}`,
        'Autorité / Authority: TUNIS',
        '',
        mrz1,
        mrz2,
      ],
    },
    insurance: {
      title: 'ASSURANCES EXEMPLE — ATTESTATION D’ASSURANCE VOYAGE SCHENGEN',
      lines: [
        `Assuré(e) : ${d.insurance!.holderName}`,
        `Période de garantie : du ${fr(d.insurance!.startDate)} au ${fr(d.insurance!.endDate)}`,
        'Zone de validité : tous les États de l’espace Schengen',
        `Plafond frais médicaux et hospitalisation : ${d.insurance!.coverEur!.toLocaleString('fr-FR').replace(/ | /g, ' ')} EUR`,
        'Garanties : rapatriement sanitaire, soins urgents, hospitalisation d’urgence, rapatriement de corps',
        'Police n° EX-2026-55881',
      ],
    },
    statements: {
      title: 'BANQUE EXEMPLE DE TUNISIE — RELEVÉS DE COMPTE',
      lines: [
        `Titulaire : ${d.statements!.holderName}`,
        'Compte n° 00 000 0000000000000 00 (fictif)',
        'Devise : TND',
        '',
        ...d.statements!.months!.flatMap((m, i, all) => [
          `Relevé du mois de ${monthFr(m)}`,
          `   Salaire ${monthFr(m)} ........ +2 350,000`,
          `   Retraits et paiements ........ -1 ${(800 + i * 35).toString()},000`,
          `   Solde fin de mois : ${i === all.length - 1 ? '7 850,000' : (7000 + i * 400).toLocaleString('fr-FR').replace(/ | /g, ' ') + ',000'} TND`,
          '',
        ]),
      ],
    },
    payslips: {
      title: 'SOCIÉTÉ EXEMPLE SARL — BULLETINS DE PAIE',
      lines: [
        `Salarié : ${d.payslips!.employeeName}`,
        'Matricule CNSS : 00000000-00 (fictif)   Emploi : Ingénieure',
        ...d.payslips!.months!.map((m) => `Bulletin de paie — ${monthFr(m)} — Salaire net : 2 350,000 TND`),
      ],
    },
    booking: {
      title: 'AIR EXEMPLE — CONFIRMATION DE RÉSERVATION',
      lines: [
        `Passager : ${d.booking!.passengerName}`,
        'Référence : XK7Q2P',
        `Aller : Tunis-Carthage (TUN) → Paris-Orly (ORY), le ${fr(d.booking!.outboundDate)}`,
        `Retour : Paris-Orly (ORY) → Tunis-Carthage (TUN), le ${fr(d.booking!.returnDate)}`,
      ],
    },
    accommodation: {
      title: 'HÔTEL EXEMPLE PARIS — CONFIRMATION DE RÉSERVATION',
      lines: [
        `Client : ${d.accommodation!.guestName}`,
        `Arrivée : ${fr(d.accommodation!.checkIn)}`,
        `Départ : ${fr(d.accommodation!.checkOut)}`,
        'Chambre simple, petit-déjeuner inclus. Réservation n° 88213',
      ],
    },
    leave: {
      title: 'SOCIÉTÉ EXEMPLE SARL — TITRE DE CONGÉ',
      lines: [
        `Nous autorisons ${d.leave!.employeeName}, Ingénieure, à prendre un congé annuel`,
        `du ${fr(d.leave!.startDate)} au ${fr(d.leave!.endDate)} inclus.`,
        'Fait à Tunis. Le Directeur des Ressources Humaines.',
      ],
    },
  };
}

/** WinAnsi-safe text for the standard Helvetica font. */
const safe = (s: string) => s.replace(/→/g, '->').replace(/[’]/g, "'").replace(/[—]/g, '-');

export async function samplePdf(kind: DocKind, applicationDate: ISODate, fixed = false): Promise<Uint8Array> {
  const { title, lines } = sampleTexts(applicationDate, fixed)[kind];
  const doc = await PDFDocument.create();
  doc.setTitle(`CheckVisa sample — ${kind}`);
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  page.drawText('SPECIMEN - fictional document generated by CheckVisa for testing', { x: 40, y: 805, size: 9, font, color: rgb(0.75, 0.1, 0.1) });
  page.drawText(safe(title), { x: 40, y: 770, size: 13, font: bold });
  let y = 735;
  for (const line of lines) {
    const isMrz = /^[A-Z0-9<]{44}$/.test(line);
    page.drawText(safe(line), { x: 40, y, size: isMrz ? 10 : 11, font: isMrz ? mono : font });
    y -= 20;
  }
  return doc.save();
}
