# Action Plan — Heatmaps Selection Performance, Single-Pass Read Validation, and Select-All (TDD-First)

## Read-First Context

1. Read `docs/plans/SPEC.md` (clean after eight planner-review rounds; user-confirmed decisions recorded in its Status section).
2. Read `docs/plans/HEATMAP_SELECTION_LAYOUT.md` (clean after two planner-review rounds) for the #342 dropdown header layout.
3. Treat those documents as the source of truth for behaviour, contracts, and layout; this plan only sequences delivery and testing.

## Scope and assumptions

### Scope

One work unit covering GitHub issues h-arnold/AssessmentBot#342, #343, #349, and #352:

- **Section 1 — #349:** single-pass read validation in the assignment/class read path (normalisers + the two read service wrappers).
- **Section 2 — #343:** deferred selection derivation, class-consistency guard, id-keyed preview pairing, pending-on-removal, and the extended busy signal in `useHeatmapsPageData`.
- **Section 3 — #342:** select all / select none header in the Topics and Assignments dropdowns (feature-local wrapper component per §9.30) plus one Playwright E2E journey.
- **Section 4 — #352:** `resolveDiscreteCellStyle` switch → `METRIC_TONE_CELL_STYLE` record lookup.
- **Section 5:** regression and contract hardening across all touched suites.
- **Section 6:** documentation and rollout (data-shape planned entries finalised, helper register updated).

### Out of scope

- #350 (post-analysis effect re-key) and #351 (isDatasetRenderable gate alignment) — recorded in the deferred-findings table below; they touch shared class-page plumbing and #351 needs its own investigation.
- #323, #344, #348 — unrelated open issues.
- The embedded Class-page `TaskHeatmapPage` (no selection bar) and any backend, persistence, transport, or schema change.

### Assumptions

1. The per-class `useQuery` stays keyed on the urgent `classId` (required by the cached-class-switch guard and its red test).
2. No file split is needed: all touched files are projected to stay under 500 LOC (per-section counts below; the hard decomposition trigger is 550 LOC per `docs/developer/frontend/frontend-architecture.md`).
3. Canonical fixtures suffice: no synthetic-generator extension is needed (per-section notes).

## Global constraints and quality gates

### Engineering constraints

