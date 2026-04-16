# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Treat `SPEC.md` as the source of truth for the frontend loading-state and panel-width standards.
3. Read the canonical frontend implementation doc for this work once it exists: `docs/developer/frontend/frontend-loading-and-width-standards.md`.
4. No separate frontend layout spec is required for this work because the change standardises repository-wide layout tokens and loading behaviour rather than introducing a new page structure or workflow surface.
5. Use this action plan to sequence delivery and testing; do not redefine product decisions already settled in `SPEC.md`.

## Scope and assumptions

### Scope

- Apply the approved loading-state and width-token standards across all active frontend surfaces in `src/frontend`.
- Establish a canonical developer-documentation home for these standards before implementation begins so later sub-agents do not drift from chat history or stale files.
- Standardise page, tab, panel, and standalone card-like width ownership through shared CSS custom properties.
- Standardise initial blocking load, fail-closed degraded-data handling, background refresh, and short-running mutation behaviour for active frontend surfaces.
- Bring currently inconsistent surfaces, including settings and classes flows, into compliance with the new rules.

### Out of scope

- Long-running non-modal write workflows or job-style progress UX.
- Visual redesign beyond preserving current rendered widths and aligning behaviour to the agreed standards.
- Introducing a second token system in TypeScript or Ant Design theme configuration for app-level layout widths.
- Modal-width redesign, except where a modal directly needs loading-state compliance changes already covered by the spec.
- Rewriting unrelated frontend policy docs beyond brief cross-links where they materially improve discoverability.

### Assumptions

1. The first width-token pass preserves the current rendered default and wide-data widths already used by active frontend surfaces unless a later spec changes them.
2. Modal sizing is out of scope for the width-token sweep unless a modal duplicates page or panel width literals that are explicitly brought into scope during implementation.
3. Degraded required data is fail-closed for the affected owned region by default, even where current implementation keeps partial content visible.
4. The canonical long-lived documentation outcome for this work is a new frontend developer doc plus a concise frontend AGENTS summary of the highest-signal rules and a signpost to the full doc, not broad rule duplication across multiple files.

---

## Global constraints and quality gates

### Engineering constraints

- Keep shared page composition thin and preserve existing frontend ownership boundaries.
- Use CSS custom properties as the single source of truth for app-level page and panel width tokens.
- Preserve current rendered widths on the first pass; do not turn standardisation into a layout redesign.
- Use Ant Design loading and status primitives idiomatically before introducing bespoke components.
- Fail closed for degraded required data in the affected owned region.
- Keep changes minimal, localised, and consistent with repository conventions.
- Keep detailed standards in canonical developer docs, but allow concise component-AGENTS summaries of the highest-signal rules when that materially reduces implementation drift.
- Use British English in comments and documentation.
- Every changed user-visible interaction must receive Playwright coverage in addition to any supporting Vitest coverage, following `docs/developer/frontend/frontend-testing.md`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria when the section changes executable code.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Publish Canonical Frontend Standards Docs

### Objective

- Publish the standards in a canonical frontend developer doc before implementation starts.
- Add only short discoverability signposts elsewhere so future agents can find the rules quickly without paying repeated context cost.

### Constraints

- The canonical implementation-facing document must live at `docs/developer/frontend/frontend-loading-and-width-standards.md`.
- `src/frontend/AGENTS.md` must gain a concise high-signal summary of the key frontend rules for this standards sweep plus a signpost to the canonical doc. Keep the summary short enough to avoid turning AGENTS into a second full policy document.
- Existing docs such as `frontend-react-query-and-prefetch.md`, `frontend-logging-and-error-handling.md`, and `frontend-shell-navigation-and-motion.md` should only gain short cross-links if they materially improve discovery; do not restate the new rules there.
- Update `.github/agents/docs.agent.md` and the matching `.codex/agents/docs.toml` instructions so the Docs subagent knows to check `docs/developer/frontend/frontend-loading-and-width-standards.md` and the frontend AGENTS summary when frontend documentation or frontend rule changes are in play.
- The new doc should be easy for agents to scan: short sections, explicit rule headings, and minimal narrative.
- The new doc must reflect `SPEC.md` exactly enough that implementation agents can treat it as the canonical long-lived repo rule set.

