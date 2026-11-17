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
- **Commit record (Section 2):** branch `feat/heatmaps-selection-perf`; commit `d566c6ea` — exact message `feat(#343): defer heatmap selection derivation on standalone surface` (10 files changed, 769 insertions, 133 deletions). `git push` succeeded (`60dd5ea1..d566c6ea` on `origin/feat/heatmaps-selection-perf`).
- **Deviations from plan:** Three behaviour-preserving deviations, all assessed acceptable by Green Review: (1) `runAnalyserStep` calls `analyse(analyserInput)` instead of `analyse(analyserInput, 'averaging')` — the service's default is `'averaging'` (`dataAnalysisService.ts:78`) and the other production caller already uses the single-argument form; required to satisfy the red class-switch assertion's single-argument matcher. (2) The `useQueries` combine projects `isError: result.status === 'error'` instead of `result.isError` (React Query derives `isError` from `status === 'error'`); this works around the pre-existing `createMockQueryResult` fixture gap, logged in the nitpicks file and scheduled for a Section 5 test-infrastructure fix. (3) `deferredClassId` is an optional parameter on `shouldRunHeatmapsPipeline` solely to keep the unchanged 3-argument direct guard spec green; the hook always supplies it; scheduled to become required in Section 5. The id-keyed pairing helper was extracted to `heatmapsPreviewQueries.ts` as the plan's LOC-overflow provision allows (the hook would otherwise approach 500). The Section 1 Vitest filter deviation (`src/features/...` relative to the `src/frontend` cwd) carries forward as authoritative.
- **Follow-up implications for later sections:** Section 5 must carry both hardening follow-ups (expose `isError` on `createMockQueryResult` and revert the combine projection; make `deferredClassId` required once the 3-arg guard spec migrates). Section 3's docs sync must ADD the #342 wrapper register entry (the pre-plan §9.30 entry was never landed; the doc's actual §9.30 is unrelated). Section 6 re-verifies the §4.1/§6/§3.3/data-analysis doc statements delivered by this section's docs sync.

### Optional `@remarks` JSDoc follow-through

- Delivered: the `useHeatmapsPageData.ts` module JSDoc records the deferred-derivation rationale, the memo key, the guard and id-keyed pairing with pending synthesis; `heatmapsPreviewQueries.ts` documents the pairing and pending-placeholder contract.

---

## Section 3 — #342: select all / select none dropdown header

### Outcome

Delivered on branch `feat/heatmaps-selection-perf`: a new feature-local `SelectAllDropdownHeader.tsx` renders both the Topics and Assignments multi-selects (two call sites in `HeatmapSelectionBar.tsx`), owns each Select's controlled search query, and supplies the `popupRender` header (Checkbox "Select all" left, `Button type="link"` "Select none" right, `Divider` below; hidden when the control has fewer than two options). Select-all unions the options the dropdown currently shows into the existing selection through `changeTopics`/`changeAssignments`, so `selectionCascadeReducer` stays the only selection state machine; select-none clears that control's whole selection. The Class dropdown is unchanged. One merged Playwright journey covers select-all with and without an active query.

### Retained for later sections

