# Frontend Skeleton Implementation Action Plan (TDD-first)

## Scope and assumptions

### Assumptions

1. This plan covers the **frontend shell skeleton only** (layout, navigation, breadcrumb, theme toggle, and blank pages).
2. No backend feature logic is introduced for the new pages at this stage.
3. `App.tsx` remains a thin composition shell, aligned with frontend architecture guidance.

### Applicable standards and constraints

- Keep implementation in active areas only (`src/frontend/**`).
- Keep changes minimal and localised.
- Use British English in user-facing copy, comments, and docs.
- Follow frontend testing and lint command hierarchy from project docs.
- Keep tests aligned with the existing frontend stack:
  - Vitest + Testing Library for unit/component behaviour.
  - Playwright for browser-level user journeys and runtime integration.

---

## Ant Design component map (with documentation links)

- **Layout / Sider / Header / Content**: app shell and collapsible left panel.  
  https://ant.design/components/layout
- **Menu**: icon-only collapsed mode, icon+label expanded mode, nested items support for future tree navigation.  
  https://ant.design/components/menu
- **Breadcrumb**: top breadcrumb trail reflecting current page context.  
  https://ant.design/components/breadcrumb
- **Switch**: top-right light/dark mode toggle.  
  https://ant.design/components/switch
- **ConfigProvider + theme algorithms** (`defaultAlgorithm`, `darkAlgorithm`): app-wide theme switching.  
  https://ant.design/components/config-provider
- **Typography**: blank page headings and placeholder content.  
  https://ant.design/components/typography
- **Button + Ant Design icons**: hamburger control and navigation icons.  
  https://ant.design/components/button  
  https://ant.design/components/icon

---

## TDD process to apply in every section

For each section below, use the same cycle:

1. **Red**: write failing tests first (Vitest and/or Playwright).
2. **Green**: implement the smallest change to make tests pass.
3. **Refactor**: tidy without altering behaviour, keeping tests green.
4. Re-run section-level tests and then run full frontend checks.

### Standard validation commands

- `npm run frontend:test -- <target-spec>` for focused Vitest checks.  
  `<target-spec>` must be relative to `src/frontend/` (no leading `src/frontend/`).  
  Example: `npm run frontend:test -- src/App.spec.tsx`
- `npm run frontend:test:e2e -- <target-e2e-spec>` for focused Playwright checks.  
  `<target-e2e-spec>` must be relative to `src/frontend/` (no leading `src/frontend/`).  
  Example: `npm run frontend:test:e2e -- e2e-tests/auth-status.spec.ts`
- `npm run frontend:test` for full frontend unit/component suite (runs via `npm --prefix src/frontend`).
- `npm run frontend:test:e2e` for full frontend e2e suite (runs via `npm --prefix src/frontend`).
- `npm run frontend:lint` for lint validation.

---

## 1) Create Ant Design app shell with collapsible Sider and top header

### Task descriptor

Refactor `App.tsx` from simple header/content into a shell composed of `Layout`, `Sider`, `Header`, and `Content`. Add a top-left hamburger toggle for collapsing and expanding the side panel.

### Constraints

- Keep `App.tsx` thin and compositional.
- Do not add service orchestration or backend calls to `App.tsx`.
- Keep implementation simple and deterministic.

### Acceptance criteria

- App renders with top header, left collapsible navigation rail, and content region.
- Hamburger button toggles collapsed state reliably.
- No direct service modules are introduced into `App.tsx`.

### Required TDD tests

#### Vitest (component/invisible state + structure)

- `renders shell landmarks`: header, sidenav, and content regions are present.
- `toggles collapsed state via hamburger`: first click collapses, second click re-expands.
- `updates accessible control label/state when toggled`: button label/aria state reflects collapse status.
- `does not regress existing auth card mounting path`: dashboard default still renders expected placeholder/legacy content if retained.

#### Playwright (user-visible browser behaviour)

- `shows shell on initial load`: header + left rail visible in browser.
- `hamburger collapses and expands nav rail visually`: width/state changes and icons remain visible.
- `keyboard activation of hamburger works`: Enter/Space triggers toggle in browser.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_ Added `AppShell` to keep `App.tsx` thin while introducing the section 1 header, collapsible left rail, and main content region. The existing auth status card remains mounted in the main content path.
- _Any deviations from plan:_ None.
- _Follow-up considerations affecting later stages:_ The temporary rail marker should be replaced by the typed menu model in section 2 without moving state orchestration back into `App.tsx`.

---

## 2) Add navigation model and left panel menu for four pages

### Task descriptor

Create a typed navigation configuration for Dashboard, Classes, Assignments, and Settings. Render it via Ant Design `Menu` in the `Sider` and wire page selection state.

### Constraints

- Use a data-driven items model so nested `children` can be added later.
- Avoid duplicated labels across menu/page/breadcrumb data sources.
- No speculative extra pages or navigation behaviour.

### Acceptance criteria

- Collapsed nav displays icons only.
- Expanded nav displays icon + label.
- Selecting an item updates highlighted menu state and active page state.
- Structure is tree-ready for future nested entries.

### Required TDD tests

#### Vitest

- `nav config contains exact four page entries with stable keys`.
- `menu renders all four entries in expanded mode with expected labels`.
- `menu renders icon-only affordance in collapsed mode`.
- `clicking each menu item updates selected key in component state`.
- `selected key drives active page renderer mapping deterministically`.

#### Playwright

- `user can navigate to Dashboard/Classes/Assignments/Settings via menu clicks`.
- `active menu item styling changes when selecting a new page`.
- `collapsed mode still allows navigation by icon click`.
- `menu remains functional after repeated collapse/expand cycles`.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_

---

## 3) Implement breadcrumb trail in the top bar

### Task descriptor

