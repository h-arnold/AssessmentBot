# Assess Task — Classes Page Workflow Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour for launching an assessment from the Classes page.

The feature will be used to:

- let a teacher select a Google Classroom assignment for a specific class
- present a minimal selection modal that confirms the chosen assignment
- enable a "Start Assessment" action that will be wired to the assessment pipeline in later work

This feature is **not** intended to:

- trigger an actual assessment run or create triggers
- parse tasks, hydrate submissions, or call the LLM
- create, update, or persist any assignment-definition records
- replace or modify the legacy AdminSheet assessment flow
- add a "Start Assessment" button anywhere other than the class cards on the Classes page

## Agreed product decisions

1. The entry point is an "Assess Task" icon button (with hover tooltip) replacing the current disabled "Edit" button on each class card on the Classes page. The icon-plus-tooltip pattern is chosen over text to stay within the 268 px card width.
2. The button opens a modal containing a dropdown of Google Classroom assignments for that class and a "Start Assessment" button that is disabled until an assignment is selected.
3. Once an assignment is selected, the modal displays the selected assignment title as confirmation below the dropdown.
4. Clicking "Start Assessment" currently has no side effect (placeholder only); the button must be clickable so enablement can be verified in tests.
5. Assignments are fetched on demand when the modal opens — they are not startup-prefetched.
6. The new backend endpoint reuses the existing `Classroom.Courses.CourseWork.list()` call path via `ClassroomApiClient` rather than calling the deprecated `GoogleClassroomManager` directly.
7. The `classId` from the ClassPartial dataset (which is the Google Classroom course ID) is the parameter passed to the assignment-fetching endpoint.

## Existing system constraints

### Backend or API constraints already in place

- `ClassroomApiClient` (`src/backend/GoogleClassroom/ClassroomApiClient.js`) already wraps `Classroom.Courses.list()`, `Classroom.Courses.Teachers.list()`, etc. but does not yet expose `Classroom.Courses.CourseWork.list()`.
- The deprecated `GoogleClassroomManager.getAssignments(courseId)` in `src/AdminSheet/GoogleClassroom/GoogleClassroomManager.js` already calls `Classroom.Courses.CourseWork.list(courseId)` and returns `{ id, title, topicId, updateTime }`. This is the existing code the new endpoint should reuse by adding an equivalent method to `ClassroomApiClient`.
- `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js` is the single transport registry for frontend-callable methods.
- Backend `z_Api` files use the trailing-underscore pattern for non-trivial handlers; new handlers must follow the same pattern.
- Transport-boundary validation belongs in the `z_Api` handler; domain invariants belong in the controller or API client.
- `ClassroomApiClient` has a mixed error contract: `fetchAllActiveClassrooms()` and `fetchTeachers()` catch and return `[]` (never throw), while `fetchTopicName()` throws on failure. The new `fetchCourseWork(courseId)` method must throw on Google Classroom API failure (matching the `fetchTopicName` pattern) so the transport layer can distinguish "no assignments" (empty list) from "fetch failure" (error). The deprecated `getAssignments` also throws on failure via `logAndThrowError`, so this is consistent with the existing assignment-fetching behaviour.

### Current data-shape constraints

- `ClassPartial.classId` is the Google Classroom course ID and is the authoritative value to pass to the assignments endpoint.
- `ClassPartial` is already startup-prefetched and available via `usePageDataset<ClassPartial[]>('classPartials')` on the Classes page.
- The Google Classroom `CourseWork` API returns objects with `id`, `title`, `topicId`, `updateTime`, and other fields.

### Frontend or architecture constraints

- All frontend-to-backend calls must go through `callApi` in `src/frontend/src/services/apiService.ts`.
- New service modules must use Zod for request/response validation.
- Query keys must be defined in `src/frontend/src/query/queryKeys.ts`.
- On-demand fetches (not startup-prefetched) should use a dedicated service call triggered by the modal, not a shared React Query `useQuery` unless the data benefits from caching across remounts. For this feature the assignment list is transient (tied to one modal open) so a local `useState` + `useEffect` fetch is appropriate.
- Modals must follow `docs/developer/frontend/frontend-modal-patterns.md`.
- Loading and busy states must follow `docs/developer/frontend/frontend-loading-and-width-standards.md`.

