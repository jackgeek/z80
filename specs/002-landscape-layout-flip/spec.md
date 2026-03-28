# Feature Specification: Landscape Layout — Screen Left, Keyboard Right

**Feature Branch**: `002-landscape-layout-flip`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "modify the landscape layout to have the screen on the left and the keyboard on the right"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Landscape View Shows Screen and Keyboard Side by Side (Priority: P1)

A user views the emulator in landscape orientation (rotated device or wide desktop window). Both the emulator screen and the full ZX Spectrum keyboard are visible simultaneously — screen on the left half, keyboard on the right half — so they can type without switching to portrait mode.

**Why this priority**: This is the entire scope of the feature. Showing both elements at once in landscape is the core value: the keyboard becomes usable in landscape without hiding the screen.

**Independent Test**: Load the emulator in landscape orientation and confirm both the screen and keyboard are visible and correctly positioned side by side.

**Acceptance Scenarios**:

1. **Given** the emulator is in landscape orientation, **When** the scene loads, **Then** the emulator screen occupies the left half of the viewport and the keyboard occupies the right half, with no overlap.
2. **Given** the emulator is in landscape orientation, **When** the user taps or clicks any key on the right-side keyboard, **Then** the key registers as pressed in the emulator.
3. **Given** the emulator is in landscape orientation, **When** the user resizes the browser window to a wider aspect ratio, **Then** both elements remain proportionally scaled within their respective halves without clipping or off-screen positioning.
4. **Given** the emulator is in landscape orientation, **When** the controls row is visible, **Then** the menu button appears between the joystick (left) and the fire button (right) along the bottom of the viewport.

---

### User Story 2 - Landscape Menu Overlay Remains Functional (Priority: P2)

When the user opens the in-app menu while in landscape orientation, the overlay appears correctly over the new side-by-side layout without visual breakage or inaccessible options.

**Why this priority**: The menu is used frequently to load tapes and change settings. Breakage here would block primary workflows.

**Independent Test**: Open the menu in landscape mode and confirm all menu items are visible and interactive.

**Acceptance Scenarios**:

1. **Given** the emulator is in landscape orientation with the new layout, **When** the user opens the menu, **Then** the menu overlay appears centred over the viewport and all options are accessible.
2. **Given** the menu is open in landscape orientation, **When** the user dismisses the menu, **Then** the layout returns to screen-left / keyboard-right with no visual artifacts.

---

### Edge Cases

- What happens when the viewport is nearly square (aspect ratio close to 1:1)? Both elements must still fit without overlap or clipping.
- What happens on a short landscape viewport (e.g., browser toolbar consuming significant height)? Both elements should scale down uniformly rather than one obscuring the other.
- When the device switches from portrait to landscape mid-session, any in-progress emulator state (key held, tape loading) must not be disrupted by the layout change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In landscape orientation, the emulator screen MUST be positioned in the left half of the viewport.
- **FR-002**: In landscape orientation, the ZX Spectrum keyboard MUST be visible and positioned in the right half of the viewport.
- **FR-003**: The screen and keyboard MUST NOT overlap each other in landscape orientation.
- **FR-004**: All keyboard keys MUST remain interactive (pressable) in the new landscape layout.
- **FR-005**: Both the screen and the keyboard MUST scale proportionally to fit within their respective halves at any supported landscape viewport width.
- **FR-006**: The landscape menu overlay MUST continue to display correctly and remain fully functional over the new layout.
- **FR-007**: The joystick, fire button, and menu button controls MUST remain visible and accessible in landscape orientation.
- **FR-008**: In landscape orientation, the menu button MUST be positioned between the joystick and the fire button (bottom centre of the viewport), matching its position in portrait mode.
- **FR-009**: Portrait orientation layouts MUST remain unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In landscape orientation, 100% of keyboard keys are tappable/clickable and register correctly in the emulator.
- **SC-002**: The screen and keyboard are both fully visible (no clipping, no off-screen positioning) across landscape viewport widths from 568 px and up.
- **SC-003**: All menu actions in landscape mode execute correctly after the layout change — 0 regressions in menu functionality.
- **SC-004**: Portrait layout acceptance scenarios continue to pass without modification — 0 portrait regressions.

## Assumptions

- Portrait layouts (`portrait1`, `portrait2`) are out of scope and must not be modified.
- The keyboard is the existing ZX Spectrum keyboard model already present in the scene — no new asset is needed.
- "Left half" and "right half" refer to an approximately equal 50/50 horizontal split of the viewport, with a small gap between the two elements.
- The joystick, fire button, and menu button are arranged along the bottom of the viewport in landscape — joystick left, menu button centre, fire button right — mirroring their portrait positions.
- The landscape menu overlay scene should be updated to stay visually coherent with the new side-by-side baseline layout.
- The keyboard was previously hidden off-screen in landscape; making it visible and interactive is the primary behavioural change.
