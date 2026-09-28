# data-model Specification

## Purpose

Defines the storage contract shared by the bot and the API: one database, user-owned expenses, a registration gate on what the bot may store, and consistent conventions for dates, money, currency and status.

## Requirements

### Requirement: Single shared database

The system SHALL store users, identities, expenses, messages and link tokens in one SQLite database that both the bot and the API open, replacing the separate bot and API database files.

#### Scenario: Both services use the same file

- **WHEN** the bot and the API start
- **THEN** both open the same database path from configuration

#### Scenario: Concurrent access

- **WHEN** the bot writes an expense while the API reads users
- **THEN** the database uses a rollback journal with a busy timeout so both operations succeed

### Requirement: User-owned expenses

Every expense SHALL reference exactly one primary owner, the user who submitted the message that produced it or the user whose import created it, and SHALL attribute the expense to that owner. An expense MAY additionally carry participants, each an active member of the same family, recorded with a role and an origin.

#### Scenario: Expense attributed to sender

- **WHEN** a linked user submits an expense message
- **THEN** the stored expense references that user as its primary owner

#### Scenario: Expense attributed to the importer

- **WHEN** an expense is created from an imported transaction
- **THEN** the stored expense references the importing user as its primary owner

#### Scenario: Payment on behalf of someone else

- **WHEN** the message says the payment was for another person
- **THEN** the expense still references the sender as owner, and the other person is named only in the description

#### Scenario: Participants are family members

- **WHEN** an expense carries participants beyond its owner
- **THEN** each participant is an active member of the same family as the owner

### Requirement: Registration and linking gate

The bot SHALL record expenses only from senders whose Telegram account is linked to a registered user, and SHALL discard messages from unlinked senders without storing them.

#### Scenario: Linked sender

- **WHEN** a linked user sends text, a receipt photo or a voice message
- **THEN** the bot extracts and stores the expense under that user

#### Scenario: Unlinked sender

- **WHEN** an unlinked sender sends any message
- **THEN** the bot replies once with the registration link, extracts nothing and stores no message or expense

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

### Requirement: Date storage and grouping

The system SHALL store the record time as a UTC instant, the spend time as a local timestamp with an offset plus a precision of either date or minute, and SHALL materialize a separate expense date for grouping and filtering.

#### Scenario: Receipt with date and time

- **WHEN** the spend time is known to the minute
- **THEN** the system stores it with its local offset and sets the precision to minute

#### Scenario: Receipt with date only

- **WHEN** only the calendar date of the spend is known
- **THEN** the system stores a date value and sets the precision to date

#### Scenario: Spend time missing

- **WHEN** the message carries no spend time
- **THEN** the expense date is the record time converted to the user's timezone

#### Scenario: Grouping by local day

- **WHEN** the dashboard groups expenses by day
- **THEN** it uses the materialized expense date, not the UTC instant, so a local evening expense stays on its local day

### Requirement: Money and currency

The system SHALL store every amount as an integer count of minor units with an ISO-4217 currency, and SHALL store the equivalent in a base currency together with the exchange rate and rate date used at write time.

#### Scenario: Same currency

- **WHEN** the expense currency equals the base currency
- **THEN** the base equivalent equals the amount and the rate is 1

#### Scenario: Foreign currency

- **WHEN** the expense currency differs from the base currency
- **THEN** the system converts using the rate for the spend date and stores the rate and its date

#### Scenario: Rate unavailable

- **WHEN** no rate is available for the spend date
- **THEN** the base equivalent is left empty for a later backfill and the original amount is unchanged

### Requirement: Expense status

The system SHALL classify each expense as pending, confirmed or rejected, and SHALL count only confirmed expenses as spend while reporting pending amounts separately and excluding rejected ones.

#### Scenario: Confirmed and pending reported separately

- **WHEN** the dashboard asks for a period
- **THEN** the response reports confirmed spend and the pending amount as separate values

#### Scenario: Rejected excluded

- **WHEN** an expense is rejected
- **THEN** it contributes to no spend total and no pending amount

### Requirement: Account and identity storage

The system SHALL store each account once per email and each external identity once per provider and subject, with identities held separately from accounts.

#### Scenario: Repeated sign-in

