# Assess Task Modal — No-Match Definition Resolution Specification

## Status

- Draft v1.3 — revised after Planner Reviewer second pass

## Purpose

This document defines the intended behaviour for the unhappy path in the Assess Task modal: when a user selects a Google Classroom assignment that has no matching `AssignmentDefinition`, the modal must offer a resolution workflow instead of a dead-end error.

The feature will be used to:

- allow a user to create a new `AssignmentDefinition` directly from the Assess Task modal when no match exists, with title, topic, and year group pre-populated from the Google Classroom assignment and ABClass data
- provide a placeholder for a future "link to existing definition" workflow

This feature is **not** intended to:

- implement the "link to existing definition" workflow (that is explicitly deferred)
- change the matching logic itself (`findMatchingDefinition`)
- change the `startAssessmentRun` API or backend behaviour
- handle the case where `classPartial.yearGroupKey` is `null` (this remains a hard blocking error)

## Agreed product decisions

1. When `findMatchingDefinition` returns `kind: 'no-match'`, the modal must present a choice between "Create New Definition" and "Link to Existing Definition" instead of showing a dead-end error.
2. "Create New Definition" opens the existing `AssignmentDefinitionWizardModal` in create mode with the following fields pre-populated from data already gathered:
   - **title**: `selectedAssignment.title`
   - **topic**: `selectedAssignment.topicId`, but only when an `AssignmentTopic` with that key exists in the reference data cache; otherwise left blank (the user must select a topic in the wizard before saving — this is a normal workflow, not an error)
   - **yearGroup**: `classPartial.yearGroupKey`
3. After the user successfully creates the definition via the wizard, the assessment must run automatically using the newly created definition.
4. "Link to Existing Definition" is rendered as a visible but disabled button wrapped in an Ant Design `Tooltip` indicating it is planned for future work. It performs no action.
5. If the ABClass has no year group (`yearGroupKey === null`), the existing blocking error must be preserved — this case must not reach the no-match resolution choice.
6. The existing `findMatchingDefinition` function, its early-return for `null` topic/yearGroup, and all other matching logic must remain unchanged.
7. The `AssignmentDefinitionWizardModal` must accept optional initial form values and an optional success callback without breaking its existing create/update usage from the Assignments page.
8. The AssessTaskModal must remain closable at all times during the no-match resolution workflow. During the `creating` state, the AssessTaskModal footer shows a Cancel button that dismisses both the wizard and the AssessTaskModal.

## Existing system constraints

### Backend or API constraints already in place

- `startAssessmentRun` API: accepts `{ definitionKey, assignmentId, courseId }` and returns `void | null`. No changes needed.
- `upsertAssignmentDefinition` API: creates/updates definitions, no changes needed.
- `getGoogleClassroomAssignments` API: returns `{ assignmentId, title, topicId, topicName }` per assignment, no changes needed.
- `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`: no new entries required.

### Current data-shape constraints

- `GoogleClassroomAssignment`: `{ assignmentId: string, title: string, topicId: string | null, topicName: string | null }`
- `ClassPartial`: includes `yearGroupKey: string | null` — must be non-null for assessment to proceed
- `AssignmentDefinitionPartial`: includes `primaryTopicKey`, `primaryTopic`, `yearGroupKey`, `primaryTitle`, `alternateTitles`
- `AssignmentTopic` (reference data): `{ key: string, name: string, yearGroupKeys: string[] }`
- `AssignmentDefinitionWizardModalProperties`: currently `{ open, mode, definitionKey, onClose }` — must be extended with optional `initialValues` and `onCreateSuccess`

### Frontend or consumer architecture constraints

- All API calls must route through `callApi` in `apiService.ts`
- The Assess Task modal currently reads `classPartials` and `assignmentDefinitionPartials` from the React Query cache via `queryClient.getQueryData()`
- The Assignment Definition wizard uses `useAssignmentDefinitionWizard` hook with its own internal state machine (parse → save lifecycle, dirty tracking, discard confirm)
- `ClassesPage` currently renders `AssessTaskModal` conditionally; `AssignmentsPage` renders `AssignmentDefinitionWizardModal`
- Modal-nesting must follow `docs/developer/frontend/frontend-modal-patterns.md`

