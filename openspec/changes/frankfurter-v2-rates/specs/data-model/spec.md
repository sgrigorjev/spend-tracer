## ADDED Requirements

### Requirement: Exchange-rate coverage

The system SHALL resolve an exchange rate for every ISO-4217 currency it stores by querying a rate source that covers that currency, so a currency outside the European Central Bank reference list, such as UAH, is converted rather than left empty. When the source has no rate for the requested date, the system SHALL fall back to the nearest earlier rate it already holds, and otherwise SHALL leave the base equivalent empty for a later backfill.

#### Scenario: Covered currency converts

- **WHEN** an expense is stored in a currency the rate source quotes, such as UAH
- **THEN** the base equivalent, the rate and the rate date are stored

#### Scenario: Missing date falls back

- **WHEN** the source has no rate for the expense date but an earlier rate is cached
- **THEN** the nearest earlier rate is used

#### Scenario: No rate at all

- **WHEN** neither the source nor the cache has a rate for the currency
- **THEN** the base equivalent stays empty and the original amount is unchanged

### Requirement: Base-equivalent backfill

The system SHALL provide a way to recompute the base equivalent of expenses whose base amount is empty, using the rate for each expense's own date, and SHALL update the base amount, the base currency, the rate and the rate date together.

#### Scenario: Empty base filled

- **WHEN** the backfill runs over an expense with an empty base equivalent and a rate is available
- **THEN** the base amount, currency, rate and rate date are written

#### Scenario: Filled rows untouched

- **WHEN** the backfill runs over an expense that already has a base equivalent
- **THEN** it is left unchanged

#### Scenario: Rate still unavailable

- **WHEN** no rate can be resolved for an expense even after the backfill
- **THEN** the base equivalent stays empty and the expense is reported as unresolved
