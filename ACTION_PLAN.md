# Data Analysis Service — Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` (Data Analysis Service Specification v1.4).
2. No related frontend layout spec exists — the v1 feature has no UI surface (see SPEC § "Main user-facing surface specification" and § "No layout spec" decision).
3. Treat `SPEC.md` as the source of truth for product behaviour, contracts, data shapes, and scope boundaries. This action plan sequences delivery and testing only; it does not redefine material already settled in the spec.
4. Backend and frontend ship in a single release (atomic deployment). The transition-union shim from the v1.3 plan is not needed; both the backend `toPartialJSON()` extension and the frontend schema updates land together.

## Scope and assumptions

### Scope

- Backend: extend `AssignmentDefinition.toPartialJSON()` to include lightweight task-weighting summaries.
- Backend: update existing test for `toPartialJSON()` to reflect the new `tasks` shape. The pre-existing assertion at `tests/models/assignmentDefinition.test.js:171-175` will fail when the backend change lands and is fixed in the same section.
- Frontend: create `TaskPartialSchema` (renamed from `TaskWeightingSummarySchema`) as a shared helper in a new file `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`, with co-located spec.
- Frontend: update the existing `AssignmentDefinitionPartialSchema` in `assignmentDefinitionPartials.zod.ts` to import `TaskPartialSchema` and use `tasks: z.array(TaskPartialSchema)`. The current `.transform(() => null)` is removed.
- Frontend: update the existing `AssignmentDefinitionPartialSchema` in `classDetailService.zod.ts` to import `TaskPartialSchema` and use `tasks: z.array(TaskPartialSchema)`. The current `tasks: z.null()` is removed.
- Frontend: extend `dataAnalysis.zod.ts` with full schemas for filter, input, and result types. Imports `AssignmentDefinitionPartialsResponseSchema` and `IsoDateTimeWithTimezoneSchema` from `assignmentDefinitionPartials.zod.ts`; imports `TaskPartialSchema` from the new shared file.
- Frontend: implement `AveragingAnalyser` in `analysers/averagingAnalyser.ts`.
- Frontend: implement `DataAnalysisService` orchestrator in `dataAnalysisService.ts`.
- Co-located `.spec.ts` files for all new modules.
- Update `docs/developer/DATA_SHAPES.md`: add a "Partial Task (`TaskPartial`)" entry with planned status `Not implemented`; update the partial definition entry to reflect `tasks: Array<TaskPartial>`; remove the existing _"Partial definitions use `tasks: null` (not `undefined` or `{}`)"_ line. Reconcile to `Implemented` after delivery.
- Write teacher-facing algorithm documentation at `docs/pedagogy/data-analysis-scoring.md` explaining how the averaging algorithm computes scores (per SPEC § "Documentation and rollout notes").

### Out of scope

- The hook (`useDataAnalysis`) — deferred hook work stream.
- The page, navigation entry, and Ant Design adapter — deferred page work stream.
- Surfacing the teacher-facing algorithm documentation in the UI (info panel, help tooltip, linked help article) — deferred page work stream.
- Cohort / cross-class analysis — future analyser work stream.
- Trend / time-series / distribution analyses — future work streams.
- Persisted "scoring profile" (criterion weightings persistence) — future work stream.
- Any changes to `getABClass`, `getABClassPartials`, `getAssignmentDefinition`, or `getAssignment` endpoints.

### Assumptions

1. The existing `getABClass` endpoint (`ALLOWLISTED_METHOD_HANDLERS.getABClass`) returns the correct data shape for the analyser. No new backend endpoint is needed.
2. `assignment.createdAt` is already fully implemented and serialised as a required ISO 8601 string in both `toJSON()` and `toPartialJSON()`.
3. `assignmentWeighting` defaults to `1` in the `AssignmentDefinition` constructor; `taskWeighting` defaults to `1` in the `TaskDefinition` constructor. The analyser mirrors these defaults in its own constructor, per AGENTS §11 / frontend §11.
4. The `AveragingAnalyser` is pure and synchronous — no I/O, no time, no randomness.
5. The `classDetailService.zod.ts` `StudentSubmissionPartialSchema` flat-model bug is fixed in Section 2 and the duplicate `AssignmentDefinitionPartialSchema` is unified in Section 3, both now in v1 scope (see Status). The analyser imports `ClassFullSchema` from the corrected `classDetailService.zod.ts` and the canonical `AssignmentDefinitionPartialSchema` from `assignmentDefinitionPartials.zod.ts` — it does not define its own submission or assignment-definition shapes.
6. SPaG score `'N'` means "not applicable" — the analyser renormalises the overall metric rather than excluding the data point.
7. **Atomic deployment**: backend and frontend ship in a single release. There is no production window where the backend returns the new `tasks: Array<TaskPartial>` shape but the frontend still expects `tasks: null`. The two downstream partial Zod files (`assignmentDefinitionPartials.zod.ts` and `classDetailService.zod.ts`) are updated in the same release as the backend change. Tests that assert the old `tasks: null` shape will fail during the §1/§4 transition and are fixed in their respective sections — this is expected and is the signal that the schema update is correct.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- The analyser is pure — no `callApi`, no React Query, no Ant Design imports inside `services/dataAnalysis/`.
- Default values are set in the analyser constructor only (AGENTS §11 / frontend §11).
- Zod-first types: define the schema first, derive TypeScript types via `z.infer`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents:

Testing Specialist mandatory docs:

- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/SPEC.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/ACTION_PLAN.md`

Implementation mandatory docs:

- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/src/backend/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/src/frontend/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/SPEC.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/SPEC.md`

Docs mandatory docs:

- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/AGENTS.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/SPEC.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/ACTION_PLAN.md`
- `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/docs/developer/DATA_SHAPES.md`

### Shared-helper planning gate (mandatory when helper changes are expected)

`TaskPartialSchema` (in the new shared file `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`) is the single shared helper introduced in this delivery. It is the renamed `TaskWeightingSummarySchema` (now using the "Partial" naming convention from the rest of the repo, e.g. `AssignmentDefinitionPartialSchema`, `BaseTaskArtifactPartialSchema`, `StudentSubmissionPartialSchema`). See Section 4 for the initial creation; the same schema is then imported by `assignmentDefinitionPartials.zod.ts`, `classDetailService.zod.ts`, and `dataAnalysis.zod.ts`.

Before Section 4 begins, a planned-only entry for `TaskPartialSchema` must be added to `docs/developer/DATA_SHAPES.md` (per the shared-helper planning gate) with status `Not implemented` and the planned canonical home noted. After the §4/§5 sections land, the entry is reconciled to `Implemented` in the Documentation section.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend:check`
- Frontend lint: `npm run lint:frontend:check`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- All-lint check: `npm run lint:check`

---

## Section 1 — Backend: extend `AssignmentDefinition.toPartialJSON()` with task-weighting summaries

### Objective

- Change `AssignmentDefinition.toPartialJSON()` to emit `tasks: Array<{ id, taskWeighting }>` instead of `tasks: null`, so the analyser can look up `taskWeighting` per task without additional `getAssignmentDefinition` API calls.
- The frontend counterpart `TaskPartialSchema` (renamed from `TaskWeightingSummarySchema`) is the canonical Zod shape for this wire field. See Section 4 for its creation.

### Constraints

