# Feature Delivery Plan — ClassPage Assignment Prefetch

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Treat `SPEC.md` as the source of truth for product behaviour, contracts, and scope boundaries.
3. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

## Scope and assumptions

### Scope

- Frontend service function `getAssignment` wrapping the existing backend `getAssignment` method
- Zod request and response schemas for full `Assignment.toJSON()` payloads
- React Query key factory and shared query options (with `staleTime` and `retry: false`)
- Shared comparator `compareAssignmentUpdatedAtDesc` for deterministic recency sort
- Adoption of the shared comparator in `classPageAdapter.ts` `recentAssignments` pipeline
- Prefetch side effect in `useClassPageData`, gated on `surfaceState.status === 'ready'`

### Out of scope

- Backend changes — none required
- UI consumers of the prefetched assignment data
- Cache invalidation rules for assignment reads
- Bulk assignment endpoint
- Assignment prefetch on any page other than ClassPage

### Assumptions

1. `assignmentName` is always populated by the backend; the Zod schema treats it as non-nullable.
2. `surfaceState.status === 'ready'` guarantees every `classFull.assignments[].updatedAt` is non-null and parseable because the adapter validates them before reaching `ready`.
3. `courseId` in `getAssignment` is the same value as `ClassFull.classId` (the Google Classroom course ID).
4. `staleTime: 5 minutes` and `retry: false` are appropriate for this fire-and-forget prefetch boundary.
5. React StrictMode double-effect invocation is acceptable; `prefetchQuery` is keyed and idempotent.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Export service functions as `function` declarations, not `const` arrow functions (frontend AGENTS §2).
- All frontend-to-backend calls must route through `callApi` in `apiService.ts`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Backend lint (if touched): `npm run lint:backend`
- Backend tests (if touched): `npm run test:backend -- <target>`

---

## Section 1 — Frontend `getAssignment` service and Zod schemas

**Status: Complete** — red/green loops clean, code review clean, regression gate passed (0 regressions vs baseline).

### Objective

Add the `getAssignment` service function and full `Assignment` Zod schemas to the existing `assignmentAssessment` service domain.

### Constraints

- Add to existing files: `assignmentAssessmentService.ts` and `assignmentAssessment.zod.ts`
- Do not create new schema or service files
- Export as `function` declarations
- Route through `callApi('getAssignment', ...)`
- Model the full `Assignment.toJSON()`, `StudentSubmission.toJSON()`, `TaskDefinition.toJSON()`, and `AssignmentDefinition.toJSON()` shapes — do not reuse partial schemas
- Response schema must be nullable (backend returns `null` for not-found)

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- Backend serialisation source of truth: `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`
- Backend `StudentSubmission.toJSON()`: `src/backend/Models/StudentSubmission.js` (around line 313)
- Backend `TaskDefinition.toJSON()`: `src/backend/Models/TaskDefinition.js` (around line 142)
- Backend `AssignmentDefinition.toJSON()`: `src/backend/Models/AssignmentDefinition.js` (around line 288)
- Backend `BaseTaskArtifact.toJSON()`: `src/backend/Models/Artifacts/0_BaseTaskArtifact.js` (around line 124)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `getAssignment` service function
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
   - Call-site rationale: Wraps the backend `getAssignment` allowlisted method; consumers (prefetch effect, future query hooks) call this function
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
   - Planned doc status: `Not implemented`

2. Helper: `AssignmentFullSchema` / `AssignmentFullResponseSchema` Zod schemas
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
   - Call-site rationale: Validates full `Assignment.toJSON()` responses at the transport boundary; required by the `getAssignment` service function
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `getAssignment({ courseId, assignmentId })` calls `callApi('getAssignment', ...)` and validates the response through the new Zod schema
- The response schema accepts the full assignment shape with per-field nullability matching `Assignment.toJSON()`: `courseId` is `z.string()`, `assignmentId` is `z.string()`, `assignmentName` is `z.string()`, `createdAt` is `z.string()`, `dueDate` / `updatedAt` / `documentType` / `referenceDocumentId` / `templateDocumentId` are `z.string().nullable()`, `tasks` is `z.record(z.string(), TaskDefinitionSchema).nullable()` (keyed object `{[taskId]: TaskDefinition}`, **not an array** — matches `AssignmentDefinition.toJSON()` at `src/backend/Models/AssignmentDefinition.js:295–300` which emits `tasks` via `Object.fromEntries(...)` and throws if `tasks` is an array), `submissions` is `z.array(StudentSubmissionSchema)`, `assignmentDefinition` is `AssignmentDefinitionSchema` (whose inner `tasks` field is likewise `z.record(z.string(), TaskDefinitionSchema)`)
- The response schema is nullable (`z.nullable()`) — a valid `null` response passes validation
- The request schema enforces `{ courseId: z.string(), assignmentId: z.string() }` with `.strict()`
- Invalid responses (wrong types, missing required fields, extra fields) throw a Zod error
- The service function and schemas are exported and importable by `sharedQueries.ts`