### Modal nesting constraint

This feature introduces up to three concurrent Ant Design `Modal` layers when the wizard's discard-confirm dialog appears:

1. AssessTaskModal (outer)
2. AssignmentDefinitionWizardModal (launched from AssessTaskModal during `creating` state)
3. Wizard's discard-confirm `Modal` (triggered by the wizard's `handleClose` when dirty edits exist)

This triple nesting is accepted for this feature because:

- The wizard owns its own lifecycle and discard-confirm pattern, which is an established convention (see `frontend-modal-patterns.md` §3.4).
- The AssessTaskModal is non-interactive during the `creating` state except for its Cancel button (escape hatch).
- Ant Design `Modal` stacking is handled automatically via z-index layering.

Focus-management rules for the triple-nesting scenario:

- When the wizard opens, focus moves to the wizard modal.
- When the discard-confirm opens, focus moves to the confirm dialog. On close (either "Keep editing" or "Discard changes"), focus returns to the wizard modal — not to the AssessTaskModal.
- When the wizard closes (success or cancel), focus returns to the AssessTaskModal's choice buttons.
- The AssessTaskModal's Cancel button is always reachable via keyboard during the `creating` state.

## Domain and contract recommendations

### Why this approach is preferable

- Reuses the existing wizard modal rather than building a parallel definition-creation surface, keeping the definition-creation contract in one place.
- Pre-population reduces user error and manual re-entry of data already available from Google Classroom.
- The placeholder "link to existing" button prevents scope creep while keeping the intended expansion visible.
- Automatic assessment after definition creation closes the loop without requiring the user to re-select the assignment and click Start Assessment again.

### Recommended data shapes

#### Wizard initial values (new)

```ts
{
  title?: string;
  topic?: string;
  yearGroup?: string;
}
```

All fields optional — the wizard applies only the provided fields, leaving others blank.

#### Wizard `onCreateSuccess` callback (new)

```ts
(definitionKey: string) => void
```