- The `tasks` field in the partial must contain **only** `id` and `taskWeighting` — no `taskTitle`, no `pageId`, no `taskNotes`, no `taskMetadata`, no `artifacts`. The partial stays intentionally lightweight (SPEC § "Backend changes required" §1).
- When `this.tasks` is `null`, `undefined`, or an empty object `{}`, the partial must emit `tasks: []` (empty array), not `tasks: null`. This ensures the frontend Zod schema can reliably expect an array.
- When `this.tasks` is a non-empty object (dictionary keyed by taskId), extract only `id` and `taskWeighting` from each `TaskDefinition` instance.
- Implementation note: `this.tasks` may be `null` (default for partial definitions), `undefined` (defensive), or `{}` (empty dictionary from `fromJSON`). Check with `!this.tasks || !Object.keys(this.tasks).length` to handle all three cases uniformly.
- This is a deliberate contract change. `docs/developer/DATA_SHAPES.md` currently states "Partial definitions use `tasks: null` (not `undefined` or `{}`)" and any production frontend code that relies on `tasks === null` to detect "no tasks" must be updated. The frontend changes that depend on this are scoped to §4 of this plan; production-code consumers that use the partial JSON are limited to the `getAssignmentDefinitionPartials` registry response (consumed by the new `TaskPartialSchema` in §4) and the embedded `assignmentDefinition` inside `getABClass` (also updated in §4). No other production code consumes the partial's `tasks` field.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

No shared-helper changes expected.

### Acceptance criteria

- `AssignmentDefinition.toPartialJSON()` returns `tasks` as `Array<{ id: string, taskWeighting: number }>` when the definition has tasks.
- `AssignmentDefinition.toPartialJSON()` returns `tasks: []` when the definition has no tasks (`null`, `undefined`, or empty `{}`).
- No extraneous task fields (`taskTitle`, `pageId`, `taskNotes`, `taskMetadata`, `artifacts`) appear in the partial.
- The existing `toJSON()` method is **not** modified.
- The pre-existing test at `tests/models/assignmentDefinition.test.js:171-175` (asserting `tasks: null`) is updated in the same section to reflect the new `tasks: []` shape for the no-tasks case. It is expected to fail when the backend change lands and is fixed here.

### Required test cases (Red first)

Backend model tests:

1. `toPartialJSON()` with a fully-populated definition including tasks → `tasks` is an array of `{ id, taskWeighting }` objects.
2. `toPartialJSON()` with a definition where `tasks` is `null` → `tasks` is `[]`.
3. `toPartialJSON()` with a definition where `tasks` is an empty object `{}` → `tasks` is `[]`.
4. `toPartialJSON()` with a definition where `tasks` is `undefined` → `tasks` is `[]` (handles the defensive case where `tasks` is not even set on the instance).
5. `toPartialJSON()` task entries contain only `id` and `taskWeighting` — no `taskTitle`, no `pageId`, no `artifacts`.
6. `toPartialJSON()` with a task that has `taskWeighting = 5` → the entry correctly reflects that weighting.
7. `toPartialJSON()` with a task that has the default `taskWeighting = 1` → the entry correctly reflects `1`.
8. **Updated pre-existing test** at `tests/models/assignmentDefinition.test.js:171-175` (currently `expect(partial.tasks).toBe(null)`) is rewritten to assert `expect(partial.tasks).toEqual([])` for the no-tasks case. **The test name is also updated** from `"should return tasks: null in toPartialJSON for partial definitions"` to `"should return tasks: [] in toPartialJSON for partial definitions"` to avoid a misleading assertion description after the change.

### Section checks

- `npm run test:backend -- tests/models/assignmentDefinition.test.js`
- `npm run lint:backend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `toPartialJSON()` explaining that `tasks` now carries lightweight weighting summaries instead of `null`, and that full task data is only available via `toJSON()` or `getAssignmentDefinition`. This prevents future developers from mistakenly expanding the partial. Reference SPEC § "Backend changes required" §1.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Changed `toPartialJSON()` to emit `tasks: Array<{ id, taskWeighting }>` instead of `tasks: null`. Uses `!this.tasks || Object.keys(this.tasks).length === 0` to detect empty/null/undefined tasks and emits `[]`. For non-empty tasks, maps each `TaskDefinition` to `{ id, taskWeighting }` via `Object.values(this.tasks).map(...)`.
  - Updated `_validate()` routing to treat empty arrays as partial-definition markers (routing to `_validatePartial()` instead of `_validateFull()`).
  - Updated constructor tasks assignment to normalise empty arrays to `null` for internal state consistency.
  - Updated `fromJSON()` to normalise array-format `tasks` from the wire back to `null` (lightweight `{id, taskWeighting}` summaries cannot be rehydrated to `TaskDefinition` instances).
  - Updated JSDoc on `toPartialJSON()` with `@remarks` documenting the change per SPEC § "Backend changes required" §1.
  - Updated 22 test assertions across 7 test files to reflect the new `tasks: Array<TaskPartial>` wire shape.
  - Added 7 new focused tests in `tests/models/assignmentDefinition.test.js` covering all edge cases.
- **Deviations from plan:** Extended test updates beyond the single listed file (`tests/models/assignmentDefinition.test.js`) to fix all 15 downstream test failures caused by the contract change (files: `assignmentDefinitionValidation.test.js`, `assignmentSerialisation.test.js`, `abclassController.readClass.test.js`, `abclassController.rehydrateAssignment.test.js`, `assignmentDefinitionController.test.js`, `assignmentDefinitionController.upsert.test.js`). These were all `tasks: null` → `tasks: []` assertion updates. The `_validate()` routing, constructor, and `fromJSON()` also required small changes to handle the new wire format correctly on deserialisation.
- **Follow-up implications for later sections:** Sections 2–4 depend on this backend change landing in the same release. The two downstream partial Zod files (`assignmentDefinitionPartials.zod.ts` and `classDetailService.zod.ts`) are updated in §4 to use the new `tasks: Array<TaskPartialSchema>` shape. No transition union is required (atomic deployment).

---

## Section 2 — Frontend: fix `StudentSubmissionPartialSchema` in `classDetailService.zod.ts` (flat-model bug)

### Objective

- Replace the pre-existing buggy flat `StudentSubmissionPartialSchema` in `classDetailService.zod.ts` with the correct nested-dictionary shape matching the backend wire (`StudentSubmission.toPartialJSON()` lines 330-336).
- The analyser then imports the corrected schema instead of defining its own.
- No production consumers of the buggy flat schema exist (verified via codebase search) — the change is scoped to schema and test-fixture updates.

### Constraints

- The current `StudentSubmissionPartialSchema` (lines 37-45) models a single `StudentSubmissionItem` — flat `{ id, taskId, artifact, assessments, feedback }`. This does not match the wire.
- The correct shape wraps items: `{ studentId, studentName, assignmentId, documentId, items: { [taskId]: StudentSubmissionItem.toPartialJSON() }, createdAt, updatedAt }`.
- Rename the old schema to `StudentSubmissionItemPartialSchema` and create a new `StudentSubmissionPartialSchema` with the nested structure.
- The `StudentSubmissionItemPartialSchema` keeps the existing fields (`id`, `taskId`, `artifact`, `assessments`, `feedback`) — these correctly model `StudentSubmissionItem.toPartialJSON()`.
- The new `StudentSubmissionPartialSchema` models the outer submission with the `items` dictionary.
- The `AssignmentPartialSchema.submissions` field (`z.array(StudentSubmissionPartialSchema)`) does **not** need its type changed — each array element is still a submission, but now with the correct nested structure.
- This change affects the `ClassFullResponseSchema` validation path — `getABClass` responses are validated through `ClassFullResponseSchema.parse()`.
- No production consumers rely on the buggy shape — only `classDetailService.ts` (which uses `ClassFull` type), `classDetailService.zod.spec.ts`, and `classDetailService.spec.ts`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/backend/Models/StudentSubmission.js` (lines 310-336, 100-126 — the wire-shape source of truth)
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

No new shared helpers. The corrected `StudentSubmissionPartialSchema` lives in `classDetailService.zod.ts` — its canonical home.

### Acceptance criteria

- `StudentSubmissionPartialSchema` models the nested `{ studentId, studentName, assignmentId, documentId, items: { [taskId]: ... }, createdAt, updatedAt }` shape.
- Former `StudentSubmissionPartialSchema` (the flat single-item shape) is renamed to `StudentSubmissionItemPartialSchema`.
- `StudentSubmissionItemPartialSchema` is exported (it is used by the new outer schema).
- The `AssignmentPartialSchema.submissions` field still uses `z.array(StudentSubmissionPartialSchema)` — no type change.
- `ClassFullResponseSchema.parse()` accepts the correct nested shape.
- `ClassFullResponseSchema.parse()` rejects the old flat shape (each submission element being a single item instead of a submission with `items`).
- All existing test suites pass after fixture updates.

