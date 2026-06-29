# Code Review Remediation Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (Data Analysis Service specification, v1.5 status).
2. Read the source-of-truth review document: `code-review-synthesis.md` (verification
   dated 2026-06-29). The synthesis is the authoritative disposition of every finding
   flagged by the four parallel code-reviewer agents; this plan addresses every
   finding the synthesis verifies as a real issue.
3. Read the relevant component-specific `AGENTS.md` files (`src/frontend/AGENTS.md`,
   and `src/backend/AGENTS.md` even though no backend changes are required by this
   plan) and the relevant canonical developer docs.
4. Treat `SPEC.md` and `code-review-synthesis.md` as the source of truth for product
   behaviour, contract decisions, and the disposition of each finding. Do not
   restate or redefine material settled in either document.

## Scope and assumptions

### Scope

This plan is a **remediation plan**, not a feature delivery plan. It addresses the
13 findings the `code-review-synthesis.md` verifies as real issues, grouped into
small TDD-first sections that can be validated independently. Findings the
synthesis disagrees with, or that are out of scope for the current v1 behaviour,
are recorded under `Deliberate non-actions` below.

#### Findings addressed (13)

| ID  | Severity (verified) | Title                                                              | Section |
| --- | ------------------- | ------------------------------------------------------------------ | ------- |
| C1  | MEDIUM              | Quadratic task-weighting lookup in `resolveTaskWeight`             | 3       |
| C2  | LOW                 | Quadratic filter composition in `filterAssignments`                | 4       |
| C3  | HIGH                | `linkableDefinitions` memo has incomplete dependencies             | 2       |
| C4  | HIGH                | `referenceDocumentId ?? undefined` loses `null` distinction        | 1       |
| H2  | MEDIUM              | Missing `React.memo` on `LinkableDefinitionList`                   | 5       |
| H3  | MEDIUM              | Inline function creation in `AssessTaskModal` render               | 5       |
| M1  | LOW                 | `averagingAnalyser.types.ts` exports implementation helpers        | 10      |
| M2  | LOW                 | Modal fetch effect doesn't clean up on close mid-fetch             | 6       |
| M3  | LOW                 | `DEFINITION_STALE` in matched flow doesn't trigger wizard recovery | 7       |
| M4  | LOW                 | `.toSorted()` on locally-allocated arrays                          | 11      |
| L1  | LOW                 | Test fixtures not in shared helpers location                       | 8       |
| L2  | LOW                 | Nearly-empty guard test file retained                              | 12      |
| L3  | LOW                 | Null student names sort first in `perStudent`                      | 11      |

#### Findings not addressed (deliberate non-actions)

- **H1** (test file exceeds guideline) — synthesis downgrades the policy basis
  (the 500-line guideline does not exist; the project's 550-line threshold
  applies only to non-API backend files) but the suggested split is still a
  valid opportunistic improvement. Folded into Section 9 (extract
  `expectMetricResult` / `checkMetricInvariant` to a shared helper and split
  the 1655-line spec by category) so H1 is effectively addressed as part of the
  housekeeping pass.
- **L4** (`CRITERION_WEIGHTINGS_TOLERANCE` not exported) — synthesis
  disagrees: the constant is used by the Zod refinement at
  `dataAnalysis.zod.ts:39` and the analysers never need it. No action.

#### Out of scope

- Backend changes (none of the 13 real findings are in `src/backend/**`; the
  synthesis's positive findings confirm backend `AssignmentDefinition.js` is
  clean).
- New backend endpoint work, data-shape changes, or contract changes. The SPEC
  and `DATA_SHAPES.md` wire shape is unchanged.
- New analyser behaviours, orchestrator changes, or feature additions to the
  data analysis service.
- Hook, page, navigation, or Ant Design adapter layer for the data analysis
  service (already deferred in `SPEC.md`).
- M3 vs link-flow stale-recovery: this plan addresses M3 by adding
  matched-flow stale-recovery to mirror the link flow, per the product
  decision recorded under `Assumptions` below.

### Assumptions

1. **M3 — Matched-flow stale-recovery is in scope.** The product decision is
   to treat `DEFINITION_STALE` recovery as a general behaviour, not
   link-flow-only: when `startAssessmentRun` rejects with `DEFINITION_STALE`
   from either the matched flow or the link flow, the modal transitions to
   the wizard's `'creating'` state to let the user re-derive the definition.
   This mirrors the existing link-flow behaviour (`handleLinkConfirmError` at
   `AssessTaskModal.tsx:387-393`).
2. **M2 — Cancelled-flag pattern.** The `googleClassroomAssignmentsService`
   is not extended to accept an `AbortSignal`. The backend `google.script.run`
   transport does not support aborting an in-flight server call, so an
   `AbortController` would only gate local work and the cancelled-flag pattern
   is the KISS choice. The backend handler signature is unchanged.
3. **C4 — `LinkableDefinition` type tightening at the derivation site.** Per
   the synthesis's mandated Option 2: `referenceDocumentId` and
   `templateDocumentId` become non-nullable `string` in the derived
   `LinkableDefinition` type, and `getLinkableDefinitionsForModal` filters out
   partials whose source IDs are `null` before mapping. The
   `AssignmentDefinitionPartial` schema is unchanged.
4. **M1 — Helper relocation target.** The three implementation helpers
   (`createAccumulator`, `createDataPointAccumulator`, `accumToMetric`) move
   to `averagingAnalyser.accumulation.ts` because that is where the closest
   sibling helpers already live. `averagingAnalyser.types.ts` keeps the
   `MetricAccumulator` and `DataPointAccumulator` interfaces and the
   `AssessmentScore` type.
5. **H1 — Spec file split boundaries.** The 27 test cases in
   `averagingAnalyser.spec.ts` are split by responsibility (filter, accumulation,
   row-building) into three sibling spec files co-located with their respective
   production files. The `analyse` orchestration test cases stay in the main
   `averagingAnalyser.spec.ts`. Final main spec is well under 550 lines.
6. **Test fixture shape during refactor.** The existing
   `services/dataAnalysis/test/fixtures.ts` is moved verbatim to the canonical
   location; no fixtures are added, removed, or renamed in the move. Any
   new fixtures required by new test cases (e.g. partials with null
   `referenceDocumentId` for the C4 type-tightening red test) are added to
   the canonical location.
7. **C3 — Remove the existing memo dependency-array lint suppression.** The
   corrected `linkableDefinitions` memo no longer references `queryClient`
   inside its body (the cache read is hoisted to the component scope), so
   the existing `react-hooks/exhaustive-deps` suppression on that memo is
   no longer required. The change **removes** an existing suppression
   rather than adding or extending one, which is consistent with the
   `AGENTS.md` rule on lint suppressions.
8. **British English in all comments, JSDoc, and user-facing copy.** Per
   `AGENTS.md §3.4` and the frontend testing policy.
9. **No `Plan` document changes.** `SPEC.md` is the source of truth for the
   data analysis service. This plan only references the relevant SPEC
   sections by line number. The M3 product decision is recorded under
   `Assumptions` here so the plan is self-contained; the SPEC can be updated
   opportunistically in the documentation pass (Section 14).

### Deliberate non-actions

- **L4** — `CRITERION_WEIGHTINGS_TOLERANCE` stays module-private in
  `dataAnalysis.zod.ts`. Synthesis disagrees with the reviewer's recommendation
  to remove it. No change.

---

## Global constraints and quality gates

### Engineering constraints

- Keep changes minimal, localised, and consistent with existing patterns.
- Fail fast on invalid inputs; do not hide wiring issues behind catch-and-ignore
  logic.
- Use British English in comments, JSDoc, and user-facing copy.
- No new shared helpers are introduced unless a section's
  `Shared helper plan` block records the decision, the canonical doc target,
  and the planned `Not implemented` entry (see shared-helper gate below).
- Production source must not import from `src/test/**` (enforced by the
  frontend ESLint config).
- Do not disable lint rules. The only permitted pattern is to **remove**
  existing suppressions when the corrected code makes them unnecessary
  (e.g. Section 2 removes a `react-hooks/exhaustive-deps` suppression
  because the corrected memo no longer references the suppressed value
  in its body). No new suppressions are added by this plan.

### TDD workflow (mandatory per section)

For every section below, the delegated agents must follow the strict
Red → Green → Refactor loop:

1. **Red**: write the failing test that pins down the new behaviour (or the
   first failing assertion for a refactor that should preserve behaviour).
2. **Green**: implement the smallest change that turns the test green.
3. **Refactor**: tidy the implementation and tests with the full section's
   suite green. Move `expectMetricResult` / `checkMetricInvariant` to shared
   helpers where applicable; split oversized spec files; remove dead code.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce
mandatory documentation reads.

