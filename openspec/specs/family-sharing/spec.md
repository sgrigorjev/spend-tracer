# family-sharing Specification

## Purpose

Lets users keep their expenses private by default and selectively share them by forming a family group, inviting other registered users, and choosing on the dashboard whose expenses to view.

## Requirements

### Requirement: Create a family group

The system SHALL let a signed-in user create a family group and become its owner and first active member.

#### Scenario: Group created

- **WHEN** a signed-in user creates a family group
- **THEN** the system stores the group with that user as owner and creates an active owner membership

#### Scenario: Only one active family

- **WHEN** a user who already has an active membership tries to create another family
- **THEN** the system refuses the second family

### Requirement: Invite a member

The system SHALL let the family owner invite a registered user by email, and the invitation SHALL grant no access until the invitee accepts.

#### Scenario: Owner invites a registered user

- **WHEN** the owner invites the email of a registered user
- **THEN** the system creates a membership with the invited status

#### Scenario: Unknown email

- **WHEN** the owner invites an email that has no registered account
- **THEN** the system rejects the invitation and creates no membership

#### Scenario: Non-owner cannot invite

- **WHEN** a member who is not the owner tries to invite someone
- **THEN** the system refuses the invitation

### Requirement: Accept or decline an invitation

The system SHALL let the invitee accept or decline an invitation, and SHALL grant visibility only on acceptance.

#### Scenario: Invitation accepted

- **WHEN** the invitee accepts
- **THEN** the membership becomes active and the invitee can see the family's expenses

#### Scenario: Invitation declined

- **WHEN** the invitee declines
- **THEN** the membership is removed and no access is granted

#### Scenario: Accept while already in a family

- **WHEN** the invitee already has an active membership and accepts another invitation
- **THEN** the system refuses to create a second active membership

### Requirement: Expense visibility

The system SHALL always show a viewer their own expenses, and SHALL show another user's expenses only when both are active members of the same family.

#### Scenario: Default private

- **WHEN** a viewer with no active family requests expenses
- **THEN** only the viewer's own expenses are visible

#### Scenario: Same family

- **WHEN** two users are active members of the same family
- **THEN** each can see the other's expenses

#### Scenario: Membership revoked

- **WHEN** a member leaves or is removed from the family
- **THEN** visibility is revoked in both directions immediately, while each expense keeps its original owner

### Requirement: Dashboard scope

The system SHALL support a dashboard scope of the viewer only, the whole family, or a single member, and SHALL reject a requested member who is outside the viewer's family.

#### Scenario: Own scope

- **WHEN** the scope is the viewer
- **THEN** only the viewer's expenses are included

#### Scenario: Family scope

- **WHEN** the scope is the family
- **THEN** the expenses of all active family members are included

#### Scenario: Single member scope

- **WHEN** the scope names an active family member
- **THEN** only that member's expenses are included

#### Scenario: Member outside the family

- **WHEN** the scope names a user who is not in the viewer's family
- **THEN** the system responds with 403 and returns no expenses

### Requirement: Leave and remove

The system SHALL let a member leave a family and the owner remove a member, and SHALL prevent the owner from leaving while active members remain.

#### Scenario: Member leaves

- **WHEN** an active member leaves
- **THEN** the membership is removed and visibility is revoked

#### Scenario: Owner removes a member

- **WHEN** the owner removes an active member
- **THEN** the membership is removed and visibility is revoked

#### Scenario: Owner cannot leave alone

- **WHEN** the owner tries to leave while other active members remain
- **THEN** the system refuses until ownership is transferred or the family is dissolved