### Required test cases (Red first)

1. `classDetailService.zod.spec.ts` — `StudentSubmissionPartialSchema`: valid nested submission (with `items: { [taskId]: submissionItem }`) parses.
2. `classDetailService.zod.spec.ts` — `StudentSubmissionPartialSchema`: missing `items` field fails.
3. `classDetailService.zod.spec.ts` — `StudentSubmissionPartialSchema`: old flat shape (`{ id, taskId, artifact, assessments, feedback }`) fails — the shape is now rejected.
4. `classDetailService.zod.spec.ts` — `StudentSubmissionItemPartialSchema` (renamed): existing valid single-item tests still pass.
5. `classDetailService.zod.spec.ts` — `ClassFullResponseSchema` (or `ClassFullSchema`): valid `validClassFull` fixture with the correct nested submission structure parses.
6. `classDetailService.spec.ts` — update `validClassFull` fixture to use the correct nested submission structure in its `submissions` array. Corrected structure per `StudentSubmission.toPartialJSON()` (lines 330-336): `{ studentId, studentName, assignmentId, documentId, items: { [taskId]: { id, taskId, artifact, assessments, feedback } }, createdAt, updatedAt }`.
7. `classDetailService.zod.spec.ts` — `AssignmentPartialSchema`: `submissions` field as `z.array(StudentSubmissionPartialSchema)` succeeds with the new shape.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the new `StudentSubmissionPartialSchema` documenting it is the canonical nested-dictionary shape matching `StudentSubmission.toPartialJSON()` wire output. Reference the backend file and lines.
- Add `@remarks` to the old-now-renamed `StudentSubmissionItemPartialSchema` explaining it models a single `StudentSubmissionItem.toPartialJSON()` entry inside the parent's `items` dictionary.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Renamed `StudentSubmissionPartialSchema` → `StudentSubmissionItemPartialSchema` (lines 44-52), exported with matching `StudentSubmissionItemPartial` type. Added `@remarks` JSDocs referencing backend wire source of truth (`StudentSubmissionItem.toPartialJSON()` lines 121-126).
  - Created new `StudentSubmissionPartialSchema` (lines 61-69) with correct nested-dictionary shape: `{ studentId: z.string(), studentName: z.string().nullable(), assignmentId: z.string(), documentId: z.string().nullable(), items: z.record(z.string(), StudentSubmissionItemPartialSchema), createdAt: z.string(), updatedAt: z.string() }`. Added `@remarks` JSDoc referencing `StudentSubmission.toPartialJSON()` lines 330-336.
  - `AssignmentPartialSchema.submissions` field remained `z.array(StudentSubmissionPartialSchema)` — no type parameter change needed, only element shape changed.
  - Updated `classDetailService.zod.spec.ts`: renamed fixtures (`validStudentSubmissionPartial` → `validStudentSubmissionItemPartial`, new `validStudentSubmissionPartial` with nested structure), renamed describe block, added 5 new tests for `StudentSubmissionPartialSchema`, updated `AssignmentPartialSchema` test to access nested `items` dictionary path. 42 tests pass.
  - Updated `classDetailService.spec.ts`: replaced flat `validSubmissionPartial` fixture with nested submission wrapper. 5 tests pass.
  - Zero production consumers of the buggy flat shape were found — only the two spec files above consumed the shape.
- **Deviations from plan:** none.
- **Follow-up implications for later sections:** Section 5 (`dataAnalysis.zod.ts`) no longer defines its own `StudentSubmissionPartialSchema` — it imports the corrected version from `classDetailService.zod.ts`.

---

## Section 3 — Frontend: unify `AssignmentDefinitionPartialSchema` (remove duplicate, make nullable)

### Objective

- Remove the duplicate lenient `AssignmentDefinitionPartialSchema` from `classDetailService.zod.ts`. The single canonical schema in `assignmentDefinitionPartials.zod.ts` becomes the sole source of truth.
- Make `referenceDocumentId` and `templateDocumentId` `.nullable()` in the canonical schema to match the backend wire — `AssignmentDefinition.toPartialJSON()` passes through instance values which can be null (the test suite at `classDetailService.zod.spec.ts` line 330 documents that `getABClass` can return null for these fields).
- Update the two affected feature consumers to handle `string | null`.

### Constraints

- The canonical `AssignmentDefinitionPartialSchema` in `assignmentDefinitionPartials.zod.ts` currently has `referenceDocumentId: z.string()` and `templateDocumentId: z.string()` — non-nullable. The backend can emit null for these, so the schema is made `.nullable()` to match reality.
- The duplicate schema in `classDetailService.zod.ts` (lines 47-69) is **removed entirely** — including its `AssignmentDefinitionPartial` type export. The file instead imports `AssignmentDefinitionPartialSchema` and `AssignmentDefinitionPartial` type from `assignmentDefinitionPartials.zod.ts`.
- Import path from `classDetailService.zod.ts` to `assignmentDefinitionPartials.zod.ts`: `import { AssignmentDefinitionPartialSchema, type AssignmentDefinitionPartial } from '../../assignmentDefinition/assignmentDefinitionPartials.zod'`.
- The two affected feature consumers:
  - `getLinkableDefinitionsForModal.ts`: `LinkableDefinition.referenceDocumentId` and `templateDocumentId` change from `string` to `string | null`. The mapper at lines 126-127 passes through as-is. The `LinkableDefinitionList` component does **not** consume these fields — only `definitionKey`, `primaryTitle`, `primaryTopic`, and `yearGroupLabel` are rendered.
  - `matchDefinitionForAssignment.ts`: does **not** access `referenceDocumentId` or `templateDocumentId`. No changes needed.
  - `useAssignmentDefinitionWizard.ts`: uses `as string` casts on these fields (lines 96-97) — already defensive. No functional change needed; type assertion is now `string | null as string` which is a no-op cast.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

No new shared helpers. The canonical `AssignmentDefinitionPartialSchema` is already shared via its existing file.

### Acceptance criteria

- `referenceDocumentId` and `templateDocumentId` in the canonical schema are `z.string().nullable()`.
- The duplicate `AssignmentDefinitionPartialSchema` definition is removed from `classDetailService.zod.ts`. The file imports the canonical schema instead.
- `classDetailService.zod.ts` has exactly one `AssignmentDefinitionPartialSchema` re-export (the canonical import).
- `getLinkableDefinitionsForModal.ts` `LinkableDefinition` type has `referenceDocumentId: string | null` and `templateDocumentId: string | null`.
- `getLinkableDefinitionsForModal.ts` mapper passes through nullable values as-is.
- `matchDefinitionForAssignment.ts` compiles without changes (does not access these fields).
- `assignmentDefinitionPartialsService.ts` (response validation via `AssignmentDefinitionPartialsResponseSchema`) still parses successfully after the nullability change.
- All existing test suites pass after fixture updates.

### Required test cases (Red first)

