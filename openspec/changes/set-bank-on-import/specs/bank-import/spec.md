## MODIFIED Requirements

### Requirement: Profile confirmation

The system SHALL present a draft profile with a preview of the parsed rows and the invariant results, SHALL apply the profile to later files only after the user confirms it, SHALL let the user set the bank name for the profile at confirmation, and SHALL mark it verified on confirmation. A user-supplied bank name SHALL override any name carried by the generated mapping.

#### Scenario: Draft not applied before confirmation

- **WHEN** a draft profile exists but the user has not confirmed it
- **THEN** it is not applied to any later file

#### Scenario: Preview shown

- **WHEN** a profile is in draft
- **THEN** the user is shown the parsed rows and whether each invariant held

#### Scenario: Confirmed and rejected

- **WHEN** the user confirms the preview the profile becomes verified, and when the user rejects it the profile is discarded

#### Scenario: Bank name set by the user

- **WHEN** the user enters a bank name while confirming a draft profile
- **THEN** the profile stores that bank name and the statement created by the import records it

#### Scenario: Bank name left unchanged

- **WHEN** the user confirms a draft profile without entering a bank name
- **THEN** the profile keeps the bank name carried by the generated mapping, which may be null