### Acceptance criteria

- `docs/developer/frontend/frontend-loading-and-width-standards.md` exists and is written as the canonical long-lived frontend standards document for this work.
- The new doc covers, at minimum: scope, owned-surface terminology, initial blocking load rules, background-refresh scope rules, fail-closed degraded-data rules, short-running mutation rules, width-token ownership, accessibility semantics, and links to closely related docs.
- `src/frontend/AGENTS.md` includes a concise summary of the key rules most likely to affect implementation correctness, plus a signpost to the canonical doc, and remains concise overall.
- `.github/agents/docs.agent.md` and `.codex/agents/docs.toml` are updated together so the Docs subagent knows the canonical rule locations and does not rely on stale discovery paths.
- Any additional cross-links added to existing frontend docs remain one-line discoverability references rather than duplicated policy blocks.

### Required test cases (Red first)

Frontend tests:

1. None. This is a documentation-first section.

### Section checks

- Verify the new doc path, frontend AGENTS summary, and Docs subagent instruction updates exist and are internally consistent with `SPEC.md`.

### Delivery checklist

- [x] Red tests added _(N/A: documentation-only section; no executable tests required)_
- [x] Red review clean
- [x] Green implementation complete
- [x] Green review clean
- [x] Checks passed
- [x] Action plan updated
- [ ] Commit created
- [ ] Push completed

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Complete through action-plan update. This documentation-first section required no executable tests, and both red and green reviews passed with no findings.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Later sections should use `docs/developer/frontend/frontend-loading-and-width-standards.md` as the canonical rule source.

---

## Section 2 — Audit Active Frontend Surfaces

### Objective

- Create an explicit inventory of active frontend surfaces in scope before code changes begin.
- Classify each surface against the new standards so later sections have a fixed target list and do not invent scope mid-stream.

### Constraints

- Keep the audit limited to active frontend surfaces in `src/frontend`.
- Cover shared page wrappers, tab panels, standalone card-like surfaces, table cards, and modal loading flows where the approved standards apply.
- Record whether each surface needs work for width tokens, initial blocking load, degraded-data handling, background refresh, non-modal mutation boundaries, accessibility signalling, or no change.
- Explicitly note whether modal widths are out of scope for each audited modal.
- Record the audit in a committed repo-tracked artefact at `FRONTEND_STANDARDS_AUDIT.md`; later sections must reference that artefact rather than ad-hoc implementation notes.

### Acceptance criteria

- A fixed in-scope inventory exists before implementation sections start.
- `FRONTEND_STANDARDS_AUDIT.md` exists as a committed inventory and classification table before Section 3 starts.
- Each active frontend surface is classified against the standards categories relevant to this sweep.
- The audit identifies the concrete surfaces that feed later sections, including shared wrappers, settings surfaces, classes surfaces, `AuthStatusCard`, Dashboard, Assignments, standalone card-like surfaces, and any other active panels found during audit.
- The audit records deliberate deferrals rather than letting them stay implicit.

### Required test cases (Red first)

Frontend tests:

1. None. This is a scope-and-classification section.

### Section checks

- Verify `FRONTEND_STANDARDS_AUDIT.md` is committed and referenced by later implementation sections before moving to code sections.

### Delivery checklist

- [x] Red tests added _(N/A: scope-and-classification section; no executable tests required)_
- [x] Red review clean
- [x] Green implementation complete
- [x] Green review clean
- [x] Checks passed
- [x] Manual green-phase checks recorded
- [x] Action plan updated
- [ ] Commit created
- [ ] Push completed

### Manual green-phase checks

