// Deterministic cross-check for money amounts on Tunisian documents.
// Tunisian banks print dinars with 3 decimals (millimes) and a comma: "7 850,000 TND" = 7,850 dinars.
// Small models often drop the comma and read 7,850,000. Like the passport MRZ check, the printed text wins.

/** Every amount written in the Tunisian/French style: "7 850,000", "2.350,500", "950,000". */
export function parseTndAmounts(text: string): number[] {
  const re = /(?<![\d,.])(\d{1,3}(?:[ .  ]\d{3})*),(\d{3})(?![\d])/g;
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const whole = Number(m[1].replace(/[ .  ]/g, ''));
    out.push(whole + Number(m[2]) / 1000);
  }
  return out;
}

/** If the AI value is a printed amount ×1000 (millimes read as dinars), return the printed amount. */
export function fixMillimes(value: number | undefined, text: string): number | undefined {
  if (value === undefined) return value;
  const printed = parseTndAmounts(text);
  if (!printed.length || printed.some((p) => Math.abs(p - value) < 0.01)) return value;
  const hit = printed.find((p) => Math.abs(p * 1000 - value) < 1);
  return hit ?? value;
}
