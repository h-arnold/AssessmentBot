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

### Objective

Make each submission item be Zod-validated exactly once per read across the whole `getABClass` / `getAssignment` path, with output structurally identical to today's.

### Constraints

- Schemas and returned shapes unchanged; only the number of parses changes.
- Parent passes parse with item/submission collections omitted and reassemble parsed parts; the item-level pass returns the _parsed_ item.
- Normaliser terminal full-tree parses removed (class path: `AssignmentPartialSchema.parse` and `ClassFullSchema.parse`; full path: `AssignmentFullSchema.parse`); service-level final full-tree `parseApiResponse` removed; cheap root/envelope stub parses stay (`assignments: []` / `submissions: []`) for fail-fast transport errors and the not-found `null` contract.
- Corrupt-item replacements (`corruptItem` / `corruptedArtifact`) constructed schema-shaped — no second evaluation; output `toEqual`-equivalent to today's post-strip output.
- Partial-path copy loop drops unsafe keys (notably `__proto__`) explicitly, before any item evaluation, in both valid and corrupt branches; the existing `__proto__` spec cases stay as pins.
- Pre-checks (`isRecord` / `taskId` / `hasExactCriteria`) move after or fold into the single evaluation, preserving all outcomes.

### Delegation mandatory reads

All phases (common):

