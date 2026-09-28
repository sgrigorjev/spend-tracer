## MODIFIED Requirements

### Requirement: Expense visibility

The system SHALL always show a viewer their own expenses, and SHALL show another user's expenses only when both are active members of the same family. A participant on an expense SHALL always be an active member of the owner's family, and a reconciliation that would attach an expense to a user outside that family SHALL be refused.

#### Scenario: Default private

- **WHEN** a viewer with no active family requests expenses
- **THEN** only the viewer's own expenses are visible

#### Scenario: Same family

- **WHEN** two users are active members of the same family
- **THEN** each can see the other's expenses

#### Scenario: Membership revoked

- **WHEN** a member leaves or is removed from the family
- **THEN** visibility is revoked in both directions immediately, while each expense keeps its original owner

#### Scenario: Match across families refused

- **WHEN** a transaction would link to an expense belonging to a user outside the importing user's family
- **THEN** the system refuses the link and changes nothing

## ADDED Requirements

### Requirement: Shared expense participants

The system SHALL let a reconciled expense carry participants from the owner's family, so a payment made with another member's card appears as one expense with the paying member recorded as a payer and the confirming member recorded as a confirmer.

#### Scenario: Payment with another member's card

- **WHEN** a member imports a statement containing a payment made with their card for a purchase another member recorded
- **THEN** the two records become one expense listing both members, the card owner as payer and the importer as confirmer

#### Scenario: Participants stay in the family

- **WHEN** a participant is attached
- **THEN** the participant is an active member of the owner's family
