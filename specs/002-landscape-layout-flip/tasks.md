# Tasks: Landscape Layout — Screen Left, Keyboard Right

**Input**: Design documents from `/specs/002-landscape-layout-flip/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: No automated tests — verified manually in the browser per quickstart.md.

**Scope**: Single file change — `src/scene/scene-layouts.ts`, two switch cases (`landscape` and `menuLandscape`) inside `computeLayout()`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

*No project initialisation or new files required. Proceed directly to user story phases.*

---

## Phase 2: Foundational

*No blocking prerequisites. All user story work can begin immediately.*

---

## Phase 3: User Story 1 — Landscape View Shows Screen and Keyboard Side by Side (Priority: P1) 🎯 MVP

**Goal**: Replace the current landscape layout (monitor centred, keyboard hidden) with a side-by-side layout — screen on the left half, keyboard on the right half — and move the menu button to the bottom centre.

**Independent Test**: Load the emulator in a landscape viewport (e.g., 812 × 375). Both screen and keyboard must be visible with no overlap. All keyboard keys must register when pressed. Joystick at bottom-left, menu button at bottom-centre, fire button at bottom-right.

### Implementation for User Story 1

- [x] T001 [US1] Rewrite the `landscape` case in `computeLayout()` in `src/scene/scene-layouts.ts` to compute left/right panel centers and scales using the half-width split logic from research.md: `halfW = (usableW - gap) / 2`, `leftCenterX = left + halfW/2`, `rightCenterX = right - halfW/2`, `monScale = min(1.4, halfW / MONITOR_UNIT_W)`, `kbScale = halfW / KB_UNIT_W`, both elements vertically centred above the controls row, keyboard `visible: true`
- [x] T002 [US1] Within the same `landscape` case in `src/scene/scene-layouts.ts`, update the controls row: move `menuButton` from `[right, top, 0.4]` to `[0, ctrlY, 0.4]` (bottom-centre between joystick and fire button)

**Checkpoint**: User Story 1 is complete — landscape shows both elements side by side with the correct controls arrangement.

---

## Phase 4: User Story 2 — Landscape Menu Overlay Remains Functional (Priority: P2)

**Goal**: Update the `menuLandscape` case to match the new side-by-side baseline, keeping the keyboard visible and both elements pushed back in Z with the existing 0.65 shrink factor.

**Independent Test**: Open the menu in landscape orientation. The overlay must appear centred over the viewport and all menu options must be accessible. Dismissing the menu returns to the US1 layout.

### Implementation for User Story 2

- [x] T003 [US2] Rewrite the `menuLandscape` case in `computeLayout()` in `src/scene/scene-layouts.ts` applying the same split logic as T001 with a 0.65 scale factor: `monScale = min(1.4, halfW / MONITOR_UNIT_W) * 0.65`, `kbScale = (halfW / KB_UNIT_W) * 0.65`, both at `pushZ = -4`, keyboard `visible: true`, menu button at `[0, ctrlY, pushZ]`

**Checkpoint**: User Stories 1 and 2 both pass — side-by-side layout works in base landscape and when the menu overlay is open.

---

## Phase 5: Polish & Verification

**Purpose**: Confirm acceptance criteria and guard against portrait regressions.

- [ ] T004 Run `bun run dev` and verify all landscape acceptance scenarios from quickstart.md: both elements visible, no overlap, all keys pressable, controls at correct positions, menu overlay functional
- [ ] T005 Verify portrait layouts are unchanged by checking portrait1 and portrait2 in a portrait viewport (no visual differences expected)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1–2)**: Nothing to do — proceed immediately
- **User Story 1 (Phase 3)**: No dependencies — start immediately
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (menu overlay must be coherent with the US1 layout)
- **Polish (Phase 5)**: Depends on Phases 3 and 4

### Within Each User Story

- T002 depends on T001 (same switch case — must be authored together or sequentially)
- T003 is independent of T001/T002 (different switch case, same file — can be done immediately after T001/T002 or deferred)

### Parallel Opportunities

No tasks touch different files in this feature, so no true parallelism applies. The two switch cases (`landscape` and `menuLandscape`) are logically independent and could be split across two agents working the same file in sequence.

---

## Parallel Example

```
# US1 and US2 switch cases are independent logic blocks:
Task T001+T002: "landscape" case rewrite in src/scene/scene-layouts.ts
Task T003:      "menuLandscape" case rewrite in src/scene/scene-layouts.ts
# Note: same file — complete T001/T002 first, then T003
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 — left/right split and scaling
2. Complete T002 — menu button to bottom-centre
3. **Validate**: Run `bun run dev`, open landscape viewport, confirm layout
4. Deploy / demo if ready

### Incremental Delivery

1. T001 + T002 → US1 complete → landscape is usable with keyboard
2. T003 → US2 complete → menu overlay coherent with new layout
3. T004 + T005 → full acceptance confirmed, portraits unaffected

---

## Notes

- No new files, dependencies, or build changes required
- All changes are pure coordinate and scale calculations — no logic branching
- If the visual result looks off, consult the constants table in quickstart.md (`MONITOR_UNIT_W`, `KB_UNIT_W`, `MARGIN`, `camZ`)
- Commit after T002 (US1 complete) and again after T003 (US2 complete)