1. `assignmentDefinitionPartials.zod.spec.ts` — `AssignmentDefinitionPartialSchema`: a partial with `referenceDocumentId: null` parses successfully (previously rejected).
2. `assignmentDefinitionPartials.zod.spec.ts` — `AssignmentDefinitionPartialSchema`: a partial with `templateDocumentId: null` parses successfully.
3. `assignmentDefinitionPartials.zod.spec.ts` — `AssignmentDefinitionPartialSchema`: a partial with both doc IDs as non-null strings still parses successfully.
4. `classDetailService.zod.spec.ts` — `AssignmentPartialSchema.assignmentDefinition` (now importing canonical): a full `getABClass` response with `assignmentDefinition.referenceDocumentId: null` parses (regression test matching line 330 comment).
5. `classDetailService.zod.spec.ts` — `AssignmentDefinitionPartialSchema` (imported canonical): verify the import resolves to the same schema (identical identity check via parse round-trip).
6. `getLinkableDefinitionsForModal.spec.ts` — `LinkableDefinition` mapper: a partial with `referenceDocumentId: null` produces `referenceDocumentId: null` in the output (was previously a compile error).
7. `assignmentDefinitionPartialsService.spec.ts` — `getAssignmentDefinitionPartials` response with nullable doc IDs parses through `AssignmentDefinitionPartialsResponseSchema`.
8. `matchDefinitionForAssignment.spec.ts` — compiles and passes unchanged (no reference to doc IDs).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.spec.ts`
- `npm run test:frontend -- src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the canonical `AssignmentDefinitionPartialSchema` noting that `referenceDocumentId` and `templateDocumentId` are nullable because the backend wire (`AssignmentDefinition.toPartialJSON()`) passes through instance values that can be null for partial definitions.
- Add `@remarks` at the canonical import site in `classDetailService.zod.ts` documenting the unification — this was previously a duplicate lenient copy; the canonical schema is the single source of truth.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Changed `referenceDocumentId: z.string()` → `z.string().nullable()` and `templateDocumentId: z.string()` → `z.string().nullable()` in the canonical `AssignmentDefinitionPartialSchema` (`assignmentDefinitionPartials.zod.ts`). Added JSDoc `@remarks` explaining these fields are nullable because `AssignmentDefinition.toPartialJSON()` passes through instance values that can be null for partial definitions.
  - Removed the duplicate `AssignmentDefinitionPartialSchema` definition (formerly lines 73-95) and its `AssignmentDefinitionPartial` type from `classDetailService.zod.ts`. Added import of the canonical schema from `../../assignmentDefinition/assignmentDefinitionPartials.zod`. Added `@remarks` JSDoc documenting the unification.
  - Updated `LinkableDefinition` type in `getLinkableDefinitionsForModal.ts`: `referenceDocumentId` and `templateDocumentId` changed from `string` to `string | null`. No runtime change — the mapper passes values through as-is.
  - Updated `classDetailService.zod.spec.ts`: import `AssignmentDefinitionPartialSchema` from canonical location; updated `'rejects a definition with tasks not null'` test to `'accepts tasks as empty array'` to match canonical schema behaviour (Section 4-compatible). 43 tests pass.
  - Updated `assignmentDefinitionPartials.zod.spec.ts`: fixture types updated for nullable doc IDs. 51 tests pass.
  - All 5 test suites pass (135 tests); broader suite 255 tests pass (13 files); lint zero warnings.
  - `matchDefinitionForAssignment.ts` — no changes needed (does not access doc ID fields). 19 tests pass unchanged.
- **Deviations from plan:** the `useAssignmentDefinitionWizard.ts` `as string` casts on lines 96-97 are already defensive and don't need changing — they now cast `string | null` to `string` which is a no-op warning (TypeScript allows it but it's technically unsafe; the component already falls back gracefully downstream).
- **Follow-up implications for later sections:** Section 4 updates the canonical schema's `tasks` field with `z.array(TaskPartialSchema)`. The canonical schema is now the single source of truth for the entire partial-definition wire shape.

---

## Section 4 — Frontend: create shared `TaskPartialSchema` and update existing Zod schemas

### Objective

- Create the new shared file `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` with the `TaskPartialSchema` helper (the single schema the updated existing partial schemas and the new analyser schemas consume). Co-located `taskPartial.zod.spec.ts` per AGENTS §7 / frontend §7.
- Update the canonical `AssignmentDefinitionPartialSchema` in `assignmentDefinitionPartials.zod.ts` (already the single source of truth after Section 3) to import `TaskPartialSchema` and use `tasks: z.array(TaskPartialSchema)`. The current `.transform(() => null)` is removed.
- Update `classDetailService.zod.ts` to import `TaskPartialSchema` and use it on the canonical `AssignmentDefinitionPartialSchema`'s `tasks` field. Since `classDetailService.zod.ts` now imports the canonical schema (Section 3), this means the canonical schema's `tasks` field changes to `z.array(TaskPartialSchema)` and both import sites see the change.

### Constraints

- The new file `taskPartial.zod.ts` lives in `src/frontend/src/services/assignmentDefinition/` (sibling of `assignmentDefinitionPartials.zod.ts`), not inside `services/dataAnalysis/`. This keeps the `assignmentDefinition/` domain folder authoritative for the partial wire shape and avoids inverting the data-load layering.
- `TaskPartialSchema` is exported from the new file as a `.strict()` Zod object with `id: z.string().min(1)` and `taskWeighting: z.number()`. The `id` field uses `.min(1)` to enforce the wire invariant that `TaskDefinition._deriveId` always produces a non-empty `t_`-prefixed hash. No range constraint is applied to `taskWeighting` at the wire-schema level — range enforcement is the analyser's job, matching the existing `assignmentDefinition.zod.ts` convention. The inferred `TaskPartial` type is also exported.
- `assignmentDefinitionPartials.zod.ts` imports `TaskPartialSchema` from `./taskPartial.zod` and replaces the current `AssignmentDefinitionPartialTasksSchema` (which transforms everything to `null`) with `z.array(TaskPartialSchema)`. The `.optional()` modifier is removed — the field is always present (the backend always emits an array, even if empty).
- `classDetailService.zod.ts` imports `TaskPartialSchema` from `../../assignmentDefinition/taskPartial.zod` so the canonical `AssignmentDefinitionPartialSchema`'s `tasks` field resolves correctly. The `classDetailService.zod.ts` file no longer defines its own `AssignmentDefinitionPartialSchema` (unified in Section 3); only the `tasks` field import is needed here.
- No transition union is required (atomic deployment). The canonical schema accepts the post-extension shape directly; both import sites see the change.
- The `StudentSubmissionPartialSchema` bug is already fixed (Section 2). The two `AssignmentDefinitionPartialSchema` definitions are already unified (Section 3). These constraints were previously recorded as "not for v1" — they are now in scope and implemented before this section.
- Type widening: code that previously did `if (tasks === null)` to detect "no tasks" must be updated to `if (!tasks || tasks.length === 0)`. Code that does `if (tasks)` continues to work because `[]` is truthy and `[].forEach(...)` is a no-op. A grep for `tasks === null` and `tasks: null` in production frontend code (`src/frontend/src/features/...`, not just tests) is a **required section check** (see Section checks below) to verify no production consumers rely on the old `null` sentinel.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

Helper decision entries:

1. Helper: `TaskPartialSchema` (Zod schema for `{ id: string, taskWeighting: number }`)
   - Decision: `new` — created in the new `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` as the primary/canonical source, imported by other schemas.
   - Owning module/path: `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`
   - Call-site rationale: Used by `assignmentDefinitionPartials.zod.ts` (registry partials list), `classDetailService.zod.ts` (embedded `AssignmentDefinition` inside ABClass), and the analyser input schemas in `dataAnalysis.zod.ts` (Section 5). Extracting to a shared file in the `assignmentDefinition/` domain folder avoids inverting the data-load layering that would result from defining it inside `services/dataAnalysis/`.
   - Relevant canonical doc target: `docs/developer/DATA_SHAPES.md`
   - Planned doc status: `Not implemented` (must be added to `DATA_SHAPES.md` before §4 begins, per the shared-helper planning gate)

### Acceptance criteria

- `taskPartial.zod.ts` exports `TaskPartialSchema` and `TaskPartial` type.
- `assignmentDefinitionPartials.zod.ts` `AssignmentDefinitionPartialSchema.tasks` is `z.array(TaskPartialSchema)` (not a transform-to-null union, not a z.null literal, not an optional field).
- `classDetailService.zod.ts` `AssignmentDefinitionPartialSchema.tasks` is `z.array(TaskPartialSchema)` (not `z.null()`, not a union).
- `taskPartial.zod.spec.ts` covers the happy path, strict-mode rejection, and field-missing rejection.
- Frontend compiles without type errors (`npm run lint:frontend:check`).
- All existing frontend test suites pass after the in-scope test updates below.