- **WHEN** a user signs in again with the same provider identity
- **THEN** the system reuses the existing account and updates the last login time

#### Scenario: Same email, new provider

- **WHEN** a new provider identity arrives for an existing email
- **THEN** the system attaches the new identity to the existing account

### Requirement: Profile display settings

The system SHALL store a display currency and an IANA display timezone per user and SHALL expose them with the user profile.

#### Scenario: Defaults on creation

- **WHEN** a new account is created
- **THEN** it receives the configured default display currency and timezone

#### Scenario: Profile returned

- **WHEN** the API returns the signed-in user
- **THEN** the payload includes the display currency and timezone

### Requirement: Message log scope

The system SHALL store a raw message only for a linked user, so the log never contains messages from senders who have not registered and linked.

#### Scenario: Linked message logged

- **WHEN** a linked user sends a message
- **THEN** the raw text is stored with a reference to that user

#### Scenario: Unlinked message not logged

- **WHEN** an unlinked sender sends a message
- **THEN** no message row is written

### Requirement: Family membership storage

The system SHALL store family groups and their memberships with a role of owner or member and a status of invited or active, and SHALL allow a user at most one active membership across all families.

#### Scenario: Active membership stored

- **WHEN** a user is an active member of a family
- **THEN** the membership records the family, the user, the role and the status

#### Scenario: Invited membership

- **WHEN** a membership is created by an invitation
- **THEN** its status is invited until the invitee accepts

#### Scenario: Second active family rejected

- **WHEN** a user who already has an active membership accepts another invitation
- **THEN** the system refuses to create a second active membership

### Requirement: Expense origin

The system SHALL store for every expense how it was created, from the values text, photo, voice or import, and SHALL keep the origin fixed after creation.

#### Scenario: Bot origin

- **WHEN** an expense comes from a message
- **THEN** its origin records text, photo or voice to match the message

#### Scenario: Import origin

- **WHEN** an expense comes from an imported transaction
- **THEN** its origin records import

### Requirement: Bank statement storage

The system SHALL store each imported statement once, with the importing user, the detected bank and format, the file name, the covered period where known, and the import time.

#### Scenario: Statement stored

- **WHEN** a statement is imported
- **THEN** the system stores one statement row with its metadata and links the transactions parsed from it

### Requirement: Imported transaction storage

The system SHALL store every parsed statement row immutably with its account, date, amount and currency, the account-currency amount where it differs, description, category, running balance, direction and its fingerprint, together with the expense it resolved to when one exists.

#### Scenario: Row stored with its fingerprint

- **WHEN** a statement row is parsed
- **THEN** it is stored with a fingerprint unique to the user, and a row whose fingerprint already exists is not stored again

#### Scenario: Resolution stored

- **WHEN** a transaction is linked to an expense, created as an expense, or ignored
- **THEN** the transaction records that outcome so it is not reconciled again

### Requirement: Import profile storage

The system SHALL store import profiles per user, each keyed by a format fingerprint and carrying the declarative role mapping, the parsing directives, a status of draft or verified, and a last use time and use count.

#### Scenario: Profile owned by its user

- **WHEN** a profile is stored
- **THEN** it references the user who created it and is unique per user and fingerprint

#### Scenario: Status stored

- **WHEN** a profile is generated it is stored as draft, and when the user confirms it the status becomes verified

### Requirement: Expense participant storage

The system SHALL store the participants of an expense as rows carrying the expense, the user, a role of recorder, payer or confirmer, an origin of bot, import or manual, and a confidence.

#### Scenario: Participant stored

- **WHEN** a participant is attached to an expense
- **THEN** a row records the expense, the user, the role, the origin and the confidence

#### Scenario: Same role from different origins

- **WHEN** a user is an assumed payer recorded by the bot and later a confirmed payer recorded by an import
- **THEN** the higher-confidence record is kept without losing the recorder

### Requirement: Expense event storage

The system SHALL store an append-only event for each expense creation, link, unlink, enrichment and participant change, carrying the expense, the event kind, the time, the actor and an optional reference to a statement transaction.

#### Scenario: Event appended

- **WHEN** an expense changes through creation, linkage or a participant change
- **THEN** one event row is appended and no earlier event is modified
