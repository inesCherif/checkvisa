# CheckVisa dataset

Official rules and reference data for Schengen short-stay visa applications lodged in **Tunisia**.
Every fact records its source, the exact locator (article / page / section) and a short verbatim quote.

- `sources.json` — source registry: publisher, authority, URL, permanent id (ELI/CELEX), version date,
  retrieval date, SHA-256 of the file read, licence, refresh cadence, verification status.
- `facts/*.json` — facts used by the rule engine (EU law, refusal grounds, harmonised list for Tunisia,
  money per day per state, visa centres and booking rules).
- `stats/` — European Commission visa statistics for consulates in Tunisia (imported with
  `scripts/import-ec-stats.mjs`).

Status `to-verify` means the official page could not be read automatically yet; the app shows it as such.

## Licence and attribution
The compilation is released under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).
EU documents are reused under Commission Decision 2011/833/EU, © European Union. National government pages are
cited as facts with short quotes and links only. Statistics: © European Union, DG Migration and Home Affairs.
