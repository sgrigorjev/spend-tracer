## MODIFIED Requirements

### Requirement: Telegram account linking

The system SHALL link a Telegram account to a signed-in user through a single-use token with a limited lifetime, SHALL keep the Telegram account and the user mapping one-to-one, and SHALL keep at most one live link token per user.

#### Scenario: Successful link

- **WHEN** a signed-in user opens the link for a valid token and the bot receives that token from the matching Telegram account
- **THEN** the system binds that Telegram account to the user and marks the token used

#### Scenario: Token in a group chat

- **WHEN** the token arrives as a start command in a group the bot is in
- **THEN** the bot binds the sender's Telegram account the same way as in a private chat

#### Scenario: Expired or reused token

- **WHEN** the bot receives a token that is unknown, expired or already used
- **THEN** the system binds nothing and reports the failure

#### Scenario: Account already linked

- **WHEN** the Telegram account is already linked to another user
- **THEN** the system refuses the second link

#### Scenario: New link supersedes an earlier pending link

- **WHEN** a signed-in user requests a new link token while an earlier unused token for the same user is still valid
- **THEN** the earlier token stops working and only the new one can be redeemed

#### Scenario: Stale tokens are removed when a link is created

- **WHEN** a new link token is created
- **THEN** tokens that had expired or were already used are removed and no longer resolve on redemption
