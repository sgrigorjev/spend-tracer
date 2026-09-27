## MODIFIED Requirements

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

## ADDED Requirements

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