- Confirm `FRONTEND_STANDARDS_AUDIT.md` covers the active surfaces in `src/frontend`.
- Confirm each audited surface is classified for width tokens, blocking load, degraded-data handling, refresh scope, mutation boundaries, accessibility signalling, or no change.
- Confirm modal-width decisions are explicitly marked out of scope where applicable.
- Confirm deliberate deferrals are recorded explicitly.
- Confirm `FRONTEND_STANDARDS_AUDIT.md` is the artefact referenced before Section 3+ implementation begins.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Green implementation recorded. `FRONTEND_STANDARDS_AUDIT.md` now fixes the active `src/frontend` audit artefact, with Section 3 and Section 6 explicitly anchored to it; `ManageYearGroupsModal` remains classified for mutation-boundary work.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Later sections should only claim repo-wide compliance against `FRONTEND_STANDARDS_AUDIT.md`.

---

## Section 3 — Tokenise Shared Width Ownership

### Objective

- Introduce shared CSS custom properties for the approved page and panel width categories.
- Keep Section 3 scoped to the `FRONTEND_STANDARDS_AUDIT.md` surfaces with width work classified as **Needs work** or inherited from those owners (`PageSection`, `TabbedPageSection`, `SettingsPage`, `AuthStatusCard`, and `BackendSettingsPanel`).
- Route those audited shared page wrappers, settings tab surfaces, and standalone card-like surfaces through the tokens while preserving current rendered widths.

### Constraints

- Keep CSS custom properties as the only app-level width token source of truth.
- Do not widen Section 3 beyond the width surfaces fixed in `FRONTEND_STANDARDS_AUDIT.md`.
- Preserve the current default and wide-data rendered widths on the first pass.
- Do not duplicate the same width literals in feature-local selectors after tokenisation.
- Keep the Settings page outer frame stable across tabs while allowing a centred default-width inner backend settings panel.
- Apply the token sweep to standalone card-like surfaces that currently reuse the same default-width literal, not just page wrappers and tab panels.
- Include the auth status card in this first-pass token sweep because it is a known active standalone card surface already using the duplicated default-width literal.

### Acceptance criteria

- Shared width tokens exist for default page width, wide-data page width, default panel width, and wide-data panel width.
- Only the audited Section 3 target surfaces consume those tokens instead of repeating raw literals in this sweep.
- The auth status card consumes the shared default panel-width token rather than a duplicated raw literal.
- Switching Settings tabs no longer changes the outer page frame width for backend settings.
- Backend settings renders as a centred default-width inner panel inside the stable Settings-page frame.

### Required test cases (Red first)

Frontend tests:

1. Add or update a Settings page/component test that asserts the outer page width class contract remains stable when switching between the Classes and Backend settings tabs.
2. Add or update a component test for the backend settings panel or surrounding Settings page composition to assert the backend form renders inside the shared page frame rather than narrowing the whole tab surface.
3. Add or update Auth status card tests to assert the standalone card surface consumes the shared default-width contract.
4. Add or update any existing shared layout wrapper tests needed to verify token-backed width classes are applied consistently to page, panel, and standalone card-like surfaces.
5. Add or update a Playwright settings-page browser test covering tab switching and the stable outer page frame.

### Section checks