- **Wrapper and register entry.** Keep the wrapper feature-local; no promotion to a shared helper. `frontend-shared-helpers-and-abstraction-standards.md` §9.33 records it (two call sites). Premise correction: the pre-plan §9.30 entry was never landed (the actual §9.30 is the unrelated always-fixed student-name-columns entry) and §9.31/§9.32 are taken by rejected designs, so §9.33 is the delivered number; the three layout-spec references in `HEATMAP_SELECTION_LAYOUT.md` now cite §9.33.
- **Controlled query contract.** `showSearch.searchValue` + `onSearch` keep the tracked value an exact mirror of the rendered query. The query is reset **only** from `onSelect` (option selection) and is kept on deselect-toggle, tag removal, allow-clear, close/Escape and header clicks — a deliberate divergence from `autoClearSearchValue`, user-confirmed 13 November 2026. Mechanism: `autoClearSearchValue: false` plus the controlled value neutralise rc-select's clearing on deselect-toggle and blur, and `onClear` arms a one-shot suppression of the empty `onSearch` the allow-clear control emits (armed only when a query exists, so it never swallows the next typed character). `onChange` cannot discriminate the reset because it also fires for tag removal and allow-clear.
- **Select-all scope.** Header shown only when the control's options array (post-cascade, pre-search) has more than one entry. Scope is exactly the options the dropdown renders: `optionFilterProp: 'label'` case-insensitive match against the controlled query, further narrowed for Assignments by the active topic cascade. Select-all unions into the existing selection (never shrinks) and dispatches the full result through the owning callback; select-none clears regardless of query; clearing all topics leaves assignments intact. Checkbox state: checked = every shown option selected, indeterminate = some, unchecked/not-indeterminate on zero query matches.
- **Interaction and accessibility.** `onMouseDown` `preventDefault()` + `stopPropagation()` on the header keeps the dropdown open and focus in place. Accessible names "Select all topics" / "Select none topics" / "Select all assignments" / "Select none assignments" over visible text "Select all" / "Select none". Header actions stay pointer-operated (Ant Design does not move focus into the portal popup); native option toggling remains keyboard-operable.
- **E2E journey and fixture additions.** `src/frontend/e2e-tests/heatmaps.spec.ts` gains "selects all assignments from the dropdown header with and without a search query": both options listed, select-all unions, select-none clears, then with query `Spreadsheet` select-all adds only the matching option while query and dropdown persist. Fixtures: `distinctSecondAssignmentTitle` scenario option, `HEATMAP_SECOND_DEFINITION_KEY`, `HEATMAP_SECOND_ASSIGNMENT_DISPLAY_TITLE` ('9. Spreadsheet Model'), `buildDistinctSecondAssignmentDefinitionPartial()` and `applyDistinctDefinitionToSecondAssignment()` — a second definition partial so a query can tell the two labels apart. No synthetic-generator extension.
- **Escape deviation.** The "Escape-close-reopen" query case is pinned via Tab (focus loss) then reopen: rc-select reads legacy `which`/`keyCode`, which `user-event` leaves at zero in happy-dom, so Escape does not close the dropdown. The contract "query kept across close" is unchanged.
- **`post-analysis-metadata.feedback.spec.ts` rework.** The controlled query is kept on keyboard deselect-toggle, so the helper's second consecutive `keyboard.type(label)` appended to the residual query and matched no option. The test's local `chooseOptionWithKeyboard` helper now clears first with `ControlOrMeta+a` + Backspace **only when `inputValue() !== ''`** (guarded because, on an empty multiple-mode input, antd treats Backspace as "remove last selected tag"). Production code and the product contract were **not** changed: the residual-query behaviour is the delivered, user-confirmed contract, and the spec's assumption was the defect.
- **LOC.** `SelectAllDropdownHeader.tsx` 247 (over the 150–180 projection because of the required `@remarks` and lint-mandated JSDoc/typed helpers), `HeatmapSelectionBar.tsx` 327, `HeatmapSelectionBar.spec.tsx` 425, `HeatmapSelectionBar.selectAllHeader.spec.tsx` 438 — all under the 500 early-warning and 550 decomposition thresholds; no split.
- **Commands (authoritative, `src/frontend`-relative).** `npm run test:frontend -- src/features/taskHeatmap`; `npm run test:frontend:e2e -- heatmaps`; `npm run lint:frontend:check`; `npm run typecheck:all`.

### Section checks

