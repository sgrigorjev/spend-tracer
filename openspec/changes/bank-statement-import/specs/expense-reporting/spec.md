## MODIFIED Requirements

### Requirement: Personal scope

Both endpoints SHALL read the expenses the signed-in user owns and the expenses the user takes part in as a participant. Monetary aggregates SHALL attribute each expense to exactly one user: the confirmed payer when one exists, otherwise the recorder. A shared expense that the user takes part in but does not own and is not the confirmed payer of SHALL appear in the list marked as shared and SHALL contribute to no monetary aggregate for that user.

#### Scenario: Own expenses only

- **WHEN** a signed-in user with no shared expenses requests the summary or the list
- **THEN** only expenses they own are included in the aggregates and the list

#### Scenario: Shared expense shown but not counted for the non-payer

- **WHEN** a user takes part in an expense whose confirmed payer is another family member
- **THEN** the expense appears in the list marked as shared and is excluded from that user's monetary aggregates

#### Scenario: Shared expense counted for the payer

- **WHEN** the signed-in user is the confirmed payer of a shared expense
- **THEN** the expense is included in that user's monetary aggregates

#### Scenario: Unauthenticated

- **WHEN** a request carries no valid session
- **THEN** the system responds with 401

## ADDED Requirements

### Requirement: Attribution of shared expenses

The system SHALL attribute a shared expense by its confirmed payer, and SHALL fall back to the recorder when no payer is confirmed, so that a bot-recorded expense with no confirming statement is attributed to the user who recorded it.

#### Scenario: Confirmed payer wins

- **WHEN** an expense has a confirmed payer
- **THEN** the expense is attributed to that payer regardless of who recorded it

#### Scenario: Several confirmed payers

- **WHEN** an expense has more than one confirmed payer
- **THEN** the earliest recorded confirmed payer is used for monetary attribution and the others stay participants

#### Scenario: Recorder is the fallback

- **WHEN** an expense has no confirmed payer
- **THEN** the expense is attributed to the user who recorded it

#### Scenario: Family total counts once

- **WHEN** a family-scoped period is summarized
- **THEN** each shared expense contributes to the total once, no matter how many participants it has