### Required test cases (Red first)

Frontend tests (new file):

1. `taskPartial.zod.spec.ts` — `TaskPartialSchema`: valid `{ id: 't_abc123', taskWeighting: 2 }` parses.
2. `taskPartial.zod.spec.ts` — `TaskPartialSchema`: extra fields fail (strict).
3. `taskPartial.zod.spec.ts` — `TaskPartialSchema`: missing fields fail.
4. `taskPartial.zod.spec.ts` — `TaskPartialSchema`: non-numeric `taskWeighting` fails.
5. `taskPartial.zod.spec.ts` — `TaskPartialSchema`: empty string `id` fails (the schema uses `z.string().min(1)` to enforce the wire invariant that `TaskDefinition._deriveId` always produces a `t_`-prefixed non-empty hash).

Frontend tests (updated existing files):

6. `assignmentDefinitionPartials.zod.spec.ts` — a valid partial with `tasks: [{ id: 't_abc123', taskWeighting: 2 }]` parses successfully.
7. `assignmentDefinitionPartials.zod.spec.ts` — a partial with `tasks: []` parses successfully.
8. `assignmentDefinitionPartials.zod.spec.ts` — a partial with `tasks: null` **fails** (no longer accepted — the schema is the strict `z.array(TaskPartialSchema)`, not a union).
9. `assignmentDefinitionPartials.zod.spec.ts` — a partial with `tasks: [{ id: 't_abc123', taskWeighting: 2, taskTitle: 'Extra' }]` fails (strict inner schema, no extra fields).
10. `assignmentDefinitionPartials.zod.spec.ts` — the existing `'tasks field backend-shape compatibility'` describe block (lines 399–465) is updated: replace the first `it.each` (normalisation cases) with new cases for `tasks: []` parsing to `[]` and `tasks: [{ id, taskWeighting }]` parsing to itself; remove the `'task-map object'` and `'undefined'` cases (no longer applicable); keep the `'rejects unsupported tasks type'` describe block unchanged.
11. `classDetailService.zod.spec.ts` — the existing `AssignmentDefinitionPartialSchema` describe block is updated: `tasks: null` now fails; `tasks: []` parses successfully; `tasks: [{ id, taskWeighting }]` parses successfully; the existing `'rejects a definition with tasks not null'` test (line 324–328) is removed (it asserted `tasks: []` throws, which is no longer true).
12. `assignmentDefinitionPartialsContract.guard.spec.ts` — the second test (`'accepts backend-compatible non-null tasks payloads and collapses them to null in the list-surface DTO'`, lines 33–60) is **deleted** in this section. The whole test encoded the old `tasks → null` collapsing contract which is being removed. A short `@remarks` is added to the file explaining the deletion (this file no longer enforces the collapsing contract; the post-extension partial carries real `TaskPartial[]` data and is validated by `assignmentDefinitionPartials.zod.spec.ts` instead).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/taskPartial.zod.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- The `DATA_SHAPES.md` planned-only entry for `TaskPartialSchema` (status `Not implemented`) is in place before this section begins implementation.
- **Prerequisite**: `docs/developer/DATA_SHAPES.md` must already contain the planned-only `TaskPartialSchema` entry (status `Not implemented`, canonical home `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`) before this section starts implementation. Verify with: `grep -q 'TaskPartial' docs/developer/DATA_SHAPES.md && grep -q 'Not implemented' docs/developer/DATA_SHAPES.md || (echo "Missing planned TaskPartial entry" && exit 1)`.
- Verify no production frontend code (outside test files) references `tasks === null` or `tasks: null` on `AssignmentDefinitionPartial` — run `grep -r 'tasks === null\|tasks: null' src/frontend/src/features/ src/frontend/src/services/assignmentDefinition/ src/frontend/src/services/googleClassrooms/` and confirm zero hits outside the two schemas being explicitly updated in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `TaskPartialSchema` explaining it is the canonical source for the lightweight task-weighting shape emitted by the extended `AssignmentDefinition.toPartialJSON()`, that the full task schema is in `assignmentDefinition.zod.ts` (`AssignmentDefinitionTaskSchema`), and that range enforcement on `taskWeighting` is the analyser's job (the wire schema only enforces shape, matching the existing `assignmentDefinition.zod.ts` convention). Note that `id` uses `.min(1)` because `TaskDefinition._deriveId` always produces a `t_`-prefixed non-empty hash.
- Add `@remarks` to the updated `tasks` field in the canonical `AssignmentDefinitionPartialSchema` explaining why the new `Array<TaskPartial>` shape is used (atomic deployment — no transition union required).

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Created `taskPartial.zod.ts` with `TaskPartialSchema` (`.strictObject({ id: z.string().min(1), taskWeighting: z.number() })`) and inferred `TaskPartial` type. Added `@remarks` JSDoc per plan.
  - Replaced `AssignmentDefinitionPartialTasksSchema` transform-to-null union in `assignmentDefinitionPartials.zod.ts` with `z.array(TaskPartialSchema)`. Removed the now-unused helper schema. Added `@remarks` explaining atomic deployment rationale.
  - Updated 9 test files where `tasks: null` fixtures/assertions changed to `tasks: []` or `tasks: [{ id, taskWeighting }]`: `assignmentDefinitionPartials.zod.spec.ts`, `assignmentDefinitionPartialsContract.guard.spec.ts`, `assignmentDefinitionPartialsService.spec.ts`, `classDetailService.zod.spec.ts`, `classDetailService.spec.ts`, `getLinkableDefinitionsForModal.spec.ts`, `AppAuthGate.auth.spec.tsx`, `matchDefinitionForAssignment.test-utilities.ts`.
  - Verified zero production code references to `tasks === null` or `tasks: null` outside test files per plan requirement.
  - Full frontend suite: 99 files, 1126 tests passed. Lint: zero warnings.
- **Deviations from plan:** none.
- **Follow-up implications for later sections:** Section 5 imports `TaskPartialSchema` from the new `taskPartial.zod.ts` file, plus `AssignmentDefinitionPartialsResponseSchema` and `IsoDateTimeWithTimezoneSchema` from the existing `assignmentDefinitionPartials.zod.ts`. No follow-up commit is required to remove a transition `z.null()` branch (none was added).

---

## Section 5 — Frontend: create `dataAnalysis.zod.ts` with analysis schemas

### Objective

- Create the new file `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` with the analysis-specific schemas: `AnalysisFilterSchema`, `AveragingAnalyserInputSchema`, `MetricResultSchema`, `PerStudentRowSchema`, `PerTaskRowSchema`, `PerClassResultSchema`, `AppliedCriterionWeightingsSchema`, `AveragingResultSchema`, `DataAnalysisResponseSchema`.
- The analyser no longer defines its own ABClass/submission/item schemas — the `StudentSubmissionPartialSchema` and `StudentSubmissionItemPartialSchema` are imported from the corrected `classDetailService.zod.ts` (Section 2); the `AssignmentDefinitionPartialSchema` is imported from the canonical `assignmentDefinitionPartials.zod.ts` (Section 3); the `TaskPartialSchema` is imported from the new shared `taskPartial.zod.ts` (Section 4).
- The analyser's `assignmentDefinitionPartials` field reuses the existing `AssignmentDefinitionPartialsResponseSchema` from `assignmentDefinitionPartials.zod.ts` (post-extension). The `classes` field reuses `ClassFullSchema` from `classDetailService.zod.ts` (post-correction). The analyser's `dateRange` field reuses `IsoDateTimeWithTimezoneSchema` from `assignmentDefinitionPartials.zod.ts`.

### Constraints

