## Purpose

Reads a bank statement file, learns and reuses a declarative per-user mapping for each bank format, and turns statement rows into normalized transactions that reconciliation can match against existing expenses.

## ADDED Requirements

### Requirement: Statement file ingestion

The system SHALL accept a bank statement as a local file in CSV, XLSX, PDF or image form, SHALL determine the file kind from its content rather than only its extension, and SHALL report a clear error for a file it cannot read.

#### Scenario: Supported file accepted

- **WHEN** the user points the importer at a CSV, XLSX, PDF or image statement
- **THEN** the system reads the file and proceeds to format detection

#### Scenario: Kind taken from content

- **WHEN** a statement's extension does not match its actual content
- **THEN** the system uses the content to decide how to read it and ignores the misleading extension

#### Scenario: Unreadable file rejected

- **WHEN** the file is corrupt, empty or in a form the system cannot read
- **THEN** the system reports an error that names the file and writes nothing

### Requirement: Format detection and profile resolution

The system SHALL compute a format fingerprint from the normalized header set, the column count, the file kind and a signature of the sample data, and SHALL resolve an existing import profile for the importing user by that fingerprint. When a profile resolves, the system SHALL parse the file with that profile without calling the language model.

#### Scenario: Known format reused

- **WHEN** the user imports a file whose fingerprint matches a profile of theirs
- **THEN** the system parses the file with that profile and calls no model

#### Scenario: Header order does not defeat the fingerprint

- **WHEN** a bank reorders its columns but keeps the same header names
- **THEN** the fingerprint still matches the stored profile

#### Scenario: Changed format falls through to learning

- **WHEN** the header set or column count changes
- **THEN** no profile resolves and the system treats the format as new

### Requirement: Profile generation with the language model

When no profile resolves, the system SHALL derive a declarative mapping with the language model from the header row and a small sample of rows, or from the rendered document for PDF and image input. The mapping SHALL reference only column or field names and fixed transformations, SHALL carry no executable content, and SHALL be produced without sending the whole statement to the model.

#### Scenario: Mapping derived from a sample

- **WHEN** the format is new
- **THEN** the system sends the headers and a small sample of rows and receives a mapping of semantic roles to columns

#### Scenario: Roles cover the statement

- **WHEN** a mapping is generated
- **THEN** it identifies at least the date, amount and currency roles and any description, category, balance, card and direction roles the file provides

#### Scenario: No executable content

- **WHEN** a mapping is generated
- **THEN** it contains only role to column references and known transformation choices, and nothing that is executed

#### Scenario: Whole file not sent

- **WHEN** the format is new
- **THEN** the model receives only the headers and a bounded sample, not every row

### Requirement: Profile verification against invariants

Before a generated profile can be reused, the system SHALL apply it and verify that every row yields a parseable date and amount, that every currency is a known ISO-4217 code, and, when the mapping includes a balance column, that consecutive balances reconcile per account. The system SHALL keep a profile that fails any check in draft status and SHALL refuse to import with it.

#### Scenario: Invariants hold

- **WHEN** every row parses and any mapped balance sequence reconciles
- **THEN** the profile is eligible for confirmation

#### Scenario: Date or amount fails to parse

- **WHEN** a row yields no parseable date or amount
- **THEN** the profile stays in draft and is not applied

#### Scenario: Balance does not reconcile

- **WHEN** consecutive balances are inconsistent with the row amounts
- **THEN** the profile stays in draft and is not applied

### Requirement: Profile confirmation

The system SHALL present a draft profile with a preview of the parsed rows and the invariant results, SHALL apply the profile to later files only after the user confirms it, and SHALL mark it verified on confirmation.

#### Scenario: Draft not applied before confirmation

- **WHEN** a draft profile exists but the user has not confirmed it
- **THEN** it is not applied to any later file

#### Scenario: Preview shown

- **WHEN** a profile is in draft
- **THEN** the user is shown the parsed rows and whether each invariant held

#### Scenario: Confirmed and rejected

- **WHEN** the user confirms the preview the profile becomes verified, and when the user rejects it the profile is discarded

### Requirement: Profile reuse and scope

The system SHALL scope every import profile to the user who created it, SHALL never apply one user's profile to another user's file, and SHALL record on each profile its last use time and use count.

#### Scenario: Same user reuses

- **WHEN** the same user imports another file of the same format
- **THEN** their verified profile is applied automatically

#### Scenario: Another user is unaffected

- **WHEN** a different user imports a file of the same format
- **THEN** the first user's profile is neither visible nor applied, and the second user goes through detection on their own

#### Scenario: Use recorded

- **WHEN** a profile is applied
- **THEN** its last use time and use count are updated

### Requirement: Amount, currency and direction mapping

The system SHALL allow a profile to identify one or more amount columns together with their currencies, and SHALL treat the transaction-currency amount as authoritative when both a transaction-currency and an account-currency amount are present. It SHALL allow the outflow direction to be expressed as a signed amount, a direction column, or separate debit and credit columns.

#### Scenario: Both amounts present

- **WHEN** a row carries an amount in the transaction currency and an amount in the account currency
- **THEN** the transaction-currency amount and currency are used as authoritative and the account amount is retained

#### Scenario: Signed amount

- **WHEN** direction is expressed by the sign of a single amount
- **THEN** a negative amount is an outflow and a positive amount is an inflow

#### Scenario: Separate debit and credit columns

- **WHEN** direction is expressed by separate debit and credit columns
- **THEN** the populated column determines the direction

### Requirement: Row classification

The system SHALL classify each parsed row as an outflow, an inflow or a transfer, SHALL treat outflows as expense candidates, and SHALL retain inflows and transfers without creating expenses for them.

#### Scenario: Purchase is an outflow

- **WHEN** a row is a card purchase
- **THEN** it is classified as an outflow and is a candidate for an expense

#### Scenario: Inflow is not an expense

- **WHEN** a row is income or a credit
- **THEN** it is classified as an inflow and creates no expense

#### Scenario: Own-account transfer is not an expense

- **WHEN** a row moves money between the user's own accounts or cards
- **THEN** it is classified as a transfer and creates no expense

### Requirement: Transaction persistence and idempotency

The system SHALL store each statement and its rows immutably, SHALL compute a stable fingerprint for each row from its account, date, amount, currency, description and running balance, and SHALL not create a second transaction for a row whose fingerprint the user already has.

#### Scenario: Rows stored

- **WHEN** a statement is parsed
- **THEN** the statement and every row are stored, and no row is discarded by classification

#### Scenario: Overlapping re-import deduplicated

- **WHEN** the user imports a period that overlaps an earlier import
- **THEN** rows whose fingerprint already exists are not stored a second time

### Requirement: Parse integrity

The system SHALL refuse an import when the parsed rows cannot be reconciled with the statement's own totals or balance sequence, so a partially parsed file is never accepted without notice.

#### Scenario: Totals mismatch refused

- **WHEN** the sum of the parsed rows does not agree with the statement's stated totals or balance sequence
- **THEN** the system reports the mismatch and stores nothing

#### Scenario: Nothing written on refusal

- **WHEN** an import is refused for a failed integrity check
- **THEN** no statement, transaction or expense is written
