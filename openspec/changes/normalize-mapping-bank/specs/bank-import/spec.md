## ADDED Requirements

### Requirement: Mapping placeholder normalization

The system SHALL treat a placeholder bank value from a generated mapping, such as an empty string or the text null, none or n/a, as no bank, and SHALL store null instead of the placeholder. A real bank name SHALL be kept unchanged.

#### Scenario: Placeholder becomes no bank

- **WHEN** a generated mapping carries the text null as the bank name
- **THEN** the profile and the statement record no bank

#### Scenario: Real name kept

- **WHEN** a generated mapping carries a real bank name
- **THEN** the profile and the statement record that name
