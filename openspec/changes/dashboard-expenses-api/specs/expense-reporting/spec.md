## Purpose

Lets a signed-in user read their own expenses over a chosen period as dashboard aggregates and a paged list, with each monetary figure shown in their display currency, compared against the previous period and projected to the end of the period.

## ADDED Requirements

### Requirement: Period presets

The system SHALL accept a period preset of `day`, `week`, `two_weeks` or `month`, defaulting to `month`, and an optional anchor date defaulting to today in the user's display timezone. It SHALL resolve the current range as local calendar dates and return the resolved range, with the range running through the anchor day.

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

### Requirement: Previous-period comparison

The system SHALL resolve a comparison range as the previous calendar unit for the preset and return it alongside the current range. For `month` it is the full previous calendar month, for `week` the previous Monday through Sunday, for `day` the previous day, and for `two_weeks` the 14 days immediately before the current range.

#### Scenario: Month comparison

- **WHEN** the current range is a month to date
- **THEN** the comparison range is the whole previous calendar month

#### Scenario: Week comparison

- **WHEN** the current range is a week to date
- **THEN** the comparison range is the previous Monday through Sunday

#### Scenario: Day comparison

- **WHEN** the current range is a single day
- **THEN** the comparison range is the previous day

#### Scenario: Two-week comparison

- **WHEN** the current range is 14 days
- **THEN** the comparison range is the 14 days ending the day before the current range starts

### Requirement: Period summary

The system SHALL return, for the current range, the total spend, the transaction count, the pending count and pending spend, the daily average, a per-day series covering every day in the range, per-category totals with their share, and the top category. It SHALL also return the total and the daily average for the comparison range and their percentage delta against the current range.

#### Scenario: Total spend

- **WHEN** the summary is requested
- **THEN** the total is the sum of the confirmed expenses in the period

#### Scenario: Daily series is dense

- **WHEN** a day in the range has no expenses
- **THEN** the day appears in the series with a zero amount

#### Scenario: Category shares

- **WHEN** the summary is requested
- **THEN** each category carries its amount and its share of the total, and the shares add up to the whole

#### Scenario: Top category

- **WHEN** the summary is requested
- **THEN** the top category is the one with the largest amount in the period

#### Scenario: No previous spend

- **WHEN** the comparison range has no confirmed spend
- **THEN** the percentage delta is null rather than a division by zero

### Requirement: Projected spend for the remaining period

For calendar presets the system SHALL project the remaining days of the period from the comparison range: for `month` from the day after the anchor through the last day of the month, and for `week` from the day after the anchor through Sunday. The expected amount for a remaining day SHALL be the average of the same weekday's confirmed spend in the comparison range, and the system SHALL return the projected days and the projected period total, which is the current confirmed spend plus the sum of the expected remaining days.

#### Scenario: Month remainder

- **WHEN** the preset is `month` and the anchor is before the last day of the month
- **THEN** the projection covers the day after the anchor through the last day of the month

#### Scenario: Week remainder

- **WHEN** the preset is `week` and the anchor is before Sunday
- **THEN** the projection covers the day after the anchor through Sunday

#### Scenario: Expected by weekday

- **WHEN** a remaining day falls on a weekday with spending in the comparison range
- **THEN** its expected amount is the average of that weekday's confirmed spend in the comparison range

#### Scenario: Projected total

- **WHEN** a projection is returned
- **THEN** the projected total equals the current confirmed spend plus the sum of the expected remaining days

#### Scenario: No remainder

- **WHEN** the preset is `day` or `two_weeks`
- **THEN** the projection is empty and the projected total is null

#### Scenario: Empty comparison range

- **WHEN** the comparison range has no confirmed spending
- **THEN** the projection is empty and the projected total is null, rather than zeros or an error

### Requirement: Expense list

The system SHALL return the current range's expenses ordered by expense date descending with a stable tiebreak, pageable by limit and offset, together with the total number of matching rows. Each row SHALL carry its date, description, category, amount, currency and status.

#### Scenario: Paged result

- **WHEN** a request supplies a limit and an offset
- **THEN** the response returns that slice and the total count of matching rows

#### Scenario: Ordering

- **WHEN** several expenses share the same expense date
- **THEN** they are ordered consistently between requests

### Requirement: Status inclusion

The system SHALL include confirmed and pending expenses in the transaction count and the list, SHALL count only confirmed expenses as spend, SHALL report the pending count and amount separately, and SHALL exclude rejected expenses from the count, the list and every aggregate.

#### Scenario: Pending included and reported separately

- **WHEN** the period contains pending expenses
- **THEN** they count toward the transaction count and appear in the list, and their count and amount are reported on their own

#### Scenario: Rejected excluded

- **WHEN** the period contains a rejected expense
- **THEN** it is absent from the total, the count, the series, the categories and the list

#### Scenario: Spend is confirmed only

- **WHEN** the period contains confirmed and pending expenses
- **THEN** the total spend is the confirmed amount alone

### Requirement: Display-currency amounts

The system SHALL return every monetary value in the user's display currency, converting the base-currency aggregate with a single rate per request, and SHALL include the currency code used in the response.

#### Scenario: Display currency differs from the base currency

- **WHEN** the user's display currency differs from the database base currency
- **THEN** each returned monetary value is converted with one rate and the response names the display currency

#### Scenario: No rate available

- **WHEN** no conversion rate can be resolved
- **THEN** the response returns base-currency amounts and names the base currency

#### Scenario: Missing base equivalent

- **WHEN** an expense has no stored base-currency equivalent
- **THEN** it contributes to no monetary aggregate while still counting toward the transaction count and appearing in the list

### Requirement: Personal scope

Both endpoints SHALL read only expenses owned by the signed-in user.

#### Scenario: Own expenses only

- **WHEN** a signed-in user requests the summary or the list
- **THEN** only expenses owned by that user are included

#### Scenario: Unauthenticated

- **WHEN** a request carries no valid session
- **THEN** the system responds with 401
