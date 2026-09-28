## MODIFIED Requirements

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

## ADDED Requirements

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