## Domain and contract recommendations

### Why this approach is preferable

- Adding `fetchCourseWork` to `ClassroomApiClient` keeps Classroom API access in one modern client rather than spreading it across deprecated managers.
- A simple selection modal (not a form-scaffold modal) avoids the overhead of `Form.useForm` and submit-on-OK wiring when the only action is a dropdown selection.
- On-demand fetch for assignments avoids bloating the startup warm-up surface with data needed only when a teacher explicitly opens the assess modal.
- Keeping the modal local to the Classes page (or a nearby feature module) follows the keep-local rule from `frontend-modal-patterns.md` §4 — there is one caller and no accepted near-term sibling.

### Recommended data shapes

#### Backend request: `getGoogleClassroomAssignments`

```ts
{
  classId: string; // Google Classroom course ID, non-empty, trimmed, path-character-safe
}
```

#### Backend response data

```ts
Array<{
  assignmentId: string; // Google Classroom assignment ID
  title: string; // Assignment title
}>;
```

The transport uses `assignmentId` rather than `id` to avoid ambiguity with other frontend identifier conventions and to match the `yearGroupKey`/`cohortKey` key-naming style already established in the codebase.

`topicId` and `updateTime` are deliberately excluded from the transport response — they are not needed for the current selection-only workflow. The response must be sorted by `updateTime` descending (most recently updated first), matching the existing deprecated `GoogleClassroomManager.getAssignments()` behaviour. The sorting is the responsibility of `ClassroomApiClient.fetchCourseWork()`.

### Naming recommendation

Prefer:

- `getGoogleClassroomAssignments` for the API method name
- `assignmentId` and `title` for the response fields
- `fetchCourseWork` for the new `ClassroomApiClient` method

Avoid:

- `getAssignments` (too generic, collides with existing method)
- `id` (ambiguous in a codebase that uses `classId`, `definitionKey`, `assignmentId`)
- `courseWork` as a top-level transport field (reserve for the GAS API layer)

### Validation recommendation

#### Frontend

- The dropdown must not allow submission with no selection.
- The "Start Assessment" button must be disabled when no assignment is selected.
- The selected assignment title shown below the dropdown must reflect the current selection.

#### Backend

