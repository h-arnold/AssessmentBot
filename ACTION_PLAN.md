# AssessTask "Link to Existing Definition" — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read the new layout spec `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md`.
3. Read `src/frontend/AGENTS.md` (frontend conventions, §2.1 composition boundary, §4 API transport, §8 Zod standard, §10 modal patterns).
4. Read `src/backend/AGENTS.md` (backend conventions, §0.1 trailing-underscore handler pattern, §0.2 validation ownership, §3 logging, §10 facade pattern).
5. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (the existing AssessTask helper entries that this work extends).
6. Read `docs/developer/frontend/frontend-testing.md` and `docs/developer/backend/backend-testing.md` for testing policy.
7. Treat `SPEC.md` and `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` as the source of truth for product behaviour, contracts, and layout rules. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in those documents.

## Scope and assumptions

### Scope

- A new `'linking'` sub-state in the existing `AssessTaskModal`
  `noMatchResolution` state machine.
- A new `hasLinkSucceeded` boolean state slot (analogous to
  `hasCreateSucceeded`) to distinguish "cancel before upsert" from
  "upsert committed, assessment running".
- A new `LinkableDefinitionList` presentational component (Ant Design
  `Radio.Group` with JSX children; not `List`). All rows are always
  selectable — no disabled-row, no Tag, no `aria-live` summary.
- A new `getLinkableDefinitionsForModal` pure helper that filters, sorts,
  and maps the cached `AssignmentDefinitionPartial` rows to
  `LinkableDefinition[]`. No `isAlreadyLinked` derivation is performed.
- A new `caseInsensitiveTrimmedEquals` feature-local helper in a new
  `stringComparison.ts` file (used by both the matcher and the picker
  derivation helper).
- A new direct dependency `fuse.js` in `src/frontend/package.json` (and
  the corresponding lockfile update). The dependency is used only by
  the picker derivation helper for fuzzy title ranking.
- A relaxation of the existing `findMatchingDefinition` matcher to use
  case-insensitive trimmed equality for both title and topic, plus a new
  `alternateTopics` lookup branch.
- A new `AssignmentDefinitionUpsertOrchestrator._resolveAlternateTopics`
  private method that mirrors the existing `_resolveAlternateTitles`.
- A one-line orchestrator constructor call to pass the resolved
  `alternateTopics` to the `AssignmentDefinition` model.
- A frontend Zod `UpsertAssignmentDefinitionRequestSchema` extension to
  accept `alternateTitles`, `alternateTopics`, `referenceDocumentId`,
  `templateDocumentId`, and `documentType` as optional fields, with a
  `superRefine` mutual-exclusion rule between the URL-shape and
  ID-shape payloads.
- The full test surface (backend controller unit tests, frontend matcher
  unit tests, picker helper unit tests, Zod schema unit tests, modal
  Vitest component tests, shared test utility extensions, Playwright
  e2e tests).
- Documentation updates to the shared-helpers doc, the DATA_SHAPES doc,
  the api-layer doc, and the front-end testing notes.
- `DEFINITION_STALE` recovery: when `startAssessmentRun` rejects with
  `DEFINITION_STALE`, the link (the alternateTitle write) is preserved
  and the modal transitions to the wizard's 2nd panel (task weightings)
  with the document re-parsed. This applies to both the link flow and
  the existing wizard flow.

### Out of scope

- Creating a new endpoint (`addAlternateTitle` or similar). The link
  flow reuses the existing `upsertAssignmentDefinition`.