- File location: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (new file in this section, created fresh — Section 4 created the shared `TaskPartialSchema` in a different file).
- Zod-first: types derived via `z.infer<typeof ...Schema>`. No hand-written TypeScript interfaces that duplicate the Zod shapes.
- `.strict()` on all object schemas (per `src/frontend/AGENTS.md` §8).
- `AnalysisFilterSchema.classIds` must be a non-empty array of non-empty strings.
- `AnalysisFilterSchema.dateRange` uses the imported `IsoDateTimeWithTimezoneSchema` (the same strict `YYYY-MM-DDTHH:mm:ss.SSSZ|±HH:MM` pattern the rest of the data-load layer uses) with a `from <= to` refinement. This is consistent with the rule that `google.script.run` does not allow `Date` objects in payloads, so all dates on the wire are ISO 8601 strings. Import path: `'../assignmentDefinition/assignmentDefinitionPartials.zod'`.
- `AnalysisFilterSchema.criterionWeightings` must be a non-negative finite triple summing to `1.0` within float-drift tolerance (`1e-9`).
- Export all schemas and their inferred types.
- `AveragingAnalyserInputSchema.assignmentDefinitionPartials` reuses `AssignmentDefinitionPartialsResponseSchema` (an `z.array(AssignmentDefinitionPartialSchema)`) from `assignmentDefinitionPartials.zod.ts`. Import path: `'../assignmentDefinition/assignmentDefinitionPartials.zod'`. There is no `AssignmentDefinitionPartialExtendedSchema` — the user explicitly rejected that approach to keep complexity low.
- `AssignmentPartialSchema.assignmentDefinition` reuses the strict canonical `AssignmentDefinitionPartialSchema` from `assignmentDefinitionPartials.zod.ts`. After Section 3's unification, there is only one `AssignmentDefinitionPartialSchema` — the canonical one.
- The `StudentSubmissionItemPartialSchema` and `StudentSubmissionPartialSchema` are **imported from the corrected `classDetailService.zod.ts`** (Section 2), not defined locally. The analyser no longer needs its own copies of these shapes.
- The `classes` field on `AveragingAnalyserInputSchema` validates against the imported `ClassFullSchema` from `classDetailService.zod.ts` (post-correction in Section 2). The analyser does not define its own class or submission shapes.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` (from Section 4)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` (existing, updated in Section 4)

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

`TaskPartialSchema` was created in Section 4 in the new shared file `taskPartial.zod.ts`. No additional shared helpers needed in this section.

### Acceptance criteria

- `dataAnalysis.zod.ts` exports all required schemas and types per `SPEC.md` § "Recommended data shapes".
- `.strict()` is applied to all object schemas.
- Schemas correctly validate valid inputs and reject invalid ones per `SPEC.md` § "Validation recommendation".
- The `dateRange` validation enforces the same strict ISO-with-timezone pattern the rest of the data-load layer uses (consistent with the rule that `google.script.run` does not allow `Date` objects in payloads).
- The `AveragingAnalyserInputSchema.assignmentDefinitionPartials` field is the imported `AssignmentDefinitionPartialsResponseSchema` (no local redefinition).
- The `AssignmentPartialSchema.assignmentDefinition` field is the imported `AssignmentDefinitionPartialSchema` (no local redefinition).
- Frontend compiles without type errors.

### Required test cases (Red first)

Frontend tests (`dataAnalysis.zod.spec.ts` — new file in this section):

1. `AnalysisFilterSchema` — valid minimal input (`{ classIds: ['c1'] }`) parses.
2. `AnalysisFilterSchema` — valid full input with all optional fields parses.
3. `AnalysisFilterSchema` — empty `classIds` array fails.
4. `AnalysisFilterSchema` — `dateRange.from > to` fails refinement.
5. `AnalysisFilterSchema` — `criterionWeightings` not summing to 1.0 fails refinement.
6. `AnalysisFilterSchema` — `criterionWeightings` with negative values fails.
7. `AnalysisFilterSchema` — extra fields fail (strict mode).
8. `AnalysisFilterSchema` — `dateRange` with a non-strict ISO timestamp (e.g. `2026-01-05T10:00:00Z`, missing milliseconds) fails the imported `IsoDateTimeWithTimezoneSchema`. Documents the strictness consistency with the data-load layer.
9. `AveragingAnalyserInputSchema` — valid input with minimal valid `ClassFullSchema`, one imported `AssignmentDefinitionPartialSchema`, and `AnalysisFilterSchema` parses.
10. `AveragingAnalyserInputSchema` — missing required field fails.
11. `MetricResultSchema` — `value: null` with `applicableDataPoints > 0` fails (invariant: null iff 0 applicable data points).
12. `MetricResultSchema` — `value: null` with `applicableDataPoints = 0` parses.
13. `StudentSubmissionItemPartialSchema.assessments` (validation of the partial-assessment value: `{ score }` — an integer 0–5 inclusive or `'N'`) — valid scores parse.
14. `StudentSubmissionItemPartialSchema.assessments` — invalid scores (`6`, `-1`, `3.5`) fail (range and integer check).
15. `StudentSubmissionPartialSchema` — `items` as record/dictionary (`{ [taskId]: { id, taskId, artifact, assessments, feedback } }`) parses.
16. `StudentSubmissionPartialSchema` — `items` as flat array is rejected (this is the pre-existing bug shape in `classDetailService.zod.ts`; must not parse here).
17. `AveragingResultSchema` — valid full result parses.
18. `DataAnalysisResponseSchema` — array of `AveragingResultSchema` parses.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the `StudentSubmissionPartialSchema` import site noting that this was previously a buggy flat shape defined locally; the corrected nested-dictionary schema is now the canonical source in `classDetailService.zod.ts` (reconciled in Section 2).
- Add `@remarks` to `AssignmentPartialSchema.assignmentDefinition` noting it reuses the single canonical `AssignmentDefinitionPartialSchema` from `assignmentDefinitionPartials.zod.ts` (unified in Section 3).
- Add `@remarks` to `AnalysisFilterSchema.dateRange` noting the strict ISO-with-timezone validation matches the data-load layer, justified by the `google.script.run` prohibition on `Date` objects in payloads.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Sections 6 and 7 import types and schemas from this file. No deferred reconciliation is needed — the `StudentSubmissionPartialSchema` divergence is resolved (Section 2) and the `AssignmentDefinitionPartialSchema` is unified (Section 3).

---

## Section 6 — Frontend: `AveragingAnalyser` (pure analysis logic)

### Objective

- Implement the `AveragingAnalyser` in `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts` — a pure, synchronous class that computes weighted averages per student, per task, and per class given an `AveragingAnalyserInput`.

### Constraints

- The analyser is pure and synchronous — no I/O, no `callApi`, no React Query, no Ant Design imports.
- Constructor takes `criterionWeightings` with default `{ completeness: 0.4, accuracy: 0.4, spag: 0.2 }` (AGENTS §11 — defaults in constructor only).
- `analyse(input: AveragingAnalyserInput): AveragingResult[]` — single public method.
- Weight per data point: `assignmentWeighting × taskWeighting`.
- `assignmentWeighting` from `assignment.assignmentDefinition.assignmentWeighting`, defaulting to `1` if `null`. Note: `TaskDefinition` constructor uses a second positional parameter for `taskWeighting = 1` (not part of the destructured object); the analyser mirrors this default internally.
- `taskWeighting` resolved by cross-referencing `assignmentDefinitionPartials` by `definitionKey` → `tasks[].id` → `taskWeighting`. Default `1` if no match.
- SPaG `'N'` → data point does not contribute to SPaG metric; overall renormalises.
- `MetricResult.value === null` iff `applicableDataPoints === 0`.
- `perStudent` sorted by `studentName` asc, then `studentId` asc (deterministic for testing).
- `perTask` sorted by `(definitionKey, taskId)` asc.
- `AveragingResult[]` sorted by `classId` asc.
- `appliedCriterionWeightings` echoes actual weights used.
- `taskTitle` resolved from `assignmentDefinitionPartials[].tasks[].id === taskId`; `null` if not found.
- Throws a typed error if `assignment.assignmentDefinition` is missing/null (defensive invariant per SPEC § "Blocking failure").
- Does not produce partial results — either succeeds or throws.
- The analyser trusts its input is already Zod-validated by the orchestrator. It does not re-validate `criterionWeightings` internally (the orchestrator validates via `AnalysisFilterSchema` before dispatching).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (from Section 5)

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

