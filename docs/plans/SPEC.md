# Heatmaps Selection Performance, Single-Pass Read Validation, and Select-All Specification

## Status

- Draft v8.0 — one work unit covering GitHub issues h-arnold/AssessmentBot#342, #343, #349, and #352. v8 aligns the two seventh-review residues (busy-signal comparison base unified to `(classId, assignmentIds)`; deselect-toggle query outcome pinned as kept). v7 incorporates the sixth planner review: §9.30 corrected to the controlled-`searchValue` mechanism; the #343 recommendation rewritten to the whole-`selection` deferral with the `classFull.classId` guard and a `(classId, assignmentIds)` busy-signal base; the tag-removal/clear query outcome pinned to "kept" (user-confirmed 13 November 2026) with the reset discriminated via `onSelect`; the pending-synthesis mechanism located in the hook with the assembly throw preserved; unsafe-key drop pinned before evaluation; the selection-summary cards named as deferred consumers.
- Scope (#342 + #343 + #349 + #352; #350 and #351 excluded), select-all semantics (union with the options currently shown; header only when more than one option exists), and the #349 single-validation scope were confirmed by the user on 13 November 2026.
- Companion documents: `docs/plans/HEATMAP_SELECTION_LAYOUT.md` (layout spec for the #342 dropdown change) and `docs/plans/ACTION_PLAN.md` (delivery plan).

## Purpose

This document defines the intended behaviour for one combined frontend work unit on the standalone Heatmaps page and the assignment/class read path. The unit will:

- remove the ~500ms UI block when selecting additional assignments (or topics) on the standalone Heatmaps page (#343);
- make each submission item be Zod-validated exactly once per read across the whole read path, instead of ~3-4x (#349);
- add a select all / select none header at the top of the Topics and Assignments dropdowns on the Heatmaps page (#342);
- replace the five-case `resolveDiscreteCellStyle` switch with the `METRIC_TONE_CELL_STYLE` record lookup (#352).

This unit is **not** intended to:

- change any scoring, analysis, averaging, or adapter semantics;
- change any validation schema, persistence model, API contract, or transport envelope shape — only how many times a payload is parsed changes, never what the schemas accept or what the read path returns;
- touch the Class page's pipeline gates or post-analysis effect (#350, #351 remain separate issues: they touch shared class-page plumbing and #351 requires its own warm-up-retry investigation);
- add test-coverage polish from #323, scrollbar behaviour from #344, or the Collapse migration from #348;
- change the embedded (Class page) TaskHeatmapPage selection flow — selection changes there arrive via navigation, not via the multi-select, so the jank is specific to the standalone Heatmaps surface.

## Agreed product decisions

1. **Selection stays urgent; derivation becomes deferred (#343).** Changing the class, topic, or assignment selection updates the selector controls and their option lists synchronously. All expensive derivation keyed to the selection — the averaging analyser, the merged heatmap adapter, the merged preview assembly, and the resulting table render — keys off a deferred copy of the whole `selection` (React concurrent deferral, e.g. `useDeferredValue`: the deferred recompute renders at an interruptible lower priority so input is never blocked during it, and rapid successive selection changes coalesce into one recompute), so selecting options never blocks further UI interaction while the pipeline or the per-assignment `getAssignment` fetches run. Topic-derived option lists are not deferred; topics do not feed the pipeline. Consistency guard: the pipeline gate additionally requires the loaded `classFull` to belong to the deferred selection's class (`classFull.classId === deferred selection.classId`), so a cached-class switch during the lag window cannot pair the new class with the previous class's deferred assignment IDs (which would surface a transient blocking "Analysis failed" frame); a red test covers the cached-class-switch lag window. The busy signal is extended to cover the deferral lag itself — `true` while the deferred pipeline inputs (`classId`, `assignmentIds`) differ from the urgent ones — reusing the existing `aria-busy` content region; no new loading UI. Note the coupling: `isRefreshing` also disables the Refresh button during the lag; that is accepted deliberately and covered by hook tests.
2. **Preview pairing is by assignment ID (#343).** Per-assignment preview results are paired with their assignment by `assignmentId` (a Map lookup), never by array index across two different selection values. The per-assignment `useQueries` list keys off the urgent selection so fetches start immediately, and the merged-preview assembly must never index-pair a deferred selection against urgent query results. A deferred-selected assignment that has no result in the urgent-keyed query list (removal during the lag window) is treated as pending for preview-status purposes — mirroring a not-yet-returned fetch — and never surfaces as an error or a transient blocking-error flash. The mechanism is located in the hook: `useHeatmapsPageData` synthesises a pending preview input (loading status, empty lookup) for any deferred `assignmentId` absent from the urgent-keyed results when building id-keyed inputs; `assembleMergedPreviewData`'s missing-input throw is unchanged and remains the fail-loud wiring-regression invariant, so `assembleMergedPreviewData.spec.ts` stays green unchanged.
3. **Reads validate each item exactly once per read (#349).** Across the whole read path (`getABClass` / `getAssignment` service call → normaliser), each submission item is Zod-validated exactly once: the item-level pass inside the normaliser. The parent passes (submission, assignment, root) parse with the item/submission collections omitted and reassemble the already-parsed parts, so no parent pass re-validates items. The normaliser's terminal full-tree parses (on the class path both `AssignmentPartialSchema.parse` and `ClassFullSchema.parse` re-validate every item; on the full path `AssignmentFullSchema.parse`) and the service-level final full-tree `parseApiResponse` are all removed; the normaliser composes only schema-parsed parts, so its declared return type holds by construction. The service keeps its cheap root/envelope stub parse (`assignments: []` for `getABClass`, `submissions: []` for `getAssignment`) for fail-fast transport-shape errors and the not-found `null` contract. The normalised output must be identical to today's output; the existing normalisation spec suites are the equivalence contract and must pass unchanged.
4. **Corrupt-item replacements are constructed schema-shaped (#349).** `corruptItem` / `corruptedArtifact` build the replacement carrying only the fields their schema owns (the five item fields; partial artefacts carry only the partial artefact schema's fields), so the replacement needs no second evaluation and is structurally identical (`toEqual`-equivalent) to today's output after the removed stripping parses. This slightly extends the change to `assignmentReadItemValidation.ts`, which is where the replacements are built. Exactly one item-schema evaluation occurs per item, valid or corrupt.
5. **Select all / select none operates on the options currently shown in the dropdown (#342).** "Select all" adds (unions with) every option the open dropdown currently lists to the existing selection — it can never shrink the selection. For Assignments the scope also respects the active topic cascade; for both dropdowns it respects the active search query. The search input is **controlled** via `showSearch.searchValue` + `onSearch`, so the tracked value is the rendered query by construction (exact mirror, no divergence cases). The controlled value is reset only when an option is selected from the open dropdown — discriminated via `onSelect`, not `onChange` (which also fires on tag removal and allow-clear). This mirrors `autoClearSearchValue` for selection, tag removal, allow-clear and close, but not for a deselect-toggle in the open dropdown (`onDeselect`, not `onSelect`), where the query is kept — a deliberate divergence from `autoClearSearchValue`, recorded here because the options render as checkbox toggles. The query is also deliberately kept on tag removal, allow-clear, and close/Escape, matching the multiple-select's rendered behaviour (user-confirmed 13 November 2026). Component tests must assert: query cleared after option selection; query kept after a deselect-toggle; query kept after Escape-close-reopen; query kept after tag removal with an active query. "Select none" clears that control's entire selection regardless of the search query; clearing all topics leaves the assignment selection intact (zero-topic set = no constraint). The header row is rendered only when the dropdown's full option list has more than one option. Topic select-all flows through the existing `changeTopics` cascade, which still clears assignments whose topic is no longer active.
6. **#352 is a pure tidy.** `resolveDiscreteCellStyle` becomes a `METRIC_TONE_CELL_STYLE` record lookup with identical return values for every tone.

## Existing system constraints

### Backend or API constraints already in place

- No backend change. All work is frontend; every backend call still goes through `callApi` via the existing service wrappers (`getABClass`, `getAssignment`).

### Current data-shape constraints

- The validation _schemas_ and the _returned shapes_ do not change. What changes is the documented read-validation chain: the data-shape docs currently describe the normaliser as "invoked by both read services before their final response parse" (`docs/developer/data-shapes/assignment.md`, `student-submission.md`, `abclass.md`, and `assessment.md`). That chain is updated in this unit (planned-only entries marked `Not implemented` recorded in all four docs before the action plan is finalised, then implemented during delivery): the service-level final full-tree parse is removed and the normaliser performs the single per-item pass.

### Frontend or consumer architecture constraints

- `features/taskHeatmap/**` must not import from `features/classPage/**`; heatmap logic is shared through `services/dataAnalysis/`.
- The per-assignment preview queries stay in a single `useQueries` call keyed to the selection array (rules of hooks).
- Ant Design v6: custom dropdown content uses `popupRender` (not the deprecated `dropdownRender`); search filtering uses `showSearch={{ optionFilterProp: 'label' }}` with `onSearch` added by this unit to track the query; inside `popupRender`, `onMouseDown` must call both `preventDefault()` and `stopPropagation()` so header clicks neither close the dropdown nor steal focus (Ant Design FAQ).
- Fail loudly: the normalisation refactor must not swallow or newly catch validation failures; corruption repair behaviour (invalid items replaced, diagnostics logged) is unchanged. The `__proto__` own-property hardening's _observable outcome_ is preserved, but its mechanism moves: today the partial-path copy loop keeps a stored `__proto__` key as an own property via `Object.defineProperty` and the removed terminal parse drops it, so the unit must drop unsafe keys explicitly in the copy loop before any item evaluation (both the valid and corrupt branches; unsafe-keyed entries are not items and receive zero schema evaluations), keeping the existing `__proto__` spec case as the pin.
- Module-size gates: the hard decomposition trigger is 550 LOC (`docs/developer/frontend/frontend-architecture.md`); 500 LOC is the ESLint `max-lines` early-warning signal. Current counts: `useHeatmapsPageData.ts` 394, `HeatmapSelectionBar.tsx` 364, `heatmapsPipeline.ts` 268, `assignmentReadNormalisation.ts` 329, `assignmentReadItemValidation.ts` 404, `metricTone.ts` 337. Projected growth from this unit keeps each under 500, so no file split is planned; counts are re-checked per section in the action plan.

## Domain and contract recommendations

### #343 — deferred derivation contract

- The urgent value is `selection` (reducer state). A deferred copy of the whole `selection` drives `shouldRunHeatmapsPipeline`, `runHeatmapsPipeline`, the merged-preview assembly, the table's `heatmapResult`, and the selection-summary cards (`useHeatmapSelectionSummary` consumes `mergedResult`).
- The pipeline gate additionally requires `classFull.classId === deferred selection.classId`, so a cached-class switch during the lag window cannot pair the new class with the previous class's deferred assignment IDs.
- The per-assignment `useQueries` list keys off the urgent selection so fetches start immediately; the assembly pairs results by `assignmentId`.
- The shared post-analysis binding (`usePagePostAnalysisTasks`, fed the pipeline's `analyserResult` and status) consumes the deferred-pipeline values, so post-analysis tasks trail the selection by the deferral lag and coalesce under rapid successive changes; this is intended, and the existing `useHeatmapsPageData.postAnalysis.spec.ts` continues to pin the binding. (This is distinct from the excluded #350, which concerns class-page plumbing.)
- `isRefreshing` (and therefore the content region's `aria-busy`) additionally reports `true` while the deferred `(classId, assignmentIds)` differ from the urgent ones — the pipeline's actual inputs — so a recompute with no in-flight fetch (for example re-selecting an assignment fetched within its 5-minute `staleTime`) still carries a busy signal, and a topic-only change (not a pipeline input) does not light a spurious busy flash.
- Acceptance is behavioural: with a realistic class (~600 items) already loaded, toggling assignment selections keeps the selector responsive and the table updates once the deferred pipeline completes.

### #349 — single-pass contract

- Each submission item is validated exactly once per read, at the item level, inside the normaliser; the parsed item is reused by reassembly, not by re-parsing. The service-level final full-tree parse is removed; the root/envelope stub parse stays.
- Output equivalence is the contract: every existing `assignmentReadNormalisation.*.spec.ts` case (including legacy, corruption-repair, and `__proto__` hardening cases) passes unchanged, as do `classDetailService.spec.ts` and `assignmentAssessmentService.spec.ts`.
- A new instrumented test counts item-schema _evaluation attempts_ (pass or fail) across a whole `getABClass`/`getAssignment` call and asserts exactly one attempt per item, with the outcome breakdown: valid items → one successful evaluation; schema-corrupt items → one failed evaluation and zero successful ones; contextually-corrupt items (taskId/key mismatch, null-parent source contradictions, non-submission artefacts — rejected by the checks around the parse, not by it) → one successful evaluation followed by contextual rejection. Today's cheap pre-checks run before `safeParse`, giving some corrupt items zero evaluations; satisfying the one-attempt guarantee requires moving those pre-checks after (or folding them into) the single evaluation, preserving all outcomes. The counting is test-only: the test rebuilds the schema modules with an attempt-counting wrapper (for example `z.preprocess`-style, which runs even when the core parse later fails — a `.refine`-style refinement would not) on the same item-schema instances the parent schemas reference (a parent schema's `.parse` does not invoke the sub-schema's public `parse`/`safeParse` methods, so spying on those undercounts). No production code is added to satisfy the test.
- The item-level pass returns the _parsed_ item; the raw item is never reassembled. Today the valid path returns the raw item and the removed terminal parses strip unknown keys; returning the parsed item keeps the output identical to today's post-strip shape even for inputs with extra unknown fields.

### #342 — dropdown header contract

- The Topics and Assignments `Select`s gain a `popupRender` header: a "Select all" row with a `Checkbox` plus a "Select none" action, separated from the option list by a `Divider`. The "Select all" checkbox is checked when every shown option is selected, indeterminate when some but not all are, and unchecked with no indeterminate state when the search query matches zero options.
- The search query is controlled via `showSearch.searchValue` (with `onSearch` inside the `showSearch` object; the top-level `onSearch`/`searchValue` props are deprecated in Ant Design v6). The controlled value is reset only on option selection (via `onSelect`; a deselect-toggle fires `onDeselect` and keeps the query — a deliberate divergence from `autoClearSearchValue`) and kept on tag removal, allow-clear, and close, so it always mirrors the query the dropdown currently renders.
- The header is present only when the dropdown's full option list has more than one entry.
- "Select all" unions the options matching the current search query (further narrowed by the active topic cascade for Assignments) into the existing selection; the header-side scope computation mirrors Ant Design's default `optionFilterProp: 'label'` filtering (case-insensitive label match) so the scope is exactly the options the dropdown renders. "Select none" clears the control's full selection.
- Clicking a header action must not close the dropdown (`onMouseDown` with `preventDefault()` and `stopPropagation()` inside `popupRender`).
- The header logic (search tracking, scope computation, checked/indeterminate derivation, `mousedown` guard) is built once as a feature-local component under `features/taskHeatmap` and shared by the two Selects (keep-local decision, registered as a planned `Not implemented` entry in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`).
- The Class dropdown does not gain the header (single-select).

### #352 — lookup equivalence

- `resolveDiscreteCellStyle(token)` returns `METRIC_TONE_CELL_STYLE[token]`; every tone maps to the same style object the switch returned.

## Feature architecture

### Placement

- #343 lives in `features/taskHeatmap/useHeatmapsPageData.ts` (plus `heatmapsPipeline.ts`, `assembleMergedPreviewData.ts`, `heatmapsPreviewQueries.ts` if memo keys or pairing move); the surface `HeatmapBuilderSurface.tsx` needs no structural change.
- #349 lives in `services/assignmentAssessment/assignmentReadNormalisation.ts` and `assignmentReadItemValidation.ts`, plus the two read service wrappers (`classDetailService.ts`, `assignmentAssessmentService.ts`) for removal of the final full-tree parse.
- #342 lives in `features/taskHeatmap/HeatmapSelectionBar.tsx` plus one new feature-local dropdown-header component in the same folder; cascade behaviour stays in `selectionCascade.ts`.
- #352 lives in `services/dataAnalysis/metricDisplay/metricTone.ts`.

### Out of scope for this surface

- No new selection state machine; the existing `selectionCascadeReducer` owns cascade rules and is reused unchanged for select-all (select-all dispatches the same `changeTopics` / `changeAssignments` actions).
- No backend, persistence, transport, or data-shape schema changes.
- No changes to `TaskHeatmapPage` (embedded heatmap) beyond what shared helpers require.

## Data loading and orchestration

### Required datasets or dependencies

- Unchanged: warm-up class partials and assignment-definition partials, per-class `getABClass`, per-selected-assignment `getAssignment`.

### Query or transport additions

- None. #343 changes which value the pipeline memos key on, not any query key or fetch policy.

## Main user-facing surface specification

- See `docs/plans/HEATMAP_SELECTION_LAYOUT.md` for the #342 dropdown header layout, states, and accessibility rules.
- #343's user-visible rule: the selection bar and the rest of the page remain interactive while the heatmap recomputes; the content region's existing `aria-busy` signal (extended to the deferral lag) indicates the recompute.

## Error, loading, and empty-state rules

- Otherwise unchanged. Blocking errors, skeletons, empty states, and the omitted-assignment warnings keep their current behaviour, with one intended #343 exception: on the empty→selected transition there is now a brief lag window in which the defensive skeleton plus `aria-busy` shows while the deferred pipeline computes (previously the table appeared in the same commit as the selection). This transient is intended and is covered by a deliberate test. #343 must not turn a slow-but-successful recompute into an error state (hence the id-keyed pairing rule and the removal-during-lag red test), and #349 must not change which payloads throw.

## Accessibility and usability notes

- The select-all header actions carry accessible names ("Select all topics", "Select none topics", and the assignment equivalents) and do not close the dropdown on activation; the "Select all" checkbox carries the checked/indeterminate state. Ant Design's Select does not move keyboard focus into the portal-rendered popup (`Tab` selects the active option), so the header actions are pointer-operated; the selection itself remains fully keyboard-operable through the Select's native option toggling. This reachability limit is pinned in the layout spec.
- #343: no new spinner; the existing `aria-busy` live region announces the refresh, now including the deferral lag.

## Backend changes required to support agreed behaviour

None.

## Planning handoff notes

- A dedicated layout spec is required for #342 because it changes the dropdown structure of the selection bar: `docs/plans/HEATMAP_SELECTION_LAYOUT.md`.
- Data-shape docs: the read-validation chain description in `docs/developer/data-shapes/assignment.md`, `student-submission.md`, `abclass.md`, and `assessment.md` changes; planned-only entries marked `Not implemented` are recorded in all four before the action plan is finalised.
- Canonical fixtures: the existing partial normalisation suites clone the canonical synthetic small-profile class data (`@synthetic/small/classesById.json?raw`) and the full suites clone `@synthetic/small/assignmentsByKey.json?raw` (the legacy suites also use the medium profile), plus local corruption probes; the new #349 parse-count tests reuse those same canonical views. #342 component tests reuse the existing `HeatmapSelectionBar.spec.tsx` fixtures; the E2E journey reuses the existing heatmap scenario helpers. No synthetic-generator extension is needed — recorded explicitly per `docs/developer/testing/synthetic-test-data.md`.
- Module sizing: current and projected LOC for every touched file are recorded per action-plan section; all projected to stay under 500 LOC, so no file separation is planned.
- #350 and #351 are deliberately excluded; they are recorded as deferred findings in the action plan's deferred table, not as open questions.

## Testing expectations

- Frontend unit/component (Vitest), red-first per section in `ACTION_PLAN.md`:
  - #349: instrumented item-schema evaluation-count tests (exactly one per item per service call) plus the unchanged existing normalisation and read-service suites as the equivalence contract.
  - #343: hook-level tests proving the pipeline/table derive from the deferred selection while the urgent selection updates immediately, id-keyed preview pairing, the removal-during-lag case (pending treatment, no error flash), the intended transient skeleton on empty→selected, and the extended busy signal (including the Refresh button's disabled state during the lag).
  - #342: component tests for the header's presence rule (>1 option), union select-all scope (search query + topic cascade), select-none, dropdown-stays-open behaviour, checked/indeterminate states, and the four query-outcome assertions from decision 5 (cleared after option selection; kept after deselect-toggle; kept after Escape-close-reopen; kept after tag removal with an active query).
  - #352: lookup equivalence for every tone.
- Browser E2E (Playwright): one journey on the standalone Heatmaps page exercising select-all in the Assignments dropdown, including with an active search query, per `docs/developer/frontend/frontend-playwright-e2e.md`.
- Regression: all existing suites of every touched module remain green — the `assignmentReadNormalisation.*.spec.ts` suites (which also exercise `assignmentReadItemValidation.ts`), `classDetailService.spec.ts`, `assignmentAssessmentService.spec.ts`, `useHeatmapsPageData.*.spec.ts`, `HeatmapBuilderSurface.spec.tsx`, `HeatmapSelectionBar.spec.tsx`, `heatmapsPipeline.spec.ts`, `heatmapsPreviewQueries.spec.ts`, `assembleMergedPreviewData.*.spec.ts`, `heatmapsSurfaceState.spec.ts`, `useHeatmapSelectionSummary.spec.ts`, `selectionCascade.spec.ts`, and the `metricTone` suites; `npm run lint:frontend:check` and `npm run typecheck:all` pass.

## Documentation and rollout notes

- Record the feature-local dropdown-header helper as a planned `Not implemented` entry in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- Update the read-validation chain description in the canonical data-shape docs `assignment.md`, `student-submission.md`, `abclass.md`, and `assessment.md` (planned-only entries marked `Not implemented`, finalised during delivery), and the two stale chain descriptions in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§3.8 and the §9.29 entry 1 sentence "Both read services invoke the normaliser before unchanged final `parseApiResponse` validation").
- No migration or rollout dependency; pure frontend behaviour change.

## V1 scope recommendation

### Include in v1

- #349 single-pass read validation with output equivalence, including the service-wrapper change and data-shape doc updates.
- #343 deferred selection derivation with id-keyed preview pairing and the extended busy signal on the standalone Heatmaps surface.
- #342 select all/none header in the Topics and Assignments dropdowns.
- #352 `METRIC_TONE_CELL_STYLE` lookup tidy.
- Unit, component, and one E2E journey covering the above.

### Defer from v1

- #350 (post-analysis effect re-key) — separate change touching shared class-page plumbing.
- #351 (isDatasetRenderable gate alignment) — separate change requiring its own warm-up-failure investigation.
- #323, #344, #348 — unrelated issues.