- Any UI changes outside the AssessTask modal.
- Any mutation, creation, or deletion of assignments (not definitions).
- Changes to the existing `AssignmentController`,
  `AssignmentDefinitionController`, or `Assignment` model (the model's
  `alternateTopics` field is already wired in the constructor; only the
  orchestrator's constructor call needs the new argument).
- Renaming `normaliseAlternateTitles` to `normaliseTrimmedStringArray`
  (deferred per the spec).
- In-picker search/filter input, virtualisation, pagination.
- Unlinking a previously-linked assignment.
- The `isAlreadyLinked` concept (removed per stakeholder decision —
  every row in the picker is always selectable).

### Assumptions

1. The cached `AssignmentDefinitionPartial` rows already include
   `yearGroupLabel` (per `assignmentDefinitionPartials.zod.ts` line 190);
   the picker reads the label directly from the partial without an extra
   yearGroups reference-data lookup.
2. The frontend Zod `superRefine` for the URL-shape vs ID-shape mutual
   exclusion can be implemented with Zod v4's `.superRefine` API; the
   wizard's existing payload (which always sends the URL fields) will
   continue to pass the new rule without modification.
3. The `Radio.Group` JSX-children pattern is fully supported in Ant
   Design v6.
4. The `name` prop on `Radio.Group` enables arrow-key navigation between
   rows in the same way a native HTML radio group does. No `disabled`
   rows exist in this component (all rows are always selectable).
5. The `flushSync` pattern in `handleWizardCreateSuccess` is **not**
   needed for the link flow (per SPEC.md Decision 11).
6. The existing `progressTracker` strip at the API boundary applies
   only to `getAssignment_`, not to `upsertAssignmentDefinition_`; the
   link flow is unaffected by that constraint.
7. `queryClient.invalidateQueries({ queryKey:
queryKeys.assignmentDefinitionPartials() })` is the correct React
   Query API for cache invalidation in the existing app (per
   `frontend-react-query-and-prefetch.md`).
8. The lock-manager and `progressTracker` logging in the backend
   transport are unchanged; the link flow is a single upsert call
   followed by a single `startAssessmentRun` call, both of which
   already exercise the existing logging and locking.

---

## Global constraints and quality gates

### Engineering constraints

- Keep the API handler thin and delegate to existing controller methods.
- Fail fast on invalid inputs with `ApiValidationError`.
- Do not add defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository
  conventions.
- Use British English in comments and documentation.
- `ABLogger` is mandatory for all new backend code (the new
  `_resolveAlternateTopics` method is a pure function and does not
  introduce new logging; existing logging in the orchestrator's
  surrounding code path is preserved).
- Match the existing `flushSync`-or-no-`flushSync` decision per
  `SPEC.md` Decision 11 (no `flushSync` for the link flow).
- Follow the shared-helpers extraction rule: feature-local helpers stay
  local; `caseInsensitiveTrimmedEquals` lives in a feature-local
  `stringComparison.ts` file (shared between the matcher and the
  picker derivation helper but not exported from the modal feature
  directory).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and
enforce mandatory documentation reads. For each delegated phase
(`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`,
`De-Sloppification`):

1. list required documentation file paths under that phase before
   delegation
2. require the sub-agent handoff to include `Files read` with explicit
   file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same
   sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

This work introduces four new feature-local helpers and reuses several
existing ones.

Helper decision entries:

1. Helper: `caseInsensitiveTrimmedEquals` feature-local pure helper
   - Decision: `new`
   - Owning module/path:
     `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
     (a new third file colocated with the matcher; **not** private to
     the matcher file because it is shared with the picker helper
     `getLinkableDefinitionsForModal`).
   - Call-site rationale: replaces the strict `===` and
     `Array.includes` equality in the matcher with case-insensitive
     trimmed equality for both title (`primaryTitle` +
     `alternateTitles`) and topic (`primaryTopic` +
     `alternateTopics`). The helper is colocated with the matcher
     feature (single file in the modal feature directory) because
     it has two in-scope callers (the matcher and the picker
     derivation helper) per
     `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
     §3.4 ("extract a new helper only when repeated behaviour exists
     now, or a second in-scope caller is already accepted"). The
     helper is **not** exported from the modal feature directory —
     it stays feature-local.
   - Relevant canonical doc target:
     `frontend-shared-helpers-and-abstraction-standards.md`
     shared-helpers document (extend the existing AssessTask entries).
   - Planned doc status: `Not implemented`
2. Helper: `getLinkableDefinitionsForModal` pure helper
   - Decision: `new`
   - Owning module/path:
     `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
   - Call-site rationale: derives the `LinkableDefinition[]` for the
     picker by filtering the cached partials to the class's
     `yearGroupKey` and sorting by `fuse.js` title rank with
     `updatedAt` desc as the tie-breaker. The helper is colocated
     with the matcher (separate file) following the same pattern as
     `findMatchingDefinition`; the function is exported for unit
     testing. No `isAlreadyLinked` derivation (removed per
     stakeholder decision).
   - Relevant canonical doc target:
     `frontend-shared-helpers-and-abstraction-standards.md`
     (extend existing AssessTask entries).
   - Planned doc status: `Not implemented`
3. Helper: `LinkableDefinitionList` presentational component
   - Decision: `new`
   - Owning module/path:
     `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
   - Call-site rationale: renders the picker as an Ant Design
     `Radio.Group` with vertical orientation, block width, and JSX
     children. The component is presentational (no state, no side
     effects); it receives the derived `LinkableDefinition[]` and the
     current selection, and emits `onSelect(definitionKey)`. The
     component has exactly one caller (`AssessTaskModal`) and is not
     promoted to a shared component. All rows are always selectable.
   - Relevant canonical doc target:
     `frontend-shared-helpers-and-abstraction-standards.md`
     (extend existing AssessTask entries).
   - Planned doc status: `Not implemented`
4. Direct dependency: `fuse.js` (fuzzy search library)
   - Decision: `new`
   - Owning module/path: `src/frontend/package.json` (and the
     corresponding lockfile entry).
   - Call-site rationale: imported by
     `getLinkableDefinitionsForModal.ts` for fuzzy title ranking
     (per `SPEC.md` Decisions 3 and 8). The library is well-maintained
     (https://fusejs.io), has built-in TypeScript types (v7+), no
     runtime dependencies, and ~12 kB gzipped bundle weight.
   - Relevant canonical doc target: no canonical doc entry required
     (the dependency declaration is self-explanatory; the integration
     is documented in `SPEC.md` Decision 8).
   - Planned doc status: N/A (the dependency is declared in
     `package.json`; the lockfile entry is generated by `npm install`)

5. Helper: `_resolveAlternateTopics` private orchestrator method
   - Decision: `new`
   - Owning module/path:
     `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`
   - Call-site rationale: mirrors the existing
     `_resolveAlternateTitles` method to handle the
     `alternateTopics` field on the upsert payload. Preserves
     existing `alternateTopics` on update when the payload omits the
     field; normalises via `validation.normaliseAlternateTitles` (the
     existing method) when the field is provided. The method is
     private (leading underscore convention for class methods) and is
     called only from the orchestrator's `upsert` method.
   - Relevant canonical doc target: none (the orchestrator's existing
     docstring is the authority; no new canonical doc entry is
     required because the helper mirrors an existing pattern).
   - Planned doc status: N/A

Reused helpers (no decision needed):

- `validation.normaliseAlternateTitles` (backend) — reused for both
  `alternateTitles` and `alternateTopics` because the validation
  semantics are identical (non-empty trimmed strings). A code comment
  in `_resolveAlternateTopics` records the reuse.
- `upsertAssignmentDefinition` (frontend service) — reused; the new
  fields ride along via the extended Zod schema.
- `queryClient.invalidateQueries` and the
  `queryKeys.assignmentDefinitionPartials` query key (frontend) —
  reused; no new query keys.
- `AssignmentDefinition.alternateTopics` field (backend model) —
  reused; the orchestrator's constructor call now passes the
  resolved array.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests:
  - `npm test -- tests/controllers/assignmentDefinitionController.upsert.test.js`
  - `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js` (no
    change expected; the existing test covers the ID-shape path)
- Frontend tests:
  - `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
  - `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts` (new file)
  - `npm run frontend:test -- src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  - `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
- Frontend dependency install (pre-Section 4, step 0):
  add `fuse.js` to `src/frontend/package.json` dependencies and run
  `npm install --prefix src/frontend` before writing Section 4 tests.
- Playwright e2e tests (if executed locally):
  - `npm run frontend:test:e2e -- classes-page-assess-task`

---

## Section 1 — Backend orchestrator `_resolveAlternateTopics` (Red, Green, Refactor)

### Objective

Add the private `_resolveAlternateTopics` method to
`AssignmentDefinitionUpsertOrchestrator` and wire it into the
`upsert` method's constructor call so that `alternateTopics` round-trips
on update.

### Constraints

- The new method is private to the orchestrator file (leading underscore
  convention for class methods).
- The new method delegates to `validation.normaliseAlternateTitles` for
  normalisation. A code comment records the reuse.
- The orchestrator's `upsert` method's constructor call gains one new
  line: `alternateTopics: this._resolveAlternateTopics({ payload,
isUpdate, existingDefinition })`.
- The `_resolveAlternateTopics` method preserves the existing
  `alternateTopics` on update when the payload omits the field (mirror
  of `_resolveAlternateTitles`).
- The new method is a pure function; no new logging, no new error
  types, no new transport validation. The transport validator in
  `z_Api/assignmentDefinitionValidation.js` requires no change because
  extra fields are tolerated.
- The model `AssignmentDefinition` already accepts `alternateTopics` in
  its constructor (per `src/backend/Models/AssignmentDefinition.js`
  line 48) and serialises it via `toJSON()` and `toPartialJSON()`.
- The response mapper already includes `alternateTopics` in the
  canonical response (per
  `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionResponseMapper.js`
  line 77).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`
  (target file)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`
  (validation class — the `normaliseAlternateTitles` method is reused)
- `src/backend/Models/AssignmentDefinition.js` (model constructor
  signature, `alternateTopics` parameter)
- `tests/controllers/assignmentDefinitionController.upsert.test.js`
  (existing test patterns and the
  `preserves existing alternateTitles when updates omit alternateTitles`
  test that the new method mirrors)
- `SPEC.md` (feature spec)
- `src/backend/AGENTS.md` §1.1, §1.2, §3 (concatenation load order,
  logging, no-`console` policy)
- `docs/developer/backend/backend-testing.md` (testing policy)

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md` §1.1, §3
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`
  (focus on lines 147-155: `_resolveAlternateTitles` pattern)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`
  (lines 56-71: `normaliseAlternateTitles`)
- `src/backend/Models/AssignmentDefinition.js` (lines 41-122: constructor
  signature for `alternateTopics`)
- `docs/developer/backend/api-layer.md` (lines around 342: optional
  request fields)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`
  (final state)
- `tests/controllers/assignmentDefinitionController.upsert.test.js`
  (final state)

### Shared helper plan (when helper changes are expected)

Recorded in the global Shared-helper planning gate above. The new
`_resolveAlternateTopics` helper is the only new orchestrator helper.

### Acceptance criteria

- `_resolveAlternateTopics` exists on the orchestrator.
- The orchestrator's `upsert` method passes
  `alternateTopics: this._resolveAlternateTopics({ payload, isUpdate,
existingDefinition })` to the `new AssignmentDefinition({ ... })`
  constructor call.
- The new method preserves the existing `alternateTopics` on update when
  the payload omits the field.
- The new method normalises the provided `alternateTopics` via
  `validation.normaliseAlternateTitles`.
- The new method is private (leading underscore).
- Existing tests in
  `tests/controllers/assignmentDefinitionController.upsert.test.js`
  pass without modification.
- Backend lint passes: `npm run lint:backend`.

### Required test cases (Red first)

Backend controller tests (added to the existing
`tests/controllers/assignmentDefinitionController.upsert.test.js`):

1. **`_resolveAlternateTopics` preserves existing on update when
   payload omits the field** — set up a `validation` mock that
   returns the existing definition's `alternateTopics` when
   `normaliseAlternateTitles` is called, verify the orchestrator's
   `upsert` constructs a new `AssignmentDefinition` with
   `alternateTopics: existingAlternateTopics` (mirroring the existing
   `_resolveAlternateTitles` test section, specifically the test named
   `'"preserves existing alternateTitles when constructing new model"'`).
2. **`_resolveAlternateTopics` normalises provided `alternateTopics`** —
   payload includes `alternateTopics: ['  Linear Equations  ', '']`;
   verify the valid entry is trimmed and the empty-string entry throws
   (delegated to `normaliseAlternateTitles`).
3. **`_resolveAlternateTopics` rejects non-array `alternateTopics`** —
   payload includes `alternateTopics: 'not an array'`; verify the
   thrown `TypeError` from `normaliseAlternateTitles` propagates
   unchanged.
4. **`_resolveAlternateTopics` rejects non-string entries** — payload
   includes `alternateTopics: [123]`; verify the thrown `Error` from
   `normaliseAlternateTitles` propagates unchanged.
5. **End-to-end: `upsert` constructs an `AssignmentDefinition` with the
   new alternates** — payload includes both `alternateTitles` and
   `alternateTopics`; verify the constructed model receives both arrays
   (this is the integration case that proves the constructor call was
   wired correctly).

### Section checks

- `npm test -- tests/controllers/assignmentDefinitionController.upsert.test.js`
  — all tests green.
- `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js` — all
  tests still green (no change).
- `npm run lint:backend` — clean.
- Mandatory-read evidence gate passed for all delegated handoffs in
  this section.
- Shared-helper planning entries are present.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on `_resolveAlternateTopics` documenting:

- Why the method delegates to `normaliseAlternateTitles` (the validation
  semantics are identical to `alternateTitles`; a parallel method
  would duplicate logic).
- The `preserve-when-omitted` semantics (the model retains its existing
  `alternateTopics` if the payload omits the field; sending the full
  array always overwrites).
- The new `alternateTopics: ...` constructor call line in `upsert`
  (one-line addition) needs no `@remarks`.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - `_resolveAlternateTopics` added at lines 162-190 of
    `AssignmentDefinitionUpsertOrchestrator.js`, mirroring
    `_resolveAlternateTitles` exactly.
  - Constructor call wired at lines 113-117 with one new
    `alternateTopics: this._resolveAlternateTopics(...)` line.
  - 6 tests added (5 from Red phase + 1 empty-array edge case from
    review feedback). All 44 tests pass.
  - `@remarks` JSDoc documents the `normaliseAlternateTitles` reuse
    and preserve-when-omitted semantics.
  - Inline comment at the `normaliseAlternateTitles` call site
    reinforces the intentional reuse.
- **Deviations from plan:** The regression checker flagged a new
  `max-lines` warning on the test file (991 lines, up from 903). This
  is a pre-existing warning rule; the file was already over 500 lines.
  The new tests add essential coverage. Accepted as technical debt.
- **Follow-up implications for later sections:** Section 3 (Zod
  schema extension) and Section 6 (modal integration) depend on the
  orchestrator's ability to round-trip `alternateTopics`. Once Section
  1 lands, those sections can be implemented independently.

---

## Section 2 — Frontend matcher relaxation (Red, Green, Refactor)

### Objective

Relax the existing `findMatchingDefinition` matcher to use
case-insensitive trimmed equality for both title (`primaryTitle` +
`alternateTitles`) and topic (`primaryTopic` + `alternateTopics`).
Introduce the `alternateTopics` lookup branch in the topic match.

### Constraints

- Add a small pure helper `caseInsensitiveTrimmedEquals(a, b)` in a
  new file `stringComparison.ts` colocated with the matcher in the
  modal feature directory. The helper is **not** exported from the
  modal feature directory (it stays feature-local) and follows the
  same case-insensitive trimmed comparison as the backend
  `normaliseTitleForDuplicate`.
- The matcher's `MatchResult` discriminated union shape does not
  change.
- The matcher's existing tests (with matching-case inputs) continue to
  pass without modification; new cases for case-different,
  whitespace-different, and the new `alternateTopics` lookup are added.
- The matcher remains a pure function; no React, no I/O, no service
  imports.
- The matcher imports `caseInsensitiveTrimmedEquals` from the new
  `stringComparison.ts` file.
- The supplementary `alternateTopics` topic check only runs when
  `topicName !== null`; the early return for `topicName === null` is
  unchanged.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
  (target file)
- `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
  (existing test patterns)
- `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
  (new helper file — must exist before tests run)
- `src/frontend/AGENTS.md` §2.2 (hooks/services/side effects
  boundaries)
- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md` (matcher relaxation section)

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §2.2, §8
- `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
- `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
  (the new helper file to create)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`
  (lines 43-47: `normaliseTitleForDuplicate` — the backend normaliser
  whose semantics the new helper mirrors)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §2.2
- `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
  (final state)
- `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
  (final state)

### Shared helper plan (when helper changes are expected)

Recorded in the global Shared-helper planning gate above. The new
`caseInsensitiveTrimmedEquals` helper lives in the new
`stringComparison.ts` file (shared between the matcher and the
picker derivation helper). The planned-only doc status for
`caseInsensitiveTrimmedEquals` is `Not implemented`; the doc entry
will be added to the shared-helpers document in Section 9
(Documentation).

### Acceptance criteria

- The matcher compares titles case-insensitive trimmed (both
  `primaryTitle` and `alternateTitles`).
- The matcher compares topics case-insensitive trimmed (both
  `primaryTopic` and `alternateTopics`). The `alternateTopics` check
  only runs when `topicName !== null`.
- The matcher's `MatchResult` discriminated union shape is unchanged.
- Existing matcher tests pass without modification (matching-case
  inputs).
- New test cases verify the case-insensitive trimmed equality for both
  title and topic, and the new `alternateTopics` lookup branch.
- The helper `caseInsensitiveTrimmedEquals` lives in
  `stringComparison.ts` and is feature-local (not exported from the
  modal feature directory).
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

Matcher unit tests (added to the existing
`matchDefinitionForAssignment.spec.ts`):

1. **Case-insensitive title match against `primaryTitle`** — partial
   `primaryTitle: 'Essay'`, `selectedAssignment.title: 'essay'`,
   topic and year group match → `'matched'`.
2. **Whitespace-tolerant title match** — partial
   `primaryTitle: 'Essay'`, `selectedAssignment.title: '  Essay  '`,
   topic and year group match → `'matched'`.
3. **Case-insensitive title match against `alternateTitles`** — partial
   `alternateTitles: ['Narrative']`, `selectedAssignment.title:
'NARRATIVE'`, topic and year group match → `'matched'`.
4. **Case-insensitive topic match against `primaryTopic`** — partial
   `primaryTopic: 'Algebra'`, `selectedAssignment.topicName: 'algebra'`,
   title and year group match → `'matched'`.
5. **Case-insensitive topic match against `alternateTopics`** —
   partial `alternateTopics: ['Linear Equations']`,
   `selectedAssignment.topicName: 'linear equations'`, title and year
   group match → `'matched'`.
6. **Whitespace-tolerant topic match** — partial
   `primaryTopic: 'Algebra'`,
   `selectedAssignment.topicName: '  Algebra  '`, title and year group
   match → `'matched'`.
7. **Case-different title does not cause a false match when topic
   or year group differ** — ensures case-insensitive equality is
   scoped to the title comparison only and the matcher doesn't
   become trivially permissive.
8. **`topicName === null` still returns `'no-match'`** — preserves the
   existing early-return behaviour: an assignment without a topic can
   never match a definition because the matcher requires both title and
   topic to match. (In the picker helper, `topicName: null` has a
   different effect: it skips the topic leg of payload construction,
   so the `alternateTopics` array is sent unchanged — see Section 6.)
9. **The helper `caseInsensitiveTrimmedEquals` lives in
   `stringComparison.ts`** — verify the helper is imported by the
   matcher from the new file and is not exported from the modal
   feature directory.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on `caseInsensitiveTrimmedEquals`
documenting:

- Why the helper is feature-local (two in-scope callers; the backend
  `normaliseTitleForDuplicate` is the only cross-system reference and
  is not exported to the frontend).
- The normalisation is `a.trim().toLowerCase() === b.trim().toLowerCase()`
  and is consistent with the backend
  `AssignmentDefinitionValidation.normaliseTitleForDuplicate`.
- Why the matcher relaxation is a strict superset of the previous
  behaviour (case-matching inputs still match; new cases match
  case-insensitively).

Add a `@remarks` JSDoc tag on `findMatchingDefinition` documenting:

- The new case-insensitive trimmed equality semantics.
- The new `alternateTopics` lookup branch.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 4
  (`getLinkableDefinitionsForModal`) imports
  `caseInsensitiveTrimmedEquals` from the new
  `stringComparison.ts` file (not from the matcher file). The
  matcher also imports from `stringComparison.ts`. The two files
  are siblings inside the modal feature directory; both are
  feature-local.

---

## Section 3 — Frontend Zod schema extension (Red, Green, Refactor)

### Objective

Extend the frontend Zod `UpsertAssignmentDefinitionRequestSchema` to
accept `alternateTitles`, `alternateTopics`, `referenceDocumentId`,
`templateDocumentId`, and `documentType` as optional fields, with a
`superRefine` mutual-exclusion rule between the URL-shape and ID-shape
payloads.

### Constraints

- `yearGroupKey`, `primaryTitle`, and `primaryTopicKey` remain required
  fields (they are already in the existing schema and remain required
  for both shapes).
- `referenceDocumentUrl` and `templateDocumentUrl` are made optional
  (they are currently required for the wizard's URL-shape contract).
- The new optional fields use `TrimmedNonEmptyStringSchema` (or the
  existing `WeightingSchema` for `assignmentWeighting`, the existing
  `TaskWeightingInputSchema` for `taskWeightings`) to match the
  existing field types.
- The `superRefine` enforces the URL-shape vs ID-shape mutual
  exclusion: the payload must include either both `referenceDocumentUrl`
  and `templateDocumentUrl`, or `referenceDocumentId`,
  `templateDocumentId`, and `documentType` (all three of the ID
  fields).
- The wizard's existing payload (which always provides the URL fields)
  continues to pass the new `superRefine` without modification.
- The schema is `strict()` (no extra fields) per the existing pattern.
- The Zod spec file
  `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  is extended with cases for the new fields and the `superRefine`
  rule.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`
  (target file, lines 81-92: the existing
  `UpsertAssignmentDefinitionRequestSchema`)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  (existing test patterns)
- `src/frontend/AGENTS.md` §8 (Zod as the validation framework; void
  responses use `.nullable()`)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §8
- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`
- `src/backend/z_Api/assignmentDefinitionValidation.js` (lines 206-270:
  the existing ID-shape path requires
  `referenceDocumentId`, `templateDocumentId`, and `documentType` as
  strings; the new schema's `superRefine` mirrors this contract)
- `src/backend/z_Api/assignmentDefinitionTransport.js` (lines 152-187:
  the upsert transport handler's URL-to-ID translation)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §8
- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`
  (final state)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  (final state)

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. The Zod schema is a local
declaration.

### Acceptance criteria

- The schema accepts the ID-shape payload (with `referenceDocumentId`,
  `templateDocumentId`, `documentType`, `alternateTitles`,
  `alternateTopics`, and no URL fields).
- The schema accepts the URL-shape payload (the wizard's existing
  payload).
- The schema rejects a payload that includes neither shape or
  includes only one of the two URL fields or only some of the three
  ID fields.
- The schema rejects payloads that violate the underlying field types
  (e.g. `alternateTitles: 'not an array'`).
- The schema is `strict()` (no extra fields).
- Existing tests in `assignmentDefinition.zod.spec.ts` pass without
  modification.
- New test cases cover the new fields and the `superRefine` rule.
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

Frontend Zod tests (added to
`assignmentDefinition.zod.spec.ts`):

1. **ID-shape payload is accepted** — a full ID-shape payload with
   `definitionKey`, `primaryTitle`, `primaryTopicKey`, `yearGroupKey`,
   `referenceDocumentId`, `templateDocumentId`, `documentType`,
   `alternateTitles: ['Linear Equations']`,
   `alternateTopics: ['Algebra']` parses successfully.
2. **URL-shape payload is accepted** — the wizard's existing URL-shape
   payload parses successfully. The payload includes
   `referenceDocumentUrl` and `templateDocumentUrl` and **does not**
   include `documentType` (the document type is derived from the URL
   on the backend, not passed by the wizard). The `superRefine`
   correctly allows the URL-shape without `documentType`.
3. **Payload with neither shape is rejected** — a payload with
   `primaryTitle`, `primaryTopicKey`, `yearGroupKey` only (no doc
   fields) is rejected with a clear error path.
4. **Payload with only `referenceDocumentId` (no `templateDocumentId`
   or `documentType`) is rejected** — the `superRefine` enforces the
   all-three-of-ID-fields rule.
5. **Payload with only `referenceDocumentUrl` (no
   `templateDocumentUrl`) is rejected** — the `superRefine` enforces
   the both-URL-fields rule.
6. **Payload with both URL fields and ID fields is rejected** — the
   `superRefine` enforces the mutual exclusion (the wizard must
   not accidentally send both).
7. **`alternateTitles: 'not an array'` is rejected** — type check.
8. **`alternateTopics: [123]` is rejected** — array-of-strings check.
9. **Extra field is rejected** — `strict()` rule preserved.
10. **Empty `alternateTitles: []` is accepted by the Zod schema**
    (valid shape — the orchestrator treats empty arrays as "clear the
    alternates"). Note: the modal's payload construction must never
    produce empty arrays (the full existing array + new entry is always
    sent); this test confirms the schema allows it.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on
`UpsertAssignmentDefinitionRequestSchema` documenting:

- The URL-shape vs ID-shape mutual-exclusion rule.
- The wizard's payload continues to pass the new rule (URL-shape is
  the wizard's contract).
- The ID-shape is the link flow's contract (no URL fields, ID fields
  instead).

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 6 (modal
  integration) depends on the extended schema to send the link flow's
  payload. Once Section 3 lands, Section 6 can be implemented
  independently.

---

## Pre-Section 4 Step — Install `fuse.js` dependency

Before writing Section 4 tests, install the `fuse.js` dependency:

1. Add `fuse.js` to `dependencies` in `src/frontend/package.json`.
2. Run `npm install --prefix src/frontend` to regenerate the lockfile
   and make `import Fuse from 'fuse.js'` available in tests.

This step must complete before the Section 4 Red phase (the new test
file imports `getLinkableDefinitionsForModal`, which imports
`fuse.js`).

---

## Section 4 — Frontend `getLinkableDefinitionsForModal` helper with `fuse.js` integration (Red, Green, Refactor)

### Objective

Add the new pure helper `getLinkableDefinitionsForModal` that derives
the picker list from the cached `AssignmentDefinitionPartial` rows
using `fuse.js` for fuzzy title ranking (with `updatedAt` desc as the
tie-breaker).

### Constraints

- The helper is colocated with the matcher (separate file, peer to
  `matchDefinitionForAssignment.ts`) and is exported for unit testing.
- The helper signature is:
  `getLinkableDefinitionsForModal(definitionPartials: AssignmentDefinitionPartial[], classYearGroupKey: string, selectedAssignment: { title: string; topicName: string | null }): LinkableDefinition[]`.
- The helper is a pure function; no React, no I/O, no service
  imports.
- The `LinkableDefinition` derived type is colocated with the helper.
- The helper filters by `yearGroupKey` equality, then sorts by
  `fuse.js` fuzzy title rank with `updatedAt` desc as the tie-breaker,
  and maps to the `LinkableDefinition` shape.
- No `isAlreadyLinked` derivation is performed. Every
  year-group-matching definition is returned as a selectable row.
- The `fuse.js` instance is configured with:
  - `keys: ['primaryTitle']` (score against `primaryTitle` only);
  - `threshold: 1.0` (include all year-group-matching definitions in
    the ranking, regardless of how distant);
  - `includeScore: true` (so the per-item score is available for
    tie-breaking and for debugging);
  - `ignoreLocation: true` (match anywhere in the title; position
    does not affect the score).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`
  (the `AssignmentDefinitionPartial` Zod schema, lines 184-202)
- `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
  (the new helper from Section 2)
- `src/frontend/AGENTS.md` §2.2, §8
- `docs/developer/frontend/frontend-testing.md`
- `SPEC.md` (Decisions 3 and 8: picker sort and `fuse.js` integration)
- The official `fuse.js` docs (https://fusejs.io) for the `Fuse`
  constructor and `search` method signatures

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §2.2, §8
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`
- `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
  (the new helper from Section 2)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md` §2.2
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
  (new file, final state)
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
  (new file, final state)

### Shared helper plan (when helper changes are expected)

Recorded in the global Shared-helper planning gate above. The new
`getLinkableDefinitionsForModal` helper is feature-local and is
documented in the shared-helpers document in Section 9 (Documentation).

### Acceptance criteria

- The helper exists and is exported.
- The helper signature matches the spec.
- The helper filters by `yearGroupKey` equality (drops partials with a
  non-matching year group).
- The helper sorts by `fuse.js` title rank (ascending score) with
  `updatedAt` desc as the tie-breaker for equal scores.
- The helper returns an empty array when `definitionPartials` is
  empty.
- The helper does not throw on any input.
- The helper is a pure function (no React, no I/O).
- The `fuse.js` dependency is declared in
  `src/frontend/package.json` and the lockfile is regenerated.
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

Picker helper unit tests (new file
`getLinkableDefinitionsForModal.spec.ts`):

1. **Empty input** — `definitionPartials: []` returns `[]`.
2. **No matches (year-group filter excludes everything)** — partials
   with non-matching `yearGroupKey` are dropped.
3. **Single match** — one partial with matching `yearGroupKey` returns
   one `LinkableDefinition`.
4. **Fuzzy ranking: closest primaryTitle ranks first** — given three
   partials with `primaryTitle` values of `"Poetry Analysis"`,
   `"Algebra HW"`, and `"Algebra Homework"`, and a
   `selectedAssignment.title` of `"Algebra HW"`, the picker returns
   `"Algebra HW"` first, `"Algebra Homework"` second (close
   rephrasing), and `"Poetry Analysis"` last (unrelated). Verify the
   observable ranking order (first by position, then by score).
5. **`updatedAt` desc is the tie-breaker for equal scores** — two
   partials with `primaryTitle` values of `"Algebra"` (perfect
   match, score 0) and `updatedAt` of 2025-01-01 vs 2025-01-03:
   the picker returns the 2025-01-03 row first, then the 2025-01-01
   row. This proves the `updatedAt` desc tie-breaker works.
6. **Completely unrelated title still appears in the picker** — a
   partial with `primaryTitle: "Poetry Analysis"` is still returned
   (with a worse score) when the `selectedAssignment.title` is
   `"Algebra HW"`. The threshold of 1.0 ensures no item is filtered
   out by score.
7. **Defensive handling of null fields** — partials with `null`
   `primaryTitle`, `primaryTopic`, or missing arrays do not cause
   the helper to throw. They are handled defensively (coerced to
   empty strings/arrays).

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.
- Pre-Section 4 dependency install step completed.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on `getLinkableDefinitionsForModal`
documenting:

- Why the helper is a separate file (pure function with one caller,
  independent testability, follows the matcher pattern).
- The `fuse.js` configuration details (threshold 1.0, score-only).
- The `updatedAt` lexicographic sort order is intentional
  (ISO 8601 with timezone sorts chronologically when compared as
  strings).

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 5
  (`LinkableDefinitionList` component) consumes the helper's output
  (the fuzzy-ranked list). Section 6 (modal integration) wires the
  helper into the modal's `useMemo`. Section 8 (Playwright e2e)
  adds a new test case verifying the picker order matches the
  fuzzy-ranked order. Once Section 4 lands, those sections can be
  implemented independently.

---

## Section 5 — Frontend `LinkableDefinitionList` presentational component (Red, Green, Refactor)

### Objective

Add the new `LinkableDefinitionList` presentational component that
renders the picker as an Ant Design `Radio.Group` with vertical
orientation, block width, and JSX children. All rows are always
selectable — no disabled state, no "Already linked" Tag, no
`aria-live` summary.

### Constraints

- The component is colocated with the modal feature
  (`src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`).
- The component is presentational: no state, no side effects, no
  React Query, no service calls.
- The component signature is:
  `LinkableDefinitionList({ linkableDefinitions, selectedDefinitionKey, onSelect }): JSX.Element`.
- The component renders an Alert with the extended copy ("Link to an
  existing definition..."), the `Radio.Group` with JSX children, and
  the per-row `Flex` with `Typography.Text` title and subtitle (with
  `ellipsis={{ rows: 1 }}`).
- The component does not render a footer (the modal owns the footer).
- The component does not render an `Empty` (the modal owns the
  empty-state Alert and the modal's overall empty state).
- The component is keyboard-navigable via the `Radio.Group`'s
  built-in arrow-key navigation (set the `name` prop).
- **Every row is always selectable** — no `disabled` prop is used
  on any `Radio`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
  (new file, target)
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
  (for the surrounding `Modal`, `Space`, `Alert`, `Button` patterns)
- `src/frontend/AGENTS.md` §2.2, §8, §10
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` (the layout spec this
  component implements)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` (the layout spec; this
  section is its primary input)
- `src/frontend/AGENTS.md` §1, §2, §3, §10
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
  (existing component patterns)
- The official Ant Design v6 Radio docs (the component uses
  `Radio.Group` with `orientation="vertical"`, `block`, `name`)

Code Reviewer mandatory docs:

- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md`
- `src/frontend/AGENTS.md` §2.2, §10
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
  (new file, final state)
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
  (new file, final state)

### Shared helper plan (when helper changes are expected)

Recorded in the global Shared-helper planning gate above. The new
`LinkableDefinitionList` component is feature-local and is documented
in the shared-helpers document in Section 9 (Documentation).

### Acceptance criteria

- The component exists and is exported.
- The component signature matches the spec.
- The component renders an Alert with the extended copy.
- The component renders a `Radio.Group` with `orientation="vertical"`,
  `block`, and `name` set.
- Each `LinkableDefinition` renders as a `Radio` with title (strong)
  and subtitle (secondary, `<topic> · <yearGroupLabel>`).
- All rows are always selectable — no `disabled` prop on any `Radio`.
- The component does not manage its own selection state (it is
  controlled via the `selectedDefinitionKey` prop and the `onSelect`
  callback).
- The component does not throw on empty input.
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

Component tests (new file `LinkableDefinitionList.spec.tsx`):

1. **Renders the Alert with the extended copy** — the
   `linkableDefinitions` prop is non-empty; the component renders the
   Alert with the title interpolation.
2. **Renders one `Radio` per `LinkableDefinition`** — three
   `linkableDefinitions` produce three `Radio` elements.
3. **No `Radio` has `disabled` prop** — every row is always selectable.
4. **Renders the title (strong) and subtitle (secondary) for each
   row** — a row with `primaryTitle: 'Essay'`, `primaryTopic:
'Writing'`, `yearGroupLabel: 'Year 10'` renders both texts.
5. **Renders `Radio.Group` with `name="linkable-definition"`** — the
   `name` prop is set for keyboard navigation.
6. **Renders `Radio.Group` with `orientation="vertical"` and `block`**
   — the orientation and block props are set.
7. **Calls `onSelect(definitionKey)` when a row is selected** — the
   `Radio.Group`'s `onChange` emits the `definitionKey`.
8. **Renders the component with empty `linkableDefinitions`** — the
   `Radio.Group` is empty (no rows); no error is thrown.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on `LinkableDefinitionList` documenting:

- The component is presentational; the modal owns the selection
  state and the side effects.
- All rows are always selectable (no `disabled`, no `isAlreadyLinked`
  logic).
- The `name` prop enables native radio-group keyboard navigation.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 6 (modal
  integration) wires the component into the modal's `'linking'`
  body branch. Once Section 5 lands, Section 6 can be implemented
  independently.

---

## Section 6 — Frontend modal integration (Red, Green, Refactor)

### Objective

Update the `AssessTaskModal` to:

- extend the `noMatchResolution` union to include `'linking'`;
- add the `selectedDefinitionForLink` state slot;
- add the `hasLinkSucceeded` state slot (analogous to
  `hasCreateSucceeded`);
- add the `handleLinkExistingDefinition`, `handleLinkConfirm`,
  `handleLinkCancel` functions;
- extend `renderBody` to render the `LinkableDefinitionList` in the
  `'linking'` branch;
- extend `getFooterContent` to render the Link + Cancel footer in
  the `'linking'` + `'idle'` branch (mirrors the wizard footer);
- reset the new state on modal reopen, on Cancel from picker, and on
  assessment-state transitions;
- invalidate `queryKeys.assignmentDefinitionPartials()` after a
  successful upsert and on any upsert failure;
- handle `DEFINITION_STALE` recovery by transitioning to the wizard's
  2nd panel instead of showing an error Alert.

### Constraints

- The `noMatchResolution` union extension is the only state-machine
  change.
- The `assessmentState` machine is reused without changes (per
  `SPEC.md` Decision 11).
- The `flushSync` pattern is **not** used (per `SPEC.md` Decision
  11).
- The choice-prompt "Link to Existing Definition" button is enabled
  when at least one `LinkableDefinition` exists; otherwise it is
  disabled with a `Tooltip` whose title is "No assignment definitions
  exist for this class's year group." (layout spec, "Link button
  disabled with Tooltip"). There is **no** "all already linked" guard —
  every row is always selectable.
- The `alreadyLinkedSummary` concept is **not implemented** (removed
  per stakeholder decision). No `aria-live` region, no "Already linked"
  Tag, no disabled rows.
- The choice-prompt Alert copy is unchanged; the picker Alert copy
  is extended (per the layout spec) to "Link to an existing
  definition to associate the Google Classroom assignment with
  it.".
- The post-link flow (loading, success, error) mirrors the wizard
  flow exactly, **except** that the loading-state footer button label
  is **"Link"** (not "Start Assessment" — the user clicked "Link", not
  "Start Assessment", and the button label should match the action the
  user initiated; "Start Assessment" is the matched-path label and
  would be misleading here, per the layout spec).
- The `useEffect` reset hook is extended to reset the new state on
  modal open and on fetch error.
- The cache invalidation uses the existing
  `queryClient.invalidateQueries` API with the existing
  `queryKeys.assignmentDefinitionPartials()` key.
- The post-success reset of `noMatchResolution` to `'idle'` mirrors
  the wizard-success flow.
- The `selectedDefinitionForLink` slot is `null` when the modal is
  in any state other than `'linking'` + `'idle'`.
- The `hasLinkSucceeded` slot is `false` when the modal is in any
  state where the upsert has not yet completed.
- **`DEFINITION_STALE` recovery**: when `startAssessmentRun` rejects
  with `DEFINITION_STALE`, the link (the alternateTitle write) is
  preserved and the modal transitions to `noMatchResolution === 'creating'`
  (wizard 2nd panel, task weightings) with the document re-parsed and
  pre-populated from the stale definition's data. This applies to both
  the link flow and the existing wizard flow.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
  (target file)
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
  (existing test patterns, the
  `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
  helpers)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts`
  (the `upsertAssignmentDefinition` service)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
  (the `startAssessmentRun` service)
- `src/frontend/AGENTS.md` §2.2, §5.1, §10
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` (the layout spec)
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Implementation mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` (the layout spec; this
  section is its primary input)
- `src/frontend/AGENTS.md` §1, §2, §5.1, §10
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
  (from Section 5)
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
  (from Section 4)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts`
- `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
- `src/frontend/src/query/queryKeys.ts`

Code Reviewer mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md`
- `src/frontend/AGENTS.md` §2.2, §10
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
  (final state)
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
  (final state)
- `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
  (final state)

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. The new modal state slots and
handler functions are local to the modal file.

### Acceptance criteria

- The `noMatchResolution` union includes `'linking'`.
- The `selectedDefinitionForLink` state slot is added.
- The `hasLinkSucceeded` state slot is added.
- The `handleLinkExistingDefinition`, `handleLinkConfirm`,
  `handleLinkCancel` functions are added.
- `renderBody` renders the `LinkableDefinitionList` in the
  `'linking'` branch.
- `getFooterContent` renders the Link + Cancel footer in the
  `'linking'` + `'idle'` branch.
- The choice-prompt "Link to Existing Definition" button is enabled
  when at least one `LinkableDefinition` exists; otherwise disabled
  with the correct `Tooltip`. There is **no** "all already linked"
  guard.
- The modal calls `upsertAssignmentDefinition` with the ID-shape
  payload on Link confirm, then `startAssessmentRun` on upsert
  success.
- The modal invalidates
  `queryKeys.assignmentDefinitionPartials()` after the upsert
  resolves (success and failure paths).
- The modal resets all new state on modal reopen, on Cancel from
  picker, and on success close.
- The post-link flow (loading, success, error) mirrors the wizard
  flow exactly, with the button label "Link" (not "Start Assessment").
- `hasLinkSucceeded` is set to `true` after the upsert resolves
  successfully and reset to `false` on modal reopen, on Cancel, and
  when `noMatchResolution` leaves `'linking'`.
- **`DEFINITION_STALE` recovery**: on `startAssessmentRun` failure
  with `DEFINITION_STALE`, the modal transitions to
  `noMatchResolution === 'creating'` (wizard 2nd panel) with the
  link preserved.
- All existing modal tests pass without modification.
- New modal tests cover the link flow.
- **Focus management**: when the picker opens (`'linking'` + `'idle'`),
  focus moves to the `Radio.Group` (the first linkable row). When the
  picker closes via Cancel, focus returns to the "Link to Existing
  Definition" button in the choice prompt. When the modal closes entirely,
  focus returns to the "Assess Task" trigger button on the class card.
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

Modal Vitest component tests (added to the existing
`AssessTaskModal.spec.tsx`):

1. **Choice prompt: "Link to Existing Definition" button is enabled
   when at least one linkable definition exists** — `definitionPartials`
   includes one row matching the class's year group; the button is
   enabled.
2. **Choice prompt: "Link to Existing Definition" button is disabled
   with Tooltip when the picker would be empty** — no
   `linkableDefinitions` match the class's year group; the button
   is disabled with the correct Tooltip title.
3. **Choice prompt: clicking "Link to Existing Definition"
   transitions to `'linking'`** — the choice buttons are replaced
   by the `LinkableDefinitionList`.
4. **Picker: clicking Cancel returns to the choice prompt** — the
   choice buttons reappear.
5. **Picker: clicking a row and clicking Link calls
   `upsertAssignmentDefinition` and then `startAssessmentRun`** —
   the ID-shape payload is sent (verified by spying on the service).
6. **Picker: Link button is disabled when no row is selected** —
   no selection → disabled Link button.
7. **Picker: empty Google Classroom topic name sends `alternateTopics`
   unchanged (not `[]`)** — when `selectedAssignment.topicName === null`,
   the payload spy verifies:
   - `alternateTitles` is the **deduplicated union** (case-insensitive
     trimmed) of the existing `alternateTitles` and the new Google
     Classroom title;
   - `alternateTopics` is the **unchanged existing array** (not `[]`,
     not omitted).
8. **Post-link: success Alert replaces the body, Close button
   replaces the footer** — mirrors the wizard-success flow.
9. **Post-link: error Alert replaces the body, Cancel button
   closes the modal** — mirrors the wizard-error flow.
10. **Post-link: cache invalidation on upsert failure** — the
    `queryClient.invalidateQueries` spy is called on
    `queryKeys.assignmentDefinitionPartials()`.
11. **Post-link: `startAssessmentRun` failure after a successful
    upsert (non-DEFINITION_STALE error)** — the upsert resolves but
    `startAssessmentRun` rejects with a non-recoverable error; the
    error Alert is shown and the modal does not close
    (mirrors the wizard-error flow). `hasLinkSucceeded` is `true`.
12. **`DEFINITION_STALE` recovery: `startAssessmentRun` fails with
    `DEFINITION_STALE` after a successful upsert** — the link is
    preserved and the modal transitions to
    `noMatchResolution === 'creating'` (wizard 2nd panel — task
    weightings). `hasLinkSucceeded` is `true`.
13. **`hasLinkSucceeded` flag management** — verify `hasLinkSucceeded`
    is `false` on modal open, `true` after upsert resolves, and
    `false` again on modal reopen.
14. **State reset on modal reopen** — the new state slots (`linking`,
    `selectedDefinitionForLink`, `hasLinkSucceeded`) are reset to idle
    values on modal reopen.
15. **State reset on Cancel from picker** — `noMatchResolution`
    returns to `'choice'`, `selectedDefinitionForLink` returns to
    `null`, `hasLinkSucceeded` returns to `false`.
    `selectedAssignmentForChoice` is **retained** (so the choice prompt
    Alert still shows the Google Classroom assignment title; the user
    is back in the choice prompt ready to pick Create New Definition
    or close the modal).
16. **Focus management: picker open moves focus to first Radio row** —
    after transitioning to `'linking'`, the first linkable `Radio` in
    the picker receives focus.
17. **Focus management: Cancel from picker returns focus to the link
    button** — after Cancel returns to `'choice'`, the "Link to Existing
    Definition" button receives focus.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

Add a `@remarks` JSDoc tag on `handleLinkConfirm` documenting:

- The deduplication strategy for the new `alternateTitles` and
  `alternateTopics` (case-insensitive trimmed equality).
- The full-array send rule (never send `[]`; always send the full
  array, even when the topic name is null).
- The cache invalidation strategy (fire-and-forget after the
  upsert resolves).
- The `DEFINITION_STALE` recovery path (preserves link, transitions
  to wizard 2nd panel).

Add a `@remarks` JSDoc tag on the `hasLinkSucceeded` state slot
documenting:

- The slot is `true` only after the upsert resolves successfully
  and before `startAssessmentRun` completes.
- The slot is reset to `false` on modal reopen, on Cancel from
  picker, and on success close.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 7 (test
  utilities) extends the shared test fixtures to support the new
  state. Section 8 (Playwright e2e) exercises the full e2e flow.

---

## Section 7 — Frontend test utilities extension (Red, Green, Refactor)

### Objective

Extend
`src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
with the new fixtures and interaction helpers needed by the modal
spec.

### Constraints

- Add a `linkableDefinition` fixture factory (mirrors
  `createDefinitionPartial`).
- Add a `clickLinkToExisting` interaction helper (clicks the new
  "Link to Existing Definition" button in the choice prompt).
- Add a `clickLink` interaction helper (clicks the new "Link"
  button in the picker footer).
- Add a `pickLinkableDefinition` interaction helper (clicks a row
  in the picker).
- Extend `renderWithCache` options to include
  `linkableDefinitions: LinkableDefinition[]` for the
  picker-rendered branch.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/src/test/classes/AssessTaskModal.test-utilities.tsx`
  (target file)
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
  (existing usage patterns)
- `src/frontend/AGENTS.md` §7

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. The test utilities are
local to the modal test feature.

### Acceptance criteria

- The new fixture factory and interaction helpers exist and are
  exported.
- The existing `renderWithCache` and `createDefinitionPartial`
  continue to work without modification.
- The new helpers are used in the Section 6 modal tests (verified by
  Section 6's `npm test` run).
- Frontend lint passes: `npm run lint:frontend`.

### Required test cases (Red first)

The test utilities themselves are exercised through the Section 6
modal tests; no dedicated test file is required for the test
utilities. The Section 6 test cases cover the helpers' usage.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
  — all tests green.
- `npm run lint:frontend` — clean.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

None — test utilities do not need `@remarks`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 8 (Playwright
  e2e) does not depend on the test utilities; the e2e tests use the
  `RuntimeScenario` pattern from
  `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`.

---

## Section 8 — Playwright e2e tests (Red, Green, Refactor)

### Objective

Extend `src/frontend/e2e-tests/classes-page-assess-task.spec.ts` with
the picker flow cases.

### Constraints

- The `RuntimeScenario` type already includes `upsertAssignmentDefinition`
  and `getAssignmentDefinition`; no new method entries are required.
- The e2e tests use the existing
  `installRuntimeMock`, `getMethodCalls`, `releaseNextDeferredSuccess`,
  and `selectVisibleOption` helpers.
- The e2e tests follow the existing pattern: `createAssessTaskScenario`
  for the standard scenario, then customise with the new method
  entries.
- The new e2e tests are added after the existing tests; the existing
  tests are not modified.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/frontend/e2e-tests/classes-page-assess-task.spec.ts` (target
  file)
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`
  (scenario factory and helpers)
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
  (runtime mock type and helpers)
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md` (the layout spec)
- `docs/developer/frontend/frontend-playwright-e2e.md` (e2e
  patterns)

Implementation mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md`
- `src/frontend/e2e-tests/classes-page-assess-task.spec.ts`
- `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`
- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

Code Reviewer mandatory docs:

- `SPEC.md`
- `ASSESS_TASK_MODAL_LINK_PICKER_LAYOUT.md`
- `src/frontend/e2e-tests/classes-page-assess-task.spec.ts` (final
  state)

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. The e2e tests use the
existing `RuntimeScenario` and helpers.

### Acceptance criteria

- The new e2e tests cover the picker flow.
- Existing e2e tests pass without modification.
- The `RuntimeScenario` type is unchanged.
- Playwright lint passes.

### Required test cases (Red first)

Playwright e2e tests (added to
`classes-page-assess-task.spec.ts`):

1. **"Link to Existing Definition" button is enabled when a
   linkable definition exists** — the choice prompt shows the
   button enabled.
2. **"Link to Existing Definition" button is disabled when the
   picker would be empty** — the choice prompt shows the button
   disabled.
3. **Clicking the link button transitions to the picker** — the
   `LinkableDefinitionList` is rendered.
4. **Picker rows show the title and the subtitle** — the row
   content includes both the title and the `<topic> · <year>` subtitle.
5. **Picker rows are sorted by fuzzy title rank with `updatedAt`
   desc tie-breaker** — given three definitions with primaryTitles of
   "Poetry Analysis" (most recently changed), "Algebra HW" (older),
   and "Algebra Homework" (oldest), and a Google Classroom
   assignment titled "Algebra HW", the picker shows "Algebra HW"
   first, "Algebra Homework" second, "Poetry Analysis" last.
   This proves the fuzzy ranking (not the most-recent-first sort)
   drives the display order.
6. **Selecting a row and clicking Link calls
   `upsertAssignmentDefinition` and then `startAssessmentRun`** —
   the method call list contains both.
7. **Loading state during link: spinner visible, Link button
   disabled** — use `deferredSuccess` entries for
   `upsertAssignmentDefinition` (or `startAssessmentRun`) to hold
   the call open. After clicking Link, assert the body shows a
   spinner (`[role="status"]`) and the Link button is disabled.
   Release the deferred and assert the spinner disappears and the
   success Alert appears. This covers the user-visible loading
   transition described in SPEC §"Post-link loading".
8. **Link success flow: success Alert and Close button** — the full
   happy path (select row → Link → upsert resolves →
   `startAssessmentRun` resolves) ends with a success Alert in the
   body and a Close button in the footer. Verify both are visible
   and that `getMethodCalls` contains `startAssessmentRun`.
9. **Upsert failure shows an error Alert and the Cancel button
   closes the modal** — the error path is exercised.
10. **Cancel from picker returns to the choice prompt** — the
    choice buttons reappear.
11. **`DEFINITION_STALE` after link: wizard opens at task-weightings
    panel (panel 2), not the title/topic panel (panel 1)** —
    `startAssessmentRun` rejects with `DEFINITION_STALE` after a
    successful upsert. Assert the wizard dialog is visible and
    contains the task-weightings UI (e.g. the weighting inputs or
    the "Save" button) rather than the title/topic inputs
    (`getByRole('textbox', { name: /assignment title/i })` must
    have count 0). This proves the wizard skipped to panel 2 per
    SPEC Decision 10.
12. **Modal state resets on reopen** — the new state slots are
    reset to idle values on modal reopen.

### Section checks

- `npm run frontend:test:e2e -- classes-page-assess-task` (local
  only; not run in CI by default per the e2e docs).
- Playwright lint passes.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

None — e2e tests do not need `@remarks`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 9
  (Documentation) and Section 10 (Regression) are independent.

---

## Section 9 — Documentation and rollout notes (Green)

### Objective

Update relevant documentation to reflect the new feature and
reconcile planned-only entries in canonical docs.

### Constraints

- Use British English.
- Only modify documents relevant to the touched areas.

### Acceptance criteria

- `SPEC.md` status updated to `Implemented v1.0` with a one-line
  note including the implementation date.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  is extended with entries for `getLinkableDefinitionsForModal` and
  `LinkableDefinitionList`. A new entry for `caseInsensitiveTrimmedEquals`
  is added as a feature-local private helper.
- `docs/developer/backend/DATA_SHAPES.md` is updated per `SPEC.md`:
  - The `AssignmentDefinitionPartial` response shape section's
    `alternateTopics` entry is updated to reflect that the field
    is now a documented optional field in the upsert request
    contract and is written by the orchestrator on update when
    provided.
  - The `upsertAssignmentDefinition` request shape section is
    extended to document the new optional `alternateTopics` field
    alongside the existing optional `alternateTitles` field.
  - The transport validation entry for the ID-shape path is
    updated to document the new `superRefine` mutual-exclusion
    rule (URL-shape vs ID-shape).
- `docs/developer/backend/api-layer.md` is updated per `SPEC.md`:
  - The "Optional request fields" entry for `upsertAssignmentDefinition`
    is updated to include `alternateTopics`.
  - The "Validation split" paragraph is updated to document the
    mutual-exclusion rule between URL-shape and ID-shape.
- No new canonical doc file is required.
- No new tests or code changes.

### Required checks

1. Verify the `SPEC.md` status is updated correctly.
2. Verify the `frontend-shared-helpers-and-abstraction-standards.md`
   entries are updated.
3. Verify the `DATA_SHAPES.md` updates are correct and in scope.
4. Verify the `api-layer.md` updates are correct and in scope.
5. Confirm no documentation regressions in canonical docs.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled)
- **Deviations from plan:** (to be filled if any)

---

## Section 10 — Regression and contract hardening

### Objective

Verify that the new feature does not break existing functionality and
that the transport contract is sound.

### Constraints

- Run all touched backend and frontend test suites.
- Run backend and frontend lint.
- Confirm the orchestrator's behaviour change (typed-error throw
  mirrored for `alternateTopics`) does not regress any existing
  controller tests.

### Acceptance criteria

- All existing backend API tests pass.
- All existing frontend modal tests pass.
- All new tests pass.
- Backend lint passes.
- Frontend lint passes.
- No regressions in `upsertAssignmentDefinition_` or any other
  handler in `assignmentDefinitionTransport.js`.
- No regressions in `AssignmentDefinitionUpsertOrchestrator` tests
  that exercise the upsert path.

### Required test cases/checks

1. `npm test -- tests/controllers/assignmentDefinitionController.upsert.test.js`
   — green.
2. `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js` —
   green.
3. `npm test -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
   — green.
4. `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
   — green.
5. `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
   — green.
6. `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.spec.tsx`
   — green.
7. `npm run frontend:test -- src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.spec.tsx`
   — green.
8. `npm run frontend:test -- src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.spec.ts`
   — green.
9. `npm run lint:backend` — clean.
10. `npm run lint:frontend` — clean.

### Section checks

- Run the commands listed above and ensure green results.
- Verify mandatory-read evidence is complete for every delegated
  regression handoff.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled)
- **Deviations from plan:** (to be filled if any)

---

## Suggested implementation order

1. **Pre-Section 4 Step** — Install `fuse.js` dependency in
   `src/frontend/package.json`.
2. **Section 1** — Backend orchestrator `_resolveAlternateTopics`
   (enables the write path; backend-only change; lowest coupling).
3. **Section 2** — Frontend matcher relaxation (enables the
   "future match" guarantee; pure helper; no React state).
4. **Section 3** — Frontend Zod schema extension (enables the
   ID-shape payload; pure schema change; no React state).
5. **Section 4** — Frontend `getLinkableDefinitionsForModal` pure
   helper (enables the picker derivation; depends on Section 2's
   helper; `fuse.js` already installed).
6. **Section 5** — Frontend `LinkableDefinitionList` presentational
   component (enables the picker UI; depends on the layout spec;
   no state).
7. **Section 6** — Frontend modal integration (depends on Sections
   3, 4, and 5; orchestrates the new state and side effects).
8. **Section 7** — Frontend test utilities extension (depends on
   Section 6's tests; small fixture addition).
9. **Section 8** — Playwright e2e tests (depends on Section 6;
   exercises the full e2e flow).
10. **Section 9** — Documentation (independent; can be done at any
    point after the implementation lands; reconcile planned-only
    entries to `Implemented`).
11. **Section 10** — Regression and contract hardening (independent;
    run after Sections 1-8 land).
