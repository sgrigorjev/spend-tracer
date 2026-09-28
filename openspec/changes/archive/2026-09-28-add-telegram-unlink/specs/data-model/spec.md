## ADDED Requirements

### Requirement: Telegram account unlinking

The system SHALL let a signed-in user remove the Telegram account linked to their account, SHALL clear the mapping, and SHALL invalidate any pending link token for that user so a deep link issued before the unlink cannot bind a Telegram account afterwards.

#### Scenario: Unlink a linked account

- **WHEN** a signed-in user with a linked Telegram asks to unlink
- **THEN** the system clears the mapping, and the bot treats that Telegram account as unlinked

#### Scenario: Pending link token is discarded

- **WHEN** a user unlinks while an issued link token is still valid
- **THEN** that token no longer resolves and cannot bind a Telegram account

#### Scenario: Unlink when nothing is linked

- **WHEN** a signed-in user without a linked Telegram asks to unlink
- **THEN** the system succeeds without changing any data
