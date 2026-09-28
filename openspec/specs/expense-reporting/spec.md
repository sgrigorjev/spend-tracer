# expense-reporting Specification

## Purpose

Lets a signed-in user read their own expenses over a chosen period as dashboard aggregates and a paged list, with each monetary figure shown in their display currency, compared against the previous period and projected to the end of the period.

## Requirements

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