Called by the wizard hook after a successful final save in create mode. Receives the non-null `definitionKey` from the successful save response (falling back to the request's `effectiveKey` only if the response omits it). The caller (AssessTaskModal) is responsible for transitioning away from the `creating` state, which unmounts the wizard. The wizard must NOT call `onClose()` when `onCreateSuccess` is provided — the callback replaces the normal close for the save path. The implementation must guard against calling the callback with a null or undefined key.

### Validation recommendation

#### Frontend

- Before pre-populating the topic field, verify the topic exists in the cached `assignmentTopics` reference data by checking `topics.some(t => t.key === selectedAssignment.topicId)`.
- When `topicId` is `null` or no matching topic is found, leave the topic field blank. The user must select a topic in the wizard before saving — this is enforced by the wizard's existing required-field validation and is a normal workflow, not an error.
- The year group field is pre-populated unconditionally from `classPartial.yearGroupKey` (already validated as non-null upstream).
- **Important implementation detail:** Applying initial values must also set the `selectedTopicKey` and `selectedYearGroupKey` state variables in the wizard hook so that the `SelectWithAddNew` component displays the correct selected value. Setting only the form field values is insufficient because `SelectWithAddNew` reads from these state variables. When the topic/yearGroup initial value is not provided or is an empty string, `selectedTopicKey`/`selectedYearGroupKey` must remain `undefined` (not set to empty string), because the wizard's validation treats empty string as unselected.

#### Backend

- No new validation required. The existing wizard validation (`requireExistingAssignmentTopic`, `requireExistingYearGroupRecord`) handles the create path.
- If the pre-populated topic's `yearGroupKeys` does not include the class's year group, the backend's `requireExistingAssignmentTopic` validation will reject the save. The wizard will display the resulting error, and the user must select a compatible topic.

## Feature architecture

### Placement

- Primary change: `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- Wizard contract extension: `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`, `useAssignmentDefinitionWizard.ts`
- Page composition: `src/frontend/src/pages/ClassesPage.tsx` — minimal; may need no changes if the wizard is rendered inside the AssessTaskModal

### Proposed high-level tree

```text
ClassesPage
└── AssessTaskModal (open when class selected)
    ├── [loading body]:      Spin
    ├── [ready body]:        Select + Start Assessment
    ├── [choice body]:       choice prompt (info Alert + two buttons)
    ├── [creating body]:     (hidden — wizard takes over)
    │   └── AssignmentDefinitionWizardModal (create mode, initialValues, onCreateSuccess)
    │       └── [discard confirm Modal] (existing pattern, on top of wizard)
    ├── [success body]:      success Alert + Close footer
    └── [error body]:        error Alert + Cancel footer
```

### Out of scope for this surface

- The "link to existing" workflow (placeholder button only)
- Any change to the matching algorithm
- Any new backend API endpoints
- Any change to the wizard's update-mode behaviour

## Core view model or behavioural model

### State machine reconciliation

The AssessTaskModal currently has an `assessmentState` machine with four variants: `'idle' | 'loading' | 'success' | 'error'`. This spec introduces a companion `noMatchResolution` machine with three variants: `'idle' | 'choice' | 'creating'`. The two machines are orthogonal — `noMatchResolution` governs which body content to render when no match is found, while `assessmentState` governs the assessment lifecycle.

The following table defines the valid state combinations and the resulting UI:

| `assessmentState` | `noMatchResolution` | Body content                                             | Footer                    | Notes                                                   |
| ----------------- | ------------------- | -------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| `'idle'`          | `'idle'`            | Select + Start Assessment                                | Cancel + Start Assessment | Normal ready state                                      |
| `'loading'`       | `'idle'`            | Select (Start Assessment button shows spinner)           | Cancel + disabled Start   | Assessment in progress                                  |
| `'idle'`          | `'choice'`          | Choice prompt (Alert + buttons)                          | Cancel                    | No-match found; user must choose                        |
| `'idle'`          | `'creating'`        | (hidden — wizard open)                                   | Cancel                    | Wizard is creating definition                           |
| `'loading'`       | `'creating'`        | (hidden — wizard unmounted, auto-assessment in progress) | Cancel + disabled Start   | Auto-assessment after wizard success; body stays hidden |
| `'success'`       | `'idle'`            | Success Alert                                            | Close                     | Assessment completed                                    |
| `'error'`         | `'idle'`            | Error Alert                                              | Cancel                    | Cache miss, API failure, ambiguous, or null-topic error |

**Key transition rules:**

0. On modal open (including reopen without unmount): reset both machines to their defaults — `assessmentState = 'idle'` and `noMatchResolution = 'idle'`. This clears any stale success/error/choice/creating state from a previous open.

1. When `findMatchingDefinition` returns `'no-match'`: set `noMatchResolution = 'choice'`. Do NOT set `assessmentState = 'error'` — no-match is not an error, it is a resolvable state. `assessmentState` stays `'idle'` (or is reset from `'loading'` to `'idle'`).

2. When `getValidatedCachedData` returns a cache error, or `handleApiError` catches a failure: set `assessmentState = 'error'` as before. `noMatchResolution` stays `'idle'`.

3. When the user clicks "Create New Definition": set `noMatchResolution = 'creating'`. `assessmentState` stays `'idle'`.

4. When `onCreateSuccess(definitionKey)` fires: call `startAssessmentRun` immediately. `noMatchResolution` stays `'creating'` during the API call so the body remains hidden (the user should not see the assignment Select flash during auto-assessment). The wizard must only render when `noMatchResolution === 'creating' && assessmentState === 'idle'` — once assessment starts (`assessmentState = 'loading'`), the wizard is already unmounted and must not re-render. After the API call settles, transition to the final state: set `noMatchResolution = 'idle'` and `assessmentState` to `'success'` or `'error'`.

5. When the wizard is cancelled/dismissed: set `noMatchResolution = 'choice'`. User returns to the choice prompt. `assessmentState` stays `'idle'`.
   **Detection mechanism:** The AssessTaskModal must track whether `onCreateSuccess` has fired (e.g., via a `hasCreateSucceeded` ref or state flag) to distinguish wizard cancel (no `onCreateSuccess`) from wizard success (`onCreateSuccess` fires, then wizard unmounts). When the wizard's `onClose` fires without `onCreateSuccess` having fired, return to `'choice'`. **Sequencing (required implementation change):** The wizard's `handlePostMutation` must be modified so that when `onCreateSuccess` is provided and the save succeeds, it calls `onCreateSuccess(definitionKey)` and does **not** call `onClose()`. The AssessTaskModal can then track a `hasCreateSucceeded` flag set inside `onCreateSuccess`; when the wizard's `onClose` subsequently fires (which it will for the cancel/discard path), the flag distinguishes the two cases.

6. When the AssessTaskModal footer Cancel is clicked during `'creating'`: calls `onClose()`, closing the entire AssessTaskModal (and thereby the wizard). This is the escape hatch.

### No-match resolution state (new)

The AssessTaskModal introduces a `noMatchResolution` state with three variants:

#### `idle`

- Default state. Normal Start Assessment flow. No choice prompt shown.

#### `choice`

- Set when `findMatchingDefinition` returns `'no-match'`.
- Body renders the choice prompt. Footer shows Cancel.
- "Create New Definition" → transitions to `creating`.
- Cancel → calls `onClose()` (modal closes).
- Modal backdrop click, Escape key, and built-in close (X) all call `onClose()` (same as Cancel button), closing the modal entirely.

#### `creating`

- Body hides the assignment selection content. The `AssignmentDefinitionWizardModal` is rendered in create mode.
- Footer shows Cancel (escape hatch to close the entire AssessTaskModal).
- **Footer transition:** While `assessmentState === 'idle'` and the wizard is open, the footer shows **only Cancel**. Once `onCreateSuccess` fires and `assessmentState` moves to `'loading'` for auto-assessment (wizard unmounted), the footer transitions to **Cancel + disabled Start Assessment**, matching the normal assessment-loading state. After auto-assessment settles, the footer follows the resulting success or error state.
- On wizard success (`onCreateSuccess`): `noMatchResolution` stays `'creating'`, `assessmentState` moves to `'loading'`, and `startAssessmentRun` is called.
- On wizard cancel/close: transitions back to `choice`.

### Choice prompt content

- An info `Alert` explaining no matching definition was found for the selected assignment title.
- Two buttons in a horizontal `Space`:
  1. "Create New Definition" (Ant Design `Button type="primary"`) — opens the wizard with pre-populated fields
  2. "Link to Existing Definition" (Ant Design `Button` with `disabled`, wrapped in an Ant Design `Tooltip` with `title="Coming soon"`) — no-op

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Alert` for the no-match explanation
- Ant Design `Space` for button layout
- Ant Design `Button` for both choice buttons
- Ant Design `Tooltip` wrapping the disabled "Link to Existing" button
- The existing `AssignmentDefinitionWizardModal` component for definition creation

### Rendering rules

#### No-match choice state

- The assignment selection `Select` and the "Select assignment" label must be hidden.
- The choice prompt replaces the body content.
- Footer shows only the Cancel button.

#### Creating state (wizard visible)

- The AssessTaskModal's own body content is hidden (no assignment Select, no choice buttons).
- The `AssignmentDefinitionWizardModal` is rendered as a separate modal surface within the AssessTaskModal component's render output. It must only render when `noMatchResolution === 'creating' && assessmentState === 'idle'` — during auto-assessment (`assessmentState = 'loading'`), the wizard is unmounted and must not re-render.
- The AssessTaskModal footer shows only a Cancel button — this closes the entire AssessTaskModal (and thereby the wizard). It is the user's escape hatch from the entire workflow. **Important:** clicking this Cancel button during the `creating` state closes everything without the wizard's discard-confirm prompt. Unsaved wizard edits are silently lost. This is intentional — the outer Cancel is the unconditional escape hatch.
- The wizard operates with its own normal lifecycle (parse, save, discard confirm, reference-data blocked/loading, etc.).
- If the wizard's reference data is blocked, the wizard's own blocking-error modal takes over. The AssessTaskModal's Cancel remains available.

#### Auto-assessment after wizard success

- When the wizard calls `onCreateSuccess(definitionKey)`:
  1. The AssessTaskModal calls `startAssessmentRun({ definitionKey, assignmentId: selectedAssignment.assignmentId, courseId: classId })`, keeping `noMatchResolution = 'creating'` so the body stays hidden during the API call.
  2. On success: set `noMatchResolution = 'idle'` and `assessmentState = 'success'`.
  3. On API failure: set `noMatchResolution = 'idle'` and `assessmentState = 'error'`.

## Workflow specification

### No-match resolution — Create New Definition

#### Preconditions

- `findMatchingDefinition` returned `kind: 'no-match'`
- `selectedAssignment` is non-null (guaranteed by the Start Assessment guard)
- `classPartial.yearGroupKey` is non-null (guaranteed by the upstream cache validation in `getValidatedCachedData`)
- `selectedAssignment.topicId` may be null or may not exist in reference data — handled gracefully

#### Inputs

| Wizard field           | Pre-population source                                                                                                       | Fallback                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `title`                | `selectedAssignment.title`                                                                                                  | n/a                                |
| `topic`                | `selectedAssignment.topicId`, if a matching `AssignmentTopic` with `key === topicId` exists in the `assignmentTopics` cache | blank (user must select in wizard) |
| `yearGroup`            | `classPartial.yearGroupKey`                                                                                                 | n/a                                |
| `referenceDocumentUrl` | (none)                                                                                                                      | blank                              |
| `templateDocumentUrl`  | (none)                                                                                                                      | blank                              |

#### Behaviour

1. User sees the choice prompt and clicks "Create New Definition".
2. The Assess Task modal sets `noMatchResolution = 'creating'`, hides its body, and renders the `AssignmentDefinitionWizardModal` in create mode with `initialValues` containing the pre-populated fields. **The `selectedAssignmentId` (and thus `selectedAssignment`) is retained in component state during the `creating` state; the assignment Select is hidden but its value is preserved in state for the subsequent auto-assessment call.**
3. The user completes the wizard's normal create flow (fill document URLs → parse → adjust weightings → save).
4. On successful final save, the wizard hook calls `onCreateSuccess(definitionKey)` instead of its normal `onClose()`. The key is taken from the save response's `definitionKey` (falling back to the request's `effectiveKey = localDefinitionKey ?? definitionKey` only if the response omits it), and must be non-null when the callback is invoked.
5. The Assess Task modal receives `onCreateSuccess(definitionKey)`, calls `startAssessmentRun({ definitionKey, assignmentId: selectedAssignment.assignmentId, courseId: classId })` while keeping `noMatchResolution = 'creating'` (body stays hidden during the API call).
6. On API success: set `noMatchResolution = 'idle'` and `assessmentState = 'success'`. Modal shows the existing success state with "Assessment started for '{title}'."
7. On API failure: set `noMatchResolution = 'idle'` and `assessmentState = 'error'`. Modal shows the existing error/warning state.