- Focused component specs 22/22 green (`HeatmapSelectionBar.selectAllHeader.spec.tsx` plus the additive `HeatmapSelectionBar.spec.tsx` cases).
- E2E heatmaps 9/9 green, including the new select-all journey.
- `post-analysis-metadata.feedback.spec.ts` 8/8 green after the gate rework.
- `npm run lint:frontend:check` 0 errors; `npm run typecheck:all` exit 0; every touched file under 500 LOC.
- Section regression gate passed on re-run at 2026-11-17T00:52:09.015Z: 0 regressions, 0 new failures, sole failure the accepted pre-existing `backend-lint-check` debt.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red phase ran two test owners in parallel: Testing Specialist (new `HeatmapSelectionBar.selectAllHeader.spec.tsx` + additive `HeatmapSelectionBar.spec.tsx`) and Playwright (merged `heatmaps.spec.ts` journey + three E2E helper additions). Initial Red Review FAIL with two in-scope findings — (1) topic-select-all clearing dropped-topic assignments not pinned through the bar, (2) missing E2E enabled+focused assertions before typing — both fixed by their owners; Red re-review PASS (`.opencode/scratchpad/review-section3-red-re-review.md`). Green phase: new `SelectAllDropdownHeader.tsx` instantiated twice from the bar; 22/22 component tests, 49 files / 410 taskHeatmap tests, E2E heatmaps 9/9, lint 0 errors, typecheck exit 0. Initial Green Review FAIL with one JSDoc-wording nitpick on `handleClear`; fixed (comment-only); Green re-review PASS (`.opencode/scratchpad/review-section3-green-rereview.md`). Separately-wrapper requirement verified structurally: one component, two call sites, no header logic in the bar. Docs sync: added the §9.33 register entry and updated three layout-spec references from the stale §9.30/Not-implemented marker; no source JSDoc edits; no new page. Two out-of-scope docs drift items reported and logged in the nitpicks file. Plan compaction: Section 3 102 → 34 lines, backup at `.opencode/scratchpad/feat-heatmaps-selection-perf-section-3-pre-compaction.md`.
- **Section regression gate (rework path):** First gate at 2026-11-17T00:03:48.333Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T00-03-48.333Z/comparison.txt`) FAILED with 1 regression + 1 new failure in `frontend-e2e-check`: `post-analysis-metadata.feedback.spec.ts` test `shows and dismisses persistent safe save-failure feedback on standalone Heatmaps`. Cause: the delivered controlled `searchValue` is kept after a keyboard deselect-toggle (`onSelect`-only reset, a user-confirmed contract), so the test's second consecutive `keyboard.type(label)` appended to the residual query (`Synthetic Assignment Definition 2Synthetic Assignment Definition 2`), matching no option. Production contract unchanged; a minimal 8-line guarded keyboard-clear was added to the test's local `chooseOptionWithKeyboard` helper (`ControlOrMeta+a` + Backspace only when `inputValue() !== ''`), reviewed PASS (`.opencode/scratchpad/review-s3-gate-rework.md`; 8/8 focused, 5/5 repeat-each, no flakiness). Reworked gate at 2026-11-17T00:52:09.015Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T00-52-09.015Z/comparison.txt`): Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing (sole failure = accepted pre-existing `backend-lint-check` debt). Gate passed.
- **Commit record (Section 3):** branch `feat/heatmaps-selection-perf`; commit `b1435a66` — exact message `feat(#342): add select all / select none dropdown header on Heatmaps` (12 files changed, 1136 insertions, 149 deletions). `git push` succeeded (`b4de5069..b1435a66` on `origin/feat/heatmaps-selection-perf`).
- **Deviations from plan:** (1) The plan's "Escape-close-reopen" query case is pinned via Tab (focus loss) then reopen, because rc-select reads legacy `which`/`keyCode` that `user-event` leaves at zero in happy-dom, so Escape does not close the dropdown; the contract "query kept across close" is unchanged. (2) The wrapper is 247 LOC versus the 150–180 projection (required `@remarks` and lint-mandated JSDoc/typed helpers); well under the 500/550 thresholds, no split. (3) The plan's suggested register entry "e.g. §9.31" was wrong — §9.31 and §9.32 are already taken by rejected designs — so docs sync used the next free number §9.33. (4) The Section 1 Vitest/E2E filter deviation (`src/features/...` relative to the `src/frontend` cwd) carries forward as authoritative.
- **Follow-up implications for later sections:** Section 6 must (a) retire SPEC.md's two "planned Not implemented entry" sentences (lines 78, 148) now that §9.33 is delivered, (b) update its own references from "§9.30 register entry flip" to §9.33 and re-verify the §9.33 register entry and layout-spec references, and (c) re-check the controlled-query contract in the regression-hardening pass. Sections 4 and 5 are unaffected by this section.

### Optional `@remarks` JSDoc follow-through

- Delivered: the wrapper's `@remarks` records why the query state is controlled (exact mirror of the rendered query), why the reset is discriminated via `onSelect`, and why the `autoClearSearchValue: false` / `onClear` suppression is needed.

---

## Section 4 — #352: metric tone lookup tidy

### Outcome

