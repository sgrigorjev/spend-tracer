## Context

The API is Fastify 5 with 16 routes across four modules registered from `api/src/index.ts`. Sessions use `@fastify/secure-session`, Google tokens are verified with `google-auth-library`, and all data access goes through the shared store in `shared/src/db.ts` on `node:sqlite`. Every protected handler resolves the session itself with the same six lines, request bodies are cast by hand, and no route declares a schema, so there is neither validation, response serialization, nor a machine-readable contract.

## Goals / Non-Goals

**Goals:**

- One authentication guard, used by every protected route.
- Schema-based validation and response serialization on every route.
- One coded error shape across the API.
- A published OpenAPI document and docs UI generated from the runtime schemas.
- A settings API for the display currency and timezone.

**Non-Goals:**

- The dashboard read endpoints, which are a separate change.
- Changing response shapes the web app already consumes.
- Changing the authentication mechanism or the database schema.
- Rate limiting and request throttling.
- Generating a typed web client, which the OpenAPI document will enable later.

## Decisions

### Authentication guard as a preHandler

A `requireUser(store)` factory returns a preHandler that resolves the session, answers 401 when there is none, and sets the user on the request through a `decorateRequest` field. Handlers then read `request.user` and stop resolving the session. The alternative, a plugin scope that registers protected routes under an `onRequest` hook, centralizes more but hides which routes are protected; the explicit per-route preHandler keeps the protection visible next to the route.

### zod as the schema type provider

Routes declare schemas with zod through `fastify-type-provider-zod`, which gives runtime validation, TypeScript types inferred from the same schema, and the OpenAPI document, all from one definition. Alternatives: TypeBox, equally valid and closer to JSON Schema; raw JSON Schema, which is verbose and separates the type from the value; the current manual casts, which validate nothing. zod reads best and the inference is the reason to pick it.

### OpenAPI from the runtime schemas

`@fastify/swagger` builds the document from the route schemas and `@fastify/swagger-ui` serves it at `/api/docs`, with the JSON at `/api/docs/json`. Generating from the same schemas the routes validate with means the document cannot drift from behavior. The docs routes sit behind the session, using the same guard as every other protected route, so the API surface is not enumerable by anyone who reaches the app without signing in. A build-time client generator does not need the HTTP route, since the document can be produced by a script that builds the app and reads the schemas directly.

### Coded error shape

A custom error handler maps validation failures and thrown errors to `{ code: string, error: string }`. The `code` is a stable identifier the frontend branches on, and `error` is the human message. Domain refusals reuse the store reason strings as codes (`not_owner`, `unknown_email`, and the rest), and infrastructure failures use fixed codes (`unauthorized`, `validation_failed`, `not_found`, `internal_error`, `invalid_currency`, `invalid_timezone`). Fastify's default validation error is a detailed array; the handler collapses it to one code plus a message, which keeps the contract stable and avoids leaking internal schema details. The codes live in one shared place so the frontend and the tests can reference the same list.

### Settings storage and validation

`updateUserSettings(userId, fields)` in the store updates `display_currency` and `display_timezone` independently, so a partial update leaves the other value alone. The route accepts both fields as optional. The currency must be a supported ISO-4217 code and the timezone a valid IANA zone; both are checked before the write, and an invalid value is a 400 with nothing stored. The currency check uses the runtime currency list from `Intl.supportedValuesOf("currency")`, because `Intl.NumberFormat` accepts placeholder codes like `XXX` and `ZZZ`; the timezone check uses `Intl.DateTimeFormat`, which accepts IANA aliases. The display currency is presentation only and never touches the base currency or stored amounts.

## Risks / Trade-offs

- The docs routes reveal the API surface, so they are behind the session guard. A signed-in user can still read the contract, which is intended; the document carries no data or secrets.
- Validation changes the status code for some malformed requests that previously reached a handler and failed differently. Mitigated by keeping the 400 status the handlers already used and the same body keys, now with a `code` added.
- New dependencies widen the supply chain. Mitigated by using official Fastify plugins and zod, and by keeping the additions to four packages.
- Timezone validation by regex is wrong; a valid check uses the platform IANA list, so a regex is not used.
- Applying schemas to existing routes can subtly change serialized responses if a handler returns an undeclared field. Mitigated by declaring every field the current responses contain and by the existing route tests.
- Schema and handler can drift if a handler is edited without its schema. Mitigated by inferring handler types from the schema, so a mismatch fails typecheck.

## Migration Plan

1. Add the dependencies and register the type provider, swagger and the docs UI.
2. Add `requireUser` and `decorateRequest`, and move the auth routes to it.
3. Apply schemas and the guard to `telegram` and `family`, keeping response shapes and tests green.
4. Add `updateUserSettings` to the store and the settings routes.
5. Verify the OpenAPI document lists every route.

Rollback is a revert of the commit; no data migration is involved.
