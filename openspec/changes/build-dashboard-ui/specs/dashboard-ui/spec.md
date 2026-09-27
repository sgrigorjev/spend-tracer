## Purpose

Lets a signed-in user see their expenses for a chosen period on one screen: the totals and a comparison against the previous period, the spend per day with a projection of the remaining days, the split by category, and the expense rows.

## ADDED Requirements

### Requirement: Period selection

The dashboard SHALL offer the presets `day`, `week`, `two_weeks` and `month`, default to `month`, re-read the summary and the expense list when the preset changes, and show the range the API resolved.

#### Scenario: Default period

- **WHEN** a signed-in user opens the dashboard
- **THEN** the `month` preset is selected and the summary and the list are requested for the current month to date

#### Scenario: Switch preset

- **WHEN** the user chooses another preset
- **THEN** both requests use that preset and the summary and list update

#### Scenario: Resolved range shown

- **WHEN** the summary returns its period
- **THEN** the toolbar shows that range's start and end dates

### Requirement: Summary cards

The dashboard SHALL show the total spent, the transaction count, the daily average and the top category for the period. It SHALL annotate the transaction count with the pending count when there is one, and the total and the daily average with the delta against the previous period when the API returns one.

#### Scenario: Deltas shown

- **WHEN** the previous period has spend and the API returns a delta
- **THEN** the total and daily-average cards show the percentage delta

#### Scenario: No basis for a delta

- **WHEN** the API returns a null delta
- **THEN** the card shows no delta

#### Scenario: Pending noted

- **WHEN** the period has pending expenses
- **THEN** the transactions card shows how many await confirmation

#### Scenario: Top category

- **WHEN** the period has categories
- **THEN** the top-category card shows the largest one with its amount

### Requirement: Daily spend chart

The dashboard SHALL chart the spend per day of the period from the summary's daily series, and SHALL draw the projected remaining days as a distinct second series when the summary returns one.

#### Scenario: Every day present

- **WHEN** the period has days without spend
- **THEN** those days appear on the axis with a zero amount

#### Scenario: Projection drawn

- **WHEN** the summary returns projected days
- **THEN** they are drawn as a distinct series continuing after the last actual day

#### Scenario: No projection

- **WHEN** the preset has no remainder or the comparison period is empty
- **THEN** only the actual series is drawn

### Requirement: Category breakdown

The dashboard SHALL show the category totals as a donut together with a legend that lists each category's amount and share.

#### Scenario: Legend

- **WHEN** the period has spend in several categories
- **THEN** each category appears in the legend with its amount and share

#### Scenario: No spend

- **WHEN** the period has no spend
- **THEN** the chart shows an empty state

### Requirement: Expenses table

The dashboard SHALL list the period's expenses in the order the API returns them, with the date, description, category, payer, amount and status of each, and SHALL show the payer's name.

#### Scenario: Columns

- **WHEN** the period has expenses
- **THEN** each row shows the date, description, category, payer, amount and status

#### Scenario: Statuses

- **WHEN** a row is confirmed or pending
- **THEN** it carries the matching status badge, and no rejected expense appears

#### Scenario: Payer

- **WHEN** the dashboard reads only the signed-in user's expenses
- **THEN** the payer column shows the signed-in user

### Requirement: Pagination

The dashboard SHALL page the expense table and SHALL show which portion of the total is visible.

#### Scenario: More rows than a page

- **WHEN** the period has more expenses than fit on a page
- **THEN** Next loads the following page and Previous returns to the earlier one

#### Scenario: Position shown

- **WHEN** the list is displayed
- **THEN** the footer shows the visible range and the total count

#### Scenario: First page

- **WHEN** the first page is shown
- **THEN** Previous is disabled

### Requirement: Currency formatting

The dashboard SHALL format every monetary value with the currency the API returns.

#### Scenario: Response currency

- **WHEN** the summary and the list name a currency
- **THEN** amounts are formatted with that currency and its decimal places

### Requirement: Loading, empty and error states

The dashboard SHALL show a loading state while a request is in flight, an empty state when the period has no expenses, and an error state when a request fails, instead of a blank page.

#### Scenario: Loading

- **WHEN** a request is in flight
- **THEN** the dashboard shows a loading state

#### Scenario: Empty period

- **WHEN** the period has no expenses
- **THEN** the table shows an empty message and the totals are zero

#### Scenario: Request failure

- **WHEN** a request fails
- **THEN** the dashboard shows an error state
