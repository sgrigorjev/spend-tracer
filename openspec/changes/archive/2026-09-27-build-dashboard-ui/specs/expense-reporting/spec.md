## MODIFIED Requirements

### Requirement: Period presets

The system SHALL accept a period preset of `day`, `week`, `two_weeks` or `month`, defaulting to `month`, and an optional anchor date defaulting to today in the user's display timezone. It SHALL resolve the current range as local calendar dates and return the resolved range, with the range running through the anchor day, together with the last day of the period's calendar unit.

#### Scenario: Month default

- **WHEN** a request omits the preset
- **THEN** the current range starts on the first day of the anchor's calendar month and ends on the anchor day

#### Scenario: Day preset

- **WHEN** the preset is `day`
- **THEN** the current range is the anchor day alone

#### Scenario: Week preset

- **WHEN** the preset is `week`
- **THEN** the current range starts on the Monday of the anchor's week and ends on the anchor day

#### Scenario: Two-week preset

- **WHEN** the preset is `two_weeks`
- **THEN** the current range starts 13 days before the anchor and ends on the anchor day

#### Scenario: Unknown preset

- **WHEN** a request supplies a preset outside the allowed set
- **THEN** the system responds with 400

#### Scenario: Period end returned

- **WHEN** a summary or list request resolves a period
- **THEN** the returned period carries both the anchor day it runs through and the last day of its calendar unit
