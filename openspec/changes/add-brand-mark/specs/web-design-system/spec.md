## ADDED Requirements

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