- Every backend call stays behind `callApi`; no new transport paths.
- `features/taskHeatmap/**` never imports `features/classPage/**`.
- Fail loudly: no catch-and-ignore; the normalisation refactor preserves every throw and the `assembleMergedPreviewData` missing-input throw stays.
- Ant Design v6 only: `popupRender`, `showSearch` object (`searchValue`/`onSearch`/`optionFilterProp`), `onSelect` discriminator; no deprecated top-level props.
- British English in comments, docs, and user-facing text.
- TDD per section: Red → Green → Refactor → section checks → docs sync → plan compaction.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend` (fix) / `npm run lint:frontend:check` (verify)
- Frontend unit/component tests: `npm run test:frontend -- <target>`
- Frontend E2E: `npm run test:frontend:e2e -- <target>`
- Type gate: `npm run typecheck:all`
- Full gate: `npm run run-all-checks`

---

## Section 1 — #349: single-pass read validation

### Outcome

Delivered on branch `feat/heatmaps-selection-perf`: each submission item is Zod-validated exactly once per read across `getABClass` / `getAssignment`, with output structurally identical to the previous post-strip shape. Parent passes omit the item/submission collections and reassemble the parsed item; the normaliser's terminal full-tree parses and both services' final `parseApiResponse` are removed, while the cheap root/envelope stub parses (`assignments: []` / `submissions: []`) and the not-found `null` contract stay. Corrupt replacements (`corruptItem` / `corruptedArtifact`) are constructed schema-shaped, and the partial-path copy loop drops `__proto__` before any item evaluation. New contract spec `assignmentReadSinglePass.spec.ts` with the test-only `itemSchemaEvaluationCounter.ts`; targeted suites, lint and typecheck green. Section regression gate passed (zero regressions, zero new failures — see Implementation notes).

### Retained for later sections

- **Read chain:** exactly one item-schema evaluation per item per whole service call — valid → one success; schema-corrupt → one failure and zero successes; contextually corrupt → one success then contextual rejection; `__proto__`-keyed entries get zero evaluations and are absent from output. The existing `assignmentReadNormalisation.*.spec.ts`, `classDetailService.spec.ts` and `assignmentAssessmentService.spec.ts` remain the unchanged output-equivalence contract.
- **Touched files:** `services/assignmentAssessment/assignmentReadNormalisation.ts`, `assignmentReadItemValidation.ts` and `assignmentAssessmentService.ts` (with `assignmentAssessment.zod.ts`), plus `services/googleClassrooms/classDetail/classDetailService.ts` (with its zod module). All stay under 500 LOC; no file split.
- **Vitest invocation:** `npm run test:frontend -- src/services/assignmentAssessment src/services/googleClassrooms`; filters resolve relative to the `src/frontend` cwd.
- **Baseline and regression:** regression-checker session `feat/heatmaps-selection-perf` (baseline report under `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/baseline/`); the only baseline failure is the accepted pre-existing `backend-lint-check` debt (four `max-lines` warnings in backend test files untouched by this frontend-only plan).
- **Helper ownership:** unchanged — `assignmentReadNormalisation.ts` and `assignmentReadItemValidation.ts` remain the §9.29 owners in `frontend-shared-helpers-and-abstraction-standards.md`; no new shared helper.
- **Data-shape docs:** the four docs (`assignment.md`, `student-submission.md`, `abclass.md`, `assessment.md`) describe the delivered single-pass chain; the pre-plan `Not implemented` entries were removed upstream in commit `85b1199d` (the #355 reconciliation), so this section's docs sync folded the chain into the canonical statements instead of de-labelling a planning block. §3.8 read-chain sentence corrected; the planned §9.29 entry-1 sentence no longer exists (also removed upstream) — §3.8 carries the sole canonical chain description. Helper ownership unchanged.
- **Canonical fixtures:** the new spec clones the existing small-profile views (`@synthetic/small/classesById.json?raw`, `assignmentsByKey.json?raw`) plus local corruption probes; the legacy suites keep the medium profile. No generator extension; existing normalisation suites stay unchanged as the equivalence contract.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/assignmentAssessment src/frontend/src/services/googleClassrooms` green.
- `npm run lint:frontend:check`, `npm run typecheck:all` green.
- Data-shape docs describe the delivered single-pass chain with no stale markers and no stale "final parse" sentences (the pre-plan `Not implemented` entries were removed upstream in `85b1199d`; the delivered chain was folded into the canonical statements); §3.8/§9.29 read-chain sentences reconciled. Data Shapes Agent sign-off recorded before this section's code-review sign-off.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Baseline established 2026-11-16 on branch `feat/heatmaps-selection-perf` (regression-checker session `feat/heatmaps-selection-perf`, mode baseline, report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/baseline/baseline.txt`). Overall status FAILING with 1 pre-existing failure: `backend-lint-check` (4 `max-lines` warnings at line 501 in `tests/backend-api/assignmentDefinitionPartials.unit.test.js`, `tests/dbManager/dbManager.test.js`, `tests/googleClassroom/classroomApiClient.test.js`, `tests/utils/batchUpdateUtility.test.js`; exit code 1 from warnings). Accepted technical debt: backend test files untouched by this frontend-only plan. All other 7 checks passing. Section 1 Red phase started. Red phase complete: new spec `src/frontend/src/services/assignmentAssessment/assignmentReadSinglePass.spec.ts` + test-only helper `src/frontend/src/test/assignmentAssessment/itemSchemaEvaluationCounter.ts`; intended-red inventory confirmed (class path 4 item evaluations/item, full path 3, `__proto__` 1-then-dropped); all 21 pre-existing suites (270 tests) green unchanged; red review PASS with zero red-phase findings (`.opencode/scratchpad/review-section1-red.md`), two non-blocking green-phase notes: (1) pre-check relocation for taskId-mismatch items is pinned by plan text only, no extra probe; (2) `__proto__` zero-eval pin covers the valid branch, corrupt-branch output pinned by existing untouched suites. Green phase complete: the four authorised production files changed; targeted suites 22 files / 273 tests all green; lint, typecheck green; LOC 324/417/39/50 (all under 500); green review PASS with zero findings (`.opencode/scratchpad/review-section1-green.md`). Docs sync complete (both delegations returned): Data Shapes Agent reconciled the delivered chain into the four data-shape docs (`assignment.md`, `student-submission.md`, `abclass.md`, `assessment.md` — 32 insertions / 26 deletions, all chain-description sentences; the pre-plan `Not implemented` entries were removed upstream in commit `85b1199d`, so no markers existed to remove) — Data Shapes Agent sign-off recorded here before code-review sign-off; Docs agent corrected the §3.8 read-chain sentence in `frontend-shared-helpers-and-abstraction-standards.md` (one line; the planned §9.29 entry-1 sentence no longer exists, also removed upstream in `85b1199d`, leaving §3.8 as the sole canonical chain description). Plan compaction complete: Section 1 84 → 34 lines, one hunk, pre-compaction backup at `.opencode/scratchpad/feat-heatmaps-selection-perf-section-1-pre-compaction.md`. Section regression gate: `npm run regression-checker` comparison run at 2026-11-16T19:48:52.164Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-16T19-48-52.164Z/comparison.txt`) — overall status FAILING solely from the accepted pre-existing `backend-lint-check` debt (the same four `max-lines` warnings as baseline); Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing. Gate passed: zero regressions, zero unaccounted new failures.
- **Commit record (Section 1):** branch `feat/heatmaps-selection-perf`; commit `133abd1d` — exact message `feat(#349): single-pass read validation in assignment/class read path` (12 files changed, 824 insertions, 263 deletions). `git push -u origin feat/heatmaps-selection-perf` succeeded: new remote branch created and local branch set to track `origin/feat/heatmaps-selection-perf`.
- **Deviations from plan:** Vitest test filters are resolved relative to the `src/frontend` package cwd, so the plan's `npm run test:frontend -- src/frontend/src/services/...` form finds no files; the working equivalent is `npm run test:frontend -- src/services/assignmentAssessment src/services/googleClassrooms` (same scope, path prefix dropped). Recorded here as the authoritative invocation for all later sections; the plan's command lines are otherwise unchanged.
- **Follow-up implications for later sections:** Section 3's docs sync must ADD the helper-register entry for the #342 wrapper (the pre-plan §9.30 entry was never landed; doc's actual §9.30 is unrelated) and Section 6 re-verifies the data-shape chain descriptions and §3.8 sentence as amended above. The deferred `assessment.md:529` merge-conflict-URL corruption awaits a user decision (recorded in the plan's deferred table).

### Optional `@remarks` JSDoc follow-through

- Delivered: `assignmentReadNormalisation.ts` records why parent passes omit and reassemble collections and why the unsafe-key drop precedes evaluation; `corruptedArtifact` carries a schema-shaped-construction remark; both service wrappers' `@remarks` describe the delivered chain.

---

## Section 2 — #343: deferred selection derivation on the Heatmaps surface

### Outcome

Delivered on branch `feat/heatmaps-selection-perf`: `useHeatmapsPageData` derives every expensive consumer from a deferred copy of the whole `selection` (`useDeferredValue`), while the selector controls, option lists and per-assignment fetches stay on the urgent value, so selection changes stay responsive. The pipeline gate carries the cached-class-switch guard, preview inputs pair to the urgent-keyed query results by `assignmentId` with a pending placeholder for removals during the lag, and `isRefreshing` covers the `(classId, assignmentIds)` lag. `assembleMergedPreviewData`'s missing-input throw is untouched. No production file outside the hook, pipeline and preview-query modules changed; a new hook spec and two surface pins cover the contract.

### Retained for later sections

- **Deferred vs urgent.** Deferred: `shouldRunHeatmapsPipeline`, `runHeatmapsPipeline`, merged-preview assembly (`mergedPreview`), the table (`mergedResult`), the summary cards (`useHeatmapSelectionSummary`) and the `usePagePostAnalysisTasks` binding. Urgent: the returned `selection`, the selection actions, the topic/assignment option lists, the per-class `useQuery` key and the per-assignment `useQueries` list.
- **Busy signal.** `isRefreshing` is `true` while the deferred `(classId, assignmentIds)` differ from the urgent ones, OR'd with the existing query-fetching signal; `topicKeys` are excluded, so topic-only changes do not flash. Refresh stays disabled during the lag — accepted and pinned.
- **Guard.** `shouldRunHeatmapsPipeline` returns `false` when `classFull.classId !== deferredClassId` (`classFull.classId === deferred selection.classId`), so a cached-class switch during the lag cannot pair the new class with the previous class's deferred assignment IDs. `deferredClassId` remains optional (`undefined` skips the check) only to keep the unchanged pre-deferral direct guard spec (`heatmapsPipeline.spec.ts`, 3-arg calls) green; the hook always supplies it.
- **Id-keyed pairing and pending-input shape.** `buildPreviewInputsByAssignmentId(assignmentIds, previewResults)` in `heatmapsPreviewQueries.ts` maps results by `assignmentId`; a deferred ID absent from the urgent results is synthesised as `{ assignmentId, isPending: true, isError: false, data: null }`, which `buildPreviewInput` converts to `{ isLoading: true, hasError: false, lookup: EMPTY_LOOKUP }`. Urgent-only results are ignored. The projected `AssignmentPreviewResult` is `{ assignmentId, isPending, isError, data }`, built in the `useQueries` `combine`; `isError` is currently `result.status === 'error'` (React Query's own derivation).
- **Intended transient.** On the empty→selected transition the defensive skeleton plus `aria-busy` shows until the deferred pipeline yields a merged result; deliberate, not a regression.
- **Throw preservation.** `assembleMergedPreviewData.ts` is unchanged and still throws on a missing input; the hook's boundary catches, logs via `logPipelineError` and surfaces `assemblyError` as the `adapterError` branch.
- **Touched files and LOC headroom.** `useHeatmapsPageData.ts` 488, `heatmapsPipeline.ts` 289, `heatmapsPreviewQueries.ts` 130 — under 500 each; no split. `heatmapsPreviewQueries.ts` is the designated overflow home if a later section pushes the hook past 500.
- **Authoritative Vitest invocation:** `npm run test:frontend -- src/features/taskHeatmap` (filters resolve relative to the `src/frontend` cwd).
- **Test harness.** New and existing hook suites use the query-level `useHeatmapsPageData.*` harness, not the embedded `TaskHeatmapPage` mock family. `useHeatmapsPageData.deferredSelection.spec.ts` swaps `useDeferredValue` for a `vi.hoisted` frozen/settle double because `act()` flushes concurrent work in one pass; it pins the deferred-output hold, the class-switch guard, removal-during-lag pending input, id pairing, both busy cases and the empty→selected transient. The surface spec pins the Refresh-disabled and skeleton states.
- **Helper decision (reconciled):** keep local — no new shared helper and no canonical-doc register entry; `buildPreviewInputsByAssignmentId` stays in `heatmapsPreviewQueries.ts`.
- **Section 5 hardening follow-ups:** (1) expose `isError` on `createMockQueryResult`'s returned object (`src/frontend/src/test/heatmapsPageDataFixtures.ts`) and revert the `combine` projection to `result.isError`; (2) make `deferredClassId` a required parameter once the 3-arg direct guard spec is migrated.

### Section checks

- `npm run test:frontend -- src/features/taskHeatmap` green.
- `npm run lint:frontend:check` green (0 errors; remaining `max-lines` warnings are pre-existing and outside this feature).
- `npm run typecheck:all` green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red phase: new `useHeatmapsPageData.deferredSelection.spec.ts` (controllable `useDeferredValue` double, six intended-red tests) plus two additive surface pins in `HeatmapBuilderSurface.spec.tsx`; all six fail for the missing #343 behaviour, existing suites green; Red Review PASS with zero in-scope findings (`.opencode/scratchpad/review-section2-red.md`). Green phase: three authorised production files changed (`useHeatmapsPageData.ts`, `heatmapsPipeline.ts`, `heatmapsPreviewQueries.ts`); 48 files / 390 tests green, `lint:frontend:check` 0 errors, `typecheck:all` exit 0, LOC 488/289/130 (all under 500); no test files edited. Green Review PASS with zero in-scope findings (`.opencode/scratchpad/review-section2-green.md`); its Playwright `heatmaps` E2E run was 8/8. Docs sync: four canonical docs updated (`frontend-loading-and-width-standards.md` new §4.1, `frontend-react-query-and-prefetch.md` §6, `frontend-shared-helpers-and-abstraction-standards.md` §3.3, `data-analysis-architecture.md` post-analysis class-ID statement) plus one JSDoc-only edit to the `isRefreshing` field doc in `useHeatmapsPageData.ts`; post-sync lint/typecheck/focused tests re-run green. No new page; Section 2's helper decision stays "keep local" (no §9 register entry). One out-of-scope docs drift reported and logged (nitpicks file). Plan compaction: Section 2 97 → 37 lines, backup at `.opencode/scratchpad/feat-heatmaps-selection-perf-section-2-pre-compaction.md`. Section regression gate: `npm run regression-checker` comparison run at 2026-11-16T21:40:05.035Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-16T21-40-05.035Z/comparison.txt`) — overall status FAILING solely from the accepted pre-existing `backend-lint-check` debt (the same four `max-lines` warnings as baseline); Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing. Gate passed: zero regressions, zero unaccounted new failures.
- **Deviations from plan:** Three behaviour-preserving deviations, all assessed acceptable by Green Review: (1) `runAnalyserStep` calls `analyse(analyserInput)` instead of `analyse(analyserInput, 'averaging')` — the service's default is `'averaging'` (`dataAnalysisService.ts:78`) and the other production caller already uses the single-argument form; required to satisfy the red class-switch assertion's single-argument matcher. (2) The `useQueries` combine projects `isError: result.status === 'error'` instead of `result.isError` (React Query derives `isError` from `status === 'error'`); this works around the pre-existing `createMockQueryResult` fixture gap, logged in the nitpicks file and scheduled for a Section 5 test-infrastructure fix. (3) `deferredClassId` is an optional parameter on `shouldRunHeatmapsPipeline` solely to keep the unchanged 3-argument direct guard spec green; the hook always supplies it; scheduled to become required in Section 5. The id-keyed pairing helper was extracted to `heatmapsPreviewQueries.ts` as the plan's LOC-overflow provision allows (the hook would otherwise approach 500). The Section 1 Vitest filter deviation (`src/features/...` relative to the `src/frontend` cwd) carries forward as authoritative.
- **Follow-up implications for later sections:** Section 5 must carry both hardening follow-ups (expose `isError` on `createMockQueryResult` and revert the combine projection; make `deferredClassId` required once the 3-arg guard spec migrates). Section 3's docs sync must ADD the #342 wrapper register entry (the pre-plan §9.30 entry was never landed; the doc's actual §9.30 is unrelated). Section 6 re-verifies the §4.1/§6/§3.3/data-analysis doc statements delivered by this section's docs sync.

### Optional `@remarks` JSDoc follow-through

- Delivered: the `useHeatmapsPageData.ts` module JSDoc records the deferred-derivation rationale, the memo key, the guard and id-keyed pairing with pending synthesis; `heatmapsPreviewQueries.ts` documents the pairing and pending-placeholder contract.

---

## Section 3 — #342: select all / select none dropdown header

### Objective

Add the select all / select none header to the Topics and Assignments dropdowns on the standalone Heatmaps page, per the layout spec, plus one E2E journey.

### Constraints

- One feature-local wrapper component under `features/taskHeatmap` renders the two multi-selects, owns the controlled `showSearch.searchValue` per Select, and supplies `popupRender` with the header (Checkbox "Select all" left, `Button type="link"` "Select none" right, space-between row, `APP_GAP_SM` spacing, `Divider` only with the header). Registered as planned `Not implemented` entry §9.30. (Premise correction recorded in Section 1 wrap-up: the pre-plan §9.30 entry was never landed — the doc's actual §9.30 is the unrelated always-fixed student-name-columns entry — so Section 3's docs sync must ADD a new register entry, e.g. §9.31, rather than flip a marker.)
- Header shown only when the control's options array (post-cascade, pre-search) has >1 entry.
- Select all unions shown options (search-query-matching via the configured `optionFilterProp: 'label'` filtering; Assignments also topic-cascade-narrowed) into the existing selection via `changeTopics`/`changeAssignments`. Select none clears the control's full selection.
- Controlled query reset only via `onSelect` (option selection); kept on deselect-toggle, tag removal, allow-clear, close/Escape, and header clicks.
- `onMouseDown` `preventDefault()` + `stopPropagation()` on the header so clicks neither close the dropdown nor steal focus.
- Checkbox states: checked = all shown selected; indeterminate = some; unchecked/not-indeterminate on zero search matches.
- Accessible names: "Select all topics" / "Select none topics" / "Select all assignments" / "Select none assignments"; visible text "Select all" / "Select none".
- Class dropdown unchanged.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- @docs/plans/SPEC.md (decision 5, #342 contract)
- @docs/plans/HEATMAP_SELECTION_LAYOUT.md
- @docs/developer/frontend/frontend-testing.md
- @src/frontend/src/features/taskHeatmap/HeatmapSelectionBar.tsx
- @src/frontend/src/features/taskHeatmap/selectionCascade.ts

Implementation mandatory docs:

- @docs/plans/SPEC.md
- @docs/plans/HEATMAP_SELECTION_LAYOUT.md
- `src/frontend/AGENTS.md` (auto-injected; listed for reference)
- @docs/developer/frontend/frontend-architecture.md (new feature file)
- @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md (§9.30 planned entry)
- @docs/developer/frontend/frontend-spacing-and-padding-standards.md
- @src/frontend/src/features/taskHeatmap/HeatmapSelectionBar.tsx
- @src/frontend/src/features/taskHeatmap/HeatmapBuilderSurface.tsx
- @docs/developer/frontend/ant-design-docs-cache/select.md

Code Reviewer mandatory docs:

- `AGENTS.md`, `src/frontend/AGENTS.md` (auto-injected; listed for reference)
- @docs/plans/HEATMAP_SELECTION_LAYOUT.md

Playwright mandatory docs:

- @docs/developer/frontend/frontend-playwright-e2e.md
- @docs/plans/HEATMAP_SELECTION_LAYOUT.md

### Shared helper plan

- Helper: select-all dropdown header wrapper under `src/frontend/src/features/taskHeatmap/` — decision **keep local (new feature-local component)**, owning controlled query state, scope computation, checked/indeterminate derivation, dispatch, mousedown guard.
- Owning path: new file in `features/taskHeatmap/`; call sites: the Topics and Assignments Selects in `HeatmapSelectionBar.tsx`.
- Canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — the pre-plan §9.30 planned entry was never landed (the doc's actual §9.30 is the unrelated always-fixed student-name-columns entry); Section 3's docs sync ADDS the wrapper register entry (next free number, e.g. §9.31) with the wrapper description (renders the two multi-selects, owns per-Select controlled query state), and Section 6 re-verifies it.

### Data-shape planning block

- None — UI-only change; no schema, persistence, API, or transport change.

### Canonical-fixture note

- Component tests reuse the existing `HeatmapSelectionBar.spec.tsx` fixtures (181 LOC spec) and mock setup. E2E reuses the existing heatmap scenario helpers (`src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`, `task-heatmap-fixtures.ts`, `task-heatmap-class-fixtures.ts`) consumed by the existing journeys (`src/frontend/e2e-tests/heatmaps.spec.ts`, `heatmaps-layout.spec.ts`). No generator extension.

### File sizing (LOC)

- New wrapper file: ~150-180 LOC projected. `HeatmapSelectionBar.tsx`: 364 → ~330-390 projected depending on how much moves into the wrapper — under 500 either way; re-verify at Green and split the wrapper out if the bar itself would exceed 500 (it will not).

### Acceptance criteria

- Header presence, union select-all scope (search + topic cascade), select-none, dropdown-stays-open, checked/indeterminate states, and the four query-outcome assertions all behave per layout spec.
- Cascade intact: topic select-all still clears assignments whose topic dropped out; clearing all topics keeps the assignment selection.
- E2E journey green: select-all in the Assignments dropdown on the standalone Heatmaps page, including with an active search query.

### Required test cases (Red first)

1. Header hidden when ≤1 option; shown when >1.
2. Select all with no query: unions all options (assignments respect topic cascade); dispatches through the reducer.
3. Select all with active query: unions only query-matching options; query kept after the header click.
4. Select none clears the full selection; query kept.
5. Query outcomes: cleared after option selection; kept after deselect-toggle; kept after Escape-close-reopen; kept after tag removal with active query.
6. Dropdown stays open on header clicks; checkbox checked/indeterminate/unchecked incl. zero-match case.
7. Topic select-all cascade: assignments whose topic dropped out are cleared; select-none on topics keeps assignments.
8. E2E (Playwright agent): merged Heatmaps journey — select-all in Assignments dropdown, with and without an active search query.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap/HeatmapSelectionBar.spec.tsx` (plus new wrapper spec) green.
- `npm run test:frontend:e2e -- heatmaps` green (Playwright agent).
- `npm run lint:frontend:check`, `npm run typecheck:all` green; LOC re-check.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

### Optional `@remarks` JSDoc follow-through

- Record in the wrapper why the query state is controlled (exact mirror of the rendered query) and why the reset is discriminated via `onSelect`.

---

## Section 4 — #352: metric tone lookup tidy

### Objective

Replace the five-case `resolveDiscreteCellStyle` switch with a `METRIC_TONE_CELL_STYLE` record lookup, identical return values.

### Constraints

- Pure refactor in `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`; no behaviour change.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- @docs/plans/SPEC.md (decision 6)
- @docs/developer/frontend/frontend-testing.md
- @src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts

Implementation mandatory docs:

- @docs/plans/SPEC.md
- `src/frontend/AGENTS.md` (auto-injected; listed for reference)
- @src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts

Code Reviewer mandatory docs:

- `AGENTS.md`, `src/frontend/AGENTS.md` (auto-injected; listed for reference)

### Shared helper plan

- Decision: **reuse existing** — `METRIC_TONE_CELL_STYLE` already exists at `metricTone.ts:82`; no new helper, no canonical-doc entry.

### Data-shape planning block

- None.

### Canonical-fixture note

- Existing `metricTone` suites cover the tones; add a lookup-equivalence case per tone if not already asserted. No generator involvement.

### File sizing (LOC)

- `metricTone.ts`: 337 → ~330. Under 500; no split.

### Acceptance criteria

- `resolveDiscreteCellStyle(token)` returns `METRIC_TONE_CELL_STYLE[token]` for every tone; existing metric-display suites green.

### Required test cases (Red first)

1. Per-tone equivalence: resolver output `toBe` the record entry for each `MetricToneColor`. Note: this is a pre-refactor pin — the current switch already returns the record entries, so the test is green before and after the refactor; the Red gate for this section is satisfied by the pin existing and staying green through the refactor.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay` green; lint and typecheck green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

### Optional `@remarks` JSDoc follow-through

- None.

---

## Regression and contract hardening

### Objective

Prove no behaviour regressed across every touched module and the read-path equivalence contract.

### Constraints

- Focused runs first, then the full frontend gate.

### Acceptance criteria

- All suites named in `SPEC.md` Testing expectations green, including `assignmentReadNormalisation.*`, `classDetailService.spec.ts`, `assignmentAssessmentService.spec.ts`, `useHeatmapsPageData.*`, `HeatmapBuilderSurface.spec.tsx`, `HeatmapSelectionBar.spec.tsx`, `heatmapsPipeline.spec.ts`, `heatmapsPreviewQueries.spec.ts`, `assembleMergedPreviewData.*`, `heatmapsSurfaceState.spec.ts`, `useHeatmapSelectionSummary.spec.ts`, `selectionCascade.spec.ts`, and the `metricTone` suites.
- `npm run lint:frontend:check`, `npm run typecheck:all`, and `npm run run-all-checks` green.

### Required test cases/checks

1. `npm run test:frontend -- src/frontend/src/services/assignmentAssessment src/frontend/src/services/googleClassrooms src/frontend/src/features/taskHeatmap src/frontend/src/services/dataAnalysis`
2. `npm run test:frontend:e2e -- heatmaps`
3. `npm run lint:check`, `npm run typecheck:all`, `npm run run-all-checks`

### Section checks

- All commands above green; LOC counts re-verified for every touched file.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

---

## Documentation and rollout notes

### Objective

Finalise the planned-only entries and keep canonical docs consistent with the delivered behaviour.

### Constraints

- Only touch docs relevant to the changed areas. The data-shape planned entries (Data Shapes Agent) and the §3.8/§9.29 read-chain sentences (Docs agent) were already finalised in Section 1's docs sync (per `AGENTS.md` §5 step 7 and §7.2); this section only re-verifies them plus the §9.30 register entry flip (Docs agent).

### Acceptance criteria

- Cross-section re-verification: the four data-shape docs (`assignment.md`, `student-submission.md`, `abclass.md`, `assessment.md`) describe the delivered single-pass chain with no stale "final parse" or `Not implemented` wording, and `frontend-shared-helpers-and-abstraction-standards.md` §3.8 carries the corrected read-chain sentence (the pre-plan planned entries and the §9.29 chain sentence were removed upstream in `85b1199d`; Section 1 folded the delivered chain into the canonical statements).
- Cross-section re-verification (Section 6): `frontend-shared-helpers-and-abstraction-standards.md` helper-register entry for the #342 wrapper is `Implemented` with the wrapper description (renders the two multi-selects, owns per-Select controlled query state). NOTE: the pre-plan §9.30 planned entry was never landed in the doc — the doc's actual §9.30 is the unrelated always-fixed student-name-columns entry — so Section 3's docs sync must ADD the wrapper entry (next free number, e.g. §9.31) rather than flip a marker.
- No other doc changes; no migration or rollout dependency.

### Required checks

1. Re-verify the Section 1 docs sync landed for both delegations separately: Data Shapes Agent reconciliation of the four data-shape docs, and Docs agent correction of the §3.8/§9.29 read-chain sentences.
2. Docs agent pass on the helper register §9.30 flip.
3. Confirm SPEC/layout companion references are satisfied.

### Delegation mandatory reads

Data Shapes Agent mandatory docs (re-verification): @docs/developer/data-shapes/INDEX.md, @docs/developer/data-shapes/assignment.md, @docs/developer/data-shapes/student-submission.md, @docs/developer/data-shapes/abclass.md, @docs/developer/data-shapes/assessment.md
Docs agent mandatory docs: @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md (§3.8, §9.29, §9.30)

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

### Optional `@remarks` JSDoc review

- Verify the `@remarks` planned in Sections 1-3 exist in the code; record `None` where not needed.

---

## Suggested implementation order

1. Section 1 (#349 single-pass read validation) — independent enabler; shrinks every later read cost.
2. Section 2 (#343 deferred selection) — the headline fix; depends on nothing from Sections 3-4.
3. Section 3 (#342 select-all header + E2E) — builds on Section 2's hook (selection actions unchanged) and the layout spec.
4. Section 4 (#352 tidy) — independent; can run any time.
5. Section 5 (regression hardening).
6. Section 6 (docs and rollout).

---

## Deferred and Out-of-Scope Findings

| Finding                                                                                                                   | Severity                                 | Scope rationale                                                                                                                                                | Evidence                                                                                       | Disposition | User decision                                |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------- |
| #350 — re-key post-analysis effect on data inputs + attempt identity                                                      | minor (CPU-only redundancy)              | Touches shared `usePagePostAnalysisTasks.ts`/`usePostAnalysisTasks.ts` used beyond the heatmaps surface; its issue states it deserves its own change and tests | GitHub issue #350; `useHeatmapsPageData.ts:342-348`                                            | noted       | Excluded from this unit by user, 13 Nov 2026 |
| #351 — pipeline gates must follow `isDatasetRenderable` (loading dead-end for failed-but-recovered dataset)               | material (user-visible endless skeleton) | Touches `useClassPageData.ts` too and requires a warm-up-retry reachability investigation first                                                                | GitHub issue #351; `heatmapsPipeline.ts:208-210`, `useClassPageData.ts:264-276`                | noted       | Excluded from this unit by user, 13 Nov 2026 |
| #323 — merged-heatmap keyboard journey + nine coverage polish items                                                       | minor                                    | Test-coverage polish, unrelated to this unit's contracts                                                                                                       | GitHub issue #323                                                                              | disregarded | Out of scope, 13 Nov 2026                    |
| #344 — sticky bottom scrollbar                                                                                            | minor                                    | Different surface behaviour (tables), separate SPEC.md at repo root already drafted                                                                            | GitHub issue #344; root `SPEC.md`                                                              | disregarded | Out of scope, 13 Nov 2026                    |
| #348 — Collapse items-prop migration                                                                                      | nitpick                                  | Unrelated component migration                                                                                                                                  | GitHub issue #348                                                                              | disregarded | Out of scope, 13 Nov 2026                    |
| Merge-conflict URL pasted mid-line in the File Index entry (corrupts the entry; casualty of the #355 docs reconciliation) | material (docs-only)                     | `docs/developer/data-shapes/assessment.md` File Index is outside this section's change surface; content repair is a separate docs fix                          | `docs/developer/data-shapes/assessment.md:529`; Section 1 docs sync (Data Shapes Agent return) | noted       | (pending user decision)                      |