#### Cancel or dismiss

- If the user cancels the wizard (clicks Cancel → discard confirm → Discard changes), the wizard's `onClose` fires. The Assess Task modal detects the wizard closed without `onCreateSuccess` firing and returns `noMatchResolution` to `'choice'` (user can try again or close entirely).
- If the user clicks Cancel on the AssessTaskModal footer during the `creating` state, the entire AssessTaskModal closes (via `onClose()`), dismissing both modals.

## Error, loading, and empty-state rules

### Blocking failure

- `classPartial.yearGroupKey === null`: unchanged — "Cannot determine year group for this class." error (`assessmentState = 'error'`). No choice prompt shown.
- `selectedAssignment.topicName === null`: unchanged — "The selected assignment has no topic. Cannot match to a definition." error (`assessmentState = 'error'`). No choice prompt shown.
- `assignmentTopics` cache miss: the topic existence check returns `false`, so the topic field is left blank. This is not an error — the user must select or create a topic in the wizard. The wizard's own required-field validation enforces completion before save.

### Empty states

- If `assignmentTopics` cache is empty (no topics configured), the topic field remains blank. The wizard's own reference-data blocking/loading handling applies.
- If the wizard's reference data is blocked during the `creating` state, the wizard's own blocking-error modal is shown. The AssessTaskModal's Cancel button remains available for the user to abort the workflow.

