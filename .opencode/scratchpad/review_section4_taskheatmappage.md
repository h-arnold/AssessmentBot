# Code Review — Section 4: Wire `TaskHeatmapPage` with assignment `useQuery`

**Reviewer:** Code Reviewer (frontend) · **Module:** frontend (`src/frontend`)
**Branch:** `feat-preview-card-real-data-wiring` · **Phase:** GREEN
**Primary file under review:** `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`

---

## Verdict: CLEAN — GREEN approved

The implementation satisfies every in-scope acceptance criterion in ACTION_PLAN.md §4 and SPEC.md.
Lint is clean (only the pre-existing, out-of-scope `apiService.spec` magic-number warning), `tsc`
exits 0, and the TaskHeatmapPage suite passes 11/11 (corroborated by an independent run).

Two non-blocking notes are recorded below (a framing discrepancy and a benign dev warning). Neither
blocks GREEN.

---

## Files read

- `/home/developer/AssessmentBot/SPEC.md` — TaskHeatmapPage section (lines 180–269, 399–521), §"Refresh behaviour", error-logging contract.
- `/home/developer/AssessmentBot/ACTION_PLAN.md` — Section 4 (full, lines 474–723), Test infrastructure requirements, Constraints, Acceptance criteria.
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskHeatmapPage.tsx` — under review (full file + `git diff`).
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx` — tests (full; assertion-vs-implementation cross-check).
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskHeatmapTable.tsx` — confirmed `getTaskPreviewData` import retained (line 49, used at 232); type-only prop addition present.
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` — skipped (not the core change; Objective 5 placeholder props noted).
- `/home/developer/AssessmentBot/src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` & `ClassPage.spec.tsx` — grep-confirmed to use required test infra.
- `/home/developer/AssessmentBot/src/frontend/src/query/sharedQueries.ts` — `getAssignmentQueryOptions(classId, assignmentId)` confirmed.
- `/home/developer/AssessmentBot/src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` — `getAssignment` is the queryFn; `null` = not found.
- `/home/developer/AssessmentBot/src/frontend/src/logging/frontendLogger.ts` — `logFrontendError`, `logFrontendEvent` signatures.
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-react-query-and-prefetch.md` — §5 (view-entry prefetch / RQ v5 dedup).
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-logging-and-error-handling.md` — logging policy.
- `/home/developer/AssessmentBot/docs/developer/frontend/frontend-spacing-and-padding-standards.md` — §4.1 Card/Alert/Flex-gap rules.

---

## Verification against each in-scope check

### 1. Hook-placement safety (highest priority) — PASS

All hooks are declared **before** the existing `if (isGenericError) return null;` early return:

- `AntdApp.useApp()` (line 161, pre-existing) — before return.
- `useQuery(getAssignmentQueryOptions(...))` (line 164) — before return.
- `useMemo` `cellPreviewLookup` (line 166) — before return.
- `useRef` `hasLoggedAssignmentErrorReference` (175) + `useEffect` (176) — before return.
- `useRef` `hasLoggedAssignmentNotFoundReference` (184) + `useEffect` (185) — before return.
- `useRef` `hasHandledGenericErrorReference` (203) + `useEffect` (204) — before return.

No new conditional early returns were introduced above the existing `isGenericError` / `isTitleError`
returns. React hooks-call order is stable across all render paths. ✔

### 2. Correctness vs spec — PASS

- `useQuery` called with `courseId = classFull.classId` and `assignmentId` (line 164). ✔
- `cellPreviewLookup` via `useMemo` keyed on `assignmentQuery.data`:
  `() => (assignmentQuery.data ? buildCellPreviewLookup(assignmentQuery.data) : null)` (lines 166–169). ✔
- `showAssignmentError = assignmentQuery.isError || assignmentQuery.data === null` (line 171). ✔
- `isAssignmentLoading = assignmentQuery.isPending` (line 172) — **not** `isFetching`. ✔
- Three props passed as real values to `TaskHeatmapTable` (line 249): `cellPreviewLookup`,
  `isAssignmentLoading`, `showAssignmentError`. ✔
- Refresh button wraps parent `refetch` AND `assignmentQuery.refetch()` **unconditionally**:
  `onClick={() => { refetch(); assignmentQuery.refetch(); }}` (line 243). Relies on RQ v5 dedup
  per SPEC §"Refresh behaviour" — no feature-level guard added. ✔

### 3. Logging — PASS

- Error effect (lines 176–181): `logFrontendError('TaskHeatmapPage', assignmentQuery.error)` guarded
  by a dedicated `useRef` (`hasLoggedAssignmentErrorReference`), fires once. Dependency array
  `[assignmentQuery.isError, assignmentQuery.error]` plus the ref guard guarantee single emission
  even under React 19 StrictMode double-invoke. ✔
- Not-found effect (lines 185–198): `logFrontendEvent('warn', { context: 'TaskHeatmapPage',
errorMessage: 'Assignment not found in AssignmentFull payload' })` guarded by a **separate** `useRef`
  (`hasLoggedAssignmentNotFoundReference`). Exact string matches the spec and the test assertion
  (spec line 636). Condition `data === null && !isPending && !isError` correctly isolates the
  not-found branch from the error branch. ✔
