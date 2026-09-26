## 1. Dependencies and plugins

- [x] 1.1 Add `zod`, `fastify-type-provider-zod`, `@fastify/swagger` and `@fastify/swagger-ui` to `api/package.json`; verify `npm install` succeeds and `npm run typecheck` is clean
- [x] 1.2 Register the zod type provider, `@fastify/swagger` and `@fastify/swagger-ui` in `api/src/index.ts`; verify the server starts and `GET /api/docs/json` returns an OpenAPI document

## 2. Authentication guard

- [x] 2.1 Add `decorateRequest` for the user and a `requireUser(store)` preHandler that answers 401 and sets the user; verify a test that an unauthenticated request to a protected route returns 401
- [x] 2.2 Move the auth, telegram and family routes to the guard and delete the repeated session block; verify the existing route tests still pass and no route resolves the session itself

## 3. Schemas, validation and errors

- [x] 3.1 Define request and response schemas for the auth routes; verify typecheck and that a bad Google token body returns 400
- [x] 3.2 Define schemas for the telegram routes; verify typecheck and the route tests
- [x] 3.3 Define schemas for the family routes, including the invite email as a string with format email; verify a non-string or invalid email returns 400
- [x] 3.4 Add a shared error-code list and a custom error handler that maps validation failures and thrown errors to `{ code, error }`, with domain refusals reusing the store reason strings; verify a validation failure returns 400 with code `validation_failed` and an unauthenticated request returns 401 with code `unauthorized`

## 4. Settings API

- [x] 4.1 Add `updateUserSettings(userId, fields)` to the shared store, updating each provided field independently; verify a test that a partial update leaves the other field unchanged
- [x] 4.2 Add `GET /api/settings` returning the display currency and timezone behind the guard; verify an unauthenticated call returns 401 and a signed-in call returns both values
- [x] 4.3 Add `PATCH /api/settings` accepting optional currency and timezone with schema validation; verify valid updates persist and are returned on the next read
- [x] 4.4 Reject an unsupported currency and an invalid timezone with 400 and no write; verify the stored settings are unchanged after each rejection

## 5. OpenAPI coverage

- [x] 5.1 Confirm every route carries schemas and appears in the OpenAPI document with its request and response shapes; verify `GET /api/docs/json` lists all routes
- [x] 5.2 Verify the docs UI is served at `/api/docs` and renders the document
- [x] 5.3 Put the docs routes behind the session guard; verify an unauthenticated request to `/api/docs/json` returns 401 and a signed-in request returns 200

## 6. Verification

- [x] 6.1 Run `npm run typecheck` in `api/` and `shared/`; verify both are clean
- [x] 6.2 Run `npm test` in `api/`; verify all route and store tests pass
- [x] 6.3 Manual check with the stack running: sign in, read and update settings in the browser, and confirm the OpenAPI document matches the actual responses
