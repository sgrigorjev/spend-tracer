# api-foundation Specification

## Purpose

Gives every API route the same authentication, input validation, response shape and error contract, and publishes a machine-readable OpenAPI document so the web app and reviewers have one source of truth for the API.

## Requirements

### Requirement: Unified authentication guard

Protected routes SHALL reject a request without a valid session with 401, and SHALL make the authenticated user available to the handler so no handler resolves the session itself.

#### Scenario: No session

- **WHEN** a request without a valid session reaches a protected route
- **THEN** the system responds with 401 and does not run the handler

#### Scenario: Valid session

- **WHEN** a request with a valid session reaches a protected route
- **THEN** the handler runs with the authenticated user

### Requirement: Request validation

Every route SHALL validate its path, query and body against its declared schema, and SHALL respond with 400 for invalid input without running the handler.

#### Scenario: Missing required field

- **WHEN** a request omits a required body field
- **THEN** the system responds with 400 and does not run the handler

#### Scenario: Wrong type

- **WHEN** a request supplies a value of the wrong type, such as a number where a string is expected
- **THEN** the system responds with 400 and does not run the handler

#### Scenario: Valid input

- **WHEN** a request matches the schema
- **THEN** the handler runs

### Requirement: Response serialization

Routes SHALL serialize responses through their declared schema, so a field not present in the schema is never sent to the client.

#### Scenario: Undeclared field

- **WHEN** a handler produces a value with a field the response schema does not declare
- **THEN** that field is omitted from the response

### Requirement: Consistent coded error shape

Every error response SHALL use a single body shape with a stable machine-readable `code` string and a human-readable `error` string, so a client can branch on the code without parsing the message.

#### Scenario: Error body

- **WHEN** any route responds with an error status
- **THEN** the body has a `code` string and an `error` string

#### Scenario: Stable code

- **WHEN** the same failure occurs on different requests or with different message wording
- **THEN** the `code` is the same string

#### Scenario: Validation failure

- **WHEN** a request fails schema validation
- **THEN** the status is 400 and the `code` is `validation_failed`

#### Scenario: Unauthenticated

- **WHEN** a request without a valid session reaches a protected route
- **THEN** the status is 401 and the `code` is `unauthorized`

### Requirement: OpenAPI document and UI

The system SHALL serve an OpenAPI document that describes every route with its schemas, and SHALL serve a browser UI for it.

#### Scenario: Document served

- **WHEN** a client requests the OpenAPI document
- **THEN** the system returns a valid OpenAPI document listing the API routes with their request and response schemas

#### Scenario: Docs UI served

- **WHEN** a browser opens the docs route
- **THEN** the system serves the interactive documentation page

#### Scenario: Docs require a session

- **WHEN** an unauthenticated client requests the OpenAPI document or the docs UI
- **THEN** the system responds with 401 and serves neither