No shared helpers beyond the analyser class itself.

### Acceptance criteria

- All test cases in "Required test cases" pass.
- The analyser produces correct weighted averages for all specified scenarios.
- Defines `const DEFAULT_CRITERION_WEIGHTINGS` in the constructor only.
- No `callApi` import, no Ant Design import, no React import.

### Required test cases (Red first)

Frontend tests (`averagingAnalyser.spec.ts`):

1. **Empty input** → empty `AveragingResult[]`.
2. **Single class, single assignment, single student, single task** → exact expected averages.
3. **Multiple students / tasks / assignments with non-trivial weights** → exact expected weighted means (use small integer weights and scores for exact arithmetic).
4. **`criterionWeightings` parameter override** → uses override, not default.
5. **SPaG `'N'` for a formulae task** → renormalised overall, `applicableDataPoints < totalDataPoints` for SPaG, overall metric reflects renormalisation.
6. **Date range filter** excludes assignments with `createdAt` outside `[from, to)`.
7. **Topic filter** excludes assignments where `assignmentDefinition.primaryTopicKey` is not in `topicKeys`.
8. **Assignment definition-key filter** excludes assignments where `assignmentDefinition.definitionKey` is not in `assignmentDefinitionKeys`.
9. **Task weighting resolution** from pre-fetched `AssignmentDefinitionPartial[]` cross-reference → correct `taskWeighting` applied.
10. **Task weighting fallback** → `taskWeighting = 1` when no matching partial/task entry is found.
11. **`assignmentWeighting = null`** → defaults to `1`.
12. **Missing `assignmentDefinition`** → typed error with `classId` / `assignmentId`.
13. **`appliedCriterionWeightings`** echoes default when no override and echoes override when supplied.
14. **`taskTitle`** is always `null` in v1 (the post-extension `AssignmentDefinitionPartial` only carries `{ id, taskWeighting }` per task — there is no `taskTitle` on the wire; see SPEC § "Core view model — perTask rows"). The resolution path is reserved for a future cross-reference enhancement; this test asserts the v1 null behaviour.
15. **`perStudent` sort order** → `studentName` asc, `studentId` asc tie-break.
16. **`perTask` sort order** → `(definitionKey, taskId)` asc.
17. **`AveragingResult[]` sort order** → `classId` asc.
18. **Student with no qualifying submissions** (all outside date filter) → excluded from `perStudent`; `perClass` metrics present with `value: null` and `applicableDataPoints: 0`.
19. **All criteria `'N'` for a data point** → `overall` for that data point is `null` (defensive — should not happen in practice per SPEC).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the `analyse` method explaining:
  - The task-weighting cross-reference strategy (avoids N+1 `getAssignmentDefinition` calls).
  - SPaG `'N'` renormalisation behaviour.
  - Deterministic sort rules for testability.
  - The analyser trusts input is already Zod-validated by the orchestrator.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 7 imports and dispatches to this analyser.

---

## Section 7 — Frontend: `DataAnalysisService` orchestrator

### Objective

- Implement the `DataAnalysisService` orchestrator in `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts` — a thin, stateless module that validates the input via Zod, dispatches to registered analysers, and returns their typed results.

### Constraints

- The orchestrator has no state.
- Public API: `analyse(input: AveragingAnalyserInput): DataAnalysisResponse` — validates input via Zod, dispatches to `AveragingAnalyser`, returns results.
- Analyser registry: a simple mechanism (e.g. `Map<string, Analyser>` or a plain object) that allows future analysers to be registered under a key. The v1 key is `'averaging'`.
- If an unrecognised analyser key is requested, the orchestrator throws a typed error.
- Zod validation failure is rethrown as the raw `ZodError` (SPEC § "Blocking failure").
- The orchestrator does **not** import `callApi`, React Query, or Ant Design.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `SPEC.md`

### Shared helper plan

No shared helpers beyond the orchestrator class.

### Acceptance criteria

- The orchestrator validates the input via `AveragingAnalyserInputSchema.parse()` and rethrows `ZodError` on failure.
- The orchestrator dispatches to the registered `AveragingAnalyser` and returns `DataAnalysisResponse`.
- An unregistered analyser key throws a typed error.
- The orchestrator is pure — no I/O, no state beyond the registry.

### Required test cases (Red first)

Frontend tests (`dataAnalysisService.spec.ts`):

1. **Valid input** → dispatches to `AveragingAnalyser` and returns results.
2. **Invalid filter (empty `classIds`)** → `ZodError` thrown.
3. **Invalid filter (`dateRange.from > to`)** → `ZodError` thrown.
4. **Invalid filter (`criterionWeightings` not summing to 1)** → `ZodError` thrown.
5. **Unregistered analyser key** → typed error thrown.
6. **Multiple class IDs** → returns `AveragingResult[]` with one entry per class (proxy through to analyser — orchestrator delegates but validates first).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to the `DataAnalysisService` class explaining the orchestrator + pluggable analyser pattern and how to register new analysers.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications:** None — this is the final code-delivery section.

---

## Regression and contract hardening

### Objective

- Run all touched and related test suites to confirm no regressions and that the full feature contract (backend + frontend) is consistent.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- All backend tests pass (including the updated `assignmentDefinition.test.js`).
- All frontend tests pass (including all new `.spec.ts` files and existing spec files for updated schemas).
- All lint checks pass with zero warnings.

### Required test cases/checks

1. Run backend model tests: `npm run test:backend -- tests/models/assignmentDefinition.test.js`
2. Run frontend `TaskPartialSchema` spec: `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/taskPartial.zod.spec.ts`
3. Run frontend assignment-definition-partials Zod spec: `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
4. Run frontend assignment-definition-partials contract guard spec: `npm run test:frontend -- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts`
5. Run frontend class-detail Zod spec: `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
6. Run new dataAnalysis specs:
   - `npm run test:frontend -- src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`
   - `npm run test:frontend -- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
   - `npm run test:frontend -- src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`
7. Run all frontend tests: `npm run test:frontend`
8. Run all backend tests: `npm run test:backend`
9. Run all lint: `npm run lint:check`
10. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- All commands above return green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during regression.
- **Deviations from plan:** none expected.

---

## Documentation and rollout notes

### Objective

- Update canonical docs to reflect the extended `AssignmentDefinitionPartial` shape, the new `TaskPartialSchema` shared helper, the new Data Analysis Service, and the teacher-facing algorithm documentation.

### Constraints

- Only modify documents relevant to the touched areas.
- Do not add documentation for the deferred hook, page, or adapter work streams (but see the teacher-facing doc requirement below, which is in scope for v1).
- The teacher-facing algorithm documentation must be written for teachers, not developers. It must be accessible, jargon-free, and include worked examples. It is a durable reference document, not UI copy (that lives in `pageContent.ts`).
- The teacher-facing doc must cover at minimum: what the four metrics are, how criterion weightings work (default 40/40/20, override), how assignment and task weightings affect influence, how SPaG `'N'` is handled (renormalisation, not exclusion), how the overall metric is derived (worked example with SPaG `'N'`), what `value`/`totalWeight`/`applicableDataPoints`/`totalDataPoints` mean when rendered, and a note that cohort/trend/distribution analyses are future additions.
- Location: `docs/pedagogy/data-analysis-scoring.md` (alongside the existing `docs/pedagogy/README.md`).
- The deferred page work stream will surface this content via an info panel, help tooltip, or linked help article. The action plan records the integration-point requirement here; the layout spec for the page work stream will define how.
- The `TaskPartialSchema` entry in `docs/developer/DATA_SHAPES.md` is added **before Section 4 begins** (per the shared-helper planning gate) with status `Not implemented` and the planned canonical home noted. This pre-implementation entry must reference the new file `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`, not the originally-planned location in `dataAnalysis.zod.ts`.

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/DATA_SHAPES.md`
- `docs/pedagogy/README.md` (to maintain consistent tone and style for the teacher-facing algorithm documentation)