Add `Breadcrumb` in the top bar (or directly beneath it), driven by current page metadata shared with the navigation config.

### Constraints

- Keep breadcrumb generation data-driven.
- Avoid duplicated hard-coded strings.
- Keep current implementation minimal (base level + active page) but extensible.

### Acceptance criteria

- Breadcrumb reflects the active page.
- Breadcrumb updates when page selection changes.
- No routing library dependency is required for this stage.

### Required TDD tests

#### Vitest

- `breadcrumb renders base crumb and active page crumb on default load`.
- `changing selected page updates breadcrumb text immediately`.
- `breadcrumb labels are sourced from shared metadata (single source of truth)`.
- `no stale breadcrumb state after rapid page switching`.

#### Playwright

- `breadcrumb visible and readable on each page`.
- `breadcrumb updates after menu navigation in real browser`.
- `breadcrumb remains correct after collapse/expand and then navigation`.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_

---

## 4) Add top-right light/dark mode toggle with ConfigProvider algorithm switching

### Task descriptor

Introduce theme state and switch `ConfigProvider` algorithm between `theme.defaultAlgorithm` and `theme.darkAlgorithm`. Expose a top-right `Switch` to toggle modes.

### Constraints

- Preserve existing theme token customisations unless explicitly changed.
- Avoid hard-coded CSS backgrounds that conflict with token-driven themes.
- Include explicit CSS cleanup tasks needed for theme compatibility (for example replacing hard-coded background/foreground colours with token-aligned styles).
- Keep state management simple and transparent.

### Acceptance criteria

- Toggle visibly switches between light and dark themes.
- Shell and page surfaces respond consistently to theme changes.
- Theme-relevant CSS has no conflicting hard-coded colours that break light/dark rendering.
- Toggle is accessible and clearly positioned in top-right header area.

### Required TDD tests

#### Vitest

- `toggle control renders with accessible label`.
- `toggle callback flips theme state between light and dark`.
- `ConfigProvider receives expected algorithm when state changes`.
- `theme toggle state persists during in-app page navigation` (single-session state).
- `theme-compatible styles are applied`: key shell containers do not rely on hard-coded colours that conflict with algorithm switching.

#### Playwright

- `user can toggle to dark mode and observe visual change`.
- `user can toggle back to light mode and observe visual reversion`.
- `theme toggle works after navigating across all four pages`.
- `theme toggle remains operable after collapsing/expanding nav`.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_

---

## 5) Create blank page components for Dashboard, Classes, Assignments, and Settings

### Task descriptor

Create page components under `src/frontend/src/pages/`:

- `DashboardPage.tsx`
- `ClassesPage.tsx`
- `AssignmentsPage.tsx`
- `SettingsPage.tsx`

Each page contains a heading and concise placeholder copy aligned to intended purpose.

### Constraints

- Keep placeholders intentionally minimal.
- Do not implement CRUD/data workflows yet.
- Keep component structure clean and composable.

### Acceptance criteria

- Each page renders distinct heading and placeholder text.
- Menu selection swaps page content correctly.
- Skeleton clearly reflects the four requested functional areas.

### Required TDD tests

#### Vitest

- `each page component renders expected heading and summary text`.
- `page switch map resolves keys to correct component`.
- `invalid key handling fails fast in development`: invalid page keys throw a clear error and are recorded in section notes if encountered.
- `Dashboard default selection renders expected default page content`.

#### Playwright

- `navigating to each menu item shows matching page heading in browser`.
- `placeholder text for each page is visible and unique`.
- `rapid navigation does not leave stale page content onscreen`.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_

---

## 6) Validate with focused frontend tests and lint checks

### Task descriptor

Complete full verification using section-level tests plus full frontend lint and test runs.

### Constraints

- Prefer user-visible behaviour assertions over implementation detail checks.
- Use documented frontend commands.
- Keep tests deterministic and scoped to this change.

### Acceptance criteria

- Vitest coverage remains compliant with frontend threshold policy.
- New and existing Playwright smoke journeys pass for shell navigation/theme flows.
- Frontend lint passes.

### Required TDD tests and verification gates

#### Vitest gates

- Run focused section specs while implementing each section.
- Run full suite: `npm run frontend:test`.
- Run coverage gate: `npm run frontend:test:coverage` (target ≥85% lines/functions/statements/branches).

#### Playwright gates

- Run focused e2e specs while implementing each section.
- Run full suite: `npm run frontend:test:e2e`.
- Optionally run `--headed --debug` for manual visual validation before final sign-off.

#### Final quality gates

- `npm run frontend:lint`
- Re-run any flaky/failing tests once with trace output for diagnosis.

**Commit reminder:** After completing this section and local validation, create a focused commit before moving to the next section.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_

---

## Stage exit criteria (must all pass)

- All section-level Vitest and Playwright tests introduced in this stage are implemented and passing.
- Full frontend unit/component suite passes: `npm run frontend:test`.
- Full frontend e2e suite passes: `npm run frontend:test:e2e`.
- Coverage gate passes at or above 85% for lines/functions/statements/branches: `npm run frontend:test:coverage`.
- Frontend lint passes: `npm run frontend:lint`.
- Any deviations from plan are recorded in the section notes with rationale and follow-up actions.

---

## Suggested delivery order

1. Shell layout refactor.
2. Navigation model and menu wiring.
3. Breadcrumb integration.
4. Theme toggle and algorithm switching (including CSS cleanup for theme compatibility).
5. Blank pages and content switching.
6. Tests and lint validation.

**Commit reminder:** After completing all sections and final verification, create a summary commit (or tidy incremental commits) and prepare PR notes.

### Notes (implementation/deviations)

- _Agent notes:_
- _Any deviations from plan:_
- _Follow-up considerations affecting later stages:_
