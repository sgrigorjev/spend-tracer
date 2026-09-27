## ADDED Requirements

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