### Acceptance criteria

- `docs/developer/DATA_SHAPES.md` accurately reflects the updated `AssignmentDefinitionPartial` shape (`tasks: Array<{ id, taskWeighting }>`) and the new `TaskPartial` entry (with the canonical home `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`).
- `DATA_SHAPES.md` no longer asserts the obsolete "Partial definitions use `tasks: null` (not `undefined` or `{}`)" rule (or that sentence is rewritten to reflect the new contract).
- `docs/pedagogy/data-analysis-scoring.md` exists and covers all required topics per SPEC § "Documentation and rollout notes" (teacher-facing algorithm documentation): the four metrics, criterion weightings, assignment/task weighting, SPaG `'N'` renormalisation, overall derivation with worked example, `MetricResult` fields (`value`, `totalWeight`, `applicableDataPoints`, `totalDataPoints`), and future-analyses note.
- `SPEC.md` status is updated to `Implemented v1.0` by the Docs agent after verifying all sections are delivered.

### Required checks

1. Verify `DATA_SHAPES.md` mentions the new `tasks` shape in the partial hydration section, and that the obsolete "Partial definitions use `tasks: null`" line has been removed or rewritten.
2. Verify `DATA_SHAPES.md` has the new `TaskPartial` entry with status `Implemented` and the canonical home recorded.
3. Verify `data-analysis-scoring.md` exists at `docs/pedagogy/` and covers each required topic from the SPEC (four metrics, criterion weightings, assignment/task weighting, SPaG renormalisation, overall derivation worked example, MetricResult fields including `totalWeight`, future-analyses note).
4. Verify `data-analysis-scoring.md` is written for a teacher audience (accessible, jargon-free, includes at least one worked example showing SPaG `'N'` renormalisation).
5. Verify `data-analysis-scoring.md` explains all `MetricResult` fields: `value`, `totalWeight`, `applicableDataPoints`, `totalDataPoints`.
6. Verify `SPEC.md` status is updated to `Implemented v1.0`.
7. Verify mandatory-read evidence (`Files read`) is complete for delegated docs handoffs.

### Optional `@remarks` JSDoc review

- Confirm that `@remarks` added in Sections 1–5 accurately document design decisions, gotchas, and cross-component interactions.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during documentation pass.
- **Deviations from plan:** none expected.

---

## Suggested implementation order

1. **Documentation and rollout notes** (preparation): add the planned-only `TaskPartialSchema` entry to `docs/developer/DATA_SHAPES.md` with status `Not implemented` and the planned canonical home noted (per the shared-helper planning gate). Add a note about the `StudentSubmissionPartialSchema` fix (Section 2) and `AssignmentDefinitionPartialSchema` unification (Section 3). The `TaskPartialSchema` entry must be in place before Section 4 begins implementation; the `StudentSubmissionPartialSchema` and `AssignmentDefinitionPartialSchema` notes should be in place before Section 2 begins.
2. **Section 1** — Backend `AssignmentDefinition.toPartialJSON()` extension (atomic with Sections 2–4 in the same release).
3. **Section 2** — Frontend fix `StudentSubmissionPartialSchema` in `classDetailService.zod.ts` (flat-model bug → correct nested dictionary shape).
4. **Section 3** — Frontend unify `AssignmentDefinitionPartialSchema`: remove the duplicate lenient copy from `classDetailService.zod.ts`, replace with import from canonical `assignmentDefinitionPartials.zod.ts`. Update `referenceDocumentId`/`templateDocumentId` to `.nullable()` in the canonical schema. Update `LinkableDefinition` type.
5. **Section 4** — Frontend shared `TaskPartialSchema` (new file) + update existing partial Zod schemas in place (replace `z.null()` collapse with `z.array(TaskPartialSchema)`). No transition union (atomic deployment).
6. **Section 5** — Frontend `dataAnalysis.zod.ts` (new file) with the full analyser's schemas, importing the existing `AssignmentDefinitionPartialsResponseSchema` and `IsoDateTimeWithTimezoneSchema` from `assignmentDefinitionPartials.zod.ts` and `TaskPartialSchema` from the new shared file.
7. **Section 6** — Frontend `AveragingAnalyser` (depends on Section 5 for types).
8. **Section 7** — Frontend `DataAnalysisService` orchestrator (depends on Sections 5 and 6).
9. **Regression and contract hardening** (depends on all sections).
10. **Documentation and rollout notes** (post-implementation): reconcile the `TaskPartialSchema` entry in `DATA_SHAPES.md` to `Implemented`; update the partial-definition entry to reflect the new `tasks: Array<TaskPartial>` shape; remove the now-incorrect "Partial definitions use `tasks: null`" line; add `StudentSubmissionPartialSchema` and `AssignmentDefinitionPartialSchema` reconciliation notes; write the teacher-facing `docs/pedagogy/data-analysis-scoring.md`; mark `SPEC.md` status as `Implemented v1.0`.

---

## Post-deployment follow-up

- **No transition-shim removal commit is required.** The v1.3 plan introduced a `z.union([z.array(TaskWeightingSummarySchema), z.null()])` shim and a follow-up commit to remove it once the backend was confirmed deployed. The v1.4 plan drops the shim entirely (atomic deployment, no transition window), so the two downstream partial Zod schemas accept `z.array(TaskPartialSchema)` directly from the start. There is nothing to remove post-deployment.
- **Pre-existing tests that asserted the old `tasks: null` shape are updated in their respective sections (not in a separate follow-up commit).** Specifically:
  - `tests/models/assignmentDefinition.test.js:171-175` — updated in Section 1.
  - `assignmentDefinitionPartials.zod.spec.ts` lines 399–465 (the `'tasks field backend-shape compatibility'` describe block) — rewritten in Section 4.
  - `classDetailService.zod.spec.ts` line 324–328 (the `'rejects a definition with tasks not null'` test) — removed in Section 4.
  - `assignmentDefinitionPartialsContract.guard.spec.ts` lines 33–60 (the `'accepts backend-compatible non-null tasks payloads and collapses them to null'` test) — deleted in Section 4.
    These tests are expected to fail when their respective sections are partially landed (e.g. §1 backend change without §4 frontend update) and are fixed in the same section. This is the signal that the schema change is correct.
- **Schema reconciliation tests (Sections 2 and 3) are also updated in-line:**
  - `classDetailService.zod.spec.ts` — updated in Section 2 (StudentSubmissionPartialSchema fix) and Section 3 (AssignmentDefinitionPartialSchema unification).
  - `classDetailService.zod.spec.ts` line 330 REGRESSION (null `referenceDocumentId`) — now correctly handled by the canonical schema's `.nullable()` (Section 3).
  - `LinkableDefinition` type (`getLinkableDefinitionsForModal.ts`) — `referenceDocumentId`/`templateDocumentId` changed from `string` to `string | null` (Section 3).
- **Deferred work streams**: the hook (`useDataAnalysis`), page (`DataAnalysisPage.tsx`), and Ant Design adapter are separate work streams. Each will have its own spec and layout spec when that work stream begins. The `StudentSubmissionPartialSchema` divergence and the `AssignmentDefinitionPartialSchema` duplication are both resolved in v1 (Sections 2 and 3), so the page work stream does not need to reconcile either.
- **Teacher-facing doc integration**: when the page work stream begins, the layout spec must include an integration point (info panel, help tooltip, or linked help article) surfacing `docs/pedagogy/data-analysis-scoring.md` so teachers can understand how scores are calculated.
- **DATA_SHAPES.md reconciliation**: the planned-only `TaskPartialSchema` entry is updated to `Implemented` after delivery. The `StudentSubmissionPartialSchema` entry is updated to reflect the corrected nested shape (Section 2). The `AssignmentDefinitionPartialSchema` entry is updated to note the canonical single source in `assignmentDefinitionPartials.zod.ts` (Section 3).
