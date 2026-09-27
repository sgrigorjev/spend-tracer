## Purpose

Lets a signed-in user choose the currency and timezone their expenses are shown in, without changing how amounts are stored.

## ADDED Requirements

### Requirement: Read display settings

The system SHALL return the signed-in user's display currency and timezone.

#### Scenario: Signed in

- **WHEN** a signed-in user requests their settings
- **THEN** the system returns the display currency and timezone

#### Scenario: Not signed in

- **WHEN** an unauthenticated request reaches the settings endpoint
- **THEN** the system responds with 401

### Requirement: Update display settings

The system SHALL let the signed-in user update the display currency and timezone, together or one at a time, and SHALL persist the change so a later read returns the new values.

#### Scenario: Update both

- **WHEN** the user submits a new currency and timezone
- **THEN** the system stores both and returns them

#### Scenario: Update one

- **WHEN** the user submits only a new timezone
- **THEN** the timezone changes and the currency keeps its previous value

### Requirement: Settings validation

The system SHALL accept only a supported ISO-4217 currency code and a valid IANA timezone, and SHALL reject anything else with 400 while leaving the stored settings unchanged.

#### Scenario: Unknown currency

- **WHEN** the user submits a currency code that is not a supported ISO-4217 code
- **THEN** the system responds with 400 and code `invalid_currency`, and the stored currency is unchanged

#### Scenario: Invalid timezone

- **WHEN** the user submits a timezone that is not a valid IANA zone
- **THEN** the system responds with 400 and code `invalid_timezone`, and the stored timezone is unchanged

### Requirement: Display settings do not change storage

The display currency SHALL affect presentation only and SHALL NOT change the base currency or the stored amounts.

#### Scenario: Currency changed

- **WHEN** the user changes the display currency
- **THEN** existing expenses keep their stored amount, currency and base-currency equivalent