- Tests assert both effects fire exactly once (spec #7, #8); suite is green. ✔

### 4. Purity / standards — PASS

- British English throughout (comments, identifiers). No `color`/American spelling. ✔
- No `console.*` calls in source. ✔
- No swallowed errors — assignment errors/not-found are explicitly logged. ✔
- Minimal localised change; no speculative scope. ✔
- `getTaskPreviewData` import retained in `TaskHeatmapTable.tsx` (line 49, still consumed at line 232)
  — removal deferred to Section 5 as required. ✔
- `TaskHeatmapTable.tsx` diff is type-only (`cellPreviewLookup`, `isAssignmentLoading`,
  `showAssignmentError` added to the prop type; `CellPreviewLookup` type import) — no consumption yet,
  matching Objective 4. ✔

### 5. Spacing / padding — PASS

- New UI surface is the page-level `<Card size="small">` (line 248) hosting the table.
  `Card size="small"` body padding is 12px — documented as 8px-grid-aligned in
  `frontend-spacing-and-padding-standards.md` §4.1. ✔
- Both `Flex` wrappers use `gap={APP_GAP_MD}` (16px, `var(--app-spacing-md)`). ✔
- No inline `margin`/`padding` literals were introduced; the pre-existing `Alert` (line 228) relies on
  the Flex gap, no override. No non-8px-multiple values present. ✔

### 6. Tests untouched — DISCREPANCY (informational, not a defect)

The task framing claims the implementation edited **only** `TaskHeatmapPage.tsx` and that "RED test
files unchanged". The working tree (and `git diff`) shows seven changed files, including:

- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` — Objective 4 type-only prop addition (required).
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`, `ClassPageHeatmapView.spec.tsx`,
  `ClassPage.spec.tsx` — Section 4 **Test infrastructure requirements** (lines 499–580): each wraps
  the render in a real `QueryClientProvider` + `createTestQueryClient()` and mocks `getAssignment` at
  the service path. `getAssignment` queries were also added (Tests #1–#9).
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` — Objective 5 placeholder props.
- `src/frontend/e2e-tests/task-preview-card.spec.ts-snapshots/completeness-pinned.png` — incidental
  binary snapshot regeneration (out of code-review scope).

A grep confirms the spec files import `QueryClientProvider`/`QueryClient`/`UseQueryResult` and mock
`getAssignment` **only at the service module** — they do **not** globally mock `@tanstack/react-query`,
complying with ACTION_PLAN §4 ("do not mock @tanstack/react-query globally"). All these changes are
**mandated by Section 4**; they are correct and in-scope, not inappropriate edits. The "ONLY
TaskHeatmapPage.tsx" claim in the review request is therefore inaccurate, but it is not a defect — the
actual diff is the legitimate, required GREEN deliverable. No action required beyond noting the
framing mismatch.

### 7. Lint / tsc — PASS

- `npm run lint:frontend` → 0 errors; only the pre-existing `apiService.spec.ts` magic-number warning
  (out of scope, documented as such). ✔
- `npm exec tsc -b src/frontend/tsconfig.json` → exit 0. ✔
- Independent `vitest run TaskHeatmapPage` → 11/11 passed. ✔

---

## Findings

### Critical

None.

### Improvement

None blocking. (All spec acceptance criteria are met.)

### Nitpick / Informational

- **Nitpick (informational, non-blocking) — `TaskHeatmapPage.tsx` generic-error test stderr warning:**
  During `vitest run TaskHeatmapPage` the generic-error test emits a React Query dev warning:
  `Query data cannot be undefined. Please make sure to return a value other than undefined from your
query function. Affected query key: ["assignment","class-1","nonexistent-id"]`.
  In that test `getAssignment` is mocked to resolve `buildDefaultAssignmentFixture()` (a defined
  object), so this is a benign dev-mode artifact, not a real undefined return; the test still passes
  (11/11). No code change required. If the team wants a clean stderr, confirm React Query is not
  observing an undefined transient during the StrictMode unmount/remount; otherwise it can be ignored.

- **Informational — working-tree scope vs review-request framing:** as detailed in check #6, the tree
  includes the required Section 4 spec-file infrastructure and `TaskHeatmapTable.tsx` type-only prop
  addition in addition to `TaskHeatmapPage.tsx`. This is expected per ACTION_PLAN §4 and is correct;
  no remediation needed. Flagged only so the record is accurate.

---

## Summary of compliance

| Spec item                                                                                | Status |
| ---------------------------------------------------------------------------------------- | ------ |
| `useQuery` wired with `classFull.classId`, `assignmentId`                                | ✔      |
| `cellPreviewLookup` via `useMemo` keyed on `data`                                        | ✔      |
| `showAssignmentError = isError                                                           |        | data === null` | ✔   |
| `isAssignmentLoading = isPending`                                                        | ✔      |
| Three real props passed to `TaskHeatmapTable`                                            | ✔      |
| Refresh calls both `refetch` and `assignmentQuery.refetch()` unconditionally             | ✔      |
| Error effect `logFrontendError('TaskHeatmapPage', error)` once (useRef guard)            | ✔      |
| Not-found effect `logFrontendEvent('warn', …exact string…)` once (separate useRef guard) | ✔      |
| New hooks before `if (isGenericError) return null;`; no new early returns                | ✔      |
| `getTaskPreviewData` import retained in `TaskHeatmapTable`                               | ✔      |
| Spacing on `Card`/Flex complies with 8px grid                                            | ✔      |
| Lint clean (frontend) / tsc clean                                                        | ✔      |
| Suites green (TaskHeatmapPage 11/11)                                                     | ✔      |

**GREEN approved.**
