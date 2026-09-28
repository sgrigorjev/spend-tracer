## MODIFIED Requirements

### Requirement: Telegram link state in settings

The account settings page SHALL show whether the signed-in user's Telegram account is linked, based on the link status endpoint, and SHALL present a linked account as a success confirmation.

#### Scenario: Account already linked

- **WHEN** a signed-in user with a linked Telegram opens the settings page
- **THEN** the page shows a success-styled confirmation that Telegram is linked

#### Scenario: Account not linked

- **WHEN** a signed-in user without a linked Telegram opens the settings page
- **THEN** the page shows that Telegram is not linked and offers to link it

#### Scenario: Status unavailable

- **WHEN** the link status request fails
- **THEN** the page shows an error state instead of a link state
