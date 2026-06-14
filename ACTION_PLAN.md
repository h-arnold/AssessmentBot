# Assess Task Modal — No-Match Definition Resolution Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `src/frontend/AGENTS.md` for frontend conventions.
3. Read `docs/developer/frontend/frontend-modal-patterns.md` for modal composition rules.
4. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` for helper extraction policy and the canonical location for recording helper decisions.
5. Treat `SPEC.md` as the source of truth for product behaviour, contracts, and state-machine rules.
6. No layout spec exists — the choice prompt is simple inline content in the existing modal body, and the wizard is reused with no visual changes. Rendering rules live in `SPEC.md` §Main user-facing surface specification.
7. Record the Section 3 keep-local helper decision in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented` before implementation starts.

## Scope and assumptions

### Scope

- Extend `AssignmentDefinitionWizardModal` and `useAssignmentDefinitionWizard` with `initialValues` and `onCreateSuccess` props
- Add `noMatchResolution` state machine to `AssessTaskModal` and reconcile it with the existing `assessmentState` machine
- Implement the no-match choice prompt (Alert + two buttons) in the Assess Task modal
- Implement pre-population of wizard fields from Google Classroom assignment and ABClass data
- Implement automatic assessment after successful definition creation
- Wire the wizard's `selectedTopicKey`/`selectedYearGroupKey` synchronisation with `initialValues`

### Out of scope

- The "link to existing definition" workflow (placeholder button only)
- Any backend changes
- Any changes to `matchDefinitionForAssignment.ts`
- Any topic auto-creation logic

### Assumptions

1. The wizard's `initialValues` will be applied in create mode only and are optional — when absent, existing behaviour is preserved.
2. `onCreateSuccess` replaces the normal `onClose` for the save path in create mode — the caller is responsible for unmounting the wizard by transitioning its own state.
3. The `assignmentTopics` cache is populated by the startup warmup flow — a cache miss simply means the topic field is left blank.
4. The wizard's `SelectWithAddNew` component reads from `selectedTopicKey`/`selectedYearGroupKey` state, not from the form — both must be set when applying initial values.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>` (paths relative to `src/frontend/`)

---

## Section 1 — Extend AssignmentDefinitionWizardModal contract

### Objective

Add `initialValues` and `onCreateSuccess` props to the `AssignmentDefinitionWizardModal` and `useAssignmentDefinitionWizard` hook. Apply initial form values in create mode and call `onCreateSuccess` on successful save instead of `onClose`.

### Constraints

- Must not break existing create/update behaviour when the new props are not provided
- `initialValues` are optional and only applied in create mode
- `selectedTopicKey` and `selectedYearGroupKey` must be synchronised with `initialValues`
- Apply initial values in `useAssignmentDefinitionWizard` after `useFormInitialization` runs, setting `selectedTopicKey`/`selectedYearGroupKey` state directly from `initialValues.topic`/`initialValues.yearGroup`, converting empty strings to `undefined`. This is the chosen approach; `FormInitializationOptions` does not need new callbacks.
- `onCreateSuccess` called after successful final save in create mode, replacing the normal `onClose()` call
- In `handlePostMutation` (inside `runWizardMutation`), save actions in create mode must call `onCreateSuccess(definitionKey)` instead of `onClose()` when `onCreateSuccess` is provided
- The key passed to the callback is the non-null `definitionKey` from the save response, falling back to the request's `effectiveKey` (`localDefinitionKey ?? definitionKey`) only if the response omits it
- Thread `onCreateSuccess` through the options object passed to `runWizardMutation` (add it as an optional property), then pass it to `handlePostMutation`. This is cleaner than adding a new parameter to `runWizardMutation`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan (when helper changes are expected)

No new shared helpers. All changes are local to the wizard feature.

### Acceptance criteria