Delivered on branch `feat/heatmaps-selection-perf`: `resolveDiscreteCellStyle` is now a single total lookup (`METRIC_TONE_CELL_STYLE[token]`), replacing the five-case switch with identical return values for every tone. The function stays module-private, the exported record and its JSDoc are unchanged, and no public API, documented behaviour, data shape or config moved — so docs sync was not required. `metricTone.ts` 337 → 321 LOC.

### Retained for later sections

- **Single style source.** `METRIC_TONE_CELL_STYLE` (`Readonly<Record<MetricToneColor, CSSProperties>>`) is the sole source of discrete cell styles; `resolveDiscreteCellStyle` adds no branch and no fallback, and its `'default'` entry remains an ordinary record key.
- **Regression guard.** The new per-tone `it.each` pin in `metricTone.spec.ts` asserts `result.cellStyle` is the shared record entry by reference (`toBe`) for all five `MetricToneColor` tokens. It was green before and after the refactor, which is this section's Red contract: a pure tidy has no intended-red state.
- **Authoritative Vitest invocation (`src/frontend`-relative):** `npm run test:frontend -- src/services/dataAnalysis/metricDisplay`.
- **Measured LOC:** `metricTone.ts` 321, `metricTone.spec.ts` 375 — both under 500; no split.
- **No helper register or doc entry changed:** the module-private function and the existing exported record remain outside the shared-helper register, so Section 6 has nothing to re-verify for this section.

### Section checks

