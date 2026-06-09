# Assess Task Happy Path Specification

## Status

- Draft v1.0
- Initial spec for wiring the "Start Assessment" button in the Assess Task modal to the existing `startAssessmentRun` backend API.

## Purpose

This document defines the intended behaviour for the "Start Assessment" happy path in the Assess Task modal on the Classes page.

The feature will be used to:

- match a user-selected Google Classroom assignment against a known AssignmentDefinition by title, topic, and year group
- trigger an AssessmentRun via the existing `startAssessmentRun` backend API when a match is found
- provide inline success or error feedback within the modal

This feature is **not** intended to:

- change the overall wizard or Classes page layout
- add support for starting assessments outside the Classes page Assess Task modal
- handle the full assessment lifecycle (processing, results) — only the trigger
- support manual definition selection when matching fails

## Agreed product decisions

1. **Matching strategy**: The selected Google Classroom assignment is matched against `AssignmentDefinitionPartial` records using three fields: title (against `primaryTitle` and `alternateTitles`), topic (matched by direct string equality between the assignment's resolved topic name and the definition's `primaryTopic` display name), and year group (against `yearGroupKey` — resolved from the class's `ClassPartial`).
2. **Match uniqueness**: If more than one `AssignmentDefinitionPartial` matches all three fields, the operation fails with an error. The backend enforces uniqueness on the `(primaryTitle, primaryTopicKey, yearGroupKey)` business tuple at the key level. Since `primaryTopic` (display name) is resolved from `primaryTopicKey` via reference data and a given key always resolves to the same display name, display-name collisions can only occur if reference data changes after definition creation — a rare edge case. The matching algorithm compares display names; the uniqueness guard operates at the key level.
3. **No match**: When no definition matches, clicking "Start Assessment" shows an error `Alert` inside the modal body. The modal stays open so the user can select a different assignment or dismiss.
4. **Success state**: On successful `startAssessmentRun`, the modal body is replaced with an inline success state (e.g., "Assessment started for [assignment title]"). The user must manually dismiss the modal.
5. **Failure states**: Backend errors (including `DefinitionStaleError`) are shown as an error `Alert` in the modal body. The modal stays open.
6. **Data source — AssignmentDefinitionPartials**: Already prefetched at startup via React Query (`assignmentDefinitionPartials` key). The modal reads from the React Query cache using `useQuery`; no additional fetch is required.
7. **Data source — Class year group**: Resolved from `classPartials` (also startup-prefetched, key `classPartials`) by looking up the class by its `classId`.
8. **Backend extension**: `getGoogleClassroomAssignments` must be extended to include `topicId` and resolved `topicName` in its response so the frontend can use the topic name for matching.

## Existing system constraints

### Backend or API constraints already in place

- `startAssessmentRun` in `src/backend/z_Api/assignmentAssessment.js` accepts `{ definitionKey, assignmentId, courseId }` and returns `null` on success. `courseId` is validated as a non-empty string (domain-level); unlike `classId` in `getGoogleClassroomAssignments`, path-character safety checks are not replicated here because the value originates from backend-controlled data (`ClassPartial.classId`).
- `startAssessmentRun` is registered in `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`.
- `AssignmentController.startAssessmentRun` performs domain validation, fetches the full definition, checks freshness, resolves the ABClass, and delegates to `startProcessing`.
- `getAssignmentDefinitionPartials` returns an array of partials with `primaryTitle`, `alternateTitles`, `primaryTopicKey`, `yearGroupKey`, and `definitionKey`.
- `getGoogleClassroomAssignments` currently returns `{ assignmentId, title }` only; must be extended to include `topicId` and resolved `topicName`.
- `ClassroomApiClient.fetchCourseWork` currently maps `{ id, title, updateTime }` only; must also map `topicId`.

### Current data-shape constraints

- Google Classroom `CourseWork.topicId` is a string or `null`/`undefined`. When `null`, the assignment has no topic.
- `AssignmentDefinitionPartial.primaryTopicKey` is always a non-empty trimmed string.
- `AssignmentDefinitionPartial.alternateTitles` is an array of strings (may be empty).
- `ClassPartial.yearGroupKey` is a nullable string. Matching can only proceed when `yearGroupKey` is non-null.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls must route through `callApi` in `apiService.ts`.
- New backend-callable methods need a frontend service wrapper with Zod validation.
- `AssignmentDefinitionPartials` and `classPartials` are available via React Query hooks (`useQuery` / `usePageDataset`).
- The Assess Task modal currently uses local `useState` + `useEffect` for assignment fetching; it should keep this pattern for the assignment dropdown but read partials and class data from React Query.

## Domain and contract recommendations

### Why this approach is preferable

- Reuses already-prefetched data rather than adding new fetches in the modal.
- Keeps matching logic simple and testable with clear inputs.
- Uses the existing backend `startAssessmentRun` API without modification to its contract.
- The three-field match (title, topic name, year group) provides sufficient uniqueness in practice. Display-name matching is backed by key-level uniqueness enforcement on the `(primaryTitle, primaryTopicKey, yearGroupKey)` business tuple.

### Recommended data shapes

#### Extended Google Classroom assignment (backend transport)

```ts
{
  assignmentId: string;
  title: string;
  topicId: string | null;
  topicName: string | null;
}
```

`topicName` is resolved from `topicId` via `Classroom.Courses.Topics.get()` (using the existing `ClassroomApiClient.fetchTopicName`). When `topicId` is null, `topicName` is also null.

#### Frontend matching input

```ts
{
  selectedAssignment: { assignmentId: string; title: string; topicName: string | null };
  classPartial: { yearGroupKey: string | null };
  definitionPartials: AssignmentDefinitionPartial[];
}
```

Note: `courseId` for the subsequent `startAssessmentRun` call is the modal's `classId` prop (the Google Classroom course identifier), not part of the matching input. The `courseId` value is held separately by the modal alongside the matching result.

#### startAssessmentRun frontend service request

```ts
{
  definitionKey: string;
  assignmentId: string;
  courseId: string;
}
```

### Naming recommendation

Prefer:

- `assignmentAssessmentService.ts` for the new frontend service (follows existing domain-prefix convention, e.g., `assignmentDefinitionPartialsService.ts`)
- `assignmentAssessment.zod.ts` for its Zod schemas
- `matchDefinitionForAssignment` for the pure matching function

Avoid:

- `startAssessment` without context (ambiguous with starting other workflows)
- `assessmentRunService` (inconsistent with existing naming)

### Validation recommendation

#### Frontend

- Validate that `classPartials` contains an entry for the given `classId` before matching.
- Validate that `yearGroupKey` is non-null on the matched class before comparing.
- Validate that `topicName` on the GC assignment is non-null before comparing against `primaryTopic`; a null `topicName` (assignment has no topic) is treated as "cannot match".
- The "Start Assessment" button must remain disabled while assignments are loading or errored (existing behaviour).

#### Backend

- Extend `getGoogleClassroomAssignments_` to include `topicId` in its mapped response (the field is already available from `Classroom.Courses.CourseWork` resources via `cw.topicId`).
- Extend `ClassroomApiClient.fetchCourseWork` to map `topicId`.
- No change to `startAssessmentRun` contract is required.

### Display-resolution recommendation

- The success message should include the matched assignment title for clarity.
- The no-match error message should indicate which definition fields were compared and that no match was found.

## Feature architecture

### Placement

- The matching logic lives in the `AssessTaskModal` component or a dedicated hook (`useAssessTask`).
- A new frontend service `src/frontend/src/services/assignmentAssessmentService.ts` wraps the `startAssessmentRun` call.
- The pure matching function should be extractable for unit testing.

### Proposed high-level tree

```text
AssessTaskModal/                      (new subfolder in features/classes/)
├── AssessTaskModal.tsx               (moved, extended)
├── AssessTaskModal.spec.tsx          (moved, extended)
├── matchDefinitionForAssignment.ts   (new)
├── matchDefinitionForAssignment.spec.ts (new)
├── Assignment dropdown (existing, extended with topicId/topicName)
├── Match logic (new)
│   ├── Read classPartials from React Query cache
│   ├── Read assignmentDefinitionPartials from React Query cache
│   └── Match: title ∈ (primaryTitle ∪ alternateTitles) ∧ topicName = primaryTopic ∧ yearGroupKey = classPartial.yearGroupKey
├── Start Assessment button → calls startAssessmentRun service
├── Success state (new — inline body replacement)
└── Error states (no-match alert, backend error alert)
```

### Out of scope for this surface

- Manual definition selection when matching fails
- Batch assessment triggering
- Assessment progress tracking or results display
- Modifying the Classes page layout or card structure

## Data loading and orchestration

### Required datasets or dependencies

- `assignmentDefinitionPartials` — already startup-prefetched; read from React Query cache
- `classPartials` — already startup-prefetched; read from React Query cache
- `googleClassroomAssignments(classId)` — fetched on modal open (existing); now extended with `topicId`

### Prefetch or initialisation policy

#### Startup

- No change. `assignmentDefinitionPartials` and `classPartials` are already startup-prefetched.

#### Feature entry

- Google Classroom assignments are fetched when the modal opens (existing behaviour).
- `assignmentDefinitionPartials` and `classPartials` are read from the React Query cache via `useQueryClient().getQueryData()` (read-only, no additional fetch). If cached data is unavailable at match time, treat as a blocking error.
- Using `useQuery` with default options would trigger an unnecessary refetch on every modal open; prefer cache-only reads.

#### Manual refresh

- Intentionally absent. The modal reads from cache; stale data risk is accepted as acceptable for this workflow.

### Query or transport additions

- `startAssessmentRun` — new frontend service method, no shared query key (mutation, not a query)
- `getGoogleClassroomAssignments` — extended response shape (adds `topicId`)

## Core view model or behavioural model

### Matching algorithm

```text
function findMatchingDefinition(selectedAssignment, classPartial, definitionPartials):
  if classPartial.yearGroupKey is null → return NO_MATCH (no year group to compare)
  if selectedAssignment.topicName is null → return NO_MATCH (no topic to compare)

  matches ← []
  for each partial in definitionPartials:
    titleMatch ← selectedAssignment.title ∈ {partial.primaryTitle} ∪ partial.alternateTitles
    topicMatch ← selectedAssignment.topicName = partial.primaryTopic
    yearMatch ← classPartial.yearGroupKey = partial.yearGroupKey

    if titleMatch ∧ topicMatch ∧ yearMatch:
      matches.push(partial)

  if matches.length = 0 → return NO_MATCH
  if matches.length > 1 → return AMBIGUOUS
  return matches[0]
```

### States

1. **No match**: No definition satisfies all three criteria.
2. **Ambiguous**: Multiple definitions satisfy all three criteria (should not occur with valid data but handled defensively).
3. **Matched**: Exactly one definition found.

Note: `alternateTopics` on `AssignmentDefinitionPartial` is intentionally not used for v1 matching; topic matching is against `primaryTopic` only.

## Main user-facing surface specification

### Recommended components or primitives

- `Alert` (error and success feedback) — already used in the modal
- `Button` (Start Assessment) — already present, currently no-op

### Workflow specification

## Assess Task — Start Assessment

### Eligible inputs or preconditions

- Modal is open with a valid `classId` and `className`.
- Google Classroom assignments have been fetched successfully.
- A valid `AssignmentDefinitionPartial` list is available in the React Query cache.
- A `ClassPartial` for the given `classId` exists and has a non-null `yearGroupKey`.

### Inputs, fields, or confirmation copy

- User selects a Google Classroom assignment from the dropdown (existing).
- "Start Assessment" button triggers the match + API call.

### Behaviour

1. User clicks "Start Assessment".
2. The matching algorithm runs against the selected assignment, the class's year group, and all definition partials.
3. **If no match**: An `Alert` of type `error` is shown in the modal body with a message like "No matching assignment definition found for '[assignment title]'." The modal remains open.
4. **If ambiguous**: An `Alert` of type `error` is shown with a message like "Multiple definitions match this assignment. Ensure definition titles are unique per topic and year group." The modal remains open.
5. **If matched**: `startAssessmentRun({ definitionKey, assignmentId, courseId })` is called.
   - On success: The modal body is replaced with an inline success `Alert` of type `success` with a message like "Assessment started for '[assignment title]'." The footer changes to a single "Close" button.
   - On `DefinitionStaleError`: An `Alert` of type `warning` is shown with a message like "The assignment definition has changed. Please refresh and try again." The frontend `ApiErrorResponseSchema` currently discards the `details` block from error envelopes; for v1 this is acceptable as the warning message is static. The `code` field (`'DEFINITION_STALE'`) is sufficient for detection.
   - On other backend error: An `Alert` of type `error` is shown with the error message.

## Error, loading, and empty-state rules

### Blocking failure

- The "Start Assessment" button is disabled while assignment data is loading or errored (existing behaviour).
- The "Start Assessment" button is disabled when no assignment is selected (existing behaviour).

### Partial-load or partial-success failure

- If `assignmentDefinitionPartials` or `classPartials` are unavailable from cache at match time, treat as a blocking error (show error `Alert`).

### Empty states

- If the class has no `yearGroupKey`, matching cannot proceed. Show an error `Alert` on click: "Cannot determine year group for this class."
- If the selected assignment has no `topicName`, matching cannot proceed. Show an error `Alert` on click: "The selected assignment has no topic. Cannot match to a definition."

## Accessibility and usability notes

- Error and success `Alert` components must include `showIcon` for accessible status indication.
- The "Start Assessment" button must remain keyboard-focusable and show its disabled reason via `disabled` prop (Ant Design handles `aria-disabled`).
- Focus should move to the new `Alert` when an error or success message appears.

## Backend changes required to support agreed behaviour

1. **Extend `ClassroomApiClient.fetchCourseWork`**
   - Add `topicId` to the mapped response: `topicId: cw.topicId || null`.
2. **Extend `getGoogleClassroomAssignments_` transport handler**
   - Include `topicId` and `topicName` in the returned assignment objects.
   - Resolve `topicName` from `topicId` via `ClassroomApiClient.fetchTopicName(courseId, topicId)` when `topicId` is non-null.
   - When `topicId` is null, `topicName` is also null.
   - Validate `topicId` as `string | null` and `topicName` as `string | null`.
   - Update the function's `@returns` JSDoc tag and function-level comment to reflect the new fields.
3. **Extend frontend Zod schema for Google Classroom assignments**
   - Add `topicId: z.string().nullable()` and `topicName: z.string().nullable()` to `GoogleClassroomAssignmentSchema` in `googleClassroomAssignments.zod.ts`.
4. **New frontend service: `assignmentAssessmentService.ts`**
   - Method: `startAssessmentRun({ definitionKey, assignmentId, courseId })`.
   - Zod request/response schemas in `assignmentAssessment.zod.ts`.
   - Response schema: `z.void().nullable()` (backend returns `null`).

## Planning handoff notes

- The `courseId` parameter for `startAssessmentRun` is the `classId` prop passed to `AssessTaskModal` — they are the same Google Classroom course identifier.
- The backend `topicId` extension must be implemented before the frontend matching logic depends on it.
- The frontend service for `startAssessmentRun` must be implemented before the modal calls it.
- The matching function should be a pure function extractable for unit testing independently of React.
- No layout spec is required — the modal structure does not change materially (same dropdown, same button, new `Alert` states replace or augment existing body content).

## Testing expectations

- Backend unit tests for `ClassroomApiClient.fetchCourseWork` topicId inclusion.
- Backend API tests for `getGoogleClassroomAssignments_` topicId in response.
- Frontend unit tests for the matching function (all states: match, no-match, ambiguous, null-topic, null-yearGroup).
- Frontend component tests for error/success `Alert` rendering in `AssessTaskModal`.
- Frontend service tests for `startAssessmentRun` call (mock `callApi`).
- Zod schema tests for extended `GoogleClassroomAssignmentSchema`.

## Documentation and rollout notes

- Update `docs/developer/frontend/frontend-react-query-and-prefetch.md` if usage patterns change (unlikely; partials remain startup-prefetched).
- No rollout dependencies beyond the existing deployed backend.

## V1 scope recommendation

### Include in v1

- Matching logic (title + topicName + yearGroupKey).
- `startAssessmentRun` frontend service + call from modal.
- Inline success state.
- No-match error alert.
- Backend `topicId` extension.
- Frontend Zod schema extension.

### Defer from v1

- Manual definition selection fallback when matching fails.
- Batch assessment triggering.
- Assessment progress/result display.
- Surfacing `DefinitionStaleError.details` (which document is stale) through the frontend transport boundary (requires `ApiErrorResponseSchema` extension).
- Topic name display in the modal dropdown or success message beyond what is needed for matching.

## Open questions

None — all material design decisions have been settled through clarification.