- `npm run frontend:test -- src/pages/TabbedPageSection.spec.tsx src/pages/SettingsPage.spec.tsx src/features/auth/AuthStatusCard.spec.tsx`
- `npm run frontend:test -- SettingsPage`
- `npm run frontend:test -- AuthStatusCard`
- `npm run frontend:test:e2e -- e2e-tests/settings-page.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Delivery checklist

- [x] Red tests added
- [x] Red review clean
- [x] Green implementation complete
- [x] Green review clean
- [x] Checks passed
- [x] Action plan updated
- [ ] Commit created
- [ ] Push completed

### Optional `@remarks` JSDoc follow-through

- Document the reason page-width ownership and panel-width ownership are separate if the final implementation introduces a shared helper or wrapper whose intent would otherwise be non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Complete through action-plan update. Red coverage landed in `src/frontend/src/pages/SettingsPage.spec.tsx`, `src/frontend/src/pages/TabbedPageSection.spec.tsx`, `src/frontend/src/features/auth/AuthStatusCard.spec.tsx`, `src/frontend/e2e-tests/settings-page.spec.ts`, `src/frontend/src/test/appStylesRaw.ts`, and `src/frontend/vite.config.ts` to support raw stylesheet assertions. Green implementation updated `src/frontend/src/index.css` and `src/frontend/src/pages/SettingsPage.tsx` to add shared width CSS custom properties plus a neutral Settings-page outer-frame class so backend settings stays inside a stable wide outer frame while the backend panel remains centred at the default panel width.
- **Deviations from plan:** Red review removed unsafe implementation-specific assertions; otherwise none. Green review passed with no findings.
- **Follow-up implications for later sections:** Later settings-surface work should preserve the shared width-token ownership and stable outer-frame contract introduced here.

---

## Section 4 — Standardise Initial Blocking Loads

### Objective

- Replace generic loading placeholders with shape-matched skeletons for owned regions that have no usable content yet.
- Apply the minimum accessible loading semantics required by the spec.

### Constraints

- Skeletons must render in the same owned region as the eventual content.
- Initial loading must not show ready-state content for the same region at the same time.
- Initial-loading regions must expose an announced status pattern alongside the skeleton.
- Use `FRONTEND_STANDARDS_AUDIT.md` to identify every surface still using generic loading copy or mismatched blocking-load treatment.
- Include `AuthStatusCard` in the first-pass initial-load standardisation because it is a known active surface currently using spinner-plus-text loading.

### Acceptance criteria

- Panel-like and data-heavy surfaces with no usable content render shape-matched skeletons instead of generic loading copy.
- Initial-loading regions expose labelled announced status semantics, such as `role="status"`.
- The classes surface no longer uses plain loading text for its initial blocking state.
- `AuthStatusCard` no longer uses a spinner-plus-text placeholder for its initial blocking state.

### Required test cases (Red first)

Frontend tests:

1. Add or update a Classes management panel test covering the loading branch and asserting a skeleton-style loading region is rendered instead of the existing text-only placeholder.
2. Add or update backend settings loading tests to assert the initial-loading branch keeps the announced status semantics required by the spec.
3. Add or update Auth status card tests to assert the initial blocking load uses a shape-matched skeleton instead of spinner-plus-text.
4. Add focused tests for any additional surfaces listed in `FRONTEND_STANDARDS_AUDIT.md` that still use generic loading copy in place of owned-region skeletons.
5. Add or update Playwright coverage for any changed user-visible loading interaction in touched browser flows.

### Section checks

- `npm run frontend:test -- src/features/auth/AuthStatusCard.spec.tsx src/features/classes/ClassesManagementPanel.spec.tsx src/features/settings/backend/BackendSettingsPanel.spec.tsx src/features/classes/manageCohorts.spec.tsx src/features/classes/manageYearGroups.spec.tsx`
- `npm run frontend:test -- ClassesManagementPanel`
- `npm run frontend:test -- BackendSettingsPanel`
- `npm run frontend:test -- AuthStatusCard`
- `npm run frontend:test -- App`
- `npm run frontend:test -- src/features/auth/AppAuthGate.auth.spec.tsx`
- `npm run frontend:test -- src/features/auth/useAuthorisationStatus.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/auth-status.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Delivery checklist

- [x] Red tests added
- [x] Red review clean
- [x] Green implementation complete
- [x] Green review clean
- [x] Checks passed
- [x] Action plan updated
- [ ] Commit created
- [ ] Push completed

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red coverage was added or updated in `src/frontend/src/features/auth/AuthStatusCard.spec.tsx`, `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx`, `src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx`, `src/frontend/src/features/classes/manageCohorts.spec.tsx`, `src/frontend/src/features/classes/manageYearGroups.spec.tsx`, and `src/frontend/e2e-tests/auth-status.spec.ts`. Directly coupled auth tests were then synced in `src/frontend/src/App.spec.tsx`, `src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`, and `src/frontend/src/features/auth/useAuthorisationStatus.spec.tsx`. Green implementation updated `src/frontend/src/features/auth/AuthStatusCard.tsx`, `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/ManageCohortsModal.tsx`, `src/frontend/src/features/classes/ManageYearGroupsModal.tsx`, and `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx` so owned-region skeleton status treatments now cover `AuthStatusCard`, `ClassesManagementPanel`, backend settings loading placement, `ManageCohortsModal`, and `ManageYearGroupsModal`.
- **Deviations from plan:** None. Red review was clean, and green review was clean after the coupled auth test sync.
- **Follow-up implications for later sections:** Later loading-state work should preserve the owned-region skeleton-plus-status treatment now shared across these auth, classes, and backend settings surfaces.