- Focused `metricDisplay` suites 7 files / 107 tests green.
- `npm run lint:frontend:check` 0 errors (16 pre-existing warnings elsewhere); `npm run typecheck:all` exit 0.
- Full frontend coverage 329 files / 3189 tests green.
- Red Review PASS (green-before-and-after pin, per this section's Red contract); Green Review PASS with zero findings.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red phase: Testing Specialist added a per-tone reference-identity pin in `metricTone.spec.ts` (all five `MetricToneColor` tokens via the public `resolveMetricTone` error branch to the private resolver), green before and after the refactor as the plan's special Red contract; Red Review PASS (`.opencode/scratchpad/review-section4-red.md`). Green phase: the five-case `resolveDiscreteCellStyle` switch became `return METRIC_TONE_CELL_STYLE[token];`; focused 7 files / 107 tests, full frontend coverage 329 files / 3189 tests, lint 0 errors, typecheck exit 0; Green Review PASS with zero findings (`.opencode/scratchpad/review-section4-green.md`). Docs sync SKIPPED: pure internal refactor of a module-private function with unchanged JSDoc and no documented behaviour, public API, data-shape or config change — no existing document needs reconciliation. Plan compaction: Section 4 65 → 30 lines, backup at `.opencode/scratchpad/feat-heatmaps-selection-perf-section-4-pre-compaction.md`. Section regression gate: `npm run regression-checker` comparison run at 2026-11-17T01:56:38.774Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T01-56-38.774Z/comparison.txt`) — Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing (sole failure = accepted pre-existing `backend-lint-check` debt). Gate passed.
- **Commit record (Section 4):** branch `feat/heatmaps-selection-perf`; commit `9950ca56` — exact message `refactor(#352): replace metric tone style switch with record lookup` (3 files changed, 45 insertions, 69 deletions). `git push` succeeded (`bf81c499..9950ca56` on `origin/feat/heatmaps-selection-perf`).
- **Deviations from plan:** None. The plan's projected ~330 LOC was conservative; measured `metricTone.ts` is 321. No new helper, no canonical register entry, no config or doc change.
- **Follow-up implications for later sections:** Section 5 re-exercises this suite in its full frontend gate; Section 6 has no doc re-verification obligation for this section (no helper register or documented behaviour changed).

### Optional `@remarks` JSDoc follow-through

- None — delivered as planned: the lookup keeps its existing minimal JSDoc and adds no `@remarks`.

---

## Regression and contract hardening

### Outcome

Delivered on branch `feat/heatmaps-selection-perf`: resolved the two Section 2 hardening follow-ups with behaviour-preserving changes and re-ran the full gate across every touched module. No contract, documented behaviour, data shape or config changed. Canonical docs were untouched (JSDoc updated in the same Green change; docs sync skipped), so Section 6 has no doc re-verification obligation arising from this section.

### Retained for later sections

- **Fixture and spec.** `createMockQueryResult` in `src/frontend/src/test/heatmapsPageDataFixtures.ts` now exposes `isError: status === 'error'` on its returned `UseQueryResult`; the new `src/frontend/src/test/heatmapsPageDataFixtures.spec.ts` pins it. `src/frontend/src/features/taskHeatmap/heatmapsPipeline.spec.ts` migrated five direct `shouldRunHeatmapsPipeline` calls to pass a 4th `deferredClassId` argument.
- **Final guard signature.** `shouldRunHeatmapsPipeline(classFull: ClassFull | null, selectedAssignmentIds: readonly string[], adpDatasetState: PageDatasetState, deferredClassId: string | null): boolean` in `src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts`. `deferredClassId` is a required 4th parameter with an unconditional `classFull.classId !== deferredClassId` guard; the old `!== undefined` skip branch and its JSDoc wording are gone.
- **Combine projection.** The `useQueries` `combine` in `src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts` uses `isError: result.isError` (reverted from `result.status === 'error'`). Section 2's retained notes (lines 100, 101, 120, 121) still describe `deferredClassId` as optional and the `status === 'error'` projection as live — pre-Section-5 state, now resolved; the Section 2 follow-up pointer (line 108) is discharged.
- **Authoritative commands (`src/frontend`-relative).** `npm run test:frontend -- src/services/assignmentAssessment src/services/googleClassrooms src/features/taskHeatmap src/services/dataAnalysis` (Section 1 deviation: filters resolve against the `src/frontend` cwd); `npm run test:frontend:e2e -- heatmaps`; `npm run lint:frontend:check`, `npm run lint:builder:check`, `npm run lint:synthetic:check`, `npm run typecheck:all`, `npm run test:coverage`, `npm run build:production`.
- **Lint interpretation.** `lint:check` exits 1 solely from the four accepted pre-existing backend `max-lines` warnings (0 errors): GREEN MODULO ACCEPTED DEBT per the decision below. That decision governs any later full-gate interpretation; backend test files stay out of scope and the lint rule is not relaxed.
- **LOC.** Five touched files: `heatmapsPageDataFixtures.ts` 209, `heatmapsPageDataFixtures.spec.ts` 27, `heatmapsPipeline.spec.ts` 421, `heatmapsPipeline.ts` 288, `useHeatmapsPageData.ts` 488 — all under 500; no split.

### Section checks

- Focused `test:frontend` four-area run 123 files / 1173 tests and E2E `heatmaps` 9/9 passed; `lint:frontend:check`, `lint:builder:check`, `lint:synthetic:check`, `test:coverage`, `typecheck:all` and `build:production` exit 0; `lint:check` exit 1 solely from the accepted backend debt (0 errors). Red and Green reviews PASS with zero findings. LOC re-verified for all five touched files.

### Implementation notes / deviations / follow-up

- **Implementation notes:** User decision (2026-11-17): Section 5's `npm run lint:check` is treated as GREEN MODULO ACCEPTED DEBT — verify frontend/builder/synthetic lint green and zero new backend findings beyond the four accepted pre-existing `max-lines` warnings; backend test files remain out of scope and the lint rule is not relaxed. This resolves the conflict between Section 5's required `lint:check` and the baseline debt accepted in Section 1. Red phase: test-only changes exposing `isError` on `createMockQueryResult` (new co-located pin spec, intended-RED confirmed against HEAD) and migrating five direct guard calls to 4 args; Red Review PASS with zero in-scope findings (`.opencode/scratchpad/review-section5-red.md`). Green phase: two behaviour-preserving production changes (required `deferredClassId` with unconditional guard; `combine` reverted to `result.isError`); all six call sites verified 4-arg; Green Review PASS with zero findings (`.opencode/scratchpad/review-s5-green.md`). Docs sync SKIPPED: Section 5 changed only internal test infrastructure and behaviour-preserving production code — no documented behaviour, public API contract, data shape or config changed; the only stale descriptions (`deferredClassId` optional, `status === 'error'` projection) live in plan notes (compaction-owned), not canonical docs, and the JSDoc was updated in the same Green change. No existing document needed reconciliation. Plan compaction: Section 5 32 → 26 lines, backup at `.opencode/scratchpad/feat-heatmaps-selection-perf-section-5-pre-compaction.md`.
- **Deviations from plan:** None. The `lint:check`/`run-all-checks` interpretation is governed by the recorded user decision, not a deviation.
- **Follow-up implications for later sections:** Section 6 has no doc re-verification obligation from Section 5 (no canonical docs changed); the GREEN-MODULO-ACCEPTED-DEBT full-gate interpretation governs its final checks. Section 2's retained notes describing `deferredClassId` as optional and the `status === 'error'` projection (lines 100, 101, 120, 121) are resolved by this section; the line-108 follow-up is discharged.
- **Section regression gate:** First comparison at 2026-11-17T05-10-52.566Z FAILED with 1 regression / 1 new failure from a flaky E2E visual assertion (`task-preview-source-link.visual.spec.ts`, `toHaveClass(/ant-select-item-option-active/)` timed out on attempt 0 then passed on retry; E2E check exit 0, 351 expected / 0 unexpected / flaky 1). Investigated and confirmed flaky and unrelated to Section 5's behaviour-preserving changes (Section 4 gate also had a flaky E2E that passed; baseline had none); no source rework was made. Authoritative re-run at 2026-11-17T05-26-45.470Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T05-26-45.470Z/comparison.txt`) — Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing, E2E passing with flaky 0 (352 expected / 0 unexpected); sole failure = the accepted pre-existing `backend-lint-check` debt (the same four `max-lines` warnings). Gate passed: zero regressions, zero unaccounted new failures.
- **Commit record (Section 5):** branch `feat/heatmaps-selection-perf`; commit `27c0b61c` — exact message `test(heatmaps): harden fixture and pipeline guard contracts` (5 files changed, 41 insertions, 12 deletions). `git push` succeeded (`d3472afd..27c0b61c` on `origin/feat/heatmaps-selection-perf`).

---

## Documentation and rollout notes

### Outcome

Docs-only finalisation: re-verified both Section 1 docs-sync delegations, confirmed the delivered §9.33 helper-register entry and its three layout-spec references, and retired the two planned-only SPEC.md sentences (lines 78, 148) to implemented §9.33 wording. Green doc review PASS with zero findings (`.opencode/scratchpad/review-section6-spec-docs.md`). No production code changed.

### Retained for later sections

- **Helper register:** the #342 wrapper is recorded as implemented decision §9.33 under "Delivered decisions" in `frontend-shared-helpers-and-abstraction-standards.md` — not §9.30. §9.30 is the unrelated always-fixed student-name-columns entry; §9.31/§9.32 are rejected designs. The plan's stale §9.30-flip / "e.g. §9.31" planning framing was corrected to §9.33.
- **Layout spec:** `HEATMAP_SELECTION_LAYOUT.md` cites §9.33 in three places.
- **Read-chain docs:** the four data-shape docs (`assignment.md`, `student-submission.md`, `abclass.md`, `assessment.md`) and helper-standards §3.8 carry the delivered single-pass chain (root/envelope stub parse then one per-item normaliser pass), with no stale "final parse" / `Not implemented` wording; §9.29's stale chain sentence was removed upstream in `85b1199d`.
- **No rollout dependency:** pure frontend behaviour change delivered in Sections 1–5; no migration or rollout dependency.

### Section checks

- Data Shapes Agent re-verification PASS on all four data-shape docs (correct single-pass chain, no stale wording, no out-of-scope drift); Docs agent re-verification PASS (§3.8 read-chain sentence, absent §9.29 sentence, §9.33 register entry, three layout-spec §9.33 references).
- Green doc review PASS with zero findings; SPEC.md lines 78/148 retired to §9.33 wording; SPEC/layout companion references confirmed satisfied.

### Implementation notes / deviations / follow-up

- **Implementation notes:** This is a docs-only section: no executable Red/Green TDD phases apply. Re-verification of Section 1's two docs-sync delegations: Data Shapes Agent returned PASS on all four data-shape docs (`assignment.md`, `student-submission.md`, `abclass.md`, `assessment.md`) — each describes the delivered single-pass chain (root/envelope stub parse then one per-item normaliser pass) with no stale "final parse"/"second full-tree parse" or `Not implemented` wording, and no out-of-scope drift. Docs agent returned PASS re-verifying §3.8's corrected read-chain sentence, the absence of the stale §9.29 sentence, the §9.33 helper-register entry under "Delivered decisions" (§9.30 is the unrelated student-name entry; §9.31/§9.32 are rejected designs), and the layout spec's three §9.33 references. The two planned-only SPEC.md sentences (lines 78, 148) were retired to implemented §9.33 wording; Green doc review PASS with zero findings (`.opencode/scratchpad/review-section6-spec-docs.md`). SPEC/layout companion references confirmed satisfied. Out-of-scope drift was recorded in the nitpicks log, not actioned (Section 6 forbids other doc changes).
- **Deviations from plan:** None in the delivered edits. The plan's stale planning framing for the register entry (§9.30 flip / "e.g. §9.31") was corrected to the delivered §9.33; Sections 3 and 5 already recorded that §9.31/§9.32 are taken by rejected designs.
- **Follow-up implications for later sections:** None — final section. No migration or rollout dependency; pure frontend behaviour change already delivered in Sections 1–5.
- **Section regression gate:** First comparison at 2026-11-17T05-46-55.317Z flagged 1 regression / 1 new failure from a flaky E2E visual assertion (`post-analysis-metadata.feedback.spec.ts`, `toHaveClass` failed on attempt 0 then passed on retry; E2E check exit 0, 351 expected / 0 unexpected / flaky 1) — confirmed flaky, unrelated to the SPEC.md prose edit, no rework. Authoritative re-run at 2026-11-17T06-01-38.152Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T06-01-38.152Z/comparison.txt`) — Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing, E2E passing with flaky 0 (352 expected / 0 unexpected); sole failure = accepted pre-existing `backend-lint-check` debt. Gate passed.
- **Commit record (Section 6):** branch `feat/heatmaps-selection-perf`; commit `8949ec8d` — exact message `docs(#342): retire planned helper wording in SPEC.md` (1 file changed, 2 insertions, 2 deletions). `git push` succeeded (`af141e86..8949ec8d` on `origin/feat/heatmaps-selection-perf`).

### Optional `@remarks` JSDoc review

- Verified: the `@remarks` planned in Sections 1–3 exist in code — `assignmentReadNormalisation.ts` (parent-pass and unsafe-key remarks), `assignmentReadItemValidation.ts`, both service wrappers, and `SelectAllDropdownHeader.tsx` (controlled query-state remarks). Section 5 changed one existing JSDoc only (required `deferredClassId` parameter); Section 6 is docs-only. `None` new needed.

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

---

## Post-implementation outcomes

- **De-sloppification pass (§5.1):** reviewed all 36 delivered files against base `85b1199d`. Production code clean of confirmed slop. One in-scope Improvement — four stale export names (`isValidFullItem`/`isValidPartialItem` → `validateFullItem`/`validatePartialItem`) in the canonical data-shape docs, introduced by this plan's #349 rename — plus one British-English nitpick on an already-rewritten line. Minimal docs-only fix applied to `assignment.md` (lines 61, 388), `abclass.md` (1411), `student-submission.md` (180, 722); cleanup review PASS with zero findings (`.opencode/scratchpad/review-desloppification-docs-cleanup.md`).
- **Final post-cleanup regression comparison (§5.1):** the cleanup changed files, so the final gate was run at 2026-11-17T06:23:10.234Z (report `.ts-regression-checker/reports/session-feat-heatmaps-selection-perf/runs/2026-11-17T06:23:10.234Z/comparison.txt`) — Regressions 0, New Failures 0, Fixes 0, 7/8 checks passing, E2E `flaky: 0` (352 expected / 0 unexpected); sole failure = the accepted pre-existing `backend-lint-check` debt. Clean; branch ready for documentation sync.
- **Final documentation pass (§5.2):** no reconciliation edits needed — all per-section doc syncs internally consistent with each other and the delivered code across module `AGENTS.md`, JSDoc, `docs/developer/*`, public API and testing docs; no new page created. Out-of-scope drift reported (stale SPEC.md planning lines, pre-existing US "serializer" spellings, transient flaky E2E assertions) and either already logged in the nitpicks file or recorded there.
- **Cleanup commit:** branch `feat/heatmaps-selection-perf`; commit `501038f1` — exact message `docs: correct renamed validator references in data-shape docs` (3 files changed, 5 insertions, 5 deletions). `git push` succeeded (`d1833fae..501038f1` on `origin/feat/heatmaps-selection-perf`).