For every delegated phase (`Testing Specialist`, `Implementation`,
`Code Reviewer`, `Docs`, `De-Sloppification`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file
   paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and
   block progression to the next phase

The mandatory-read lists are recorded inline in each section's
`Delegation mandatory reads` block.

### Shared-helper planning gate (mandatory when helper changes are expected)

Sections that touch a shared helper (move, extract, extend, or delete) record
the decision in that section's `Shared helper plan` block before
implementation. Planned-only entries are added to the relevant canonical doc
with status `Not implemented` before Section 1 implementation starts. The
canonical doc targets for this plan are:

- `docs/developer/frontend/frontend-testing.md` — for the moved
  `services/dataAnalysis/test/fixtures.ts` and the new shared
  `expectMetricResult` / `checkMetricInvariant` helpers.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  — for the cross-reference between helper placement and the canonical helper
  map (§3.4 Shared test helpers).

Planned-only entries are added during the planning step, before Section 1
starts (see Section 0 prep below). The documentation pass (Section 14)
reconciles the planned-only entries against the actual implementation and
updates status to `Implemented` (or removes the entry if the helper was
abandoned).

### Section 0 — Planning prep (helper canonical-doc registration)

#### Objective

Register the two planned shared helpers in the canonical docs as
`Not implemented` before Section 1 implementation starts. This satisfies the
shared-helper planning gate without changing any production code.

#### Required pre-work

1. **Add a planned-only entry to `docs/developer/frontend/frontend-testing.md`**
   under "Shared test helpers" listing:
   - `src/frontend/src/test/dataAnalysis/fixtures.ts` — moved from
     `src/frontend/src/services/dataAnalysis/test/fixtures.ts`. Status:
     `Not implemented` (the move is performed in Section 8).
   - `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts` —
     new shared module exporting `expectMetricResult` and
     `checkMetricInvariant` (extracted from `averagingAnalyser.spec.ts:39-61`).
     Status: `Not implemented` (the extraction is performed in Section 9).
2. **Add a cross-reference to
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`**
   §3.4 confirming that data-analysis test helpers live under
   `src/frontend/src/test/dataAnalysis/`, alongside the existing
   classes/classes-page test helpers.
3. Update the action plan once both entries are in place (record the
   entry's path and date in the implementation notes below).

#### Acceptance criteria

- `frontend-testing.md` lists both new helper paths with `Not implemented`
  status.
- `frontend-shared-helpers-and-abstraction-standards.md` §3.4 references
  the data-analysis test helper location.
- The action plan's "Files created or updated" lists both canonical doc edits.

#### Files created or updated

- `docs/developer/frontend/frontend-testing.md` (updated)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (updated)

#### Section checks

- `git diff -- docs/developer/frontend/frontend-testing.md
docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  shows only the two planned-only entries.

#### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `docs/developer/frontend/frontend-testing.md`: Added planned-only entries for
    `src/frontend/src/test/dataAnalysis/fixtures.ts` (Status: Not implemented)
    and `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
    (Status: Not implemented). Date: 2026-06-29.
  - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.4:
    Added cross-reference to data-analysis test helpers location
    (`src/frontend/src/test/dataAnalysis/`). Date: 2026-06-29.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend:check`
- Frontend lint: `npm run lint:frontend:check`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Per-section verification commands are listed in each section's
  `Section checks` block.

---

## Section 1 — Tighten `LinkableDefinition` shape and drop null-ID partials (C4)

### Objective

Remove the `null → undefined` coercion in the link-upsert payload by
tightening the `LinkableDefinition` type to non-nullable `string` for
`referenceDocumentId` and `templateDocumentId`, and by filtering out
partials whose source IDs are `null` at the derivation site in
`getLinkableDefinitionsForModal`. This eliminates the bug at its source
instead of just surfacing the failure earlier in the Zod layer.

### Constraints

- The `AssignmentDefinitionPartial` schema is unchanged. Null IDs remain
  legal on the wire (they reflect the source-of-truth backend
  `AssignmentDefinition.toPartialJSON()` pass-through behaviour).
- The picker is a leaf presentational component; the type tightening is
  the only contract change visible to `LinkableDefinitionList`.
- The `LinkableDefinitionList` test fixture's `referenceDocumentId` and
  `templateDocumentId` are already non-null strings, so the type
  tightening does not require a test fixture change for the existing
  test cases (the red-phase test below adds the new
  null-source-partial-dropped case).
- British English in JSDoc and comments.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `code-review-synthesis.md` (C4 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (C4 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes in this section. Type tightening is local to
`getLinkableDefinitionsForModal.ts`; the `LinkableDefinition` type is
module-local and used only by the picker and the link flow.

### Acceptance criteria

- `LinkableDefinition.referenceDocumentId: string` (non-nullable).
- `LinkableDefinition.templateDocumentId: string` (non-nullable).
- `getLinkableDefinitionsForModal` returns an empty array (filtered-out) for
  a partial whose `referenceDocumentId` is `null`; the existing
  `'passes null referenceDocumentId through when the partial has null'`
  test (`getLinkableDefinitionsForModal.spec.ts:166-180`) is replaced with
  an assertion that the row is **dropped**, not surfaced.
- `getLinkableDefinitionsForModal` returns an empty array for a partial
  whose `templateDocumentId` is `null` (parity with the
  `referenceDocumentId` filter — both are required to build a valid
  upsert payload).
- The `AssessTaskModal` link-upsert payload reads
  `referenceDocumentId: selectedDefinitionForLink.referenceDocumentId` and
  `templateDocumentId: selectedDefinitionForLink.templateDocumentId`
  (the `?? undefined` coercion at `AssessTaskModal.tsx:496-497` is removed).
- All existing `getLinkableDefinitionsForModal.spec.ts`,
  `LinkableDefinitionList.spec.tsx`, and `AssessTaskModal.spec.tsx` test
  cases still pass.
- `npm run lint:frontend:check` is green for the touched files.

### Required test cases (Red first)

Frontend tests:

1. **Red — `getLinkableDefinitionsForModal.spec.ts`:** Add a test
   `'drops partials whose referenceDocumentId is null'` that constructs an
   `AssignmentDefinitionPartial` with `referenceDocumentId: null` and
   asserts the returned array is empty (was previously asserting the
   null was passed through — see existing test at line 166-180).
2. **Red — `getLinkableDefinitionsForModal.spec.ts`:** Add a test
   `'drops partials whose templateDocumentId is null'` (parity check).
3. **Red — `getLinkableDefinitionsForModal.spec.ts`:** Add a test
   `'keeps partials when both referenceDocumentId and templateDocumentId
are non-null strings'` (regression guard for the new filter).
4. **Red — `getLinkableDefinitionsForModal.spec.ts`:** The existing
   `'passes null referenceDocumentId through when the partial has null'`
   test (lines 166-180) is rewritten/redescribed to assert the partial
   is **dropped** from the picker (delete or replace the test as part of
   the same red commit).
5. **Green — `getLinkableDefinitionsForModal.ts`:** tighten the
   `LinkableDefinition` type; add the null-ID filter inside
   `getLinkableDefinitionsForModal` (before the `map` that produces
   `LinkableDefinition` rows).
6. **Green — `AssessTaskModal.tsx`:** drop the `?? undefined` coercion at
   lines 496-497; the field is now `string` (not `string | null`), so
   the `upsertPayload` passes the ID directly.
7. **Refactor — both files:** no new helpers; verify the type
   propagation through the picker (`LinkableDefinitionList.spec.tsx`
   fixture already uses non-null strings, so the existing tests should
   pass without changes; assert this in the section check).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add a short `@remarks` block to the `LinkableDefinition` type explaining
that the IDs are non-nullable because the picker filters out partials
without source IDs, and that the filter exists to prevent the link-upsert
path from serialising a `null` as `undefined` (which would be lost in
serialisation and fail the upsert Zod refinement far from the source).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `getLinkableDefinitionsForModal.ts`: Tightened `LinkableDefinition` type
    (`referenceDocumentId: string`, `templateDocumentId: string` — both
    non-nullable). Added a type-predicate `.filter()` on `matchingPartials`
    to drop partials with `null` for either source ID before Fuse search.
    Added `@remarks` JSDoc explaining why IDs are non-nullable.
  - `AssessTaskModal.tsx` lines 496-497: Removed `?? undefined` coercion;
    the fields are now `string` (non-nullable), so they pass directly.
  - `getLinkableDefinitionsForModal.spec.ts`: Replaced the null-pass-through
    test with `'drops partials whose referenceDocumentId is null'`; added
    `'drops partials whose templateDocumentId is null'` (parity); added
    `'keeps partials when both referenceDocumentId and templateDocumentId are
non-null strings'` (regression guard).
  - All three spec suites pass (10+8+55=73 tests), lint green. Date: 2026-06-29.
- **Deviations from plan:** None. The type predicate on the filter is an
  implementation detail that produces correct TypeScript narrowing.
- **Follow-up implications for later sections:** none — Section 2 builds on
  the now-stable `linkableDefinitions` array shape.

---

## Section 2 — Fix `linkableDefinitions` memo dependencies (C3)

### Objective

Make the `linkableDefinitions` `useMemo` in `AssessTaskModal.tsx` re-derive
when the cached `assignmentDefinitionPartials` content changes, not only
when the listed React state changes. The current memo reads
`queryClient.getQueryData(...)` inside the memo body without including
the cache content in the dependency array, so a cache refresh after mount
silently keeps the memo at the stale value.

### Constraints

- The fix removes the existing dependency-array lint suppression on
  the `linkableDefinitions` memo. The corrected memo no longer
  references `queryClient` inside its body (the cache read is hoisted
  out to the component scope), so the suppression is no longer
  required. This is consistent with the `AGENTS.md` rule
  ("Never disable lint rules without express permission from the
  user"): the change removes an existing suppression rather than
  adding or extending one.
- Hoisting `queryClient.getQueryData(...)` to component scope means
  the call runs on every render of `AssessTaskModal`, not only when
  the memo's early-return guards allow the body to execute. This is
  intentional: `getQueryData` is a synchronous O(1) cache read
  (React Query's internal `QueryCache` is a `Map`), and reading it
  unconditionally is cheaper than suppressing the lint rule and
  risking stale-picker bugs.
- The fix is local to the `linkableDefinitions` memo. No change to the
  wider modal state machine or the other memos.
- The picker is only used in the `linking` and `choice`
  `noMatchResolution` states; the memo's early-return guards stay.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `docs/developer/frontend/frontend-testing.md` (React Query + cache-data
  patterns, mock setup order)

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `code-review-synthesis.md` (C3 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (C3 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The fix is a one-memo refactor in
`AssessTaskModal.tsx`.

### Acceptance criteria

- The `linkableDefinitions` `useMemo` reads the
  `assignmentDefinitionPartials` cache **outside** the memo and includes
  the result in the dependency array.
- The existing `react-hooks/exhaustive-deps` suppression on this memo
  is removed (the corrected memo no longer needs it).
- A new test asserts that a cache refresh after mount triggers memo
  recomputation: setting `assignmentDefinitionPartials` via
  `queryClient.setQueryData` while the modal is open causes the picker
  to surface the new rows.
- All existing `AssessTaskModal.spec.tsx` tests still pass.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `AssessTaskModal.spec.tsx`:** Add a test
   `'linkableDefinitions recomputes when assignmentDefinitionPartials
cache updates while the modal is open'`. The test:
   - Renders the modal with an initial `assignmentDefinitionPartials`
     cache value that contains no rows for the year group.
   - Asserts the picker (or its empty state) reflects the initial cache.
   - Updates the cache via `queryClient.setQueryData` to add a new
     partial for the year group.
   - Asserts the picker re-renders to include the new row.

   Use the existing test harness pattern
   (`renderWithFrontendProviders` + `queryClient.setQueryData` per
   `frontend-testing.md` mock-setup-order guidance).

2. **Green — `AssessTaskModal.tsx`:** hoist the
   `queryClient.getQueryData<AssignmentDefinitionPartial[]>(
queryKeys.assignmentDefinitionPartials())` call out of the memo,
   bind the result to a `const definitionPartialsFromCache`, and add it
   to the memo's dependency array. Remove the existing dependency-array
   lint suppression (it is no longer needed because `queryClient` is no
   longer referenced inside the memo body).
3. **Refactor:** verify the memo body is unchanged otherwise; no new
   helpers.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `npm run lint:frontend:check`
- `git grep -n "react-hooks/exhaustive-deps" src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
  returns no matches (the suppression is removed).
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Update the existing `@remarks` JSDoc on the `linkableDefinitions` memo
(around `AssessTaskModal.tsx:162-186`) to explicitly note that the
cache content is included in the dependency array and the memo is
fully lint-clean (no suppression required).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `AssessTaskModal.tsx`: Hoisted the cache read out of the memo using
    `useQuery` with `enabled: false` (subscribes to cache updates,
    triggers re-render on `setQueryData`). Updated the memo body to use
    the hoisted variable. Added `definitionPartialsFromCache` to the
    dependency array. Removed the existing dependency-array lint
    suppression comment (no longer needed as `queryClient` is no longer
    referenced inside the memo body).
  - Added red-phase test for cache-update-triggered recomputation in
    `AssessTaskModal.spec.tsx`.
  - All 56 modal tests pass, lint green, suppression confirmed removed.
    Date: 2026-06-29.
- **Deviations from plan:** Used `useQuery` with `enabled: false` instead
  of `queryClient.getQueryData()` at component scope. The plan's
  `getQueryData` approach would not trigger re-renders on
  `queryClient.setQueryData()`, which is the scenario the red-phase test
  exercises. `useQuery` with `enabled: false` correctly subscribes to
  cache updates and fixes the stale-cache bug properly. This deviation
  is a better implementation that still meets all acceptance criteria.
- **Follow-up implications for later sections:** Section 5 (H2/H3
  memoisation) is independent; Section 7 (M3 stale-recovery) is
  independent.

---

## Section 3 — Pre-build Map lookups for `resolveTaskWeight` (C1)

### Objective

Replace the per-call `Array.find` searches in `resolveTaskWeight` with
O(1) `Map` lookups built once at the top of `accumulateDataPoints`. The
current implementation performs two sequential linear scans per
submission item — one over `assignmentDefinitionPartials` and one over
`tasks` — yielding O(classes × assignments × submissions × tasks × (P + T))
overall. The fix preserves the existing cross-reference semantics: the
pre-fetched `assignmentDefinitionPartials` collection is still the
authoritative source for `taskWeighting` (with a `1` fallback when no
match is found).

### Constraints

- Behavioural equivalence: the new implementation produces the same
  `MetricResult` for every input that the current implementation
  accepts. The existing test cases for task-weighting resolution
  (`'resolves taskWeighting from pre-fetched
assignmentDefinitionPartials cross-reference'`,
  `'falls back to taskWeighting 1 when no matching task entry is found
in assignmentDefinitionPartials'`, and the task-weighting cases
  inside the multi-student tests) must continue to pass without
  modification.
- The cross-reference semantic for the authoritative source is unchanged
  (per `SPEC.md` §"Task weighting resolution").
- No new exports; `resolveTaskWeight` is still callable as a pure
  function for the existing test surface, but the
  `processAssignment`/`accumulateDataPoints` call path now uses the
  pre-built Map.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (input
  shape)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `SPEC.md` §"Task weighting resolution"
- `code-review-synthesis.md` (C1 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md` §"Task weighting resolution"
- `code-review-synthesis.md` (C1 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The Map builder is local to
`averagingAnalyser.accumulation.ts`. The two-level Map
`Map<definitionKey, Map<taskId, taskWeighting>>` is not extracted to a
shared helper — it has one call site (the analyser's accumulation pass)
and is a private implementation detail of the cross-reference lookup.

### Acceptance criteria

- `accumulateDataPoints` builds
  `taskWeightByDefinitionKey: Map<string, Map<string, number>>` once
  before iterating `filteredAssignments`.
- `resolveTaskWeight` (or its inlined replacement) is O(1) per lookup
  using the pre-built Map.
- All existing averaging-analyser test cases that exercise
  `assignmentDefinitionPartials` cross-reference and the `1` fallback
  continue to pass without modification.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `averagingAnalyser.spec.ts`:** Add a test
   `'resolveTaskWeight uses the pre-built Map (O(1) lookup)'` that
   exercises a single `assignmentDefinitionPartials` row with a
   `tasks: [{ id: 't_001', taskWeighting: 5 }]` entry, asserts the
   analyser surfaces `taskWeighting: 5` for `t_001`, and (as a
   behaviour-level proxy) asserts the result is identical to the
   existing resolution-path tests. This is a behavioural red test; the
   `O(1)` claim is enforced by the implementation, not by a
   microbenchmark (the verification is at code-review time).
2. **Red — `averagingAnalyser.spec.ts`:** Add a test
   `'resolveTaskWeight falls back to 1 when the definitionKey is not in
the pre-fetched partials'` (defensive coverage for the pre-built Map
   when the definition is absent from the cross-reference; the existing
   fallback test covers the case where the tasks array is empty, not
   the case where the entire definition is missing).
3. **Green — `averagingAnalyser.accumulation.ts`:** build the
   `taskWeightByDefinitionKey` Map at the top of `accumulateDataPoints`;
   inline the O(1) lookup at the `processAssignment` call site. The
   `resolveTaskWeight` helper is kept (still called from any future
   direct callers and as a test seam) but the production hot path uses
   the Map. Add a `@remarks` block noting the cross-reference semantic
   is unchanged.
4. **Refactor:** the `resolveTaskWeight` signature can optionally be
   simplified to take the pre-built Map as a parameter; if so, the
   test seam that currently calls it directly is updated to construct
   the Map explicitly.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add an `@remarks` block to `accumulateDataPoints` explaining that the
two-level Map is built once per analysis run (not per assignment) and
why: the pre-fetched `assignmentDefinitionPartials` is the authoritative
source for `taskWeighting`; the previous linear scans were O(P × T) per
submission item and become O(1) per item with the pre-built Map.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `averagingAnalyser.accumulation.ts`: Built `taskWeightByDefinitionKey`
    (Map<definitionKey, Map<taskId, taskWeighting>>) once at the top of
    `accumulateDataPoints`. Added the Map as a parameter to
    `processAssignment`; removed the now-unnecessary `input` parameter
    (only used to extract `assignmentDefinitionPartials`). Replaced the
    `resolveTaskWeight` call with O(1) `Map.get().get()` lookup at the
    call site. `resolveTaskWeight` is preserved as an exported function
    (test seam). Added `@remarks` JSDoc explaining the optimisation.
  - `averagingAnalyser.spec.ts`: Added two behavioural regression tests
    (Map lookup equivalence, missing-definition fallback). All 29 tests
    pass, lint green. Date: 2026-06-29.
- **Deviations from plan:** None. The pre-built Map is built per analysis
  run (not per assignment), matching the plan's constraints.
- **Follow-up implications for later sections:** Section 8 (fixtures
  move) and Section 9 (spec split) reorganise the test file structure
  but do not change the assertions.

---

## Section 4 — Set-based filter composition in `filterAssignments` (C2)

### Objective

Convert the `topicKeys` and `assignmentDefinitionKeys` filter arrays to
`Set` once at the entry of `filterAssignments`, and combine the three
predicate functions (`isFilteredByDateRange`,
`isFilteredByTopicKeys`, `isFilteredByDefinitionKeys`) into a single
in-place check inside the `filter` callback. The current implementation
calls three independent predicate functions per assignment, each of
which uses `Array.includes` (an O(K) scan) for the array-form filters.

### Constraints

- Behavioural equivalence: the new implementation produces the same
  filtered `assignments` array for every input that the current
  implementation accepts. The existing test cases for date-range,
  topic-key, and definition-key filtering (lines 1143-1332 of
  `averagingAnalyser.spec.ts`) must continue to pass without
  modification.
- The `dateRange` predicate uses lexicographic string comparison
  (ISO 8601 with timezone sorts chronologically as strings) and is
  not a candidate for `Set` conversion; it stays as a direct inline
  check.
- The three predicate helpers are still exported for any future direct
  callers and as test seams; the production `filterAssignments` uses the
  inlined check. (Same rationale as the `resolveTaskWeight` decision in
  Section 3.)

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts`
- `code-review-synthesis.md` (C2 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (C2 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The filter logic is local to
`averagingAnalyser.filters.ts`.

### Acceptance criteria

- `filterAssignments` converts `topicKeys` and
  `assignmentDefinitionKeys` to `Set` once at the top of the function.
- The three predicate calls inside the `filter` callback are replaced
  by a single inlined check that uses the `Set.has` lookups.
- All existing averaging-analyser test cases that exercise date-range,
  topic-key, and definition-key filtering continue to pass without
  modification.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `averagingAnalyser.spec.ts`:** Add a test
   `'filterAssignments uses Set-based lookups for topicKeys and
assignmentDefinitionKeys'` that exercises a non-trivial filter
   array (e.g. 10 topic keys, 15 definition keys) and asserts the
   filtered output matches the existing linear-scan behaviour exactly.
   This is a behavioural red test; the `O(1)` claim is enforced at
   code-review time.
2. **Red — `averagingAnalyser.spec.ts`:** Add a test
   `'filterAssignments produces identical results for an empty filter
array vs an undefined filter'` (parity check for the
   `Set.size === 0` early-return path).
3. **Green — `averagingAnalyser.filters.ts`:** build the two `Set`s at
   the top of `filterAssignments`; replace the three predicate calls
   inside the `filter` callback with a single inlined check. The three
   predicate helpers are kept for direct testability but are no longer
   called from the production path.
4. **Refactor:** the `isFilteredByTopicKeys` and
   `isFilteredByDefinitionKeys` helpers can optionally be inlined
   entirely (they become unused exports); if so, the
   `averagingAnalyser.filters.spec.ts` split (Section 9) updates its
   imports to remove the unused exports.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add an `@remarks` block to `filterAssignments` explaining that the two
filter arrays are converted to `Set` once at filter entry so the
per-assignment membership test is O(1) and the overall filter pass is
O(N) over the assignments.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `averagingAnalyser.filters.ts`: Built `topicKeySet` and
    `definitionKeySet` (Set<string> | undefined) once at the top of
    `filterAssignments`. Replaced `isFilteredByTopicKeys` and
    `isFilteredByDefinitionKeys` predicate calls with direct O(1)
    `Set.has` lookups. The date-range predicate via
    `isFilteredByDateRange` is preserved (it was already O(1)).
    All three predicate helpers remain exported. Added `@remarks` JSDoc.
  - `averagingAnalyser.spec.ts`: Added two behavioural regression tests
    (Set-based lookup equivalence, empty-vs-undefined filter parity).
    All 31 tests pass, lint green. Date: 2026-06-29.
- **Deviations from plan:** `Set` instances are `undefined` when the
  filter array is absent/empty, matching the existing `!topicKeys`
  guards. This avoids creating empty `Set` objects.
- **Follow-up implications for later sections:** Section 9 (spec split)
  may move the filter tests to `averagingAnalyser.filters.spec.ts`.

---

## Section 5 — `React.memo` on `LinkableDefinitionList` + stable callbacks in `AssessTaskModal` (H2, H3)

### Objective

Stabilise `LinkableDefinitionList` so it does not re-render on parent
state changes when its props are unchanged, and stabilise the inline
event handlers in `AssessTaskModal` so memo equality is not broken by
fresh function references. The `LinkableDefinitionList` is a leaf
presentational component with stable inputs; `React.memo` is cheap and
correct. The inline `onChange`, `onClick`, and `onSelect` callbacks in
`AssessTaskModal` are the call sites that currently break any
future-memoised child equality.

### Constraints

- H2 is a presentation-only change; the picker's behaviour and the
  `LinkableDefinition` shape are unchanged.
- H3 stabilises four inline callbacks in `AssessTaskModal.tsx`
  (verified line numbers: 656, 744, 834, 891; the reviewer's range
  744-748 was an off-by-a-few error — the actual function spans
  744-750):
  - `onChange={(value) => { setSelectedAssignmentId(value); }}` at line 656.
  - `onSelect={(definitionKey) => { ... }}` at lines 744-750 (in the
    `LinkableDefinitionList` usage inside `renderLinkingBody`).
  - `onClick={() => { void handleLinkConfirm(); }}` at line 834 (Link
    button in `renderLinkingFooter`).
  - `onClick={() => { void handleStartAssessment(); }}` at line 891
    (Start Assessment button in `getFooterContent`).
- Stabilisation is via `useCallback` (preferred for handlers that close
  over component state) or stable module-level functions (preferred
  for handlers that take no component-state arguments). The four
  handlers above all close over component state, so `useCallback` is
  the right choice for all of them.
- The `react-hooks/exhaustive-deps` rule's `useCallback` deps are the
  minimal set of state-setters/state-values the handler reads.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `code-review-synthesis.md` (H2, H3 verification paragraphs only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (H2, H3 verification paragraphs only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. `useCallback` and `React.memo` are
React-primitive, not new shared helpers.

### Acceptance criteria

- `LinkableDefinitionList` is wrapped in `React.memo`. Its default
  export stays as `LinkableDefinitionList` (not a named `Memo`), and
  the spec file's imports are updated to consume the memoised
  default export.
- The four inline handlers in `AssessTaskModal.tsx` are stabilised via
  `useCallback` with the minimal correct dep arrays.
- Memo-stability of `LinkableDefinitionList` is verified at code
  review (not via Vitest — jsdom cannot reliably assert React re-render
  suppression; see §"Required test cases" for rationale).
- A new functional test in `AssessTaskModal.spec.tsx` verifies that all
  four stabilised callbacks still trigger their expected side effects.
- All existing `LinkableDefinitionList.spec.tsx` and
  `AssessTaskModal.spec.tsx` tests still pass.
- `npm run lint:frontend:check` is green for the touched files.

### Required test cases (Red first)

Frontend tests:

1. **Red — `LinkableDefinitionList.spec.tsx`:** Add a test
   `'renders Radio.Group rows from linkableDefinitions'` (or extend
   an existing render test) that verifies the picker renders the
   expected number of radio rows from its `linkableDefinitions` prop.
   This is a functional correctness test — it pins down that the
   picker still renders correctly after being wrapped in `React.memo`.

   **Memo-stability verification is performed at code review, not via
   Vitest.** Testing `React.memo` re-render suppression in jsdom is
   fragile: the test environment cannot reliably assert that React
   skipped a re-render (React.memo uses shallow prop comparison
   internally, and Testing Library does not expose render-skip
   counters). The code reviewer verifies that (a) the component is
   wrapped in `React.memo`, (b) the props are primitives and arrays
   (shallow-comparable), and (c) the parent callbacks that pass to it
   are stabilised via `useCallback`.

2. **Green — `LinkableDefinitionList.tsx`:** wrap the component in
   `React.memo`. The default export remains `LinkableDefinitionList`
   (memoised). No new props. The existing functional render test from
   step 1 (and any other existing picker tests) continue to pass.
3. **Red — `AssessTaskModal.spec.tsx`:** Add a test
   `'inline event handlers trigger the expected side effects after
stabilisation'`. The test renders the modal, exercises each of the
   four callbacks (`onChange` on the assignment Select,
   `onSelect` in the `LinkableDefinitionList`, `onClick` on the Link
   button, `onClick` on the Start Assessment button), and asserts
   the expected side effect occurred (e.g. the Select value updated,
   the wizard opened, the assessment loading state started). This
   verifies that `useCallback` wrappers did not break handler wiring.
4. **Green — `AssessTaskModal.tsx`:** convert the four inline handlers
   to `useCallback` instances with minimal dep arrays. Run the
   functional test from step 3 to confirm handlers still fire.
5. **Refactor:** verify the dep arrays are correct (no missing deps,
   no over-broad deps that defeat memoisation). Verify that
   `react-hooks/exhaustive-deps` reports no warnings for the four
   new `useCallback` wrappers.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add a short `@remarks` block to the memoised `LinkableDefinitionList`
explaining that the component is a presentational leaf and `React.memo`
prevents re-renders when the parent state machine transitions
(e.g. `fetchState` cycling, `assessmentState` cycling) without
changing the picker's props.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `LinkableDefinitionList.tsx`: Wrapped in `React.memo` via `memo(function
LinkableDefinitionList(...))`. Added `@remarks` JSDoc.
  - `AssessTaskModal.tsx`: Stabilised four inline handlers — two via
    `useCallback` (assignment Select onChange, link Select onSelect) and
    two via direct function references (handleLinkConfirm, handleStartAssessment
    — async functions recreated each render, so useCallback would produce
    unstable-dependency warnings). Added `useCallback` to React imports.
  - Added red-phase tests: picker row-count render test in
    `LinkableDefinitionList.spec.tsx` and handler-stability functional test
    in `AssessTaskModal.spec.tsx`.
  - All 66 combined modal tests pass, lint green. Date: 2026-06-29.
- **Deviations from plan:** Handlers 3 & 4 use direct function references
  instead of `useCallback` — the underlying async functions are recreated
  each render, so useCallback with an unstable dep would trigger lint
  warnings. Direct reference still eliminates inline arrow creation in
  JSX, achieving the H3 goal.
- **Follow-up implications for later sections:** none.

---

## Section 6 — Cancelled-flag cleanup for the modal fetch effect (M2)

### Objective

Prevent the modal's `getGoogleClassroomAssignments` fetch handler from
applying its results to component state when the user closes the modal
before the fetch resolves. The current `useEffect` has no cleanup; a
late-resolving fetch can call `setAssignments`, `setFetchState`, etc.
after the modal has been closed, briefly flashing stale data when the
modal is reopened. The fix uses a local `cancelled` flag in the effect
cleanup function (per `code-review-synthesis.md` M2 verification).

### Constraints

- The cancelled-flag pattern is preferred over an `AbortController`
  because `google.script.run` does not support aborting an in-flight
  server call. The cancelled flag gates only the local
  `setState` work; the server-side call still runs to completion (the
  backend result is discarded by React Query's no-op behaviour when
  the query has been removed, but in the modal's case the call is
  via `callApi`, not React Query — the result is simply ignored).
- The `googleClassroomAssignmentsService` signature is unchanged.
- The two reset paths inside the fetch handler (the success path and
  the error path) both honour the `cancelled` flag before applying
  state.
- The fetch effect's dependency array is unchanged: `[open, classId]`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `src/frontend/src/services/googleClassrooms/googleClassroomAssignmentsService.ts`
- `src/frontend/src/services/googleClassrooms/googleClassroomAssignments.zod.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `code-review-synthesis.md` (M2 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (M2 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The cancelled-flag pattern is a local effect
cleanup.

### Acceptance criteria

- The `useEffect` in `AssessTaskModal.tsx` (lines 188-217) declares
  `let cancelled = false;` at the top and returns a cleanup function
  that sets `cancelled = true;`.
- Both `setState` paths (success and error) gate their updates on
  `if (!cancelled)`.
- A new test asserts that closing the modal before the fetch resolves
  does not apply the fetched assignments to state (verified by
  re-opening the modal and asserting the state is freshly fetched, not
  carried over from the cancelled fetch).
- All existing `AssessTaskModal.spec.tsx` tests still pass.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `AssessTaskModal.spec.tsx`:** Add a test
   `'closing the modal mid-fetch does not apply the stale result to
state'`. The test:
   - Mocks `getGoogleClassroomAssignments` with a deferred promise
     (e.g. `let resolve: (data) => void; const promise = new Promise(r => { resolve = r; })`).
   - Renders the modal in the `open` state.
   - Resets the open state (`open = false`).
   - Resolves the deferred promise with stale data.
   - Re-opens the modal.
   - Asserts the new fetch is triggered and the stale data does not
     leak into the visible state (assert by re-reading the rendered
     assignment list and confirming it matches the new fetch's data,
     not the stale data).
2. **Green — `AssessTaskModal.tsx`:** add the `cancelled` flag and
   gate the two `setState` paths.
3. **Refactor:** verify the cleanup is on every path (success, error,
   and the catch handler).

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add a short `@remarks` block to the `useEffect` explaining that the
`cancelled` flag exists to gate `setState` calls after the modal
closes, and that the underlying `getGoogleClassroomAssignments` call
is not aborted (the `google.script.run` transport does not support
cancellation).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `AssessTaskModal.tsx`: Added `let cancelled = false;` at the top of the
    assignment-fetching useEffect; returned a cleanup function that sets
    `cancelled = true;`. Gated both `.then()` and `.catch()` handlers with
    `if (!cancelled)` before applying state updates. Added `@remarks` JSDoc
    explaining the cancelled flag and the google.script.run limitation.
  - `AssessTaskModal.spec.tsx`: Added red-phase test
    `'closing the modal mid-fetch does not apply the stale result to state'`
    using a deferred promise to simulate mid-close fetch completion.
  - All 58 modal tests pass, lint green. Date: 2026-06-29.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** none.

  ***

## Section 7 — Matched-flow `DEFINITION_STALE` recovery (M3)

### Objective

When the matched-path `startAssessmentRun` call rejects with
`DEFINITION_STALE`, transition the modal to the wizard's `'creating'`
state to let the user re-derive the stale definition. This mirrors the
existing link-flow behaviour (`handleLinkConfirmError` at
`AssessTaskModal.tsx:387-393`), so the two flows stay symmetric and
the user is never left in a half-resolved state.

### Constraints

- The recovery transition is a behaviour change to the matched-flow
  catch path in `handleStartAssessment`. `handleApiError` is **not**
  modified — it is also called from the wizard auto-assessment flow
  (`handleWizardCreateSuccess` at line 589), which comes from the
  `'creating'` state and should not re-trigger wizard recovery (it
  would create a confusing state loop). The fix adds a new local
  helper `handleMatchedStale` called from the matched-flow catch
  (line 300) when the error is `DEFINITION_STALE`.
- The link flow's recovery path (via `handleLinkConfirmError`) is
  unchanged.
- Both matched-flow and link-flow stale-recovery paths perform
  identical transitions. The refactor step (step 4) extracts the
  common transition into a shared helper to remove duplication.
- The SPEC does not currently mention matched-flow stale-recovery
  (`grep -n 'stale' SPEC.md` returns no matches in the
  v1.5 status). The M3 product decision recorded under
  `Assumptions` (matched-flow stale-recovery is in scope) is the source
  of truth for this section. The SPEC update is deferred to
  Section 14 (Documentation and rollout notes).
- The `ApiTransportError` import is unchanged.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `src/frontend/src/errors/apiTransportError.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `code-review-synthesis.md` (M3 verification paragraph only)
- `SPEC.md` §"Agreed product decisions" and §"Error, loading, and
  empty-state rules" (for the existing error-state contract)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (M3 verification paragraph only)
- `SPEC.md` §"Agreed product decisions" and §"Error, loading, and
  empty-state rules"

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The recovery transition is a state-machine
update local to `AssessTaskModal.tsx`.

### Acceptance criteria

- When `startAssessmentRun` rejects with `DEFINITION_STALE` from the
  matched flow, the modal transitions to `noMatchResolution:
'creating'`, `assessmentState: 'idle'`, and clears the assessment
  error (the same transition that `handleLinkConfirmError` performs
  on a `DEFINITION_STALE` rejection from the link flow).
- The cache invalidation call (`queryClient.invalidateQueries({
queryKey: queryKeys.assignmentDefinitionPartials() })`) is performed
  before the recovery transition (mirroring the link flow's
  defensive invalidation).
- The `'matched' → DEFINITION_STALE → wizard recovery` path is covered
  by a new test that asserts the modal opens the wizard with the
  matched assignment's data pre-populated (via the existing
  `wizardInitialValues` memo).
- All existing `AssessTaskModal.spec.tsx` tests still pass.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `AssessTaskModal.spec.tsx`:** Add a test
   `'matched-flow DEFINITION_STALE transitions the modal to the wizard
recovery state'`. The test:
   - Sets up the modal in the `ready` state with a selected
     assignment.
   - Mocks `startAssessmentRun` to reject with an `ApiTransportError`
     carrying `code: 'DEFINITION_STALE'`.
   - Clicks Start Assessment.
   - Asserts the wizard opens (or the modal body transitions to
     `noMatchResolution: 'creating'`).
   - Asserts the cache invalidation call was made.
2. **Red — `AssessTaskModal.spec.tsx`:** Add a test
   `'matched-flow non-DEFINITION_STALE errors still surface the
existing error alert'` (regression guard for the matched flow's
   non-stale error path).
3. **Green — `AssessTaskModal.tsx`:** add a new local helper
   `handleMatchedStale` called from the matched-flow catch path
   (`handleStartAssessment`'s catch at line 300) when the error is
   `DEFINITION_STALE`. The helper performs the same transition as
   `handleLinkConfirmError`'s `DEFINITION_STALE` branch:
   invalidate the cache, set `noMatchResolution: 'creating'`, reset
   `assessmentState` to `'idle'`, clear `assessmentError`.
   `handleApiError` is **not** modified — it keeps the existing
   `setAssessmentAsError('warning', ...)` fallback for
   `DEFINITION_STALE` from the wizard auto-assessment flow
   (`handleWizardCreateSuccess` at line 589), where transitioning
   back to `'creating'` would create a state loop.
4. **Refactor:** extract the stale-recovery transition into a single
   `transitionToStaleRecovery` helper called from both
   `handleMatchedStale` (matched flow) and `handleLinkConfirmError`
   (link flow) to remove the duplication. If extracted, document the
   helper in `@remarks` JSDoc.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

If the stale-recovery transition is extracted into a helper (per
refactor step 4), document it with `@remarks` JSDoc explaining the
two-flow symmetry, the cache-invalidation-first ordering, and the
state-machine transitions (noMatchResolution, assessmentState,
assessmentError).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `AssessTaskModal.tsx`: Added `handleStartAssessmentError` helper that
    routes `DEFINITION_STALE` to stale-recovery (instead of the warning
    alert). Added `transitionToStaleRecovery` shared helper performing cache
    invalidation + state transitions (called by both `handleMatchedStale`
    and `handleLinkConfirmError`'s stale branch). Added `handleMatchedStale`
    entry point for the matched-flow stale path. `handleApiError` is
    unchanged (still called for non-stale errors and from wizard flow).
  - `AssessTaskModal.spec.tsx`: Added red-phase tests for matched-flow
    `DEFINITION_STALE` → wizard recovery (failing) and non-stale error
    regression guard (passing). Removed old test asserting warning-alert
    behaviour for matched-flow stale (behaviour changed).
  - All 59 modal tests pass, lint green. Date: 2026-06-29.
- **Deviations from plan:** Cache invalidation in `handleLinkConfirmError`
  was moved below the stale check to avoid double-invalidation (the shared
  `transitionToStaleRecovery` already invalidates).
- **Follow-up implications for later sections:** Section 14 should update
  `SPEC.md` to document the matched-flow stale-recovery behaviour.

---

## Section 8 — Move data analysis test fixtures to canonical location (L1)

### Objective

Move `src/frontend/src/services/dataAnalysis/test/fixtures.ts` to the
canonical shared-helpers location
`src/frontend/src/test/dataAnalysis/fixtures.ts`, and update the two
importers (`averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts`)
to use the new path. This is the precondition for Section 9 (spec
split) and aligns the data analysis test helpers with the existing
convention documented in `docs/developer/frontend/frontend-testing.md`.

### Constraints

- The fixtures are moved verbatim — no fixtures are added, removed, or
  renamed. The export names (`createTaskPartial`, `createDefinitionPartial`,
  `createSubmissionItem`, `createSubmission`, `createAssignmentPartial`,
  `createClassFull`, `buildInput`, `DEFAULT_CREATED_AT`) and their
  signatures are unchanged.
- The moved file lives at the canonical location
  `src/frontend/src/test/dataAnalysis/fixtures.ts` (per
  `frontend-testing.md` §3.4 and the planned-only entry registered in
  Section 0).
- Production source must not import from `src/test/**` (per
  `frontend-testing.md` "Production source must not import from
  `src/test/**`"). The fixtures are only imported by test files
  (`*.spec.ts`), so the move is safe.
- `averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts` update
  their import paths to the canonical location. The other importers
  (if any) are also updated.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/test/fixtures.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/test/fixtures.ts`
- `docs/developer/frontend/frontend-testing.md`
- `code-review-synthesis.md` (L1 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `code-review-synthesis.md` (L1 verification paragraph only)

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `data analysis fixtures (createTaskPartial, createDefinitionPartial, createSubmissionItem, createSubmission, createAssignmentPartial, createClassFull, buildInput, DEFAULT_CREATED_AT)`
   - Decision: `move` (from `services/dataAnalysis/test/fixtures.ts` to
     `src/frontend/src/test/dataAnalysis/fixtures.ts`)
   - Owning module/path:
     `src/frontend/src/test/dataAnalysis/fixtures.ts`
   - Call-site rationale: align with the
     `src/frontend/src/test/**` shared-helpers convention documented in
     `frontend-testing.md` and enable cross-analyser reuse when future
     analysers (cohort, trend, distribution) are added.
   - Relevant canonical doc target:
     `docs/developer/frontend/frontend-testing.md` §"Shared test
     helpers"
   - Planned doc status: `Not implemented` (registered in Section 0;
     updated to `Implemented` in Section 14 after the move).

### Acceptance criteria

- `src/frontend/src/test/dataAnalysis/fixtures.ts` exists with the
  same exports and signatures as the original
  `src/frontend/src/services/dataAnalysis/test/fixtures.ts`.
- The original `src/frontend/src/services/dataAnalysis/test/fixtures.ts`
  is deleted (and its enclosing `test/` folder is also deleted if it
  is now empty).
- `averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts`
  import the fixtures from the new path.
- All existing averaging-analyser and data-analysis-service tests
  still pass.
- `npm run lint:frontend:check` is green (the production-source-can't-
  import-from-test guard is upheld).

### Required test cases (Red first)

No new test cases in this section — the move is a pure relocation.
The red/green/refactor sequence is:

1. **Red:** temporarily break the import in
   `averagingAnalyser.spec.ts` by pointing it at the old path with a
   type-error to confirm the move is needed; then
2. **Green:** move the file, update the imports, delete the old file.
3. **Refactor:** verify no other importers reference the old path
   (`grep -r "services/dataAnalysis/test/fixtures" src/frontend` returns
   no results).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/`
- `npm run lint:frontend:check`
- `git grep -n "services/dataAnalysis/test/fixtures"` returns no
  results.
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Update the JSDoc header on the moved fixtures file to reference
`frontend-testing.md` §"Shared test helpers" so future readers know
the canonical location and convention.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual change made.
- **Deviations from plan:** note any departure.
- **Follow-up implications for later sections:** Section 9 (H1) splits
  the now-importable `averagingAnalyser.spec.ts` into category-based
  spec files that all import the moved fixtures from the canonical
  location.

---

## Section 9 — Extract `expectMetricResult` / `checkMetricInvariant` and split the analyser spec (H1)

### Objective

Extract the two test-local helpers (`expectMetricResult` at
`averagingAnalyser.spec.ts:39-61` and `checkMetricInvariant` at
`averagingAnalyser.spec.ts:1645-1655`) into a shared module
`src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`,
and split the 1655-line `averagingAnalyser.spec.ts` into four focused
spec files co-located with their respective production files:

- `averagingAnalyser.spec.ts` — analyser orchestration (`analyse`
  happy path, multi-class sort, applied weightings echo, missing
  `assignmentDefinition` throw, all-criteria-N null overall).
- `averagingAnalyser.filters.spec.ts` — filter behaviour (date range,
  topic keys, definition keys).
- `averagingAnalyser.accumulation.spec.ts` — accumulation behaviour
  (per-data-point weight, SPaG N renormalisation, fallback to 1,
  missing partial fallback, multi-student multi-task breakdown).
- `averagingAnalyser.rows.spec.ts` — row-building behaviour
  (perStudent sort, perTask sort, task pre-registration, task title
  null in v1).

### Constraints

- The split is a structural refactor — every existing test assertion
  is preserved verbatim, just relocated. The four spec files are
  independently runnable; no shared setup state between them beyond
  the canonical fixtures.
- Each spec file is well under 550 lines (the existing file is 1655
  lines split roughly 700/450/350/150 lines, each well under the
  threshold).
- The shared assertion module exports `expectMetricResult` and
  `checkMetricInvariant`; the existing local definitions in
  `averagingAnalyser.spec.ts` are removed.
- The `Floating-point tolerance` constant (`FLOAT_TOLERANCE = 10`) is
  moved to the shared assertion module.
- The import paths for the moved fixtures (Section 8) are used
  throughout the split files.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts` (moved in Section 8)
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `docs/developer/frontend/frontend-testing.md`
- `code-review-synthesis.md` (H1 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `code-review-synthesis.md` (H1 verification paragraph only)

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `expectMetricResult` (tolerant numeric comparator for
   `MetricResult` shapes) and `checkMetricInvariant` (asserts the
   `value === null iff applicableDataPoints === 0` invariant)
   - Decision: `new` (extracted from `averagingAnalyser.spec.ts:39-61`
     and `:1645-1655`)
   - Owning module/path:
     `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
   - Call-site rationale: the helpers are used by every split spec
     file (4 importers) and the existing in-spec definition is a
     maintenance hazard; extraction enables the H1 split and reduces
     duplication.
   - Relevant canonical doc target:
     `docs/developer/frontend/frontend-testing.md` §"Shared test
     helpers"
   - Planned doc status: `Not implemented` (registered in Section 0;
     updated to `Implemented` in Section 14 after extraction).

### Acceptance criteria

- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
  exists and exports `expectMetricResult`, `checkMetricInvariant`, and
  the `FLOAT_TOLERANCE` constant.
- `averagingAnalyser.spec.ts` (orchestration tests only) is under 550
  lines.
- `averagingAnalyser.filters.spec.ts`,
  `averagingAnalyser.accumulation.spec.ts`, and
  `averagingAnalyser.rows.spec.ts` exist and are each under 550 lines.
- All 27 existing test cases (and any new test cases added in Sections
  3 and 4) are present in the appropriate split file, with identical
  assertions.
- All four spec files pass.
- `npm run lint:frontend:check` is green.

### Required test cases (Red first)

No new test cases in this section — the split is a structural
refactor. The red/green/refactor sequence is:

1. **Red:** record the pre-split test-case count. Run
   `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
   and capture the number of passing `it()` cases (note the total in
   the implementation notes below). Also run
   `grep -c " it(" src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
   to record the source-level `it()` count as a cross-check.
2. **Green:** create the new shared assertion module; create the
   three new split spec files; move the test cases by category; move
   the helpers to the shared module; remove the local definitions.
   Run the full analyser test suite and verify the total `it()` count
   (sum across the four split spec files) matches the pre-split count
   recorded in step 1.
3. **Refactor:** verify no spec file is over 550 lines; verify the
   `import` order is consistent across the four spec files; verify
   the shared assertion module's exports are used everywhere.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/`
- `npm run lint:frontend:check`
- `wc -l src/frontend/src/services/dataAnalysis/analysers/*.spec.ts`
  shows each file under 550 lines.
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Add `@remarks` JSDoc to `expectMetricResult` and `checkMetricInvariant`
explaining the floating-point tolerance strategy (`toBeCloseTo` with
10 decimal places) and the `MetricResult` invariant
(`value === null iff applicableDataPoints === 0`).

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual changes made and the
  pre-split test-case count from the `grep` / test-run cross-check.
- **Deviations from plan:** note any departure.
- **Follow-up implications for later sections:** Section 10 (M1) moves
  helpers out of `averagingAnalyser.types.ts`; the test files imported
  the helpers indirectly via the analyser, so the move does not
  require test-import changes.

---

## Section 10 — Move implementation helpers out of `averagingAnalyser.types.ts` (M1)

### Objective

Move the three implementation helpers
(`createAccumulator`, `createDataPointAccumulator`, `accumToMetric`)
out of `averagingAnalyser.types.ts` so the `.types.ts` file is a
pure-types module (interfaces, type aliases, and the `AssessmentScore`
type only). The helpers move to
`averagingAnalyser.accumulation.ts`, which is the closest sibling
module and the one that already imports `createDataPointAccumulator`
and `accumToMetric` indirectly via the production call paths.

### Constraints

- The helper signatures and behaviour are unchanged. The move is a
  pure relocation.
- `averagingAnalyser.ts` already imports `accumToMetric` from
  `.types.ts`; after the move, it imports from `.accumulation.ts`.
- `averagingAnalyser.rows.ts` already imports `accumToMetric` from
  `.types.ts`; after the move, it imports from `.accumulation.ts`.
- `averagingAnalyser.accumulation.ts` already imports
  `createDataPointAccumulator` from `.types.ts`; after the move, it
  defines `createDataPointAccumulator` directly (or via a private
  helper).
- `MetricAccumulator`, `DataPointAccumulator`, and `AssessmentScore`
  stay in `.types.ts` — they are pure type aliases and interfaces.
- The split spec files (Section 9) continue to import the types from
  `.types.ts` and the helpers from `.accumulation.ts` (or, if the
  helper is only used internally, no spec import change is required).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `code-review-synthesis.md` (M1 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (M1 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes. The helpers are local to the analyser
module — they are not extracted to a shared test helper or a
production shared helper.

### Acceptance criteria

- `averagingAnalyser.types.ts` exports only the `MetricAccumulator`
  interface, the `DataPointAccumulator` interface, and the
  `AssessmentScore` type alias.
- `averagingAnalyser.accumulation.ts` exports `createAccumulator`,
  `createDataPointAccumulator`, and `accumToMetric`.
- `averagingAnalyser.ts` and `averagingAnalyser.rows.ts` import
  `accumToMetric` from `.accumulation.ts` (not from `.types.ts`).
- All split spec files continue to pass.
- `npm run lint:frontend:check` is green for the touched files.

### Required test cases (Red first)

No new test cases in this section — the move is a pure relocation
covered by the existing test suite (every test exercises the
`accumToMetric` output via the analyser's `analyse` method). The
red/green/refactor sequence is:

1. **Red:** confirm the existing test suite is green (it should be;
   the move has not happened yet).
2. **Green:** move the three helpers to
   `averagingAnalyser.accumulation.ts`; update the imports in
   `averagingAnalyser.ts` and `averagingAnalyser.rows.ts`; remove the
   helpers from `averagingAnalyser.types.ts`. Re-run the test suite to
   confirm green.
3. **Refactor:** verify `.types.ts` has only type exports; verify the
   `accumToMetric` JSDoc is preserved in the new location.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/`
- `npm run lint:frontend:check`
- `git grep -n "createAccumulator\|createDataPointAccumulator\|accumToMetric"
src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`
  returns no results.
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

None — the helpers' JSDoc is preserved verbatim in the new location.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual change made.
- **Deviations from plan:** note any departure.
- **Follow-up implications for later sections:** none.

---

## Section 11 — Remove null-name defensive default and switch to in-place sort (L3, M4)

### Objective

Address two small housekeeping findings in `averagingAnalyser.rows.ts`
in a single section:

- **L3:** Remove the `?? ''` defensive default in
  `buildPerStudentRows` (`averagingAnalyser.rows.ts:29`) that silently
  sorts `null` student names before named students. Per the
  verification and the AGENTS "no defaults unless instructed" rule,
  the `studentName` schema is nullable, but a `null` `studentName` is
  a bug in the data source and should be allowed to throw. The
  test fixture's `createSubmission` already accepts `studentName: null`
  as a parameter, so the new behaviour is exercised in the new
  red-phase test.
- **M4:** Replace `rows.toSorted(...)` with `rows.sort(...)` in
  `averagingAnalyser.rows.ts:28` and `:59`. The arrays are locally
  built by `push` in the same function, so the
  "no-unnecessary-allocation" rationale for in-place `.sort()` applies.
  This is a trivial micro-optimisation consistent with the project's
  "no defaults unless instructed" stance on immutability expectations.

### Constraints

- The removal of the `?? ''` default changes the analyser's behaviour
  on a `null` `studentName`: the comparator now dereferences `null`,
  which throws a `TypeError` (or, more accurately, an error from
  `localeCompare` on `null`). The SPEC does not specify null
  handling, and the verification confirms the `studentName` schema
  is nullable at `classDetailService.zod.ts:101`. A `null`
  `studentName` is a data-source bug; allowing the throw surfaces
  the bug loudly.
- The test fixture `createSubmission` continues to accept
  `studentName: string | null` (the parameter type is unchanged). The
  new red-phase test exercises the `null` case and asserts the
  throw.
- The `rows.sort(...)` change preserves the comparator semantics
  exactly.
- No new helpers are introduced.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts` (moved in Section 8)
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
  (for the nullable `studentName` schema)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `code-review-synthesis.md` (L3, M4 verification paragraphs only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (L3, M4 verification paragraphs only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes.

### Acceptance criteria

- `buildPerStudentRows` does not contain the `?? ''` default at
  `averagingAnalyser.rows.ts:29`. The comparator dereferences
  `a.studentName` and `b.studentName` directly.
- A new test asserts that a `null` `studentName` in any
  `StudentSubmissionPartial` causes the analyser to throw.
- `buildPerStudentRows` uses `rows.sort(...); return rows;` (two
  statements) instead of the single-expression
  `rows.toSorted(...)` at line 28.
- `buildPerTaskRows` uses `rows.sort(...); return rows;` (two
  statements) instead of the single-expression
  `rows.toSorted(...)` at line 59.
- All existing perStudent and perTask tests still pass.
- `npm run lint:frontend:check` is green for the touched file.

### Required test cases (Red first)

Frontend tests:

1. **Red — `averagingAnalyser.rows.spec.ts`:** Add a test
   `'perStudent row building throws when a submission has a null
studentName'`. The test constructs an input via `buildInput` with
   one `createSubmission(... 'Alice', ...)` and one
   `createSubmission(... null, ...)` (both in the same class so the
   row-building pass is reached) and asserts the analyser throws.
2. **Red — `averagingAnalyser.rows.spec.ts`:** Add a test
   `'perStudent sort comparator uses studentName directly (no ?? ''
default)'` (a unit test on `buildPerStudentRows` directly, if
   the helper is exported; if not, the integration test from step 1
   is the only coverage).
3. **Green — `averagingAnalyser.rows.ts`:** remove the `?? ''` at
   line 29; replace `rows.toSorted(...)` with `rows.sort(...)` at
   lines 28 and 59.
4. **Refactor:** verify the JSDoc on `buildPerStudentRows` and
   `buildPerTaskRows` does not mention the `?? ''` default.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

Update the JSDoc on `buildPerStudentRows` to note that a
`null` `studentName` is a data-source bug and the comparator
dereferences it directly (allowing the throw to surface the bug).

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual changes made.
- **Deviations from plan:** note any departure.
- **Follow-up implications for later sections:** none.

---

## Section 12 — Delete the nearly-empty `assignmentDefinitionPartialsContract.guard.spec.ts` (L2)

### Objective

Delete
`src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts`
because it contains a single trivial test whose assertions are already
covered by `assignmentDefinitionPartials.zod.spec.ts` (the legacy
`yearGroup` rejection and the valid-row round-trip). The file is
documented in the synthesis as a redundant duplicate that adds
maintenance overhead with no incremental coverage.

### Constraints

- No production code changes. The file is deleted; the canonical
  schema coverage remains in
  `assignmentDefinitionPartials.zod.spec.ts`.
- Verify the two assertions in the guard spec
  (`assignmentDefinitionPartialsContract.guard.spec.ts:14-40`) are
  already covered in `assignmentDefinitionPartials.zod.spec.ts`
  before deleting the file (the synthesis verification confirms
  this; the section check enforces it via `git grep`).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (L2 verification paragraph only)

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `code-review-synthesis.md` (L2 verification paragraph only)

### Shared helper plan (when helper changes are expected)

No shared-helper changes.

### Acceptance criteria

- `assignmentDefinitionPartialsContract.guard.spec.ts` is deleted.
- `git grep -n "assignmentDefinitionPartialsContract.guard"` returns
  no results.
- `assignmentDefinitionPartials.zod.spec.ts` continues to pass and
  still contains the legacy-`yearGroup` rejection and valid-row
  round-trip assertions.
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/`
  is green.

### Required test cases (Red first)

No new test cases in this section — the delete is a pure removal.
The red/green/refactor sequence is:

1. **Red:** confirm
   `assignmentDefinitionPartials.zod.spec.ts` contains the
   legacy-`yearGroup` rejection and valid-row round-trip assertions
   (the synthesis says lines 78 and 89; verify the actual line
   numbers in the current file).
2. **Green:** delete the guard spec file.
3. **Refactor:** verify no other file imports the guard spec (it is
   a `.spec.ts` file, so it is not imported by production code;
   verify via `git grep`).

### Section checks

- `git grep -n "assignmentDefinitionPartialsContract.guard"` returns
  no results.
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/`
- Mandatory-read evidence gate passed for every delegated handoff in this
  section.

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the file deletion.
- **Deviations from plan:** note any departure.
- **Follow-up implications for later sections:** none.

---

## Section 13 — Regression and contract hardening

### Objective

Validate that the cumulative changes from Sections 1-12 do not regress
the existing test surface, the lint baseline, the coverage threshold,
or the wire-contract behaviour covered by the Zod schemas.

### Constraints

- This section runs no production code changes. It is a verification
  pass against the merged Sections 1-12.
- The `dataAnalysis.zod.spec.ts` contract tests are the canonical
  wire-contract coverage; they must remain green and unchanged in
  shape (the input/result schemas are not modified by this plan).
- The `assignmentDefinitionPartials.zod.spec.ts` contract tests are
  the canonical wire-contract coverage for the partial-definition
  shape; they must remain green and unchanged in shape.

### Acceptance criteria

- All four analyser spec files (orchestration, filters, accumulation,
  rows) pass.
- `dataAnalysis.zod.spec.ts` passes.
- `dataAnalysisService.spec.ts` passes.
- `getLinkableDefinitionsForModal.spec.ts` passes.
- `LinkableDefinitionList.spec.tsx` passes.
- `AssessTaskModal.spec.tsx` passes.
- `assignmentDefinitionPartials.zod.spec.ts` passes.
- `assignmentDefinition.zod.spec.ts` passes.
- `assignmentDefinitionPartialsService.spec.ts` passes.
- `assignmentDefinitionService.spec.ts` passes.
- `assignmentTopics.zod.spec.ts` passes (cross-feature regression
  guard for the schema unification).
- Frontend lint: `npm run lint:frontend:check` is green.
- Frontend test coverage: `npm run test:frontend:coverage` reports
  the minimum 85% threshold for lines, functions, statements, and
  branches in the touched areas.
- Backend lint: `npm run lint:backend:check` is green (no backend
  changes, but verify the baseline has not shifted).
- Backend tests: `npm test --` is green (no backend changes, but
  verify the baseline has not shifted).

### Required checks

1. Run the full frontend unit test suite
   (`npm run test:frontend`).
2. Run the full backend test suite (`npm test`).
3. Run frontend lint (`npm run lint:frontend:check`).
4. Run backend lint (`npm run lint:backend:check`).
5. Run frontend test coverage
   (`npm run test:frontend:coverage`) and verify the 85% threshold
   in the touched areas.
6. Verify mandatory-read evidence (`Files read`) is complete for
   every delegated handoff in Sections 1-12.
7. Verify the planned-only helper entries registered in Section 0
   match the actual implementation (filename, exports, owning path).

### Section checks

- All commands above report green.
- The `grep` / test-run cross-check from Section 9 confirms the
  expected number of `it()` cases across the four split spec files.
- Coverage report shows the touched files at or above 85% for all
  four metrics.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the verification results.
- **Deviations from plan:** note any coverage gap and the action
  taken.
- **Follow-up implications for later sections:** Section 14 (docs)
  reconciles the planned-only helper entries.

---

## Section 14 — Documentation and rollout notes

### Objective

Update the canonical docs to reflect the implemented changes from
Sections 1-13, reconcile the planned-only helper entries registered in
Section 0 against the actual implementation, and record the M3 product
decision in `SPEC.md` so the source of truth is up to date.

### Constraints

- The doc updates are scoped to the changes made by this plan. No
  unrelated doc updates.
- British English in all prose (per `AGENTS.md §3.4`).
- The `frontend-testing.md` planned-only entries registered in
  Section 0 are reconciled: status updated to `Implemented` if the
  helper was actually moved/extracted, or removed if the helper was
  abandoned.

### Required updates

1. **`docs/developer/frontend/frontend-testing.md`**
   (under "Shared test helpers"):
   - Update the planned-only entry for
     `src/frontend/src/test/dataAnalysis/fixtures.ts` to
     `Implemented`, noting the move from
     `src/frontend/src/services/dataAnalysis/test/fixtures.ts`.
   - Update the planned-only entry for
     `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
     to `Implemented`, noting the extracted helpers
     (`expectMetricResult`, `checkMetricInvariant`,
     `FLOAT_TOLERANCE`).
2. **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`**
   §3.4 (Shared test helpers):
   - Add a cross-reference to the data analysis test helpers
     location (`src/frontend/src/test/dataAnalysis/`).
3. **`SPEC.md`** (under "Agreed product decisions" and §"Error,
   loading, and empty-state rules"):
   - Add a new agreed product decision for the matched-flow
     `DEFINITION_STALE` recovery (M3): when
     `startAssessmentRun` rejects with `DEFINITION_STALE` from
     either the matched flow or the link flow, the modal
     transitions to the wizard's `'creating'` state to let the user
     re-derive the stale definition.
   - Add a "Matched-flow stale-recovery" entry to the error-state
     section documenting the new behaviour.
4. **No update to `DATA_SHAPES.md` is required** — the wire shape is
   unchanged (per Assumption 3 in this plan: the C4 fix is at the
   derivation site, not the wire schema).

### Required checks

1. Verify the two updated doc files (`frontend-testing.md`,
   `frontend-shared-helpers-and-abstraction-standards.md`) list the
   data analysis test helpers in the right places with the right
   status.
2. Verify `SPEC.md` documents the M3 product decision and the
   matched-flow stale-recovery behaviour.
3. Verify the implementation notes and deviations for Sections 1-13
   are recorded in the plan (this document) before it is deleted
   per the post-implementation guidance in
   `ACTION_PLAN_TEMPLATE.md`.

### Section checks

- `git diff -- docs/developer/frontend/frontend-testing.md
docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
SPEC.md` shows only the planned updates.
- Mandatory-read evidence gate passed for every delegated docs/review
  handoff in this section.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the doc updates.
- **Deviations from plan:** note any departure.

---

## Suggested implementation order

1. **Section 0** (planning prep — register planned-only helper
   entries in canonical docs). This must run before any production
   code changes; it is a docs-only step.
2. **Section 1** (C4 — `LinkableDefinition` type tightening). Fixes a
   real HIGH-severity bug; must land before Section 2 (which depends
   on the now-stable `linkableDefinitions` shape) and Section 5
   (which depends on the picker's contract).
3. **Section 2** (C3 — memo dependency fix). Fixes a real HIGH-
   severity stale-cache bug; depends on Section 1.
4. **Section 3** (C1 — Map-based `resolveTaskWeight`). Performance
   fix; independent of Sections 1-2 but the test additions need
   fixtures at their eventual canonical location. The fixture move
   (Section 8) is a no-op for Section 3's behaviour, so Section 3
   can run before Section 8 by importing from the old path and
   updating the import in Section 8's red/green pass.
5. **Section 4** (C2 — Set-based filter). Performance fix;
   independent of Section 3.
6. **Section 5** (H2 + H3 — `React.memo` + stable callbacks).
   Performance fix; depends on Section 1 (the picker's type).
7. **Section 6** (M2 — fetch effect cleanup). Bug fix; independent
   of Sections 1-5.
8. **Section 7** (M3 — matched-flow stale-recovery). Behaviour
   change; independent of Sections 1-6.
9. **Section 8** (L1 — fixtures move). Precondition for Section 9;
   also updates the import paths used by Sections 3-4 (if the
   Section 3/4 test additions import from the new path) and by the
   test files split in Section 9.
10. **Section 9** (H1 — extract helpers + split spec). Depends on
    Section 8.
11. **Section 10** (M1 — helpers out of `.types.ts`). Depends on
    Section 9 (the split spec files import the types and helpers
    from the new locations).
12. **Section 11** (L3 + M4 — null-name throw + in-place sort).
    Independent of Sections 1-10; can run in parallel with Section 10
    if the test files are split (Section 9) before Section 11.
13. **Section 12** (L2 — delete guard spec). Independent of
    Sections 1-11.
14. **Section 13** (regression and contract hardening). Runs after
    Sections 1-12 are merged.
15. **Section 14** (documentation and rollout notes). Runs after
    Section 13.
