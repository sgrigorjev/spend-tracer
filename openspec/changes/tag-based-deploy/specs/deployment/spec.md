## Purpose

Defines how a released version is named and how a named version is rolled out to the server by hand, so what runs in production is always an explicit, reversible release rather than whatever happens to be on `main`.

## ADDED Requirements

### Requirement: Release is an immutable semver tag

The project SHALL mark every released state with an annotated git tag of the form `vMAJOR.MINOR.PATCH`, published on GitHub as a Release with generated notes. A published tag SHALL NOT be moved, deleted or reused for a different commit.

#### Scenario: Cutting a release

- **WHEN** the maintainer decides `main` is ready to ship
- **THEN** an annotated tag `vX.Y.Z` is created on the target commit and published as a GitHub Release with generated notes

#### Scenario: Tag is never moved

- **WHEN** a defect is found in a released version
- **THEN** a new version is tagged rather than re-pointing the existing tag

### Requirement: Deploy targets one named version

The deploy command SHALL deploy the exact commit of the named release tag and nothing else. It SHALL accept both `X.Y.Z` and `vX.Y.Z` and resolve them to the same tag.

#### Scenario: Deploy a specific version

- **WHEN** the operator runs the deploy command with version `1.0.0`
- **THEN** the working tree is switched to tag `v1.0.0`, the stack is rebuilt and restarted from that commit, and the deployed version is reported

#### Scenario: Unknown version is rejected

- **WHEN** the deploy command is given a version with no matching tag
- **THEN** it fails with an error naming the missing tag and leaves the running stack unchanged

### Requirement: Deploys are explicit and never automatic

No process SHALL deploy without an operator-issued deploy command. A commit or merge reaching `main` SHALL NOT by itself change what runs in production.

#### Scenario: Merge to main does not deploy

- **WHEN** a pull request is merged into `main`
- **THEN** the running stack is unchanged until the operator deploys a version

### Requirement: Repeated deploys are idempotent

Deploying the version that is already running SHALL be a no-op unless a force flag is given, and a forced deploy SHALL rebuild the same version.

#### Scenario: Same version is a no-op

- **WHEN** the operator deploys the version that is already running without the force flag
- **THEN** the command reports that the version is already deployed and does not rebuild or restart the stack

#### Scenario: Force redeploys the current version

- **WHEN** the operator deploys the current version with the force flag
- **THEN** the stack is rebuilt and restarted from that version

### Requirement: Deployment is serialized

The deploy command SHALL hold a lock so that two concurrent invocations cannot interleave and leave the stack in a mixed state.

#### Scenario: Second invocation cannot interleave

- **WHEN** a deploy is in progress and another deploy is started
- **THEN** the second invocation does not run a second concurrent checkout and rebuild

### Requirement: Runtime state survives deployment

Switching to a release tag SHALL NOT modify the environment file or the data directory, which are excluded from version control.

#### Scenario: Checkout leaves env and data intact

- **WHEN** a deploy switches the working tree to a tag
- **THEN** the environment file and the data directory keep their contents

### Requirement: Deployment status is observable

The deploy command SHALL report, on demand, the version currently deployed and the state of the stack, and SHALL be able to list recent release tags.

#### Scenario: Status of the running deployment

- **WHEN** the operator asks for the deploy status
- **THEN** the command prints the currently deployed version and the container state of the stack

#### Scenario: List recent releases

- **WHEN** the operator asks to list releases
- **THEN** the command prints the most recent release tags

### Requirement: Any release can be rolled back to

Deploying an earlier release tag SHALL restore that version on the server.

#### Scenario: Roll back to an earlier release

- **WHEN** the operator deploys an earlier release tag after a bad rollout
- **THEN** the stack runs that earlier version again
