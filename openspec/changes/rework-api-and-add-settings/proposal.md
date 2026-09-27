## Why

The API grew one endpoint at a time and now repeats the same session check in twelve handlers, casts request bodies by hand, and validates nothing. There is no machine-readable contract, so the web app cannot generate a client and reviewers cannot see the request and response shapes. The dashboard read endpoints and a settings screen are next, so the conventions should be set once, before more routes copy the current shape.

## What Changes

- Add a single authentication guard that resolves the session user and decorates the request, replacing the copy-pasted `getSessionUser` plus 401 block in every protected handler.
- Define a request and response schema for every route, with one validation path and one coded error shape, replacing the manual `request.body as {...}` casts.
- Return errors as `{ code, error }`, where `code` is a stable identifier the frontend branches on and `error` is the human message.
- Publish an OpenAPI document and a `/api/docs` UI generated from those schemas.
- Add a user settings API: read and update the preferred display currency and timezone.
- Add a store method to update a user's display settings.
- Add `zod`, `fastify-type-provider-zod`, `@fastify/swagger` and `@fastify/swagger-ui` to the API.

## Capabilities

### New Capabilities

- `api-foundation`: one authentication guard for protected routes, schema-based request validation and response serialization, a single coded error shape, and a published OpenAPI document.
- `user-settings`: reading and updating a user's preferred display currency and timezone, validated against ISO-4217 and IANA.

### Modified Capabilities

None. The dashboard read endpoints are a separate change.

## Impact

- `api/src/routes/*.ts`: auth guard, schemas and error handling applied to every route.
- `api/src/index.ts`: register the schema type provider, the OpenAPI plugin and the docs UI.
- `api/src/routes/settings.ts`: new settings endpoints.
- `shared/src/db.ts`: add `updateUserSettings`.
- `api/package.json`: new dependencies.
- `web/`: unchanged now, but the generated OpenAPI can drive a typed client later.
