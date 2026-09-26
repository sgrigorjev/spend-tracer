## ADDED Requirements

### Requirement: Configurable session lifetime

The system SHALL accept an optional session lifetime in seconds through `SESSION_MAX_AGE`. When it is a positive number, the session cookie SHALL be persistent with that max age and SHALL survive a browser restart. When it is unset or zero, the session cookie SHALL be a session cookie that ends when the browser closes.

#### Scenario: Persistent session configured

- **WHEN** `SESSION_MAX_AGE` is a positive number of seconds
- **THEN** the sign-in response sets a session cookie with that max age, and the session survives a browser restart

#### Scenario: Session lifetime unset

- **WHEN** `SESSION_MAX_AGE` is unset or zero
- **THEN** the session cookie ends when the browser closes