1. `AssignmentDefinitionWizardModalProperties` includes optional `initialValues` and `onCreateSuccess`
2. In create mode with `initialValues`, form fields are pre-populated for the provided keys (title, topic, yearGroup) and blank for unprovided keys
3. `selectedTopicKey` and `selectedYearGroupKey` state is set to match `initialValues.topic` and `initialValues.yearGroup` respectively
4. In create mode without `initialValues`, behaviour is unchanged (form starts empty)
5. In update mode, `initialValues` is ignored (existing definition hydration takes precedence)
6. On successful final save in create mode with `onCreateSuccess` provided: `onCreateSuccess(definitionKey)` is called with the non-null key from the save response (falling back to the request's `effectiveKey` only if the response omits it), and `onClose()` is NOT called
7. On successful final save in create mode without `onCreateSuccess`: existing `onClose()` behaviour is preserved
8. On save failure: `onCreateSuccess` is NOT called; the existing `blockingError` flow runs
9. The implementation guards against invoking `onCreateSuccess` with a null or undefined key
10. Props flow through `AssignmentDefinitionWizardModal` → `useAssignmentDefinitionWizard` → `useFormInitialization` and `runWizardMutation`

### Required test cases (Red first)

Frontend tests (AssignmentDefinitionWizardModal.spec.tsx — integration):

1. `initialValues` are applied in create mode: title, topic, yearGroup appear in form fields
2. `initialValues` with partial fields: only provided fields are pre-populated
3. `initialValues` absent: form starts empty in create mode (existing behaviour)
4. `initialValues` absent: update mode still hydrates from definition (existing behaviour)
5. `onCreateSuccess` is called on save in create mode with the correct definition key
6. `onCreateSuccess` is NOT called when save fails
7. `onClose` is NOT called when `onCreateSuccess` is provided and save succeeds
8. `onClose` IS called when `onCreateSuccess` is not provided and save succeeds (existing behaviour)

Frontend tests (useAssignmentDefinitionWizard.spec.ts — hook):

1. Initial values set `selectedTopicKey` and `selectedYearGroupKey` state
2. `definitionKey` passed to `onCreateSuccess` matches the save response key (falling back to the request's `effectiveKey` only if the response omits it)
3. `onCreateSuccess` is NOT called when save fails with both `initialValues` and `onCreateSuccess` provided

### Pre-test cleanup

- Remove or replace the stale "Section 7 - Red Loop" placeholder test in `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts` before adding the new acceptance-criteria tests.

### Section checks

- `npm run test:frontend -- src/features/classes/AssessTaskModal/`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- **Pre-implementation gate:** Verify that `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` contains the topic-existence check keep-local entry with status `Not implemented` before any Section 3 code changes begin.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `useAssignmentDefinitionWizard` return type documenting the `initialValues` application semantics: applied in create mode only, ignored in update mode, `selectedTopicKey`/`selectedYearGroupKey` synchronised.
- Add `@remarks` to `AssignmentDefinitionWizardModalProperties` documenting `onCreateSuccess`: replaces `onClose` for the save path in create mode; the caller is responsible for unmounting.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  1. Extended `AssignmentDefinitionWizardModalProperties` with optional `initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>` and `onCreateSuccess?: (definitionKey: string) => void`
  2. Added `applyFormInitialValues` pure helper function that sets form fields via `form.setFieldsValue()` and synchronises `selectedTopicKey`/`selectedYearGroupKey` state, converting empty strings to `undefined`
  3. Added `useEffect` in `useAssignmentDefinitionWizard` gated to create mode with `initialValues` present, running after `useFormInitialization`
  4. Modified `handlePostMutation` to accept optional `onCreateSuccess` and `effectiveKey` params; on save with `onCreateSuccess` provided, calls `onCreateSuccess(key)` (with null guard) instead of `onClose()`
  5. Threaded `onCreateSuccess` through `runWizardMutation` options, passed by `handleSave`
  6. Updated `AssignmentDefinitionWizardModal` to destructure and pass both new props to hook
  7. Added `@remarks` JSDoc on `AssignmentDefinitionWizardModalProperties` and `UseAssignmentDefinitionWizardReturn`
  8. Test helpers (`wizardModalTestHelpers.tsx`): extended `RenderWizardModalOptions` with `initialValues` and `onCreateSuccess`
  9. Added 8 new modal integration tests and 3 hook tests (11 total; all pass)
- **Deviations from plan:** None. All implementation follows the plan exactly.
- **Follow-up implications for later sections:** The extended wizard contract (`initialValues`, `onCreateSuccess`) is now available for Section 3 (AssessTaskModal wizard integration).

---

## Section 2 — Add noMatchResolution state machine to AssessTaskModal

### Objective

Introduce the `noMatchResolution` state (`'idle' | 'choice' | 'creating'`) into `AssessTaskModal`, reconcile it with the existing `assessmentState` machine per the SPEC.md reconciliation table, and implement the choice prompt UI.

### Constraints

- Must not break any existing test cases except the no-match error-alert test (`'shows error Alert when findMatchingDefinition returns no-match'` in AssessTaskModal.spec.tsx), which is deliberately replaced by the new choice-state tests in this section. All other existing test paths (cache-miss, null-topic, null-yearGroup, ambiguous, matched-success, matched-failure, fetching, empty, cancel, reopen) must pass unchanged.
- The no-match path (`kind: 'no-match'` in `handleMatchOutcome`) sets `noMatchResolution = 'choice'` instead of `assessmentState = 'error'`
- All other error paths (cache miss, API failure, null topic, null yearGroup, ambiguous) continue to set `assessmentState = 'error'` as before
- During `choice` state, the body shows the choice prompt; the assignment Select is hidden
- During `choice` state, the footer shows only Cancel
- The "Link to Existing" button is disabled and wrapped in an Ant Design `Tooltip` with `title="Coming soon"`
- The wizard is rendered only when `noMatchResolution === 'creating' && assessmentState === 'idle'`

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. All changes are local to the AssessTaskModal state machine. The topic existence check used for pre-population is handled in Section 3.

### Acceptance criteria

1. `noMatchResolution` state exists on the component with initial value `'idle'`
2. When `findMatchingDefinition` returns `'no-match'`, `noMatchResolution` is set to `'choice'` and `assessmentState` is reset from `'loading'` to `'idle'` (not set to `'error'`)
3. During `noMatchResolution === 'choice'`:
   - Body renders an info Alert: "No matching assignment definition found for '{title}'."
   - Body renders two buttons: "Create New Definition" (primary) and "Link to Existing Definition" (disabled, with Tooltip "Coming soon")
   - Footer shows only Cancel button
   - Assignment Select is not visible
4. "Create New Definition" click sets `noMatchResolution = 'creating'`
5. Existing error paths unchanged: cache miss → `assessmentState = 'error'`
6. Existing error paths unchanged: null topic → `assessmentState = 'error'`
7. Existing error paths unchanged: null yearGroup → `assessmentState = 'error'`
8. Existing error paths unchanged: ambiguous → `assessmentState = 'error'`
9. Modal reopen resets `noMatchResolution` to `'idle'`
10. Modal reopen resets `assessmentState` to `'idle'`
11. `handleMatchOutcome` no-match branch calls `setNoMatchResolution('choice')` not `setAssessmentAsError`

### Required test cases (Red first)

Frontend tests (AssessTaskModal.spec.tsx):

1. No-match → choice state: Alert visible, "Create New Definition" button visible, "Link to Existing" disabled
2. Choice state: Cancel button in footer, no assignment Select visible
3. "Create New Definition" click → `noMatchResolution` transitions to `'creating'`
4. Cache miss → still shows `assessmentState = 'error'` (unchanged)
5. Null topic → still shows `assessmentState = 'error'` (unchanged)
6. Null yearGroup → still shows `assessmentState = 'error'` (unchanged)
7. Ambiguous → still shows `assessmentState = 'error'` (unchanged)
8. Reopen modal resets `noMatchResolution` to `'idle'`
9. Reopen modal resets `assessmentState` to `'idle'` (clears stale success/error from previous open)
10. "Link to Existing" button is disabled with Tooltip "Coming soon"

### Section checks

- `npm run test:frontend -- src/features/classes/AssessTaskModal/`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Update `@remarks` on `AssessTaskModal` to document the orthogonal `assessmentState` × `noMatchResolution` state machine, replacing the current single-axis description.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  1. Added `noMatchResolution` state (`'idle' | 'choice' | 'creating'`, initial `'idle'`) alongside `assessmentState`
  2. Added `selectedAssignmentForChoice` state to preserve assignment for choice prompt Alert
  3. Modified `handleMatchOutcome`: no-match branch sets `noMatchResolution('choice')` + resets `assessmentState` to `'idle'` instead of calling `setAssessmentAsError`
  4. Added `handleCreateNewDefinition` handler → `noMatchResolution = 'creating'`
  5. Modified `renderBody()`: renders choice prompt (info Alert + two buttons) during `choice`; returns null during `creating` (body hidden)
  6. Extracted `getFooterContent()` with reconciliation table logic: Cancel-only during choice/creating; Cancel + disabled Start Assessment during creating+loading; normal buttons otherwise
  7. Added `Tooltip` wrapping pattern for disabled "Link to Existing Definition" button with `<span>` wrapper per SPEC.md
  8. Added reset of both state machines (`noMatchResolution`, `assessmentState`, `selectedAssignmentId`, `assessmentError`) on modal open
  9. Updated `@remarks` JSDoc to document orthogonal `assessmentState × noMatchResolution` state machine
  10. Replaced old no-match error-alert test with 7 new choice-state tests
- **Deviations from plan:** State resets were placed inside `.then()`/`.catch()` callbacks (rather than synchronously in the effect body) to satisfy React 19 `react-hooks/set-state-in-effect` lint rule. This has no observable behavioural difference.
- **Follow-up implications for later sections:** Section 3 wires the `AssignmentDefinitionWizardModal` into the `creating` state slot (currently returns `null` body).

---

## Section 3 — Wire wizard integration, pre-population, and auto-assessment

### Objective

Wire the `AssignmentDefinitionWizardModal` into the AssessTaskModal's `creating` state with pre-populated initial values. Implement the auto-assessment flow after successful definition creation.

### Constraints

- The wizard must only render when `noMatchResolution === 'creating' && assessmentState === 'idle'`
- Initial values are derived from: `selectedAssignment.title`, cached `assignmentTopics`, and `classPartial.yearGroupKey`
- Topic pre-population: look up `selectedAssignment.topicId` in `assignmentTopics` cache; if found, set topic; if not, leave blank
- `assignmentTopics` is read from `queryClient.getQueryData(queryKeys.assignmentTopics())`
- The selected assignment and class ID must be preserved for the auto-assessment API call
- During auto-assessment (`assessmentState = 'loading'` while `noMatchResolution = 'creating'`), the body remains hidden
- After auto-assessment completes, `noMatchResolution` is reset to `'idle'`
- When the wizard is cancelled (closes without `onCreateSuccess`), `noMatchResolution` returns to `'choice'`
- When the AssessTaskModal footer Cancel is clicked during `'creating'`, the entire modal closes
- The `assignmentTopics` import is added to the AssessTaskModal's existing imports

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

### Shared helper plan (when helper changes are expected)

1. Helper: topic existence check (`topics.some(t => t.key === selectedAssignment.topicId)`)
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
   - Call-site rationale: single-caller, one-liner lookup; no existing helper matches this contract
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented` (must be recorded in the canonical doc before implementation starts; updated to `Implemented` in the documentation pass)

### Acceptance criteria

1. During `noMatchResolution === 'creating' && assessmentState === 'idle'`, the wizard is rendered with:
   - `mode="create"`
   - `initialValues` containing title, topic (if found), and yearGroup
   - `onCreateSuccess` callback wired
   - `definitionKey={null}` (create mode)
   - `open={true}`
2. Topic pre-population: when `selectedAssignment.topicId` matches an `AssignmentTopic.key` in the cache, the topic field is pre-populated
3. Topic pre-population: when `selectedAssignment.topicId` is null or no match found, topic field is blank
4. Year group pre-population: `classPartial.yearGroupKey` is always pre-populated (guaranteed non-null upstream)
5. Title pre-population: `selectedAssignment.title` is always pre-populated
6. On `onCreateSuccess(definitionKey)`: `startAssessmentRun` is called with the received non-null key
7. During auto-assessment API call: `noMatchResolution` stays `'creating'`, `assessmentState` becomes `'loading'`, the wizard is **unmounted** (not rendered), body stays hidden, footer shows Cancel + disabled Start Assessment
8. On auto-assessment success: `noMatchResolution = 'idle'`, `assessmentState = 'success'`
9. On auto-assessment API failure: `noMatchResolution = 'idle'`, `assessmentState = 'error'`
10. When the wizard's `onClose` fires without `onCreateSuccess` having fired: `noMatchResolution` returns to `'choice'`
11. When Cancel is clicked in the AssessTaskModal footer during `'creating'`: `onClose()` is called, closing everything (unsaved wizard edits are silently lost — this is the intentional escape hatch behaviour)
12. The `body` render function hides the assignment content during `noMatchResolution !== 'idle'`

### Required test cases (Red first)

Frontend tests (AssessTaskModal.spec.tsx):

1. Creating state: wizard is rendered with `mode="create"` and correct `initialValues` (title, topic found, yearGroup)
2. Creating state: topic field empty when `topicId` not in cache
3. Creating state: topic field empty when `topicId` is null
4. `onCreateSuccess` → `startAssessmentRun` called → success state shown
5. `onCreateSuccess` → `startAssessmentRun` fails → error state shown
6. Wizard cancel → returns to choice state (Alert + buttons visible again)
7. AssessTaskModal Cancel during creating → `onClose` called
8. Auto-assessment loading: after `onCreateSuccess` fires and before `startAssessmentRun` resolves, the wizard is NOT rendered, the assignment Select is NOT visible, footer shows Cancel + disabled Start Assessment; then after resolution, final success/error state is shown

### Section checks

- `npm run test:frontend -- src/features/classes/AssessTaskModal/`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Document in `AssessTaskModal` `@remarks` that the `creating` state persists during auto-assessment to keep the body hidden, preventing a flash of the assignment Select.

### Accessibility/focus follow-through

- Verify that focus moves to the wizard modal when it opens and returns to the choice prompt (or success/error Alert) when the wizard closes. Automated coverage is limited per `SPEC.md`; rely on Ant Design's default focus behaviour and manual verification.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** none — this is the final feature section.

---

## Section 4 — E2E integration tests

### Objective

Add Playwright E2E tests covering the cross-component integration of the no-match resolution workflow: choice-prompt rendering, wizard pre-population, modal-stacking behaviour, and the full auto-assessment journey.

### Constraints

- Tests must use the existing E2E mock infrastructure (`endToEndRuntimeMocks.ts`, `classes-page-end-to-end-helpers.ts`)
- `startAssessmentRun` must be added to the `RuntimeScenario` type and the `createAssessTaskScenario()` factory
- All void-method responses (including `startAssessmentRun`) must use `{ kind: 'success', data: null }`; never omit `data` or use `data: undefined`
- All custom response queues for `useEffect`-triggered backend methods must provide **two entries per expected real call** to account for React 19 StrictMode double-effect firing in development builds. This includes not only `startAssessmentRun` and `upsertAssignmentDefinition`, but also any overridden reference-data queues such as `getAssignmentTopics` and `getYearGroups` used by Tests 3 and 5.
- The `AssessTaskModal` and `ClassesPage` unit tests remain the primary regression safety net — E2E tests cover the multi-modal integration that unit tests cannot reach
- All E2E tests must pass `npm run test:frontend:e2e` before this section is considered complete

### Delegation mandatory reads (when sub-agents are used)

Playwright mandatory docs:

- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-playwright-e2e.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

### Shared helper plan (when helper changes are expected)

No new shared helpers. E2E tests reuse the existing mock infrastructure.

### Infrastructure change required

1. **`RuntimeScenario` type and `allMethods` array** (`src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`):
   - **Line 50–62 (`RuntimeScenario` type):** Add `startAssessmentRun?: ReadonlyArray<ResponseItem>`.
   - **Line ~485 (`allMethods` array inside `installRuntimeMock`):** Add `'startAssessmentRun'` to the `const allMethods = [...]` array. This array gates which backend methods the browser-side mock accepts — without it, every `startAssessmentRun` call triggers `"Unexpected call to method: startAssessmentRun"` and fails.
   - **Note:** These are two separate edits in the same file.

2. **`CreateAssessTaskScenarioOptions` type and `createAssessTaskScenario()`** (`src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` interface at lines 111–115, factory at lines 181–189): Introduce a dedicated `CreateAssessTaskScenarioOptions` type that extends `CreateClassesScenarioOptions` with optional `startAssessmentRun?: ReadonlyArray<ResponseItem>` and `upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>` fields. Update `createAssessTaskScenario()` to:
   - Destructure `startAssessmentRun` and `upsertAssignmentDefinition` from its options.
   - Spread the remaining options into `createClassesScenario()`.
   - Explicitly merge the two new fields onto the returned `RuntimeScenario` object, e.g.:
     ```ts
     const { startAssessmentRun, upsertAssignmentDefinition, ...classesOptions } = options;
     const scenario = createClassesScenario({
       ...classesOptions,
       getGoogleClassroomAssignments:
         options.getGoogleClassroomAssignments ?? MOCK_COURSEWORK_ASSIGNMENTS,
     });
     return {
       ...scenario,
       ...(startAssessmentRun !== undefined && { startAssessmentRun }),
       ...(upsertAssignmentDefinition !== undefined && { upsertAssignmentDefinition }),
     };
     ```
   - This ensures the new fields are not silently dropped when `createClassesScenario()` destructures only its own options.

### Test data patterns

- **Wizard mock data:** Tests 3 and 5 need `getAssignmentTopics` with actual topic data (not the default empty array) so the topic pre-population assertion works. These tests should construct a `RuntimeScenario` by spreading `createAssessTaskScenario()` and overriding `getAssignmentTopics` and `upsertAssignmentDefinition` with appropriate mock responses. The `createAssessTaskScenario()` factory does not need to expose `getAssignmentTopics` directly — callers can spread-override the returned scenario object.

### Acceptance criteria

1. `startAssessmentRun` is in the `RuntimeScenario` type and the `allMethods` array, producing correctly queued mock responses
2. A dedicated `CreateAssessTaskScenarioOptions` type exists; `createAssessTaskScenario()` accepts `startAssessmentRun` and `upsertAssignmentDefinition` through that type
3. Six E2E test cases pass (see below)
4. All existing E2E tests (`classes-page-assess-task.spec.ts`, `classes-page.spec.ts`) continue to pass

### Required test cases

E2E tests added to `src/frontend/e2e-tests/classes-page-assess-task.spec.ts`:

1. **No-match → choice prompt renders correctly**
   - Mock a single assignment whose title/topic/yearGroup has no matching definition partial
   - Open the AssessTaskModal, select the assignment, click Start Assessment
   - Assert: the body contains an info/warning Alert with text about no matching definition
   - Assert: a "Create New Definition" button is visible and enabled
   - Assert: a "Link to Existing Definition" button is visible and disabled
   - Assert: the disabled button has a tooltip with text "Coming soon"
   - Assert: the footer shows only Cancel (no Start Assessment button)

2. **Choice prompt → Cancel closes the modal**
   - From the choice-prompt state, click Cancel
   - Assert: the AssessTaskModal dialog is no longer visible

3. **"Create New Definition" → wizard opens in create mode with pre-populated fields**
   - Click "Create New Definition"
   - Assert: the AssignmentDefinitionWizardModal appears (title "Create assignment")
   - Assert: the title input contains the GC assignment's title
   - Assert: the year-group dropdown shows the class's year group selected

4. **Wizard cancel/discard → returns to choice prompt**
   - Click "Create New Definition", then cancel the wizard (click Cancel → confirm discard in the wizard's discard-confirm dialog)
   - Assert: the wizard modal closes
   - Assert: the AssessTaskModal body returns to the choice prompt (Alert + buttons visible)

5. **Full wizard flow → auto-assessment success**
   - Precondition: mock `upsertAssignmentDefinition` with a success response and `startAssessmentRun` with a success response
   - Click "Create New Definition", fill in document URLs, click "Parse and continue", wait for parse, click "Save"
   - Assert: the wizard closes
   - Assert: `startAssessmentRun` was called (verify via `getMethodCalls(page)`)
   - Assert: the AssessTaskModal shows a success Alert ("Assessment started for...")
   - Assert: the footer shows only a Close button

6. **AssessTaskModal outer Cancel during wizard → both modals close**
   - Click "Create New Definition" to open the wizard
   - Click the AssessTaskModal's footer Cancel button (the outer modal's Cancel, not the wizard's)
   - Assert: both modals close and the ClassesPage returns to its normal interactive state

### Section checks

- Create the new test file `src/frontend/e2e-tests/classes-page-assess-task.spec.ts` (it does not exist yet).
- `npm run test:frontend:e2e -- src/frontend/e2e-tests/classes-page-assess-task.spec.ts`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None — E2E tests are self-documenting.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** Regression must include the E2E suite.

---

## Regression and contract hardening

### Objective

Verify that all existing tests pass and that the new feature does not regress any existing behaviour in the Assess Task modal, wizard, or Classes page.

### Constraints

- Prefer focused test runs before broader validation.
- Existing `matchDefinitionForAssignment.spec.ts` must pass unchanged.
- Existing `AssignmentDefinitionWizardModal.spec.tsx` must pass unchanged when new props are omitted.
- Existing `AssessTaskModal.spec.tsx` must pass unchanged (no behavioural regressions on existing test cases).

### Acceptance criteria

1. All existing AssessTaskModal tests pass
2. All existing wizard tests pass
3. All existing `matchDefinitionForAssignment` tests pass
4. All existing `ClassesPage` tests pass
5. All existing AssessTaskModal E2E tests pass
6. Frontend lint passes

### Required test cases/checks

1. Run `npm run test:frontend -- src/features/classes/AssessTaskModal/`
2. Run `npm run test:frontend -- src/features/assignmentWizard/`
3. Run `npm run test:frontend -- src/pages/ClassesPage`
4. Run `npm run lint:frontend`
5. Run `npm run test:frontend:e2e -- src/frontend/e2e-tests/classes-page-assess-task.spec.ts`
6. Run `npm run test:frontend:e2e -- src/frontend/e2e-tests/classes-page.spec.ts`

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

Update docs to match the implemented feature and record shared-helper decisions.

### Constraints

- Only modify documents relevant to the touched areas.
- Record the topic existence check as a keep-local decision in the shared helpers doc.

### Acceptance criteria

1. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` updated with keep-local decision for the topic existence check, with status `Not implemented` recorded before implementation starts and updated to `Implemented` during this pass
2. `@remarks` JSDoc on `AssessTaskModal`, `useAssignmentDefinitionWizard`, and `AssignmentDefinitionWizardModalProperties` updated
3. Notes/deviations fields in each section above are filled during implementation

### Required checks

1. Verify shared-helpers doc has the topic-check keep-local entry
2. Verify `@remarks` JSDoc matches implementation
3. Confirm all section notes/deviations fields are populated

### Optional `@remarks` JSDoc review

- Confirm that `AssessTaskModal` `@remarks` describes the orthogonal `assessmentState` × `noMatchResolution` machine (merge Section 2 and Section 3 `@remarks` entries into one coherent block)
- Confirm that `useAssignmentDefinitionWizard` `@remarks` describes `initialValues` application semantics
- Confirm that `AssignmentDefinitionWizardModalProperties` `@remarks` describes `onCreateSuccess` contract

### Implementation notes / deviations / follow-up

- Record any deviations discovered during documentation pass.

---

## Suggested implementation order

0. **Prerequisites (before any implementation starts):**
   - Record the Section 3 topic-existence keep-local decision in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`. This entry must be created in Section 9 of that document before any code changes begin.
   - Remove or replace the stale "Section 7 - Red Loop" placeholder test in `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.spec.ts`.
1. **Section 1** — Wizard contract extension (enabling infrastructure, no AssessTaskModal changes)
2. **Section 2** — AssessTaskModal no-match state machine (choice prompt, state transitions)
3. **Section 3** — Wizard integration, pre-population, and auto-assessment (composes Sections 1 + 2)
4. **Section 4** — E2E integration tests (cross-modal user journeys)
5. **Regression and contract hardening** — verify no regressions across unit and E2E suites
6. **Documentation and rollout notes** — finalise docs and JSDoc
