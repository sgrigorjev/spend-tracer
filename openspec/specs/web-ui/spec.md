# web-ui Specification

## Purpose

Lets the owner sign in from a browser with their Google account and reach a protected dashboard, without exposing the bot's expense data to anyone outside the email allowlist.

## Requirements

### Requirement: Sign in with Google

The system SHALL let a user authenticate with a Google ID token and, on success, return the signed-in user and establish a session.

#### Scenario: Valid Google ID token

- **WHEN** a user submits a valid Google ID token for an allowed email
- **THEN** the system verifies the token, creates or updates the account, returns the user, and sets a signed session cookie

#### Scenario: Invalid Google ID token

- **WHEN** a user submits an unverifiable or expired Google ID token
- **THEN** the system responds with 401 and does not create a session

### Requirement: Email allowlist

The system SHALL only allow sign-in for emails listed in the configured allowlist.

#### Scenario: Allowed email

- **WHEN** the verified email matches an entry in the allowlist
- **THEN** the system proceeds with sign-in

#### Scenario: Disallowed email

- **WHEN** the verified email does not match any entry in the allowlist
- **THEN** the system responds with 403 and does not create an account or session

### Requirement: Session

After sign-in the system SHALL identify the user on later requests from a signed cookie.

#### Scenario: Authenticated request

- **WHEN** a request carries a valid session cookie
- **THEN** the system treats the request as the signed-in user

#### Scenario: Missing or invalid session

- **WHEN** a request has no cookie or a cookie that fails signature validation
- **THEN** the system treats the request as unauthenticated

### Requirement: Configurable session lifetime

The system SHALL accept an optional session lifetime in seconds through `SESSION_MAX_AGE`. When it is a positive number, the session cookie SHALL be persistent with that max age and SHALL survive a browser restart. When it is unset or zero, the session cookie SHALL be a session cookie that ends when the browser closes.

#### Scenario: Persistent session configured

- **WHEN** `SESSION_MAX_AGE` is a positive number of seconds
- **THEN** the sign-in response sets a session cookie with that max age, and the session survives a browser restart

#### Scenario: Session lifetime unset

- **WHEN** `SESSION_MAX_AGE` is unset or zero
- **THEN** the session cookie ends when the browser closes

### Requirement: Current user

The system SHALL expose the authenticated user through a dedicated endpoint.

#### Scenario: Signed in

- **WHEN** a signed-in user requests the current-user endpoint
- **THEN** the system returns the user's profile

#### Scenario: Not signed in

- **WHEN** an unauthenticated request hits the current-user endpoint
- **THEN** the system responds with 401

### Requirement: Logout

The system SHALL end a session when the user logs out.

#### Scenario: Logout clears the session

- **WHEN** a signed-in user logs out
- **THEN** the system clears the session cookie so later requests are unauthenticated

### Requirement: Redirect to login

The web UI SHALL send an unauthenticated visitor to the login page when they open a protected route.

#### Scenario: Unauthenticated visit to a protected route

- **WHEN** a visitor with no valid session opens the root or dashboard route
- **THEN** the app shows the login page with a Google sign-in button

#### Scenario: Signed-in visit to a protected route

- **WHEN** a visitor with a valid session opens a protected route
- **THEN** the app shows the requested page instead of the login page

### Requirement: Protected dashboard

The system SHALL return a dashboard payload only to an authenticated user.

#### Scenario: Authenticated dashboard request

- **WHEN** a signed-in user requests the dashboard
- **THEN** the system returns the user and an expense total placeholder of `null`

#### Scenario: Unauthenticated dashboard request

- **WHEN** an unauthenticated request hits the dashboard
- **THEN** the system responds with 401