## Accessibility and usability notes

- The "Link to Existing Definition" disabled button must be wrapped in an Ant Design `Tooltip` with `title="Coming soon"`. **Implementation note:** a disabled `<Button>` does not emit pointer events, so the `Tooltip` must wrap a `<span>` containing the button: `<Tooltip title="Coming soon"><span><Button disabled>Link to Existing Definition</Button></span></Tooltip>`.
- Focus management:
  - When transitioning from `choice` to `creating`, focus moves to the wizard modal.
  - When the wizard opens its discard-confirm, focus moves to the confirm dialog. On close, focus returns to the wizard.
  - When the wizard closes (success or cancel), focus returns to the AssessTaskModal's choice buttons (if returning to choice) or to the success/error Alert.
  - **Testing caveat:** Focus transitions across stacked Ant Design modals are not covered by Vitest unit tests and are only partially verifiable in Playwright E2E tests. Focus behaviour is specified here as intended behaviour; implement it but accept that automated verification is limited.
- The AssessTaskModal's Cancel button is always rendered and clickable with the pointer during the `creating` state, providing an escape hatch. While the wizard modal is the topmost surface, Ant Design's focus trap keeps keyboard focus inside the wizard; keyboard reachability of the outer Cancel is therefore limited to moments when focus returns to the AssessTaskModal (e.g. after the wizard closes). Automated verification of this behaviour is limited.

