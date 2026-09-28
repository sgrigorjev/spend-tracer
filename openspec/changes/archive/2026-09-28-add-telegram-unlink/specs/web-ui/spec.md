## ADDED Requirements

### Requirement: Unlink Telegram from settings

The account settings page SHALL let a signed-in user with a linked Telegram remove the link, SHALL ask for confirmation before removing it, and SHALL show the unlinked state once the link is removed.

#### Scenario: Confirmed unlink

- **WHEN** a linked user chooses to unlink Telegram and confirms
- **THEN** the page removes the link and shows the unlinked state with the option to link again

#### Scenario: Cancelled unlink

- **WHEN** a linked user starts the unlink and cancels the confirmation
- **THEN** the page sends no request and keeps the linked state

#### Scenario: Unlink fails

- **WHEN** the unlink request fails
- **THEN** the page shows an error and keeps the linked state