- `classId` must be a non-empty, trimmed string without path characters (`/`, `\`, `..`) or ASCII control characters (transport-boundary validation in the `z_Api` handler). The path-character check is defence-in-depth — Google Classroom course IDs are numeric strings and will never contain path separators, but the check follows the established `z_Api` safe-key pattern.
- Malformed or missing `classId` must return an `INVALID_REQUEST` envelope.

### Display-resolution recommendation

- The selected assignment's `title` is displayed directly as returned by the API. No label resolution or join is required.

## Feature architecture

### Placement

- **Button**: inside the card body on each `ClassesPage` class card, replacing the current disabled "Edit" button.
- **Modal**: a new feature-local component in `src/frontend/src/features/classes/`, following the existing convention for classes feature modules (e.g., `BulkCreateModal.tsx`, `BulkDeleteModal.tsx`). It is owned by the Classes page workflow and not reusable cross-feature at this stage.
- **Backend endpoint**: new `z_Api` file `src/backend/z_Api/googleClassroomAssignments.js` with a trailing-underscore handler, plus a new `fetchCourseWork` method on `ClassroomApiClient`.
- **Frontend service**: new `src/frontend/src/services/googleClassroomAssignmentsService.ts` with adjacent Zod schema file.

### Proposed high-level tree

```text
ClassesPage
└── ClassCard (per class in year-group panel)
    └── AssessTaskButton (icon + tooltip)
        └── opens AssessTaskModal
            ├── AssignmentSelect (Ant Design Select, loading state)
            ├── SelectedAssignmentTitle (conditional, below dropdown)
            └── StartAssessmentButton (disabled until selection)
```

### Out of scope for this surface

- Assessment triggering, trigger creation, or pipeline execution
- Assignment-definition creation or editing
- Task parsing or document ID collection
- Any workflow beyond selecting an assignment and reaching the enabled "Start Assessment" button

## Data loading and orchestration

### Required datasets or dependencies

- `classPartials` (already startup-prefetched, available on the Classes page) — provides `classId` for the selected card.
- Google Classroom assignments — fetched on demand when the modal opens, keyed by `classId`.

### Prefetch or initialisation policy

#### Startup

- No change. Assignments are not added to startup warm-up.

#### Feature entry

- When the modal opens, fetch assignments from `getGoogleClassroomAssignments` with the card's `classId`.
- Show a loading state in the dropdown area while the fetch is in flight.
- If the fetch fails, show an error inside the modal and keep the modal open so the user can retry or cancel.

#### Manual refresh

- No manual refresh control in this scope. The user can close and reopen the modal to re-fetch.
- Reopening the modal for the same class always triggers a fresh fetch (no client-side cache for assignment lists in this scope).

### Query or transport additions

- New query key: `googleClassroomAssignments: (classId: string) => ['googleClassroomAssignments', classId] as const` in `queryKeys.ts`, following the existing scoped-key factory pattern (e.g., `assignmentDefinitionByKey`). This is defined for future React Query adoption but the initial implementation uses a local fetch inside the modal.
- New transport method: `getGoogleClassroomAssignments` registered in `ALLOWLISTED_METHOD_HANDLERS`.
- New frontend service: `getGoogleClassroomAssignments(classId)` calling `callApi('getGoogleClassroomAssignments', { classId })`.

## Core view model or behavioural model

### Modal state machine

The modal has four states:

1. **Loading** — assignments are being fetched. Dropdown is disabled or shows a spinner. "Start Assessment" is disabled.
2. **Ready (no selection)** — assignments are loaded, dropdown is enabled, no assignment is selected. "Start Assessment" is disabled.
3. **Ready (selection made)** — an assignment is selected. The selected title is shown below the dropdown. "Start Assessment" is enabled.
4. **Error** — the fetch failed. An error alert is shown inside the modal. The dropdown is not shown (the alert replaces the dropdown area). "Start Assessment" is disabled. The user can cancel to dismiss.

Transitions:

- Modal open → Loading
- Loading + fetch success → Ready (no selection)
- Loading + fetch failure → Error
- Ready (no selection) + select assignment → Ready (selection made)
- Ready (selection made) + change selection → Ready (selection made) (different assignment)
- Any state + Cancel/close → modal closed, selection discarded

### Empty state

If the course has no assignments, the dropdown is empty. "Start Assessment" remains disabled. The modal should show an appropriate empty message (e.g., "No assignments found for this class").

## Modal behaviour

### Opening

- Clicking the "Assess Task" icon button on a class card opens the modal.
- The modal title should identify the class (e.g., "Assess Task — {className}").

### Closing

- Cancel button closes the modal.
- Clicking the modal mask (backdrop) may also close it (default Ant Design behaviour).
- Closing discards any selection.

### Width

- Default Ant Design modal width is sufficient for this workflow. The modal does not need the `--app-modal-width-wide-data` token.

### Start Assessment

- When enabled (an assignment is selected), clicking "Start Assessment" is a no-op in this scope.
- The button must be clickable and must not trigger any backend call or navigation.
- It must remain enabled while the modal is open and a selection is active (i.e., it does not enter a loading or disabled state on click).

## Open questions

- None at this stage. The icon choice (e.g., `AuditOutlined` vs `CheckSquareOutlined`) is deferred to implementation — any appropriate Ant Design icon is acceptable.
- The exact empty-state copy is deferred to implementation.