## Backend changes required to support agreed behaviour

None. All changes are frontend-only.

## Planning handoff notes

- The wizard's `AssignmentDefinitionWizardModalProperties` type must be extended with two new optional fields:
  - `initialValues?: Readonly<{ title?: string; topic?: string; yearGroup?: string }>` — pre-populates form fields in create mode
  - `onCreateSuccess?: (definitionKey: string) => void` — called after successful final save in create mode, replacing the normal `onClose()` for that path
- The `useAssignmentDefinitionWizard` hook must:
  - Apply `initialValues` via `form.setFieldsValue()` after `form.resetFields()` in create mode, only for the provided fields. The `useFormInitialization` effect must include `initialValues` in its dependency array (or use a separate effect) so that initial values are applied whenever the modal opens with a new `initialValues` object.
  - Set `selectedTopicKey` and `selectedYearGroupKey` state variables to match the initial values (critical: `SelectWithAddNew` reads these, not the form; see Validation recommendation §Frontend for details)
  - In `handlePostMutation` for save actions in create mode: call `onCreateSuccess(definitionKey)` instead of `onClose()` when `onCreateSuccess` is provided. The key is the non-null `definitionKey` from the save response (falling back to the request's `effectiveKey = localDefinitionKey ?? definitionKey` only if the response omits it).
  - Pass `onCreateSuccess` through to `handlePostMutation` (or thread it as a new parameter on `runWizardMutation`)
- The AssessTaskModal must:
  - Read `assignmentTopics` from the React Query cache via `queryClient.getQueryData(queryKeys.assignmentTopics())`. Requires importing the type: `import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';` for the `getQueryData<AssignmentTopic[]>(...)` call.
  - Add `noMatchResolution` state (`'idle' | 'choice' | 'creating'`)
  - Replace the `kind: 'no-match'` branch in the existing `handleMatchOutcome` function with `setNoMatchResolution('choice')` instead of `setAssessmentAsError(...)` (and must not call `setAssessmentAsError`, which would set `assessmentAlertType`/`assessmentError`)
  - Derive body and footer rendering from the combination of `assessmentState` and `noMatchResolution` per the reconciliation table
  - Gate the wizard render: only render the wizard when `noMatchResolution === 'creating' && assessmentState === 'idle'`
  - Derive the `creating` state detection for wizard close: when the wizard's `onClose` fires but `onCreateSuccess` has not fired, return to `'choice'`. The AssessTaskModal can track this by setting a flag when `onCreateSuccess` fires, or by checking that `onCreateSuccess` (which fires before the wizard unmounts) was not called before `onClose`.
  - Update the component's `@remarks` JSDoc to describe the orthogonal `assessmentState` × `noMatchResolution` state machine (replacing the current single-axis description)
- No layout spec is required — the choice prompt is simple inline content in the existing modal body, and the wizard is reused with no visual changes.
- The `ClassesPage` composition requires no changes if the wizard is rendered inside the AssessTaskModal component.
- Shared-helper decision: the topic existence check (`topics?.some(t => t.key === selectedAssignment.topicId)`) is a simple one-liner and should remain local to the AssessTaskModal rather than being extracted into a separate helper. This decision must be recorded in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented` before implementation starts, and updated to `Implemented` in the documentation pass.

## Testing expectations

- AssessTaskModal unit tests:
  - No-match → choice state renders correctly (Alert + two buttons, "Link to Existing" disabled)
  - "Create New Definition" click → wizard opens with correct `initialValues` (title, topic when exists, yearGroup)
  - Topic pre-population: topic exists in cache, topicId is null, topic missing from cache
  - Wizard success → auto-assessment triggered, success state shown
  - Wizard failure → error state shown
  - Wizard cancel → returns to choice state
  - AssessTaskModal Cancel during `creating` → both modals close
  - Existing error paths (cache miss, null yearGroup, null topicName) unchanged
- `matchDefinitionForAssignment` unit tests: no changes needed (matching logic unchanged)
- AssignmentDefinitionWizardModal tests:
  - `initialValues` are applied in create mode (form fields populated, `selectedTopicKey`/`selectedYearGroupKey` set)
  - `onCreateSuccess` is called on save with the correct key
  - `onClose` is NOT called when `onCreateSuccess` is provided and save succeeds
  - Existing create/update behaviour unchanged when `initialValues` and `onCreateSuccess` are not provided
- `useAssignmentDefinitionWizard` hook tests (or integration tests via wizard modal):
  - Initial values apply correctly alongside normal create-mode reset
  - `selectedTopicKey`/`selectedYearGroupKey` are synchronised with initial values
- Playwright E2E tests (6 new cases in `classes-page-assess-task.spec.ts`):
  - Choice prompt rendering (Alert, buttons, tooltip)
  - Cancel from choice prompt closes modal
  - Wizard opens in create mode with pre-populated fields
  - Wizard cancel → returns to choice prompt
  - Full wizard flow → auto-assessment success
  - Outer Cancel during wizard → both modals close
- E2E mock infrastructure: `RuntimeScenario` extended with `startAssessmentRun`; introduce a dedicated `CreateAssessTaskScenarioOptions` type (extending the general Classes scenario options) for `createAssessTaskScenario()`; all void-method responses including `startAssessmentRun` must use `{ kind: 'success', data: null }`

## Documentation and rollout notes

- No canonical docs changes required beyond this spec.
- No migration or rollout dependencies.
- The "link to existing" button is explicitly deferred.

## V1 scope recommendation

### Include in v1

- No-match choice prompt with "Create New Definition" and placeholder "Link to Existing"
- Pre-population of title, topic (conditional), and year group into the wizard
- Automatic assessment after successful definition creation
- Updated wizard contract (`initialValues`, `onCreateSuccess`) with `selectedTopicKey`/`selectedYearGroupKey` synchronisation
- AssessTaskModal state machine changes (`noMatchResolution` + reconciliation with `assessmentState`)
- Triple-modal-nesting acknowledgement and focus-management rules

### Defer from v1

- The "link to existing definition" workflow implementation
- Any topic auto-creation when the GC assignment topic does not exist in reference data
- Queue-based or priority-based assessment runs