---

## Section 5 — Enforce Fail-Closed Degraded Data Handling

### Objective

- Make degraded required data suppress the affected owned region’s normal content by default.
- Replace currently visible degraded content with the surface’s blocking-state treatment, using the standard blocking-error primitive for that surface and an Ant Design `Alert` by default unless a stronger documented UX case exists.

### Constraints

- React Query staleness or ordinary refetch eligibility alone must not be treated as degraded data.
- Only known-invalid, known-incomplete, or refresh-invalidated data should trigger fail-closed behaviour.
- Wider surrounding regions may remain visible only when they are independently usable and trustworthy.
- Use `FRONTEND_STANDARDS_AUDIT.md` to identify every currently non-compliant degraded-data surface before implementation starts.
- Add Playwright coverage for any changed user-visible degraded-data handling flows.

### Acceptance criteria

- Surfaces that currently keep degraded required data visible are updated to suppress the affected region by default.
- Blocking degraded regions reuse the standard blocking-error primitive for that surface, defaulting to an Ant Design `Alert` in the owned region.
- Backend settings no longer leaves the form visible when the required configuration payload is degraded in a way the spec now classifies as blocking.

### Required test cases (Red first)

Frontend tests:

1. Add or update backend settings tests to assert degraded required data suppresses the form region and renders the blocking-state treatment instead.
2. Add focused tests for any additional surfaces listed in `FRONTEND_STANDARDS_AUDIT.md` where partial or invalid data currently stays visible in violation of the fail-closed rule.
3. Add regression tests that confirm ordinary background refetch or query staleness does not trigger fail-closed behaviour when usable data remains trustworthy.
4. Add or update Playwright coverage for changed degraded-data browser behaviour where the affected flow is user-visible.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/BackendSettingsPanel.spec.tsx src/features/settings/backend/useBackendSettings.spec.ts src/features/classes/manageCohorts.spec.tsx src/features/classes/manageYearGroups.spec.tsx`
- `npm run frontend:test -- BackendSettingsPanel`
- `npm run frontend:test -- useBackendSettings`
- `npm run frontend:test:e2e -- e2e-tests/settings-backend.spec.ts e2e-tests/classes-crud-manage-cohorts.spec.ts e2e-tests/classes-crud-manage-year-groups.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Delivery checklist

- [x] Red tests added
- [x] Red review clean
- [x] Green implementation complete
- [x] Green review clean
- [x] Checks passed
- [x] Action plan updated
- [x] Commit created
- [x] Push completed

### Optional `@remarks` JSDoc follow-through

- Use `@remarks` where implementation needs to explain why a previously visible partial state now fails closed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red coverage for backend settings plus cohorts/year-groups degraded-data handling and the regression/browser flows landed and reviewed clean. Final Section 5 validation passed with the commands listed above. Branch chore/StandardiseFrontendPatterns recorded code/test commit 0a817f6 — "refactor: standardise frontend patterns for backend settings and cohort/year group management" — plus plan commit a732c18 — "docs: update ACTION_PLAN.md Section 5 completion" — and push succeeded.
- **Deviations from plan:** Green review initially raised two findings, both now remediated: the cohorts/year-groups modals now preserve a durable fail-closed trust boundary across remounts, and `BackendSettingsPanel` now renders its blocking `Alert` inside the panel shell. Follow-up green review passed clean with no blocking issues.
- **Follow-up implications for later sections:** Refresh work in later sections must treat this trustworthy-data boundary as already settled.

---

## Section 6 — Standardise Refresh and Non-Modal Mutation Boundaries

