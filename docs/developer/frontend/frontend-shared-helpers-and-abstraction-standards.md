# Frontend Shared Helpers and Abstraction Standards (Draft)

This document is the draft canonical policy for shared-helper discovery and abstraction decisions in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 1. Purpose and scope

Use this policy to decide whether to:

- reuse an existing helper
- extend an existing helper
- keep logic local
- extract a new shared helper

It applies to production frontend source under `src/frontend/src/**`.

## 2. Reuse-first rule

Before creating any new helper, you must:

1. identify the behaviour you want to share
2. check the canonical helper locations in Section 3
3. prefer extending an existing helper when it keeps that helper coherent
4. create a new helper only when no suitable helper exists

Do not create a new helper only to move code out of a large file.

## 3. Canonical helper map (check these first)

### 3.1 Server-state and query contracts

- Query keys: `src/frontend/src/query/queryKeys.ts`
- Shared query definitions and warm-up contracts: `src/frontend/src/query/sharedQueries.ts`
- Query client foundation/provider: `src/frontend/src/query/queryClient.ts`, `src/frontend/src/query/AppQueryProvider.tsx`

### 3.2 Error and transport helpers

- Unknown-error normalisation: `src/frontend/src/errors/normaliseUnknownError.ts`
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`

### 3.3 Feature-shared helpers (existing local precedents)

- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/ClassesTable.helpers.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/queryInvalidation.ts`
- Classes reference-data workflow helpers: `src/frontend/src/features/classes/manageReferenceDataHelpers.ts`

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

## 4. Extraction decision rules

### 4.1 Keep logic local when

- there is one call site and no clear independent contract
- extraction would only rename existing code without removing duplication
- extraction introduces a large prop or argument pass-through surface

### 4.2 Extend an existing helper when

- the new behaviour matches the helper's existing responsibility
- call sites already depend on that helper contract
- extension reduces repeated logic in active call paths

### 4.3 Create a new helper when

- at least two active call sites need the same behaviour now, or
- one call site exists now but a documented near-term second call site is in the accepted scope, and
- the helper owns a coherent contract (not only a pass-through wrapper)

## 5. Anti-patterns to reject

Reject these patterns during implementation and review:

- single-caller wrapper extraction that does not own an independent contract
- duplicated orchestration skeletons copied across handlers instead of descriptor-driven derivation
- duplicated routing render sources for the same navigation key set
- mirrored validation error state where two stores track the same errors without distinct responsibilities
- ad-hoc helper modules created without checking the canonical helper map

## 6. Placement and naming

- Keep cross-feature helpers in stable shared domains (`query`, `errors`, `logging`, `services`) when the contract is genuinely cross-feature.
- Keep feature-specific helpers inside the owning feature folder.
- Name helpers by the contract they provide, not by where they were extracted from.
- Prefer explicit function exports and typed return contracts.

## 7. Review and PR checks

For frontend changes that add or modify helpers, include a short helper audit in the PR description:

- which existing helpers were checked
- whether logic was reused, extended, kept local, or extracted
- why extraction was justified when a new helper was introduced

Reviewer checks:

1. no unjustified one-caller abstraction extraction
2. no duplicated orchestration added where descriptor/config derivation is feasible
3. no duplicate source of truth for routing/render mapping
4. no duplicated validation-error source of truth without explicit contract boundaries

## 8. Relationship to other canonical docs

This document defines helper discovery and abstraction rules.

Use topic-specific docs for runtime policy details:

- React Query and prefetch policy: `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Loading, width, and busy-state semantics: `docs/developer/frontend/frontend-loading-and-width-standards.md`
- Logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Testing helper and harness policy: `docs/developer/frontend/frontend-testing.md`
- Shell navigation and motion policy: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 9. Planned cleanup helper entries

These entries are planning-only records for the current frontend de-sloppification work.
They are not implemented yet and must be reconciled during the documentation pass once the code changes land.

### 9.1 Assignments page filter cleanup

1. Helper or contract: assignments column-filter descriptor and single typed filter setter

- Decision: keep local
- Owning path: `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Not implemented`
- Rationale: the duplication is within one page; the goal is to collapse repeated column wiring and callback boilerplate without creating a cross-feature helper prematurely

### 9.2 Shell navigation cleanup

1. Helper or contract: navigation page renderer source of truth

- Decision: reuse
- Owning path: `src/frontend/src/navigation/appNavigation.tsx`
- Status: `Not implemented`
- Rationale: the cleanup should keep one authoritative mapping for navigation keys and page rendering instead of maintaining parallel render sources in shell and tests

### 9.3 Settings page tab cleanup

1. Helper or contract: settings tab item construction

- Decision: keep local
- Owning path: `src/frontend/src/pages/SettingsPage.tsx`
- Status: `Not implemented`
- Rationale: there is one production caller and two fixed tabs, so the cleanup should simplify by inlining instead of preserving single-use wrapper layers

### 9.4 Classes bulk-action cleanup

1. Helper or contract: bulk action descriptor feeding shared orchestration

- Decision: extend
- Owning path: `src/frontend/src/features/classes/bulkMutationOrchestration.ts`
- Status: `Not implemented`
- Rationale: the shared orchestration already owns a real cross-action contract; the planned change is to remove repeated handler scaffolding by supplying action-specific copy and mutation behaviour through a smaller descriptor surface

1. Helper or contract: metadata bulk-update contract for editable existing rows

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulkMetadataUpdateFlow.ts`
- Status: `Not implemented`
- Rationale: cohort, year-group, and course-length flows repeat the same editable-row filtering, payload-shaping, mutation-execution, and outcome-mapping pattern; one feature-scoped contract removes a real duplication seam instead of moving code sideways

### 9.5 Backend settings validation cleanup

1. Helper or contract: local schema-aware field descriptor path for backend settings fields

- Decision: keep local
- Owning path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- Status: `Not implemented`
- Rationale: repeated `Form.Item` validation wiring should be collapsed through a local descriptor-driven pattern inside the panel rather than a one-caller wrapper extraction

### 9.6 Page copy reuse in tests

1. Helper or contract: page copy source of truth for frontend tests

- Decision: reuse
- Owning path: `src/frontend/src/pages/pageContent.ts`
- Status: `Not implemented`
- Rationale: where tests are currently duplicating stable page copy only to mirror production constants, the cleanup may reuse the production copy source instead of preserving a second test-only source of truth
