# web-design-system Specification

## Purpose

Gives the web app one shared visual language, the Tailwind v4 and shadcn tokens from the mockups, so the Login page and later screens look alike and stay close to the design source.

## Requirements

### Requirement: Shared design tokens

The web app SHALL load one global stylesheet that defines the mockup design tokens and maps them to Tailwind utilities.

#### Scenario: Token-backed utility classes

- **WHEN** a component uses `bg-card`, `text-muted-foreground`, or `border-border`
- **THEN** it renders with the token values from the shared stylesheet

### Requirement: Inter typography

The web app SHALL render its text in Inter.

#### Scenario: Default font

- **WHEN** any page renders
- **THEN** body text uses Inter

### Requirement: Light and dark theme

The web app SHALL support a light and a dark theme, SHALL start in the operating system's preferred theme, and SHALL let the user switch between them.

#### Scenario: Switch theme

- **WHEN** the user activates the theme toggle
- **THEN** the app switches between the light and dark theme

#### Scenario: Theme persists across reloads

- **WHEN** the user has chosen a theme and reloads the page
- **THEN** the app renders the chosen theme with no flash of the other theme

### Requirement: Brand mark

The web app SHALL render one shared brand mark, an orange rounded tile with a white wallet glyph that matches the favicon, and SHALL use it in the app header and on the login card. The mark SHALL look the same in the light and dark themes.

#### Scenario: Header brand mark

- **WHEN** a signed-in user opens any authenticated route
- **THEN** the header shows the orange wallet mark next to the app name

#### Scenario: Login brand mark

- **WHEN** a signed-out visitor opens the login page
- **THEN** the login card shows the same orange wallet mark

#### Scenario: Both themes

- **WHEN** the user switches between the light and dark theme
- **THEN** the brand mark keeps its orange tile and white glyph and stays legible on both backgrounds

### Requirement: Login page presentation

The login page SHALL render in the shared visual language: a centered card with the brand mark, the app name, a sign-in subtitle, the Google sign-in control, an allowlist note, and a footer.

#### Scenario: Signed-out visitor opens the login page

- **WHEN** a visitor with no valid session opens the login page
- **THEN** the page renders the card with the Google sign-in control

### Requirement: Login loading and error states

The login page SHALL show a loading state while Google Identity Services initializes, and SHALL show an alert when sign-in fails. A rejected non-allowlisted account SHALL get a distinct message, and no server error text SHALL reach the page.

#### Scenario: Google Identity Services is loading

- **WHEN** Google Identity Services has not finished loading
- **THEN** the sign-in control area shows a loading state

#### Scenario: Account not on the allowlist

- **WHEN** sign-in is rejected with HTTP 403
- **THEN** the page shows the allowlist error message

#### Scenario: Other sign-in failure

- **WHEN** sign-in fails for any other reason
- **THEN** the page shows a generic error message and does not expose server details