### Objective

- Apply the subregion-scoped refresh rule and the table-surface mutation boundary baseline only to the `FRONTEND_STANDARDS_AUDIT.md` surfaces that are currently marked **Needs work** for refresh or mutation-boundary behaviour in this pass (`BackendSettingsPanel`, `ClassesManagementPanel`, `ClassesToolbar`, `ClassesTable`, `ManageCohortsModal`, and `ManageYearGroupsModal`).
- Keep ready data visible during background refresh while constraining conflicting write actions during short-running non-modal mutations on those audited surfaces.

### Constraints

- Targeted hooks or view models must derive and expose explicit refresh or busy state before visual refresh affordances are updated.
- Subregion-level refresh affordances are the default for composite surfaces.
- Whole-panel refresh treatment is reserved for primary-region refresh or whole-panel invalidation.
- Data-table mutation flows must freeze selection after snapshot, disable conflicting write launchers in the owned workflow region, and keep sort/filter available by default.
- Unrelated write launchers elsewhere on the page remain outside the default conflict boundary unless they operate on the same owned dataset workflow.
- For the classes surface, implementation must define and test a small control-boundary matrix covering at least: bulk-action launchers, row selection, row-level write launchers if any, sort/filter controls, and adjacent reference-data launchers such as Manage Cohorts and Manage Year Groups.
- For the classes surface, the default owned refresh region for class-partials and classroom dataset refresh is the classes data-workflow region comprising the summary card, bulk-actions toolbar, and table. The alert stack and outer panel chrome stay outside that region unless the whole panel context is invalidated.
- Add Playwright coverage for changed visible refresh and disabled-control behaviour.
- Do not expand Section 6 into active frontend surfaces that `FRONTEND_STANDARDS_AUDIT.md` already classifies as `No change`, `Inherits owner`, or `Out of scope` for refresh and mutation-boundary work.

### Acceptance criteria

- Only the audited Section 6 target surfaces publish explicit refresh or busy state instead of relying on panel-local heuristics only.
- Composite surfaces derive refresh affordances at the correct scope instead of replacing whole ready surfaces unnecessarily.
- Table-heavy non-modal mutation flows follow the agreed baseline for selection freeze, write disablement, and sort/filter availability.
- The classes surface has an explicit tested control-boundary matrix for what is disabled, what remains available, and what is outside the owned conflict boundary.
- The classes surface scopes post-mutation refresh feedback to the classes data-workflow region by default rather than the whole panel.
- Background refresh affordances expose region-scoped busy signalling, such as `aria-busy="true"`, alongside visible feedback.

### Required test cases (Red first)

Frontend tests:

1. Add or update Classes management tests to assert background refresh keeps existing visible data on screen while showing a localised busy affordance.
2. Add or update Classes toolbar/table tests to assert conflicting write launchers are disabled during bulk mutation, selection is frozen after snapshot, and sort/filter controls remain available.
3. Add or update tests covering the classes control-boundary matrix, including whether adjacent reference-data launchers remain outside the conflicting workflow region.
4. Add focused tests for any other composite surfaces listed in `FRONTEND_STANDARDS_AUDIT.md` that currently promote subregion refresh to unnecessary whole-surface replacement or that need explicit busy-state publication.
5. Add or update Playwright classes browser coverage for visible refresh affordances and disabled-control behaviour.

### Section checks

