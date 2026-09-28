## 1. Confirmation result and store

- [x] 1.1 Change `ProfileConfirmer` in `shared/src/import/pipeline.ts` to return `{ confirmed: boolean; bank?: string | null }`, and on confirmation use a supplied bank name over the mapping's name for the profile and the statement; verify a pipeline test with a stub that returns a bank name stores it on the profile and one without keeps the mapping's name
- [x] 1.2 Add `setProfileBank(userId, fingerprint, bank)` to the store and update the profile before it is marked verified; verify a test that a learned profile with a supplied name stores that name

## 2. CLI

- [x] 2.1 Add a `--bank <name>` flag and a bank-name question in the confirmation prompt, defaulting to the mapping's name and keeping it on an empty answer, and have `--yes` use the flag or the mapping's name; verify by re-learning a profile against a scratch database and confirming the stored name

## 3. Verification

- [x] 3.1 Run `npm run typecheck` in `shared/`, `bot/` and `api/`; verify all are clean
- [x] 3.2 Run the bot and API test suites; verify they pass
