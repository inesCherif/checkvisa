# CheckVisa

**The consular officer's checklist, run privately on your laptop.**

CheckVisa helps people in **Tunisia** check a Schengen short-stay visa dossier *before* they pay the
non-refundable fee. It uses hybrid AI built on **Firebase AI Logic**: the on-device model (Gemini Nano in
Chrome) reads private documents, and the cloud model (Gemini) only gets public rules and trip facts.

> **Rules come down, documents never go up.**

- Live app: **https://checkvisa-dc172.web.app** (free, no account)
- Demo video (2:41): **https://youtu.be/KG7cXqiGfRY**
- Built for the Google Firebase **#BuildHybridAI 2026** hackathon. Platform: Web / Chrome.

## Why

- In 2025, **188,579** Schengen short-stay applications were lodged in Tunisia and **19.6%** were not issued
  (European Commission visa statistics, imported in [data/stats/](data/stats/); see the in-app *Statistics* page).
- Each application costs at least EUR 90 plus the visa-centre fee, and none of it is refunded. Appointments are scarce, so a refusal also costs months.
- Most refusal reasons on the official refusal form are about a missing or weak document: no valid insurance, not
  enough money shown, a booking that does not cover the stay. These can be caught before applying.
- The documents involved (passport, bank statements, payslips) are the most sensitive papers people own, so
  uploading them to an unknown website is a real risk. CheckVisa reads them on the device instead.

## What it does

1. **My trip**: destination, dates, purpose, job situation. You get a personal checklist built from official
   sources, the visa fee and its waivers, the money you must show (in EUR and TND), and where to apply in Tunisia.
2. **Check my dossier**: add your PDFs. **Gemini Nano reads them on your device** and extracts only the fields the
   rules need (as JSON, with a JSON-schema response constraint). The passport MRZ is checked with the ICAO 9303
   check digits. A deterministic rule engine then checks validity dates, insurance coverage (EUR 30,000, every day
   of the stay), 3 months of bank statements, enough money for the stay, a round trip, accommodation for every
   night, and more. Each result cites the exact article or official page, with a verbatim quote.
3. **Explain** a failed check (on-device first; if the cloud is needed it receives only the rule id and generic numbers),
   and **write a cover letter** (cloud, from trip facts only; your name and passport number are filled in locally
   after the text comes back).
4. **Privacy ledger**: every AI call in the session, where it ran, and the exact text that went to the cloud.
5. **Statistics**: not-issued rates per Schengen state for consulates in Tunisia (2023 vs 2025).
6. **Sources**: the 18 official sources behind every rule (EU law, Commission guidance, consulate pages,
   visa-centre pages, Central Bank of Tunisia), with retrieval date, SHA-256 and verification status.
7. **Landing page**: a WebGL "UV lamp" over a specimen dossier. The problems it reveals are computed live by the same
   rule engine on the fictional sample applicant; a timeline lets you move the trip and re-run the passport check.
8. **Optional account** (Google or email): saves only the trip answers and the checklist ticks (`users/{uid}` =
   `{ trip, checked, updatedAt }`, enforced by `firestore.rules`). Documents and results are never stored, with or
   without an account. The Account page shows the exact stored record and can delete it.

**Try it in 30 seconds:** open *Check my dossier* and click **Try the sample dossier**. It generates a
fictional applicant's PDFs in the browser with 4 planted mistakes (a passport that expires less than 3 months after
the trip, insurance that ends 2 days before the return, only 2 of the 3 required months of bank statements, and a
booking under a misspelled surname), and Gemini Nano finds them on-device. *Download sample PDFs* gives you the same files to upload by hand.

## How the hybrid AI is used

Every AI call declares a *data class*; one routing policy turns it into a Firebase AI Logic inference mode
([src/core/routing/policy.ts](src/core/routing/policy.ts), tested in [tests/core/policy.test.ts](tests/core/policy.test.ts)):

| Data class | Example | Inference mode |
|---|---|---|
| `PRIVATE` | passport, bank statement, payslip text | `ONLY_ON_DEVICE`; cloud only if the user ticks "Allow the cloud to read my documents" |
| `PRIVATE_DERIVED` | explanation of a failed check | `PREFER_ON_DEVICE`; the cloud gets rule ids and generic numbers only |
| `TRIP_FACTS` | destination, dates, purpose (cover letter) | `PREFER_IN_CLOUD`; falls back on-device when offline |
| `PUBLIC` | laws, consulate checklists | `ONLY_IN_CLOUD` |

Code pointers:

- [src/core/ai/modelFactory.ts](src/core/ai/modelFactory.ts): `getGenerativeModel(ai, { mode, inCloudParams, onDeviceParams })`, one cached model per mode; on-device inputs `en` + `fr` (Tunisian documents are often in French).
- [src/core/extract/extract.ts](src/core/extract/extract.ts): on-device extraction with `promptOptions.responseConstraint` (JSON schema) and `temperature 0`.
- [src/core/ai/assist.ts](src/core/ai/assist.ts): explain (reduced payload) and cover letter (placeholders filled locally).
- [src/core/routing/ledger.ts](src/core/routing/ledger.ts): records `response.inferenceSource` (`on_device` / `in_cloud`) for every call; the UI shows a badge on each answer.
- [src/core/ai/retry.ts](src/core/ai/retry.ts): retries temporary cloud errors (429 / 5xx "high demand") with backoff.
- [src/ui/HelloHybrid.tsx](src/ui/HelloHybrid.tsx) (*AI status* page): model availability, *Prepare Gemini Nano* (download progress via `initializeDeviceModel`), and a *Force cloud* switch to simulate a device without Nano.

## Architecture

```
Browser (React + Vite, Firebase Hosting)
 ├─ Rule engine (pure TypeScript, unit-tested)   src/core/rules/
 ├─ Extraction: pdf.js text → Gemini Nano JSON   src/core/extract/
 ├─ Firebase AI Logic (hybrid)                   src/core/ai/
 │    on-device: Chrome Prompt API (Gemini Nano)
 │    cloud:     Gemini Developer API (gemini-3.5-flash-lite, set by Remote Config)
 └─ Firebase
      App Check (reCAPTCHA Enterprise), enforced for AI Logic and Firestore
      Auth: anonymous for visitors, Google for the maintainer
      Firestore: public reference data only (sources, facts, statistics); never user data
      Remote Config: TND exchange rates, cloud model name
```

- Documents and extracted fields stay **in memory** only: never written to storage, Firestore or logs.
- The dataset ships in the bundle and is also published to Firestore from the maintainer page (`#/admin`), so
  rules can be updated without a redeploy; the app prefers the live copy ([src/firebase/library.ts](src/firebase/library.ts)).
- Firestore rules ([firestore.rules](firestore.rules)): signed-in users can read the public collections; only the maintainer can write.

## Data

[data/](data/) holds the dataset: 18 sources and 66 facts, each with a locator and a verbatim quote, plus
European Commission statistics. Released under CC BY 4.0 with attribution ([data/README.md](data/README.md)).
Facts whose official page could not be read automatically are marked `to-verify` and shown as such in the app.

## Setup

Requirements: Node 22+, a Google account (Firebase Spark plan, free, no billing account), Chrome desktop 148+ for
on-device inference.

1. Create a Firebase project and add a **Web app**.
2. **AI Logic** → Get started → **Gemini Developer API** (free tier).
3. **Authentication** → enable **Anonymous** (and **Google** if you want the maintainer page).
4. **Firestore** → create a database (production mode) and deploy [firestore.rules](firestore.rules) (put your UID in `isMaintainer()`).
5. Create a reCAPTCHA key (Google Cloud **Fraud Defense / reCAPTCHA Enterprise**, website, score-based) for your
   hosting domains and `localhost`. **App Check** → Apps → register the web app with **Fraud Defense** and that
   site key. Enforce App Check for AI Logic and Firestore.
6. `cp .env.example .env.local` and fill in the web config and `VITE_RECAPTCHA_SITE_KEY`.
7. `npm install` → `npm run dev` → http://localhost:5173. On localhost App Check uses a debug token: copy it from
   the browser console into App Check → Apps → *Manage debug tokens*.
8. Deploy: `npm run deploy` (builds, then deploys hosting, Firestore rules and Remote Config).

### Turning on Gemini Nano in Chrome

Chrome desktop 148+ exposes the Prompt API to web pages. The device needs a GPU with more than 4 GB VRAM, or 16 GB RAM
and 4 CPU cores, plus about 22 GB free disk. Open the *AI status* page and click **Prepare Gemini Nano**. The first
time, Chrome downloads the model (a few GB) and the page shows progress. You can check the state at
`chrome://on-device-internals`.

Without Nano, CheckVisa still works: trip checklist, statistics, cover letter and explanations use the cloud, and
reading documents asks for explicit consent before anything is sent.

## Testing

- `npm test`: unit tests (Vitest), covering the routing policy, rule engine, dates, money, MRZ, extraction parsing, dataset schema, statistics, Remote Config parsing and the retry logic.
- `npm run typecheck` · `npm run build`
- Manual: the sample dossier (above) should report exactly the 4 planted problems; the *AI status* page shows
  `On this device` or `Cloud` for each answer, and *Force cloud* shows the fallback.

## Disclosure

Built during the #BuildHybridAI 2026 submission period (Nov 11–30, 2026), with no pre-existing project code. An AI
coding assistant (Claude Code) helped write the code.

## License

Code: [Apache-2.0](LICENSE). Dataset: CC BY 4.0. CheckVisa is a pre-check tool, not legal advice.