- `npm run frontend:test -- ClassesManagementPanel`
- `npm run frontend:test -- ClassesToolbar`
- `npm run frontend:test -- ClassesTable`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud.harness.spec.ts`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- Use `@remarks` if a helper is introduced to explain why refresh scope is region-based rather than whole-panel by default or why a surface exposes explicit busy-state metadata.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Section 7 — Repo-Wide Compliance Sweep

### Objective

- Update the remaining active frontend surfaces listed in `FRONTEND_STANDARDS_AUDIT.md` so the standards are applied consistently beyond the initially obvious settings and classes areas.

### Constraints

- Keep the sweep limited to the active frontend surfaces listed in `FRONTEND_STANDARDS_AUDIT.md` within `src/frontend`.
- Cover shared page wrappers, tab panels, standalone card-like surfaces, table cards, and modal loading flows where the approved standards apply.
- Do not expand into unrelated UX redesign.

### Acceptance criteria

- Every active frontend surface listed in `FRONTEND_STANDARDS_AUDIT.md` is either updated for compliance or explicitly recorded as a deliberate deferral.
- Remaining non-compliant surfaces in scope are not left implicit.
- No duplicated default or wide-data width literals remain in touched active frontend surfaces where shared tokens should apply.

### Required test cases (Red first)

Frontend tests:

1. Add or update focused tests for each newly touched surface listed in `FRONTEND_STANDARDS_AUDIT.md` where existing behaviour changes under the standards sweep.
2. Add regression coverage for any shared helper or wrapper introduced to support repo-wide consistency.
3. Run the relevant frontend Vitest suites for all touched surfaces from `FRONTEND_STANDARDS_AUDIT.md`, not just the initial settings and classes tests.
4. Add or update Playwright coverage for every changed user-visible interaction introduced by the remaining `FRONTEND_STANDARDS_AUDIT.md` surface work.

### Section checks

- `npm run frontend:test -- <touched targets>`
- `npm run frontend:test:e2e -- <touched browser targets>`
- `npm run frontend:lint`

### Optional `@remarks` JSDoc follow-through

- None unless a new shared helper has non-obvious behavioural constraints.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
- **Deviations from plan:**
- **Follow-up implications for later sections:**

---

## Regression and contract hardening

### Objective

- Confirm the standards sweep holds across touched surfaces without reintroducing width drift, generic loading placeholders, or inconsistent mutation handling.

### Constraints

- Prefer focused frontend suites before broader validation.

### Acceptance criteria

- All touched frontend tests pass.
- Frontend lint passes.
- No touched surface regresses to duplicated shared width literals or generic loading copy where the new standards apply.

### Required test cases/checks

1. Run touched frontend component and hook suites.
2. Run `npm run frontend:lint`.
3. Run `npm run frontend:test:e2e` or the targeted Playwright browser suites that cover every changed user-visible interaction.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

- Verify the early documentation changes stayed aligned with the implemented sweep and record any deliberate exceptions or follow-up rules.

### Constraints

- Treat the new frontend standards doc as the canonical long-lived doc for these rules.
- Keep the frontend AGENTS summary concise and high-signal, and avoid retroactive rule duplication in unrelated docs.
- Keep Docs subagent instructions aligned with the canonical rule locations in both `.github/agents/docs.agent.md` and `.codex/agents/docs.toml`.

### Acceptance criteria

- The canonical frontend standards doc still matches the implemented behaviour.
- Any deliberate deferrals or exceptions discovered during implementation are recorded in the appropriate canonical doc or implementation notes.
- No stale contradictory guidance remains in touched signpost docs or Docs subagent instructions.

### Required checks

1. Verify `SPEC.md`, `ACTION_PLAN.md`, and the canonical frontend standards doc still agree on width-token ownership, loading-state rules, and fail-closed degraded-data handling.
2. Verify `src/frontend/AGENTS.md` remains concise while still carrying the agreed high-signal summary and canonical-doc signpost.
3. Verify `.github/agents/docs.agent.md` and `.codex/agents/docs.toml` still point the Docs subagent at the correct rule locations.
4. Verify any touched cross-links still improve discoverability without duplicating policy blocks.
5. Confirm notes and deviations fields are filled during implementation.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious shared wrapper, loading-state helper, or orchestration helper needs `@remarks` documentation.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 — Publish Canonical Frontend Standards Docs
2. Section 2 — Audit Active Frontend Surfaces
3. Section 3 — Tokenise Shared Width Ownership
4. Section 4 — Standardise Initial Blocking Loads
5. Section 5 — Enforce Fail-Closed Degraded Data Handling
6. Section 6 — Standardise Refresh and Non-Modal Mutation Boundaries
7. Section 7 — Repo-Wide Compliance Sweep
