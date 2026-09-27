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

The web UI SHALL redirect an unauthenticated visitor to `/login` when they open a protected route, changing the browser address rather than rendering the login form in place.

#### Scenario: Unauthenticated visit to a protected route

- **WHEN** a visitor with no valid session opens the root or the settings route
- **THEN** the browser address becomes `/login` and the login page renders

#### Scenario: Signed-in visit to a protected route

- **WHEN** a visitor with a valid session opens a protected route
- **THEN** the requested page renders and the address stays on that route

#### Scenario: Signed-in visitor opens the login route

- **WHEN** a signed-in user opens `/login`
- **THEN** the app redirects to the dashboard at `/`

### Requirement: Protected dashboard

The system SHALL return a dashboard payload only to an authenticated user.

#### Scenario: Authenticated dashboard request

- **WHEN** a signed-in user requests the dashboard
- **THEN** the system returns the user and an expense total placeholder of `null`

#### Scenario: Unauthenticated dashboard request

- **WHEN** an unauthenticated request hits the dashboard
- **THEN** the system responds with 401

### Requirement: Root and settings routes

The dashboard SHALL be served at the root path `/` with no separate dashboard address, and account settings SHALL be served at `/settings`. Both routes SHALL require a session.

#### Scenario: Signed-in user opens the root

- **WHEN** a signed-in user opens `/`
- **THEN** the dashboard shell renders

#### Scenario: Signed-in user opens settings

- **WHEN** a signed-in user opens `/settings`
- **THEN** the account settings page renders inside the same shell

### Requirement: Authenticated app shell

Authenticated routes SHALL render inside one shared shell whose header shows the brand, a theme toggle and the signed-in user's name and avatar, and whose user menu offers a link to account settings and a log-out action.

#### Scenario: Header identity

- **WHEN** a signed-in user opens any authenticated route
- **THEN** the header shows the user's name and avatar, falling back to initials when there is no avatar image

#### Scenario: Open account settings

- **WHEN** the user chooses Settings in the user menu
- **THEN** the app navigates to `/settings`

#### Scenario: Log out

- **WHEN** the user chooses Log out
- **THEN** the session ends and the app returns to `/login`

### Requirement: Account settings page

The account settings page SHALL show the signed-in user's display currency and timezone as editable fields, offer the currencies and IANA timezones the runtime supports, and save a change through the settings API while reflecting the saved values.

#### Scenario: Show current settings

- **WHEN** the user opens `/settings`
- **THEN** the fields show the currency and timezone returned by the API

#### Scenario: Save a change

- **WHEN** the user picks a new currency or timezone and saves
- **THEN** the API stores it and the page shows the saved values

#### Scenario: Invalid value rejected

- **WHEN** the API rejects a value with 400
- **THEN** the page shows an error and the stored settings stay unchanged

### Requirement: Telegram link state in settings

The account settings page SHALL show whether the signed-in user's Telegram account is linked, based on the link status endpoint.

#### Scenario: Account already linked

- **WHEN** a signed-in user with a linked Telegram opens the settings page
- **THEN** the page shows that Telegram is linked

#### Scenario: Account not linked

- **WHEN** a signed-in user without a linked Telegram opens the settings page
- **THEN** the page shows that Telegram is not linked and offers to link it

#### Scenario: Status unavailable

- **WHEN** the link status request fails
- **THEN** the page shows an error state instead of a link state

### Requirement: Issue a one-time Telegram link

When the account is not linked, the page SHALL request a single-use link token and present it as both a tappable Telegram deep link and a scannable QR code encoding the same link, together with the link's expiry.

#### Scenario: Start linking

- **WHEN** the user chooses to link Telegram
- **THEN** the page requests a token and shows the deep link, the matching QR code and the expiry

#### Scenario: Deep link not configurable

- **WHEN** the link endpoint returns no URL
- **THEN** the page explains that Telegram linking is not configured and shows no QR code

#### Scenario: Expired link

- **WHEN** the shown link passes its expiry without being used
- **THEN** the page shows that the link expired and lets the user create a new one

### Requirement: Link token lifetime in the browser

The page SHALL keep the issued link token only in memory while the linking panel is open, and SHALL discard it when the panel closes, when the link completes, and when the page reloads.

#### Scenario: Panel closed

- **WHEN** the user closes the linking panel before linking completes
- **THEN** the page discards the token

#### Scenario: Page reloaded

- **WHEN** the user reloads the page with a link pending
- **THEN** the page shows no previously issued token

### Requirement: Automatic detection of a completed link

While a link is pending, the page SHALL poll the link status and switch to the linked state on its own once the Telegram account is bound, without a manual refresh.

#### Scenario: Link completed on another device

- **WHEN** the Telegram account is bound while the linking panel is open
- **THEN** the page detects it by polling and shows the linked state without a reload

#### Scenario: Polling stops

- **WHEN** the linking panel closes
- **THEN** the page stops polling the link status