- @docs/plans/SPEC.md (decisions 3-4, #349 contract)
- @src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts
- @src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts
- @src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts
- @src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
- @src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
- @src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
- @src/frontend/src/services/apiService.ts
- @docs/developer/data-shapes/assignment.md, @docs/developer/data-shapes/student-submission.md, @docs/developer/data-shapes/abclass.md, @docs/developer/data-shapes/assessment.md (planned-only `Not implemented` entries in each "Planned contract changes" section)
- @docs/developer/frontend/frontend-architecture.md
- @docs/developer/frontend/frontend-testing.md

Testing Specialist mandatory docs: @docs/developer/frontend/frontend-testing.md, @docs/developer/testing/synthetic-test-data.md
Implementation mandatory docs: `src/frontend/AGENTS.md` (auto-injected; listed for reference), @docs/developer/frontend/frontend-architecture.md
Code Reviewer mandatory docs: `AGENTS.md`, `src/frontend/AGENTS.md` (auto-injected; listed for reference), @docs/developer/data-shapes/INDEX.md
Data Shapes Agent mandatory docs: @docs/developer/data-shapes/INDEX.md, @docs/developer/data-shapes/assignment.md, @docs/developer/data-shapes/student-submission.md, @docs/developer/data-shapes/abclass.md, @docs/developer/data-shapes/assessment.md
Docs agent mandatory docs: @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md (§3.8, §9.29)

### Shared helper plan

- Decision: **keep local / extend existing owners** — no new shared helper; `assignmentReadNormalisation.ts` and `assignmentReadItemValidation.ts` remain the owners (already registered in `frontend-shared-helpers-and-abstraction-standards.md` §9.29). No new canonical-doc entry needed beyond the data-shape planned entries below.

### Data-shape planning block

- Planned-only entries marked `Not implemented` are already recorded in `docs/developer/data-shapes/assignment.md`, `student-submission.md`, `abclass.md`, and `assessment.md` ("Planned contract changes (Not implemented)"). This section implements them; per `AGENTS.md` §5 step 7 and §7.2, the **Data Shapes Agent** removes the `Not implemented` markers and reconciles the wording in the four data-shape docs **in this section's docs-sync step, before this section's regression gate and code-review sign-off** (the read-validation chain is contractually affected). The same-timing corrections to the stale read-chain sentences in `frontend-shared-helpers-and-abstraction-standards.md` §3.8 and §9.29 entry 1 are a documentation update, so per `AGENTS.md` §7.2 they are owned by the **Docs agent** in the same docs-sync step. No schema, persistence, API, or transport shape changes.

### Canonical-fixture note

- New parse-count tests clone the canonical synthetic views the existing suites already use: `@synthetic/small/classesById.json?raw` (partial), `@synthetic/small/assignmentsByKey.json?raw` (full), `@synthetic/medium/...` (legacy suites), plus local corruption probes. No generator extension needed. Opportunistic migration: none — existing normalisation suites stay as the equivalence contract, unchanged.

### File sizing (LOC)

- `assignmentReadNormalisation.ts`: 329 → ~345 (restructure; net small). `assignmentReadItemValidation.ts`: 404 → ~415 (schema-shaped replacements). `classDetailService.ts`: 42 → ~38. `assignmentAssessmentService.ts`: 50 → ~46. All well under 500; no split.

### Acceptance criteria

- Every existing `assignmentReadNormalisation.*.spec.ts` case (legacy, corruption-repair, `__proto__`) passes unchanged, as do `classDetailService.spec.ts` and `assignmentAssessmentService.spec.ts`.
- Instrumented test (test-only attempt-counting wrapper rebuilt into the schema modules, instrumenting the same item-schema instances the parent schemas reference): exactly one item-schema evaluation attempt per item per whole service call — valid → one success; schema-corrupt → one failure, zero successes; contextually-corrupt → one success then contextual rejection.
- Service wrappers no longer perform a final full-tree parse; stub parses and `null` handling intact.

### Required test cases (Red first)

1. Instrumented parse-count test for `getABClass` over the small canonical class view: exactly one attempt per item, with the valid/corrupt breakdown.
2. Same for `getAssignment` over the small canonical assignment view, including a corruption probe (schema-corrupt and contextually-corrupt items).
3. Equivalence: existing normalisation + service suites run unchanged (no edits to their assertions).
4. `__proto__` partial-path case: unsafe key dropped before evaluation; output excludes the own key; zero evaluations for the unsafe-keyed entry.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/assignmentAssessment src/frontend/src/services/googleClassrooms` green.
- `npm run lint:frontend:check`, `npm run typecheck:all` green.
- Data-shape planned entries finalised in this section's docs sync: `Not implemented` markers removed from all four data-shape docs and the entries describe the delivered single-pass chain; §3.8/§9.29 read-chain sentences corrected. Data Shapes Agent sign-off recorded before this section's code-review sign-off.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

### Optional `@remarks` JSDoc follow-through

- Record in `assignmentReadNormalisation.ts` why parent passes omit and reassemble collections (single-evaluation guarantee) and why the unsafe-key drop must precede evaluation.

---

## Section 2 — #343: deferred selection derivation on the Heatmaps surface

### Objective

Make selection changes on the standalone Heatmaps page update the controls immediately while the analyser/adapter/preview/table derivation runs off a deferred selection, with no error flashes in the lag window.

### Constraints

- Defer the whole `selection` via React concurrent deferral (`useDeferredValue`); pipeline gate, pipeline, merged-preview assembly, table, summary cards, and post-analysis binding all key off the deferred value; selector controls and option lists stay urgent.
- Pipeline gate additionally requires `classFull.classId === deferred selection.classId` (cached-class-switch guard).
- Per-assignment `useQueries` keys off the urgent selection; preview inputs paired by `assignmentId` (Map), never by index across differing selections.
- Deferred-selected assignment missing from urgent-keyed results → hook synthesises a pending preview input (loading status, empty lookup); `assembleMergedPreviewData`'s missing-input throw unchanged.
- `isRefreshing` extended: `true` while deferred `(classId, assignmentIds)` differ from urgent ones (reuses existing `aria-busy` region; also disables Refresh during the lag — accepted, tested).
- Intended transient: defensive skeleton + `aria-busy` on the empty→selected transition.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- @docs/plans/SPEC.md (decisions 1-2, #343 contract)
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/frontend/frontend-react-query-and-prefetch.md
- @src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts
- @src/frontend/src/features/taskHeatmap/useHeatmapsPageData.knownErrorPreview.spec.ts (existing hook spec showing the harness in use)
- @src/frontend/src/test/taskHeatmap/useHeatmapsPageData.mockSetup.ts
- @src/frontend/src/test/taskHeatmap/useHeatmapsPageDataSpecMocks.ts
- @src/frontend/src/features/taskHeatmap/heatmapsPreviewQueries.ts
- @src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts

Implementation mandatory docs:

- @docs/plans/SPEC.md
- `src/frontend/AGENTS.md` (auto-injected; listed for reference)
- @docs/developer/frontend/frontend-react-query-and-prefetch.md
- @docs/developer/frontend/data-analysis-architecture.md
- @src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts
- @src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts
- @src/frontend/src/features/taskHeatmap/heatmapsPreviewQueries.ts
- @src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts
- @src/frontend/src/features/taskHeatmap/heatmapsSurfaceState.ts
- @src/frontend/src/features/taskHeatmap/HeatmapBuilderSurface.tsx
- @src/frontend/src/features/taskHeatmap/selectionCascade.ts
- @src/frontend/src/query/sharedQueries.ts

Code Reviewer mandatory docs:

- `AGENTS.md`, `src/frontend/AGENTS.md` (auto-injected; listed for reference)
- @docs/developer/frontend/frontend-react-query-and-prefetch.md
- @src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts (throw-preservation invariant)

### Shared helper plan

- Decision: **keep local** — deferral/pairing changes live in `useHeatmapsPageData.ts` (+ `heatmapsPipeline.ts` gate signature). No new shared helper; no canonical-doc entry.

### Data-shape planning block

- None — no schema, persistence, API, or transport change in this section.

### Canonical-fixture note

- Hook tests reuse the existing `useHeatmapsPageData.*.spec.ts` query-level harness: `src/frontend/src/test/taskHeatmap/useHeatmapsPageData.mockSetup.ts`, `useHeatmapsPageDataSpecMocks.ts`, `useHeatmapsPageDataMockHandles.ts`, `hookMockFactories.ts`, and `@/test/abClass/postAnalysisHookMockSetup` (not the embedded `TaskHeatmapPage` service-level mock family in `src/frontend/src/test/taskHeatmapPageMocks.ts`). No generator extension; no migration of existing tests beyond what the deferral requires (existing suites must stay green unchanged where they pin behaviour; timing-sensitive pins follow `useDeferredValue` settling within `act()`).

### File sizing (LOC)

- `useHeatmapsPageData.ts`: 394 → ~470 projected (deferral, guard, id-keyed pairing, pending synthesis, busy base) — under 500, re-verify at Green; if it exceeds 500, extract the pairing/pending-synthesis into `heatmapsPreviewQueries.ts` (100 LOC, headroom) in the same change. `heatmapsPipeline.ts`: 268 → ~280 (guard parameter). Others unchanged or smaller. No split planned.

### Acceptance criteria

- With a realistic class loaded, changing the assignment selection updates the Selects synchronously; the table/summary update after the deferred recompute; no frame shows a blocking error.
- Cached-class-switch lag window: no "Analysis failed" blocking frame (guard test).
- Removal-during-lag: pending preview status, no error flash; assembly throw suite unchanged and green.
- Busy signal: `aria-busy` true during the lag (including cached re-selection with no in-flight fetch); false for topic-only changes; Refresh disabled during the lag.

### Required test cases (Red first)

1. Hook test: the pipeline/merged-result/summary outputs derive from the deferred selection while the urgent selection updates immediately (render with an urgent change; assert the hook's derived outputs are unchanged until the deferred value settles within `act()`).
2. Red test: cached-class switch during lag → no blocking `analyserError` frame (guard).
3. Red test: remove an assignment during the lag → preview input treated as pending; no `adapterError`/blocking flash.
4. Id-keyed pairing: add/remove assignments mid-lag → inputs paired by `assignmentId`, never mispaired.
5. Busy signal: `isRefreshing` true when deferred `(classId, assignmentIds)` ≠ urgent; false on topic-only change; Refresh button disabled state covered via surface test.
6. Intended transient skeleton on empty→selected.

### Section checks

- `npm run test:frontend -- src/frontend/src/features/taskHeatmap` green (all `useHeatmapsPageData.*`, `HeatmapBuilderSurface`, `heatmapsPipeline`, `heatmapsPreviewQueries`, `assembleMergedPreviewData`, `heatmapsSurfaceState`, `selectionCascade`, `useHeatmapSelectionSummary` suites).
- `npm run lint:frontend:check`, `npm run typecheck:all` green; re-check LOC counts.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (filled during delivery)
- **Deviations from plan:** (filled during delivery)
- **Follow-up implications for later sections:** (filled during delivery)

### Optional `@remarks` JSDoc follow-through

- Record in `useHeatmapsPageData.ts` why the pipeline keys off the deferred selection, why pairing is id-keyed, and where the pending placeholder is synthesised.

---

## Section 3 — #342: select all / select none dropdown header

### Objective

Add the select all / select none header to the Topics and Assignments dropdowns on the standalone Heatmaps page, per the layout spec, plus one E2E journey.

### Constraints

- One feature-local wrapper component under `features/taskHeatmap` renders the two multi-selects, owns the controlled `showSearch.searchValue` per Select, and supplies `popupRender` with the header (Checkbox "Select all" left, `Button type="link"` "Select none" right, space-between row, `APP_GAP_SM` spacing, `Divider` only with the header). Registered as planned `Not implemented` entry §9.30.
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
- Canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.30 — planned entry already recorded as `Not implemented`; flip to `Implemented` in Section 6 with the wrapper description (renders the two multi-selects, owns per-Select controlled query state).

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

- Cross-section re-verification: the four data-shape docs' planned entries describe the delivered single-pass chain with `Not implemented` markers removed, and `frontend-shared-helpers-and-abstraction-standards.md` §3.8/§9.29 read-chain sentences are corrected.
- `frontend-shared-helpers-and-abstraction-standards.md` §9.30 flipped to `Implemented` with the wrapper description (renders the two multi-selects, owns per-Select controlled query state).
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

| Finding                                                                                                     | Severity                                 | Scope rationale                                                                                                                                                | Evidence                                                                        | Disposition | User decision                                |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------- | -------------------------------------------- |
| #350 — re-key post-analysis effect on data inputs + attempt identity                                        | minor (CPU-only redundancy)              | Touches shared `usePagePostAnalysisTasks.ts`/`usePostAnalysisTasks.ts` used beyond the heatmaps surface; its issue states it deserves its own change and tests | GitHub issue #350; `useHeatmapsPageData.ts:342-348`                             | noted       | Excluded from this unit by user, 13 Nov 2026 |
| #351 — pipeline gates must follow `isDatasetRenderable` (loading dead-end for failed-but-recovered dataset) | material (user-visible endless skeleton) | Touches `useClassPageData.ts` too and requires a warm-up-retry reachability investigation first                                                                | GitHub issue #351; `heatmapsPipeline.ts:208-210`, `useClassPageData.ts:264-276` | noted       | Excluded from this unit by user, 13 Nov 2026 |
| #323 — merged-heatmap keyboard journey + nine coverage polish items                                         | minor                                    | Test-coverage polish, unrelated to this unit's contracts                                                                                                       | GitHub issue #323                                                               | disregarded | Out of scope, 13 Nov 2026                    |
| #344 — sticky bottom scrollbar                                                                              | minor                                    | Different surface behaviour (tables), separate SPEC.md at repo root already drafted                                                                            | GitHub issue #344; root `SPEC.md`                                               | disregarded | Out of scope, 13 Nov 2026                    |
| #348 — Collapse items-prop migration                                                                        | nitpick                                  | Unrelated component migration                                                                                                                                  | GitHub issue #348                                                               | disregarded | Out of scope, 13 Nov 2026                    |