### Required test cases (Red first)

Frontend service tests:

1. `getAssignment` resolves with valid data when the backend returns a well-formed full assignment
2. `getAssignment` rejects with a Zod error when the response has an unexpected shape (e.g. missing `courseId`)
3. `getAssignment` accepts `null` as a valid response (assignment not found)
4. `getAssignment` rejects with a Zod error when the response has extra fields not in the `.strict()` schema

Frontend schema tests:

1. `AssignmentFullSchema` accepts a minimally valid full assignment payload
2. `AssignmentFullSchema` rejects payloads that look like the partial assignment shape (missing `referenceDocumentId`, missing `templateDocumentId`)
3. `AssignmentFullSchema` **rejects an array-valued `tasks` field** — the partial `AssignmentDefinitionPartialSchema.tasks` is an array, but the full `Assignment.toJSON().assignmentDefinition.tasks` is a keyed object (`{[taskId]: TaskDefinition}`, emitted via `Object.fromEntries(...)` at `src/backend/Models/AssignmentDefinition.js:295–300`). This is the canonical full-vs-partial divergence and must be asserted explicitly so a future schema drift toward the partial shape fails loudly
4. `AssignmentFullSchema.nullable()` accepts `null`
5. The request schema (`GetAssignmentRequestSchema`) rejects a parameters object with a missing `courseId` or `assignmentId`
6. The `getAssignment` service function parses input through the request schema before calling `callApi` (mirroring `startAssessmentRun`'s pattern)

### Section checks

- Before implementation: add §9 entries for `getAssignment`, `AssignmentFullSchema` / `AssignmentFullResponseSchema` (Zod schemas), `queryKeys.assignment`, `getAssignmentQueryOptions`, and `compareAssignmentUpdatedAtDesc` to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`
- `npm run test:frontend -- src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.spec.ts`
- `npm run test:frontend -- src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `getAssignment`: document that it wraps the backend `getAssignment_` handler and that the response is the full rehydrated `Assignment.toJSON()` (not a partial). Note that `null` means the assignment document was not found.
- `AssignmentFullSchema`: document the source-of-truth backend methods this schema models (`Assignment.toJSON()` etc.) so future maintainers know where to check when the backend changes.

---

## Section 2 — Query key factory and shared query options

**Status: Complete** — red/green loops clean, code review clean, regression gate passed (0 regressions vs baseline).

### Objective

Add `queryKeys.assignment(courseId, assignmentId)` factory and `getAssignmentQueryOptions(courseId, assignmentId)` shared query options.

### Constraints

- Key factory in `src/frontend/src/query/queryKeys.ts`
- Query options in `src/frontend/src/query/sharedQueries.ts`
- Follow existing factory pattern (`queryOptions({ queryKey, queryFn })`)
- Set `staleTime: 5 * 60 * 1000` (5 minutes) and `retry: false`
- The `queryFn` delegates to the new `getAssignment` service function from Section 1

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/query/queryKeys.ts` (existing pattern)
- `src/frontend/src/query/sharedQueries.ts` (existing pattern)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `queryKeys.assignment(courseId, assignmentId)`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/query/queryKeys.ts`
   - Call-site rationale: Scoped query key factory for per-assignment full reads; consumed by `getAssignmentQueryOptions` and future invalidation calls
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
   - Planned doc status: `Not implemented`

2. Helper: `getAssignmentQueryOptions(courseId, assignmentId)`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/query/sharedQueries.ts`
   - Call-site rationale: Shared query options for the `prefetchQuery` call in `useClassPageData` and future `useQuery` consumers
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `queryKeys.assignment('courseA', 'assign1')` returns `['assignment', 'courseA', 'assign1'] as const`
- `getAssignmentQueryOptions('courseA', 'assign1')` returns a `queryOptions` object with the correct `queryKey`, `queryFn`, `staleTime`, and `retry`
- The factory follows the `queryOptions({ queryKey, queryFn })` shape used by `getABClassQueryOptions`
- The query key is not added to the `startupWarmup` definitions (it is view-entry-only)

### Required test cases (Red first)

Query key tests:

1. `queryKeys.assignment(courseId, assignmentId)` returns the expected tuple shape

Query options tests:

1. `getAssignmentQueryOptions(courseId, assignmentId).queryKey` matches the query key factory output
2. `getAssignmentQueryOptions(courseId, assignmentId).staleTime` is `300000`
3. `getAssignmentQueryOptions(courseId, assignmentId).retry` is `false`

Startup warm-up exclusion tests:

1. No entry in `startupWarmupQueryKeys` has a first element equal to `'assignment'` (prefix guard — stronger than an exact-element match, which would be vacuously true against 1- or 2-tuple warmup keys and would not catch a future mis-wiring that adds the assignment key to the warmup set)
2. No entry in `startupWarmupDatasetKeys` is named `assignment` (string-key guard)

### Section checks

- `npm run test:frontend -- src/frontend/src/query/` (all query module tests)
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `getAssignmentQueryOptions`: document that this is a view-entry query (not startup warm-up). Note `staleTime` and `retry: false` are chosen because this is a fire-and-forget prefetch. Future consumers can override via spread.

---

## Section 3 — Shared comparator extraction

### Objective

Extract a shared `compareAssignmentUpdatedAtDesc` comparator and replace the adapter's existing `.toSorted(...)` call so both the prefetch and the displayed `recentAssignments` use the same deterministic order.

### Constraints

- Place the comparator in `src/frontend/src/features/classPage/classPageModel.ts` (alongside the existing `compareStudentNames` precedent)
- Comparator signature: `(a: { updatedAt: string; assignmentId: string }, b: { updatedAt: string; assignmentId: string }) => number`
- Sort descending by `updatedAt` (string `localeCompare`), ascending by `assignmentId` as tie-break
- In `classPageAdapter.ts`, the existing `.toSorted(...)` call at line 306 sorts an intermediate tuple `{ assignment, validatedUpdatedAt }`. The shared comparator replaces the inline comparator only; the call site maps each tuple into the comparator's minimal shape:
  `.toSorted((a, b) => compareAssignmentUpdatedAtDesc({ updatedAt: a.validatedUpdatedAt, assignmentId: a.assignment.assignmentId }, { updatedAt: b.validatedUpdatedAt, assignmentId: b.assignment.assignmentId }))`
- **Rename scope — bounded and optional**: the intermediate tuple's `validatedUpdatedAt` field — at the type annotation (line 297), the `.map()` return (line 301), the `.toSorted()` comparator args (line 306), and the `.map()` destructure for `recentAssignments` followed by its use in the `buildRecentAssignment` call (lines 310 and 314) — MAY be renamed to `updatedAt` for consistency with the comparator's parameter name, but this rename is **optional and strictly bounded to those five sort-block lines (297, 301, 306, 310, 314)**. It is not a prerequisite for the comparator extraction — the call-site mapping works whether the field is named `validatedUpdatedAt` or `updatedAt`.
- **Out of scope**: the `validatedUpdatedAt` parameter of `buildRecentAssignment` (lines 155–198: the `@param` JSDoc, the function parameter, the `formatUpdatedAtLabel(validatedUpdatedAt)` call, and the `lastAssessedAt: validatedUpdatedAt` assignment) MUST NOT be renamed. That parameter name carries the semantic "the validated non-null `updatedAt` of this assignment" distinct from the raw nullable wire value; renaming it would erase that distinction and is unrelated to the comparator extraction. The sort-block rename (lines 297, 301, 306, 310, 314 — if taken) does not propagate into `buildRecentAssignment`'s parameter — the call site passes the sort-block `validatedUpdatedAt` (or `updatedAt`, post-rename) as the argument by position.
- The adapter test at `classPageAdapter.spec.ts:249` ("returns up to 3 assignments sorted by updatedAt descending") must still pass
- The millisecond-precision test at `classPageAdapter.spec.ts:333` must still pass

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/features/classPage/classPageModel.ts` (existing `compareStudentNames` pattern)
- `src/frontend/src/features/classPage/classPageAdapter.ts` (the `recentAssignments` sort block — lines 294–316, plus the `validatedUpdatedAt` occurrences at 297, 301, 306, 310, and 314 that fall within it)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `compareAssignmentUpdatedAtDesc`
   - Decision: `new` (shared between prefetch and adapter)
   - Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
   - Call-site rationale: Ensures the prefetched top-3 and the adapter's displayed `recentAssignments` use identical ordering; prevents divergence when `updatedAt` values are equal
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `compareAssignmentUpdatedAtDesc` is exported from `classPageModel.ts`
- It accepts two objects `{ updatedAt: string; assignmentId: string }` and returns a number suitable for `.sort()` / `.toSorted()`
- Primary sort: `updatedAt` descending (b.updatedAt.localeCompare(a.updatedAt))
- Tie-break: `assignmentId` ascending (a.assignmentId.localeCompare(b.assignmentId))
- The adapter's `recentAssignments` pipeline uses the shared comparator instead of the inline `.toSorted(...)`
- All existing adapter tests pass without modification to their assertions

### Required test cases (Red first)

Comparator unit tests:

1. Later `updatedAt` sorts before earlier `updatedAt` (descending)
2. Equal `updatedAt` — `assignmentId` ascending breaks the tie
3. Equal `updatedAt`, equal `assignmentId` — returns 0

Adapter regression tests:

1. The existing `recentAssignments` sort tests pass unmodified (confirm the shared comparator produces the same ordering the tests already expect)

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/classPageModel.spec.ts`
- `npm run test:frontend -- src/frontend/src/features/classPage/classPageAdapter.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `compareAssignmentUpdatedAtDesc`: document the two-level sort (updatedAt desc, assignmentId asc) and note that it is used by both the prefetch and the adapter's `recentAssignments` pipeline for determinism.

---

## Section 4 — Prefetch effect in `useClassPageData`

### Objective

Add a `useEffect`-based prefetch side effect that fires when `surfaceState.status === 'ready'`, sorts `classFull.assignments` using the shared comparator, takes the top 3, and calls `queryClient.prefetchQuery` for each.

### Constraints

- Obtain `QueryClient` via `useQueryClient()`
- Gate on `surfaceState.status === 'ready'` and `classFull` being non-null
- Guard against re-dispatch: use a `useRef<string | null>` tracking the last-dispatched `classId`. The effect fires only when `surfaceState.status === 'ready'` AND the guard ref's value differs from the current `classId`. On fire, set the ref to `classId`. This ensures exactly one prefetch per class reaching `ready`, with the guard resetting when the user navigates to a different class.
- **Effect dependency array (mandatory)**: the effect's dependency array MUST include both `surfaceState.status` and `classId` (read fresh inside the effect body for the ref comparison). Omitting `classId` from the deps would cause the ref-vs-current-`classId` comparison to use a stale `classId` when the user navigates to a new class while the `useClassPageData` instance stays mounted (the `ClassesPage` inline-render pattern per `frontend-shared-helpers-and-abstraction-standards.md` §9.18.4). The flow on navigation is: `classId` changes → `classFull` becomes pending → `surfaceState.status` transitions `ready → loading` → effect re-runs (deps changed), but the `ready`-gate is false so it's a no-op → new `classFull` resolves → `surfaceState.status` returns to `ready` → effect re-runs again (deps changed), now with the new `classId` read fresh, the ref still holds the _old_ `classId` (different from new), so the prefetch fires exactly once for the new class. The combination of `classId` in deps + guard ref read inside the effect body is what makes the cross-class navigation reset work.
- Sort using the shared `compareAssignmentUpdatedAtDesc` comparator. The `ClassFull.assignments[].updatedAt` type is `string | null` — narrow to `string` before sorting: since the `ready`-gate guarantee (SPEC assumption 2) asserts every `updatedAt` is non-null and parseable when `surfaceState.status === 'ready'`, narrow via a **type-level assertion at the sort boundary** (e.g. `classFull.assignments as Array<{ assignmentId: string; updatedAt: string }>`, or by deriving a narrowed const above the `.toSorted(...)` call). **Do not filter** — filtering implies nulls are expected, which contradicts the `ready`-gate invariant and would hide a genuine invariant violation. The assertion is purely a TypeScript-level concern; at runtime the values are guaranteed non-null.
- Take first 3 (or fewer); no-op when 0
- Call `queryClient.prefetchQuery(getAssignmentQueryOptions(classFull.classId, assignmentId)).catch(() => undefined)` for each
- Prefetch failures must not affect `surfaceState`, `error`, or any existing return values
- Current LOC: 404; projected: ~435 — well under the 500-line threshold
- **Pre-existing test mitigation**: Before implementing the effect, update the existing `useClassPageData.spec.ts` setup to spy on `queryClient.prefetchQuery` (e.g. `vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined)`) so that existing ready-state tests do not invoke the real `callApi` → `getAssignment` transport path
- **React StrictMode double-invoke**: In development, `useEffect` runs twice on mount. The guard-ref mechanism ensures the second invocation is a no-op (the ref already holds the current `classId`). A dedicated test asserting exactly one `prefetchQuery` call even under double-effect is recommended but optional; the guard-ref already provides this property.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `src/frontend/src/features/classPage/useClassPageData.ts`
- `src/frontend/src/features/classPage/useClassPageData.helpers.ts`
- `src/frontend/src/query/sharedQueries.ts` (for `getAssignmentQueryOptions`)
- `src/frontend/src/features/classPage/classPageModel.ts` (for `compareAssignmentUpdatedAtDesc`)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `compareAssignmentUpdatedAtDesc` (from Section 3)
   - Decision: `reuse` — already created in Section 3
   - Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
   - Call-site rationale: Imported in `useClassPageData` for sorting `classFull.assignments` before prefetch

2. Helper: `getAssignmentQueryOptions` (from Section 2)
   - Decision: `reuse` — already created in Section 2
   - Owning module/path: `src/frontend/src/query/sharedQueries.ts`
   - Call-site rationale: Passed to `queryClient.prefetchQuery` for each candidate assignment

3. Prefetch logic itself
   - Decision: `keep local` — the effect stays in `useClassPageData`; it is feature-specific wiring, not a reusable abstraction

### Acceptance criteria

- When the page reaches `ready` state, `prefetchQuery` is called for the 3 most recently updated assignments
- The assignments are sorted using `compareAssignmentUpdatedAtDesc`
- `courseId` passed to `getAssignmentQueryOptions` is `classFull.classId`
- When there are fewer than 3 assignments, only the available ones are prefetched
- When there are 0 assignments, no `prefetchQuery` calls are made
- A failing `prefetchQuery` (e.g. network error) does not throw, does not change `surfaceState`, and does not populate `error`
- The effect does not re-fire on subsequent `refetch()` calls or dataset refreshes
- All existing `useClassPageData` tests continue to pass

### Required test cases (Red first)

1. **Ready state triggers prefetch**: Mock `prefetchQuery` on `QueryClient`. When `surfaceState.status === 'ready'` and `classFull` has 4 assignments with distinct `updatedAt` timestamps, assert `prefetchQuery` is called exactly 3 times with query options whose `queryKey` matches the 3 most recently updated assignments
2. **Tie-break ordering**: When two assignments share the same `updatedAt`, assert the `assignmentId` ascending tie-break determines which is prefetched first
3. **Fewer than 3**: When `classFull.assignments` has only 1 entry, assert `prefetchQuery` is called once for that single assignment
4. **Zero assignments**: When `classFull.assignments` is empty, assert `prefetchQuery` is never called
5. **Prefetch failure is swallowed**: Mock `prefetchQuery` to return a rejected promise. Assert `surfaceState` remains `ready` and `error` remains `null`
6. **Effect does not re-fire on refetch**: Mock `prefetchQuery`. Use the guard-ref mechanism. Trigger `refetch()` (which resolves to a new `classFull` object). Assert `prefetchQuery` was called once before the refetch and is not called again after — the guard ref prevents re-dispatch for the same `classId`
7. **Effect does not fire before `ready`**: In `loading` or `blocking` state, assert `prefetchQuery` is never called, even if `classFull` is non-null
8. **Existing tests remain green**: Run the full `useClassPageData.spec.ts` suite and verify no regressions. The pre-existing test suite must already spy on `queryClient.prefetchQuery` per the Constraints mitigation step above.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/useClassPageData.spec.ts`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- Prefetch effect: document that it gates on `surfaceState.status === 'ready'`, uses the shared `compareAssignmentUpdatedAtDesc` comparator, and is intentionally fire-and-forget with `.catch(() => undefined)`. Note the `prefetchQuery` keyed-and-idempotent property that makes StrictMode double-fire safe.

---

## Regression and contract hardening

### Objective

Verify that all existing ClassPage, service, and query tests pass, and that no regression is introduced.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/AGENTS.md`

### Acceptance criteria

- All existing ClassPage feature tests pass: `npm run test:frontend -- src/frontend/src/features/classPage/`
- All existing query module tests pass: `npm run test:frontend -- src/frontend/src/query/`
- All existing assignment assessment service tests pass: `npm run test:frontend -- src/frontend/src/services/assignmentAssessment/`
- Frontend lint passes: `npm run lint:frontend`
- No new console warnings or errors in test output (beyond pre-existing ones)

### Section checks

- `npm run test:frontend -- src/frontend/src/features/classPage/`
- `npm run test:frontend -- src/frontend/src/query/`
- `npm run test:frontend -- src/frontend/src/services/assignmentAssessment/`
- `npm run lint:frontend`

---

## Documentation and rollout notes

### Objective

Update canonical docs to record the new shared helpers, the view-entry prefetch decision, and any caveats.

### Delegation mandatory reads (when sub-agents are used)

Docs agent mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Acceptance criteria

1. `docs/developer/frontend/frontend-react-query-and-prefetch.md` §5 updated: record `getAssignment` per-assignment full-read prefetch as a view-entry prefetch triggered from ClassPage `useClassPageData`
2. `docs/developer/frontend/frontend-react-query-and-prefetch.md` §2 "Query-key convention" updated to list the new `queryKeys.assignment` key factory.
3. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9 updated: add entries for `getAssignment` (service), `AssignmentFullSchema` / `AssignmentFullResponseSchema` (Zod schemas), `queryKeys.assignment` (query key factory), `getAssignmentQueryOptions` (query options), and `compareAssignmentUpdatedAtDesc` (comparator). Mark each as implemented (not `Not implemented`), since all are delivered in this plan.
4. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.3 updated: the "Pure hook — no useEffect beyond what React Query uses internally" claim is now stale — note the new fire-and-forget prefetch `useEffect` alongside the existing data-orchestration logic. The hook remains side-effect-light (one additional fire-and-forget effect). Also update the line-count claim from the stale "473 lines" to the post-change ~435 lines.
5. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.1 updated: note that the adapter now imports and uses the shared `compareAssignmentUpdatedAtDesc` comparator for `recentAssignments` ordering (was previously an inline stable sort).

### Section checks

- Verify the doc changes are consistent with the implemented code
- Reconcile all shared-helper planning entries from Sections 1–3: mark `Not implemented` → implemented in the canonical docs
- `npm run lint:frontend`

### Optional `@remarks` JSDoc review

- Confirm that all `@remarks` planned in Sections 1–4 are present in the relevant source files before closing.

---

## Suggested implementation order

1. **Section 1** — Frontend `getAssignment` service and Zod schemas (enabling contract)
2. **Section 2** — Query key factory and shared query options (depends on Section 1)
3. **Section 3** — Shared comparator extraction (independent; can run in parallel with 1–2)
4. **Section 4** — Prefetch effect in `useClassPageData` (depends on Sections 1, 2, 3)
5. **Regression and contract hardening** — after all sections are complete
6. **Documentation and rollout notes** — after regression pass
