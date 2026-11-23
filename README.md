# CheckVisa

**The consular officer's checklist, run privately on your laptop.**

CheckVisa helps applicants in **Tunisia** check a Schengen short-stay visa dossier *before* they pay the
non-refundable fee — using hybrid AI built on **Firebase AI Logic**: the on-device model (Gemini Nano in
Chrome) reads private documents, the cloud model (Gemini) works only on public, official rules.

> **Rules come down, documents never go up.**

Built for the Google Firebase **#BuildHybridAI 2026** hackathon. Status: **Step 1 of 10 — Hello hybrid**.

## Why

- 2025: **188,579** Schengen applications were lodged in Tunisia and **36,673** were refused (**19.6%**)
  (European Commission data, reported by La Presse, 25 Aug 2026).
- Each application costs at least ~400 TND (EUR 90 visa fee + visa-centre fee), non-refundable — roughly
  **14.7M TND a year** lost to refusals in fees alone (our estimate from the figures above).
- Appointments are scarce (waits of up to 3 months) and resold by intermediaries, so a refusal also costs months.
- The documents involved — passport, bank statements, payslips — are the most sensitive papers people own.

## How the hybrid AI is used

Every AI call declares a *data class*; one routing policy turns it into a Firebase AI Logic inference mode
([src/core/routing/policy.ts](src/core/routing/policy.ts), tested in [tests/core/policy.test.ts](tests/core/policy.test.ts)):

| Data class | Example | Inference mode |
|---|---|---|
| `PRIVATE` | passport, bank statement, payslip | `ONLY_ON_DEVICE` — cloud only with explicit consent |
| `PRIVATE_DERIVED` | explanation of a failed check | `PREFER_ON_DEVICE` — cloud gets rule ids + generic numbers only |
| `TRIP_FACTS` | destination, dates, purpose | `PREFER_IN_CLOUD` — falls back on-device when offline |
| `PUBLIC` | laws, consulate checklists | `ONLY_IN_CLOUD` |

Models are created in [src/core/ai/modelFactory.ts](src/core/ai/modelFactory.ts) with `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })`;
every answer shows where it ran (`response.inferenceSource`).

## Setup

Requirements: Node 22+, a Google account (Firebase Spark plan — free, no billing account), Chrome 148+ on desktop
for on-device inference.

1. Create a Firebase project and add a **Web app**.
2. **AI Logic** → Get started → choose the **Gemini Developer API** (free tier).
3. **Authentication** → Sign-in method → enable **Anonymous**.
4. **App Check** → register the web app with **reCAPTCHA v3** (create a v3 key at
   https://www.google.com/recaptcha/admin, put the *secret* key in the Firebase console), then enforce App Check
   for Firebase AI Logic.
5. `cp .env.example .env.local` and fill in the web config + the reCAPTCHA *site* key.
6. `npm install` → `npm run dev` → open http://localhost:5173.
7. On localhost, copy the **App Check debug token** printed in the browser console and register it in
   App Check → Apps → Manage debug tokens.

Deploy: `npm run build` then `npx firebase-tools deploy --only hosting`.

### On-device model in Chrome

Chrome desktop 148+ exposes the Prompt API to web pages. Requirements: a GPU with more than 4 GB VRAM, or 16 GB RAM
and 4 CPU cores, plus ~22 GB free disk. The first use downloads Gemini Nano — click **Prepare Gemini Nano** in the app.
Without it, CheckVisa still works through the cloud fallback (private documents need your explicit consent).

## Scripts

- `npm run dev` — local dev server
- `npm test` — unit tests (Vitest)
- `npm run typecheck` — TypeScript
- `npm run build` — production build into `dist/`

## Disclosure

Built during the #BuildHybridAI 2026 submission period (Nov 11–30, 2026) with the help of an AI coding assistant
(Claude Code). No pre-existing project code.

## License

Code: [Apache-2.0](LICENSE). CheckVisa is a pre-check tool, not legal advice.
