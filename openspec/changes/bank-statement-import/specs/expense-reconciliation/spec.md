## Purpose

Matches imported transactions to expenses already recorded within a family, links a clear match, asks the user when a match is uncertain, creates an expense when there is none, and records the people involved so a payment made with another member's card stays one expense instead of becoming two.

## ADDED Requirements

### Requirement: Candidate selection

The system SHALL consider as match candidates only expenses that belong to an active member of the importing user's family, that are pending or confirmed, whose amount equals the transaction amount in the transaction currency, and whose expense date lies within a bounded window around the transaction date.

#### Scenario: Family member's expense is a candidate

- **WHEN** an imported transaction could correspond to an expense recorded by another active member of the same family
- **THEN** that expense is considered as a candidate

#### Scenario: Outside the family excluded

- **WHEN** an expense belongs to a user outside the importing user's family
- **THEN** it is never considered

#### Scenario: Amount or date outside the window excluded

- **WHEN** an expense's amount differs from the transaction amount or its date falls outside the window
- **THEN** it is not a candidate

#### Scenario: Rejected expense excluded

- **WHEN** an expense is rejected
- **THEN** it is not a candidate

### Requirement: Match scoring and bands

The system SHALL score each candidate by date proximity, description similarity and amount exactness. It SHALL link automatically when the best score is above a high threshold and no other candidate is close, SHALL ask the user when the best score falls in a middle band or several candidates are close, and SHALL create a new expense when no candidate is plausible.

#### Scenario: Clear single match linked

- **WHEN** one candidate scores above the high threshold and the next is clearly lower
- **THEN** the system links it without asking

#### Scenario: Uncertain match asks

- **WHEN** the best score is in the middle band
- **THEN** the system asks the user before linking

#### Scenario: Several close candidates ask

- **WHEN** two or more candidates score within a narrow range of each other
- **THEN** the system asks the user to choose

#### Scenario: No plausible match creates a new expense

- **WHEN** no candidate reaches the lower bound and no candidate exists at the amount and date
- **THEN** the system creates a new expense for the transaction without asking

### Requirement: Automatic linking

On an automatic link the system SHALL attach the transaction to the matched expense, SHALL record a payer and a confirmer for the importing user, and SHALL write both in one atomic operation.

#### Scenario: Link recorded

- **WHEN** an automatic link happens
- **THEN** the transaction references the matched expense and will not be reconciled again

#### Scenario: Payer and confirmer recorded

- **WHEN** an automatic link happens
- **THEN** the importing user is added as a confirmed payer and as a confirmer of the expense

#### Scenario: Atomic

- **WHEN** any part of the link cannot be written
- **THEN** no part of it is written

### Requirement: Uncertain match decision

When the system asks, it SHALL present the candidate expense with its date, amount, merchant and origin, and SHALL offer merge, create separate, and ignore. The chosen outcome SHALL persist and SHALL not be asked again for that transaction.

#### Scenario: Merge

- **WHEN** the user chooses merge
- **THEN** the transaction is linked to the candidate as in an automatic link

#### Scenario: Create separate

- **WHEN** the user chooses to create separately
- **THEN** a new expense is created from the transaction and the candidate is left unchanged

#### Scenario: Ignore

- **WHEN** the user chooses ignore
- **THEN** the transaction is marked resolved with no expense and creates nothing

#### Scenario: Decision not repeated

- **WHEN** a transaction has been resolved by any of these outcomes
- **THEN** a later import of the same transaction asks nothing

### Requirement: Creating an expense from a transaction

When a transaction has no match or the user chooses to create separately, the system SHALL create an expense owned by the importing user with source import, carrying the transaction amount, currency, date, description and category where the statement provides them.

#### Scenario: New expense with import source

- **WHEN** an outflow transaction is created as an expense
- **THEN** the expense has source import and is owned by the importing user

#### Scenario: Fields carried

- **WHEN** the transaction carries a date, amount, currency, description or category
- **THEN** those values are written to the expense

### Requirement: Family boundary on linking

The system SHALL allow a link only when the importing user and the expense's owner are active members of the same family, and SHALL refuse a link to any other user's expense.

#### Scenario: Same family allowed

- **WHEN** the importing user and the expense's owner share an active family
- **THEN** the link is allowed

#### Scenario: Non-member refused

- **WHEN** the expense's owner is not an active member of the importing user's family
- **THEN** the system refuses the link and reports it

### Requirement: Participant roles

An expense SHALL be able to carry participants with a role of recorder, payer or confirmer, each with an origin of bot, import or manual and a confidence. A bot-recorded expense SHALL record its owner as recorder and an assumed payer, and an import SHALL add a confirmed payer without removing the recorder.

#### Scenario: Bot records recorder and assumed payer

- **WHEN** an expense is recorded through the bot
- **THEN** its owner is recorded as recorder and as an assumed payer

#### Scenario: Import adds a confirmed payer

- **WHEN** a statement transaction is matched to a bot-recorded expense paid with another member's card
- **THEN** the importing user is added as a confirmed payer and the recorder stays

#### Scenario: Several payers

- **WHEN** more than one user is confirmed as a payer
- **THEN** the expense lists all of them

### Requirement: Enrichment from the transaction

On a link the system SHALL attach the card and bank data carried by the transaction to the expense detail without overwriting values the user entered.

#### Scenario: Card shown on the expense

- **WHEN** a transaction carrying a card is linked
- **THEN** the expense detail shows the card and the bank from the transaction

#### Scenario: User value kept

- **WHEN** the expense already carries a value the statement also provides
- **THEN** the user's value is kept and the statement value is stored on the transaction

### Requirement: Undo a link

The system SHALL let the user undo a link, SHALL detach the transaction, SHALL remove the participants the link added, and SHALL return the transaction to the unmatched state so it can be matched again.

#### Scenario: Undo detaches

- **WHEN** the user undoes a link
- **THEN** the transaction no longer references the expense

#### Scenario: Added participants removed

- **WHEN** a link is undone
- **THEN** the payer and confirmer records the link added are removed

#### Scenario: Rematch possible

- **WHEN** a link has been undone
- **THEN** the transaction can be matched again

### Requirement: Idempotent reconciliation

A transaction that has been resolved by linking, by creating an expense, or by being ignored SHALL not be reconciled again, and a re-import of an overlapping statement SHALL not produce a second expense or a second prompt.

#### Scenario: Resolved transaction skipped

- **WHEN** reconciliation runs again over an already resolved transaction
- **THEN** it is skipped

#### Scenario: Overlap produces no duplicate

- **WHEN** an earlier import is re-imported
- **THEN** no second expense, link or prompt is produced

### Requirement: Event log

The system SHALL record an event for each expense creation, link, unlink, enrichment and participant change, carrying the time, the actor and a reference to the source record.

#### Scenario: Link event

- **WHEN** a transaction is linked
- **THEN** an event naming the expense, the transaction and the actor is stored

#### Scenario: Undo event

- **WHEN** a link is undone
- **THEN** an event recording the undo is stored
