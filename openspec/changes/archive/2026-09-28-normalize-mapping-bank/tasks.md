## 1. Normalize the mapping bank

- [x] 1.1 In `shared/src/import/learn.ts`, trim the bank in `parseMappingReply` and map an empty string or the text null, none or n/a to null while keeping a real name; verify a test that a placeholder yields null and a real name is kept

## 2. Verification

- [x] 2.1 Run `npm run typecheck` in `shared/`, `bot/` and `api/`; verify all are clean
- [x] 2.2 Run the bot import test suite; verify it passes
