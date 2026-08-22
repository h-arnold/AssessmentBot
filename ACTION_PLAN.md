# Feature Delivery Plan (TDD-First) — TaskHeatmap Feature Extraction

## Execution status

| Section                                   | Status      | Notes                                                          |
| ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| Baseline gate                             | Complete    | Session `docs/taskheatmap-extraction-spec`; see debt log below |
| 1 — metric-state rank helpers             | Complete    | See §Section 1 notes; commit recorded below                    |
| 2 — `compareStudentNames` services module | Complete    | See §Section 2 notes; commit recorded below                    |
| 3 — cluster move + `taskHeatmapModel.ts`  | Complete    | See §Section 3 notes; commit recorded below                    |
| Regression and contract hardening         | Complete    | See §hardening notes; commit recorded below                    |
| Documentation and rollout notes           | In progress | Docs agent reconciliation                                      |

### Baseline record (accepted technical debt)

Baseline run 2026-08-22, session `docs/taskheatmap-extraction-spec`, overall FAILING with two
pre-existing failures, both **outside this cycle's scope** and accepted as-is:

1. `backend-lint-check` — 14 pre-existing `max-lines` warnings in backend files
   (`98_ConfigurationManagerClass.js`, `SlidesParser.js`, `DriveManager.js`,
   `assignmentDefinitionValidation.js`, `z_apiHandler.js`, +9 more). Backend untouched this cycle.
2. `frontend-e2e-check` — 4 failing Playwright tests, all in
   `src/frontend/e2e-tests/settings-backend.spec.ts` (settings/API-key flows). None of the three
   heatmap-related E2E suites gated by this plan are affected.

Regression gate for this cycle: zero regressions against this baseline; the three heatmap E2E
suites must pass unmodified; no new failures attributable to sections 1–3.

## Read-First Context

Before writing or executing this plan:

1. Read the current [@SPEC.md](SPEC.md) v1.4 (reviewed clean through two Planner Reviewer passes; the source of truth for all product and architecture decisions — notably the narrowed decision 3, composition-only classPage→taskHeatmap imports, and decision 4's placement of `compareStudentNames` in the flat services layer).
2. Read [@src/frontend/AGENTS.md](src/frontend/AGENTS.md) for frontend conventions (feature layout §3.3, export style §2, service organisation §14).
3. Treat those documents as authoritative for behaviour, contracts, ownership boundaries, and the binding rules (`features/taskHeatmap/**` never imports `features/classPage/**`; classPage imports taskHeatmap for **composition only**, all logic sharing flowing through `services/dataAnalysis/`). This plan only sequences delivery and testing.

## Scope and assumptions

### Scope

- Organisational, behaviour-preserving extraction of the Task Heatmap feature from `src/frontend/src/features/classPage/` into a new self-contained `src/frontend/src/features/taskHeatmap/`, comprising:
  - Relocation of three shared-helper groups to their agreed owning homes (SPEC v1.4 decision 4): metric-state rank maps → `services/dataAnalysis/metricDisplay/metricStateRank.ts`; `compareStudentNames` → flat `services/dataAnalysis/compareStudentNames.ts` (structural re-typing); `compareHeatmapStudentName` → new feature model module `features/taskHeatmap/taskHeatmapModel.ts`.
  - Wholesale move of the six-file presentation cluster and its six co-located specs.
  - Mechanical import-path and `vi.mock`-path updates.
  - Documentation reconciliation, including §9.18→§9.17 reclassification of the promoted helpers in the shared-helpers canon.

### Out of scope

- Everything in SPEC.md "Future direction — next implementation rounds" (query-parameter contract, feature-owned acquisition, chrome parameterisation, multi-assignment/multi-class/cohort capabilities).
- Any behavioural, copy, layout, logging, or accessibility change.
- Any refactor of `useClassPageData`, the analyser/adapter pipeline, or prefetch policy beyond the two import-line changes specified here.
- Opportunistic cleanup not required by the move.

### Assumptions

1. The current working tree is clean on `main` and this work proceeds as a single branch; each section below leaves the full frontend unit suite green before the next begins.
2. `git mv` is used for all file moves to preserve history.
3. No lint rules are disabled; if a lint rule fires on mechanical relocation, stop and resolve rather than suppress (per AGENTS core principle #10).

---

## Global constraints and quality gates

### Engineering constraints

- Zero runtime behaviour change is a hard acceptance constraint, evidenced by unmodified unit suites and unmodified E2E suites passing at the end.
- Keep every edit mechanical: moved code is relocated verbatim except where SPEC.md decision 4 explicitly requires the structural re-typing of `compareStudentNames` (annotations only) and removal of the now-redundant cast.
- Preserve JSDoc blocks on relocated symbols verbatim (they carry rationale), except the comparator `@remarks` wording updated per Section 2's follow-through note.
- British English in comments and documentation; exports remain function declarations (never arrow-function constants).
- Binding rules throughout:
  - After Section 3, `rg "from '.*features/classPage|from '\.\.?/classPage" src/frontend/src/features/taskHeatmap/` must return zero matches. (The pattern deliberately covers both `../classPage/` and the relative `./classPageModel` form — the latter is exactly the stale import `TaskHeatmapTable.tsx` would carry if its repoint were missed; the grep alone is not sufficient proof, so Section 3 also requires reading the moved file's import block.)
  - After Section 3, classPage's only import from `features/taskHeatmap/` is `ClassPageContent.tsx`'s component composition import (decision 3, composition-only). No classPage file may import logic from taskHeatmap, and no section may leave such an import in the tree at a section boundary. This is why Sections 2 and 3 are sequenced as they are: the wrapper module `taskHeatmapModel.ts` is created **in the same atomic section as the cluster move** (Section 3), never before it.

### TDD workflow (mandatory per section)

For each section: **Red** (failing test/spec first), **Green** (smallest change), **Refactor** (tidy, still green), then section checks. For pure-move work the Red phase is expressed honestly as: update importers/mock paths to their post-move locations first so the suite fails against not-yet-moved modules, then perform the moves and watch the suite return green.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

Every delegated handoff lists its mandatory files as `@`-prefixed worktree-relative paths and includes a `Files read` evidence section; missing items block progression. Minimum sets per role (link labels below deliberately retain the `@` prefix so the tokens remain injectable when copied into delegated prompts — preserve this form when editing):

- **Testing Specialist**: [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-testing.md](docs/developer/frontend/frontend-testing.md), plus the section's touched spec/source files.
- **Implementation**: [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), plus the section's touched source/spec files and, for Sections 1–2, [@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md).
- **Code Reviewer**: [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md), plus the section diff.

### Shared-helper planning gate

Section-level shared-helper blocks below record relocation decisions with canonical-doc targets, status `Not implemented`; the Documentation section reconciles them to implemented state.

### Data-shape planning gate

**Not applicable across all sections**: no Zod schema, persistence model, API contract, or transport shape changes; the `TaskHeatmapPage` props contract is unchanged; `docs/developer/data-shapes/INDEX.md` requires no entry. Recorded explicitly because the gate must be considered even when the outcome is "none".

### Module sizing / file separation check

Current → projected LOC for materially touched files:

| File                         | Current | Projected | Note                                                                                                                                                                                                                         |
| ---------------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskHeatmapTable.tsx`       | 470     | ~470      | import-line swaps only; under the 500-line threshold                                                                                                                                                                         |
| `TaskHeatmapPage.tsx`        | 247     | ~247      | move only                                                                                                                                                                                                                    |
| `classPageModel.ts`          | 237     | ≈150–160  | Section 1 removes rank-map code (~36 lines); Section 2 removes `compareStudentNames` (~22 lines) and adds services imports; Section 3 removes `compareHeatmapStudentName` (~20 lines) plus the dead `HeatmapRow` type import |
| `buildCellPreviewLookup.ts`  | 108     | 108       | move only                                                                                                                                                                                                                    |
| New `metricStateRank.ts`     | —       | ≈45       | Section 1                                                                                                                                                                                                                    |
| New `compareStudentNames.ts` | —       | ≈30       | Section 2                                                                                                                                                                                                                    |
| New `taskHeatmapModel.ts`    | —       | ≈35       | Section 3 (wrapper only; delegates to the services comparator)                                                                                                                                                               |

No file is projected to exceed 500 lines; **no file-separation work arises from this cycle**.

### Validation commands hierarchy

- Frontend lint (fix mode during dev): `npm run lint:frontend`
- Frontend lint (CI-equivalent gate): `npm run lint:frontend:check`
- Frontend unit suite (targeted): `npm run test:frontend -- src/features/classPage src/features/taskHeatmap`
- Frontend unit suite (full): `npm run test:frontend`
- Frontend E2E (targeted): `npm run test:frontend:e2e -- task-heatmap.spec.ts` (likewise `task-preview-card.spec.ts`, `navigation-screenshots.spec.ts`)
- Backend/builder: untouched by this cycle; no backend or builder commands required.

---

## Section 1 — Relocate metric-state ranking helpers to the shared services layer

### Objective

- Create `src/frontend/src/services/dataAnalysis/metricDisplay/metricStateRank.ts` exporting `METRIC_STATE_RANK_ASC`, `METRIC_STATE_RANK_DESC`, and `getMetricStateRank` (moved verbatim from `classPageModel.ts` lines 33–68, including the private `HIGHEST_METRIC_STATE_RANK` constant), and repoint the two consumers (`classPageModel.ts`, `TaskHeatmapTable.tsx`) away from the old definitions.

### Constraints

- Values, ordering semantics, and JSDoc are preserved byte-for-byte; this is a relocation, not a rewrite.
- Mechanical imports to add in the same edit: `metricStateRank.ts` requires `import type { MetricResult } from '../dataAnalysis.zod';` (the rank maps type against it; direct sibling-relative path from `metricDisplay/` up to `services/dataAnalysis/dataAnalysis.zod.ts`); `classPageModel.ts` gains `getMetricStateRank` from the new services module **and loses its now-orphaned `import type { MetricResult }` at `classPageModel.ts:13`** — every `MetricResult` reference lives inside the removed rank-map block (lines 33–68), so leaving the import would fail the `--max-warnings 0` lint gate as an unused import.
- `buildMetricComparator` and `DEFAULT_SORT` remain private to `classPageModel.ts`; `classPageModel.ts` retains no direct reference to either rank map afterwards (it consumes `getMetricStateRank`).
- `TaskHeatmapTable.tsx` (still inside `classPage/` at this point) imports `METRIC_STATE_RANK_ASC` from `'../../services/dataAnalysis/metricDisplay/metricStateRank'`.
- No new dependencies between features are introduced by this section.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- [@SPEC.md](SPEC.md) (decisions 3–4), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 1, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-testing.md](docs/developer/frontend/frontend-testing.md)
- [@src/frontend/src/features/classPage/classPageModel.ts](src/frontend/src/features/classPage/classPageModel.ts), [@src/frontend/src/features/classPage/classPageModel.spec.ts](src/frontend/src/features/classPage/classPageModel.spec.ts)

Implementation mandatory docs:

- [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 1, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md)
- [@src/frontend/src/features/classPage/classPageModel.ts](src/frontend/src/features/classPage/classPageModel.ts), [@src/frontend/src/features/classPage/TaskHeatmapTable.tsx](src/frontend/src/features/classPage/TaskHeatmapTable.tsx)

Code Reviewer mandatory docs:

- [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 1

### Shared helper plan

1. Helper: `metricStateRank` module (`METRIC_STATE_RANK_ASC`, `METRIC_STATE_RANK_DESC`, `getMetricStateRank`)
   - Decision: `new` module hosting relocated logic (no semantic change)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricStateRank.ts`
   - Call-site rationale: generic `MetricResult['state']` ranking consumed by both the overview table (via `buildMetricComparator`) and the heatmap table; belongs to neither feature (SPEC decision 4)
   - Relevant canonical doc target: [docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md) — the metric-state sorting / rank-maps entry (~line 584 region) **reclassified into the shared-helper section (§9.17)** with owning path `metricStateRank.ts`, plus its §9.18.12 re-use note (see Documentation section)
   - Planned doc status: `Not implemented`

### Data-shape planning

Not applicable — no schema, persistence, API, or transport change.

### Acceptance criteria

- `metricStateRank.ts` exists in `services/dataAnalysis/metricDisplay/` exporting the three symbols with identical values/behaviour; co-located `metricStateRank.spec.ts` passes.
- `classPageModel.ts` no longer defines any rank map/rank function and imports `getMetricStateRank` from the new module; its remaining suite passes unchanged (its metric-column sorting tests exercise the relocated logic indirectly).
- `TaskHeatmapTable.tsx` resolves `METRIC_STATE_RANK_ASC` from the new module; its suite passes.
- `npm run lint:frontend:check` green.

### Required test cases (Red first)

New `metricStateRank.spec.ts` (fails — module does not exist):

1. `METRIC_STATE_RANK_ASC` maps computed→0, notAttempted→1, error→2.
2. `METRIC_STATE_RANK_DESC` maps error→0, notAttempted→1, computed→2.
3. `getMetricStateRank(metric, 'asc' | 'desc')` returns the mapped rank for each state.
4. Unknown/missing state falls back to rank 0 (preserves the current `?? 0` fallback).

Existing guards (must stay green):

5. Full `classPageModel.spec.ts` suite (metric-column sort order via `buildClassPageViewModel` unchanged).
6. Full `TaskHeatmapTable.spec.tsx` suite (metric sorter behaviour unchanged).

### Section checks

- `npm run test:frontend -- src/features/classPage src/services/dataAnalysis/metricDisplay`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper entry recorded above with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- Add a one-paragraph module-header `@remarks` on `metricStateRank.ts` noting its two consumers (overview table via `classPageModel`, heatmap table) so future contributors do not migrate it back into a feature folder.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Delivered as planned. `metricStateRank.ts` created (45 lines) with verbatim relocation of lines 33–68 (verified by diffing against `git show HEAD:`), only SPEC-authorised deltas: export promotions for `METRIC_STATE_RANK_DESC`/`getMetricStateRank`, added `MetricResult` type import, module-header `@remarks` naming both consumers. `classPageModel.ts` −37/+1 (rank block + orphaned `MetricResult` import removed; services import added); `TaskHeatmapTable.tsx` import repoint only. Red spec written first and confirmed red via module-resolution failure; guards (`classPageModel.spec.ts`, `TaskHeatmapTable.spec.tsx`) green throughout. Verification: targeted suite 23 files / 302 tests green; `npm run lint:frontend:check` green; `tsc -b src/frontend/tsconfig.json` green; regression checker compare run: 0 regressions, 0 new failures.
- **Deviations from plan:** Two minimal red-spec repairs during green to satisfy the `--max-warnings 0` ESLint gate and `tsc -b` (both disclosed and accepted by green review as simplest compliant fixes): (1) hoisted `const HIGHEST_METRIC_STATE_RANK = 2` in the spec for `no-magic-numbers`; (2) fallback test cast rewritten to the codebase's `as unknown as MetricResult` idiom to fix TS2345 on a spread-over-discriminated-union. Runtime objects unchanged. No lint rules disabled.
- **Follow-up implications for later sections:** Section 3 will re-point `TaskHeatmapTable.tsx`'s sibling imports when the file moves; the services-layer path established here is final. Environment note: Playwright runs rewrite `task-preview-card.spec.ts-snapshots/completeness-pinned.png` (binary churn, content drift vs HEAD); restored before commit — later sections must exclude/restore it before every commit.

---

## Section 2 — Create `services/dataAnalysis/compareStudentNames.ts` and repoint classPage consumers to it

### Objective

- Create `src/frontend/src/services/dataAnalysis/compareStudentNames.ts` (**flat**, per `src/frontend/AGENTS.md` §14's single-file rule; precedent: flat `services/dataAnalysis/heatmapAdapter.ts`) hosting `compareStudentNames` structurally re-typed onto `Readonly<{ studentName: string; studentId: string }>` with an identical body. Migrate its describe block out of `classPageModel.spec.ts` into a co-located spec (adding a **new** case-insensitivity test — see test cases), delete the old definition from `classPageModel.ts`, repoint the three classPage consumers to the services path, and update `compareHeatmapStudentName` (still in `classPageModel.ts` at this stage) to delegate without the cast.

### Constraints

- Flat placement: no `studentDisplay/` subfolder in this cycle — a single-module folder violates §14 ("keep single-file services flat … do not create folders for them"); a subfolder is created only if future siblings join.
- Structural re-typing changes annotations only; ordering semantics (locale-aware, case-insensitive via `sensitivity: 'base'`, `studentId` ascending tie-break) are preserved exactly.
- Repoints required (exact sites):
  - `classPageAdapter.ts:29` — **split the import**: `compareAssignmentUpdatedAtDesc` stays on `'./classPageModel'`; only `compareStudentNames` moves to `'../../services/dataAnalysis/compareStudentNames'`.
  - `studentAveragesTableColumns.tsx:33` — same repoint.
  - `classPageModel.ts` — local `compareStudentNames` definition removed; `buildClassPageViewModel` consumes it via a new services import. The `as unknown as StudentAverageRowModel` cast in `compareHeatmapStudentName`'s delegation goes here (both operands now satisfy the structural shape), but the wrapper itself — and therefore the `HeatmapRow` type import (originally `classPageModel.ts:14`, shifting up one line after Section 1 removes line 13) — **stays put until Section 3**, which removes both together once the wrapper relocates.
- No feature-to-feature logic import exists or is introduced by this section (`features/taskHeatmap/` does not yet exist); all sharing flows through the services layer per SPEC v1.4 decision 3.
- Test migration (this section): remove the `compareStudentNames` import and its describe block (`classPageModel.spec.ts` lines ~16, ~483–511). The **existing case-insensitivity assertion lives in the `compareHeatmapStudentName` describe block (~lines 545–553) and relocates with that block in Section 3** — so the new co-located `compareStudentNames.spec.ts` must add a **new** case-insensitivity test of its own rather than inheriting one. `compareAssignmentUpdatedAtDesc` coverage stays put.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- [@SPEC.md](SPEC.md) (decision 4), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 2, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-testing.md](docs/developer/frontend/frontend-testing.md)
- [@src/frontend/src/features/classPage/classPageModel.ts](src/frontend/src/features/classPage/classPageModel.ts), [@src/frontend/src/features/classPage/classPageModel.spec.ts](src/frontend/src/features/classPage/classPageModel.spec.ts)

Implementation mandatory docs:

- [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 2, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md) (§14 service organisation), [@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md)
- [@src/frontend/src/features/classPage/classPageAdapter.ts](src/frontend/src/features/classPage/classPageAdapter.ts), [@src/frontend/src/features/classPage/studentAveragesTableColumns.tsx](src/frontend/src/features/classPage/studentAveragesTableColumns.tsx), [@src/frontend/src/features/classPage/classPageModel.ts](src/frontend/src/features/classPage/classPageModel.ts)

Code Reviewer mandatory docs:

- [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 2

### Shared helper plan

1. Helper: `compareStudentNames(a, b)` — structurally typed
   - Decision: `new` owning module via relocation into the neutral services layer (single source of truth preserved)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/compareStudentNames.ts`
   - Call-site rationale: canonical locale-aware name comparator over `{ studentName, studentId }`; generic student-domain semantics consumed by both features, owned by neither (SPEC decision 4) — hence the neutral layer, not either feature
   - Relevant canonical doc target: shared-helpers doc ([frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md)) — §9.18.10 entry **reclassified into the shared-helper section (§9.17)** with the new owning path and structural signature (not merely re-pathed; see Documentation section)
   - Planned doc status: `Not implemented`

### Data-shape planning

Not applicable — no schema, persistence, API, or transport change.

### Acceptance criteria

- `services/dataAnalysis/compareStudentNames.ts` exists (flat), exporting the comparator with identical behaviour; co-located `compareStudentNames.spec.ts` covers ordering, tie-break, **case-insensitivity (new coverage)**, and structural acceptance (bare object literals compile/call without casts).
- `classPageAdapter.ts`, `studentAveragesTableColumns.tsx`, and `classPageModel.ts` contain no local definition of/import reference to `compareStudentNames` in `classPageModel`; all affected suites pass.
- `compareHeatmapStudentName` remains in `classPageModel.ts` but delegates cast-free; its describe block still passes in place until Section 3 relocates it.
- `classPageModel.spec.ts` no longer contains the `compareStudentNames` describe block and passes; `classPageModel.ts` contains no unused imports after the deletions.
- `npm run lint:frontend:check` green (no `sonarjs/no-identical-functions` duplication, no unused-import errors).

### Required test cases (Red first)

New `services/dataAnalysis/compareStudentNames.spec.ts` (fails — module does not exist):

1. Ascending name order (locale-aware).
2. Deterministic `studentId` ascending tie-break when names equal ignoring case.
3. Case-insensitivity (e.g. lowercase 'alice' sorts before 'Bob') — **new coverage; not inherited from any existing block**.
4. Direction-neutral single-comparator contract (call sites apply direction inversion themselves).
5. Structural acceptance: bare `{ studentName, studentId }` literals accepted.

Existing guards (must stay green):

6. Full `classPageModel.spec.ts` minus the migrated block (builder/comparator/`compareAssignmentUpdatedAtDesc` coverage).
7. `classPageAdapter.spec.ts`, `studentAveragesTableColumns.spec.tsx`, `TaskHeatmapTable.spec.tsx`.

### Section checks

- `npm run test:frontend -- src/features/classPage src/services/dataAnalysis`
- `npm run lint:frontend:check`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper entry recorded above with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- Preserve the existing `@remarks` on `compareStudentNames` verbatim, updating only wording that referenced the Class page scope ("single source of truth … in the Class page" → app-wide student-name ordering) and the removed cast.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Delivered as planned. Flat `compareStudentNames.ts` created (34 lines); body verified byte-identical to the original (SHA-256 match of extracted bodies) with only the authorised annotation deltas: structural re-typing onto `Readonly<{ studentName: string; studentId: string }>`, `@remarks` Class-page→app-wide wording, structural `@param` types. `classPageModel.ts` lost its local definition (−20) and gained the services import; `compareHeatmapStudentName` is cast-free but stays put with its `@remarks` untouched until Section 3 relocates it. Import split in `classPageAdapter.ts` and repoint in `studentAveragesTableColumns.tsx` applied exactly as specified; describe block + banner migrated out of `classPageModel.spec.ts` (−34) while the `compareHeatmapStudentName` block (incl. case-insensitivity) stayed. Red spec first (module-resolution red confirmed), then green. Verification: targeted suites 35 files / 448 tests green; `lint:frontend:check` green; `tsc -b` green (proves cast-free structural acceptance); regression checker: 0 regressions, 0 new failures.
- **Deviations from plan:** One test-only repair: `sonarjs/prefer-specific-assertions` rejected the spec's arity assertion; replaced with the linter's suggested equivalent `expect(compareStudentNames).toHaveLength(COMPARATOR_DECLARED_PARAMETERS)` — identical semantics, no rule suppressed (accepted by green review).
- **Follow-up implications for later sections:** Section 3 relocates `compareHeatmapStudentName` (with its describe block, including the existing case-insensitivity assertion) into the new `features/taskHeatmap/taskHeatmapModel.ts`, updating its `@remarks` to reference delegation to `services/dataAnalysis/compareStudentNames`.

---

## Section 3 — Move the presentation cluster into `features/taskHeatmap/`, create `taskHeatmapModel.ts` (atomic), and repoint composition + test mocks

### Objective

- Relocate the six production modules and six co-located specs from `features/classPage/` to `features/taskHeatmap/` (`git mv`), **in the same section** create `features/taskHeatmap/taskHeatmapModel.ts` hosting the relocated `compareHeatmapStudentName` wrapper (delegating to `services/dataAnalysis/compareStudentNames`), update the composition-root import in `ClassPageContent.tsx`, and refresh the two external `vi.mock` paths. After this section both binding rules hold and nothing outside `features/taskHeatmap/` references the cluster by its old paths.

### Constraints

- **Why the wrapper creation is atomic with the move:** SPEC v1.4 decision 3 permits classPage→taskHeatmap imports for _composition only_. Creating `taskHeatmapModel.ts` before the move would force `TaskHeatmapTable.tsx` (still in `classPage/`) to import logic cross-feature; moving first without it would force a forbidden `taskHeatmap → classPage` import. Performing both in one section means no non-compliant intermediate tree ever exists at a section boundary.
- Moved set (production): `TaskHeatmapPage.tsx`, `TaskHeatmapTable.tsx`, `TaskPreviewCard.tsx`, `assembleTaskPreviewData.ts`, `buildCellPreviewLookup.ts`, `spreadsheetToMarkdownTable.ts`. Moved set (specs): the matching `.spec.tsx/.spec.ts` companions.
- Wrapper relocation (same section):
  - `compareHeatmapStudentName` moves verbatim (cast already removed in Section 2) from `classPageModel.ts` into new `features/taskHeatmap/taskHeatmapModel.ts`; its JSDoc `@remarks` updated to reference delegation to `services/dataAnalysis/compareStudentNames`.
  - Its describe block — including the existing case-insensitivity assertion (`classPageModel.spec.ts` ~lines 516–560) — relocates to co-located `taskHeatmapModel.spec.ts`.
  - `TaskHeatmapTable.tsx` (moved in this section) — its `'./classPageModel'` import of `compareHeatmapStudentName` becomes a sibling import from `'./taskHeatmapModel'`; its `METRIC_STATE_RANK_ASC` import was already repointed to `'../../services/dataAnalysis/metricDisplay/metricStateRank'` in Section 1 and keeps the same depth post-move. This edit happens inside the atomic move so no non-compliant intermediate tree exists.
  - `classPageModel.ts` deletes the definition plus the now-dead `HeatmapRow` type import (originally `classPageModel.ts:14`; shifted up one line by Section 1's deletion of line 13) in the same edit — it would otherwise fail the `--max-warnings 0` lint gate as an unused import. After this section `classPageModel.ts` retains no comparator code at all.
- Mutual `'./…'` imports within the moved set remain valid; `'../../services|components|hooks|logging|query|theme|test …'` imports keep the same depth and need no edits.
- Composition/mock edits (the only other edits outside the moved set):
  - `ClassPageContent.tsx:43` — `'./TaskHeatmapPage'` → `'../taskHeatmap/TaskHeatmapPage'`.
  - `ClassPageContent.spec.tsx:55` — `vi.mock('./TaskHeatmapPage', …)` → `'../taskHeatmap/TaskHeatmapPage'`.
  - `ClassPage.spec.tsx:129` — `vi.mock('./TaskHeatmapTable', …)` → `'../taskHeatmap/TaskHeatmapTable'`.
- `ClassPageHeatmapView.spec.tsx` requires **no edit** (verified: it mocks neither moved module and exercises the chain transitively through `ClassPageContent`).
- Stale `@see ACTION_PLAN.md §N` / `@see SPEC.md` header pointers in moved files may be refreshed to reference `@SPEC.md` only where trivially editable; no other comment rewrites.
- No prop, JSX, styling, logging-context, or behavioural token may change in this section.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 3, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-testing.md](docs/developer/frontend/frontend-testing.md)
- [@src/frontend/src/features/classPage/ClassPageContent.spec.tsx](src/frontend/src/features/classPage/ClassPageContent.spec.tsx), [@src/frontend/src/features/classPage/ClassPage.spec.tsx](src/frontend/src/features/classPage/ClassPage.spec.tsx), [@src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx](src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx)

Implementation mandatory docs:

- [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 3, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md)
- [@src/frontend/src/features/classPage/ClassPageContent.tsx](src/frontend/src/features/classPage/ClassPageContent.tsx), [@src/frontend/src/features/classPage/classPageModel.ts](src/frontend/src/features/classPage/classPageModel.ts), [@src/frontend/src/features/classPage/classPageModel.spec.ts](src/frontend/src/features/classPage/classPageModel.spec.ts), plus every moved production/spec file

Code Reviewer mandatory docs:

- [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Section 3

### Shared helper plan

1. Helper: `compareHeatmapStudentName(a, b)`
   - Decision: relocation into the new feature model module; wrapper only (delegates to the services comparator — no comparison logic of its own)
   - Owning module/path: `src/frontend/src/features/taskHeatmap/taskHeatmapModel.ts`
   - Call-site rationale: sole consumer is `TaskHeatmapTable`; keeps `HeatmapRow` typing at the call site without duplicating ordering logic
   - Relevant canonical doc target: shared-helpers doc ([frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md)) §9.18.11 — stays **feature-local** (it is heatmap-specific), owning path updated to `taskHeatmapModel.ts`, delegation note repointed to the services comparator (see Documentation section)
   - Planned doc status: `Not implemented`

### Data-shape planning

Not applicable — no schema, persistence, API, or transport change.

### Acceptance criteria

- All twelve files reside under `src/frontend/src/features/taskHeatmap/` (git history preserved via `git mv`); `features/classPage/` retains no heatmap-cluster files and no re-export shims.
- `taskHeatmapModel.ts` exists with the `HeatmapRow`-typed wrapper delegating to `services/dataAnalysis/compareStudentNames`; co-located spec covers ordering parity with the services comparator, the `studentId` tie-break, and case-insensitivity (relocated assertion).
- `classPageModel.ts` contains no comparator definitions and no unused imports; its suite passes after both describe blocks have moved out.
- Dependency rule holds: zero matches for classPage imports under `src/frontend/src/features/taskHeatmap/`.
- Composition-only rule holds: the only classPage import from `features/taskHeatmap/` is `ClassPageContent.tsx`'s component import.
- Full frontend unit suite green, including the updated mock paths; `ClassPageHeatmapView.spec.tsx` passes unmodified.
- `npm run lint:frontend:check` green.

### Required test cases (Red first)

Red phase (mechanical-move framing):

1. Update the three external reference sites listed under Constraints to their post-move paths **before** moving files; the unit suite then fails (modules unresolvable at new paths) — this is the red gate proving the graph is being exercised.
2. Perform the moves plus the `taskHeatmapModel.ts` creation/relocation described above; the full suite returns green with zero test-body modifications beyond the pre-listed path edits and describe-block relocation.

Guards that must pass unmodified:

3. `TaskHeatmapPage.spec.tsx`, `TaskHeatmapTable.spec.tsx`, `buildCellPreviewLookup.spec.ts`, `assembleTaskPreviewData.spec.ts`, `spreadsheetToMarkdownTable.spec.ts`, `TaskPreviewCard.spec.tsx` at their new paths (internal `'./…'` mocks intact).
4. `ClassPageHeatmapView.spec.tsx` byte-for-byte unchanged.

New coverage in this section:

5. `taskHeatmapModel.spec.ts`: orders two `HeatmapRow`s identically to `compareStudentNames` on the same names; deterministic `studentId` tie-break; case-insensitivity (relocated from `classPageModel.spec.ts`).

### Section checks

- `npm run test:frontend` (full suite)
- `npm run lint:frontend:check`
- Binding-rule grep (global gate, broadened pattern): `rg "from '.*features/classPage|from '\.\.?/classPage" src/frontend/src/features/taskHeatmap/` returns zero matches.
- Composition-only check: the only classPage file importing from `../taskHeatmap/` is `ClassPageContent.tsx`; additionally read `TaskHeatmapTable.tsx`'s import block to confirm no `'./classPageModel'` import survives (the grep covers it, but the read is the authoritative check).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper entry recorded above with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- Update the relocated comparator's `@remarks` delegation note to reference `services/dataAnalysis/compareStudentNames`; otherwise none required beyond the optional header-pointer refresh noted in Constraints.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Delivered atomically as planned. Twelve files moved via `git mv` (nine byte-identical; three with only authorised deltas: `TaskHeatmapTable.tsx` sibling import swap `'./classPageModel'`→`'./taskHeatmapModel'` plus `@see` drop; `TaskHeatmapPage.tsx`/`TaskHeatmapTable.spec.tsx` `@see` drops). `taskHeatmapModel.ts` created (~30 lines) hosting the verbatim cast-free wrapper with `@remarks` referencing delegation to `services/dataAnalysis/compareStudentNames`; its five-test describe block (incl. case-insensitivity) relocated verbatim into co-located `taskHeatmapModel.spec.ts`. `classPageModel.ts` lost the comparator, its JSDoc, and the dead `HeatmapRow` import (also removed from `classPageModel.spec.ts` where it became orphaned — unused-import lint gate). Red phase first: three external reference sites repointed pre-move; suite failed purely on module resolution (incl. transitive failure of unmodified `ClassPageHeatmapView.spec.tsx`, exactly as SPEC predicted). Binding rules verified at boundary: zero classPage imports under `features/taskHeatmap/`; sole classPage import is the `ClassPageContent.tsx` composition edge. Verification: full suite 146 files / 1789 tests green; lint and `tsc -b` green; regression checker 0 regressions / 0 new failures.
- **Deviations from plan:** None behavioural. Two interpretation notes accepted by green review: (1) the composition-only check scoped to real imports — two spec files carry red-phase-mandated `vi.mock('../taskHeatmap/…')` strings, which are not imports and are required by the plan itself; (2) orphaned `HeatmapRow` type import also removed from `classPageModel.spec.ts` under the same unused-import rationale as the production file.
- **Follow-up implications for later sections:** Enables the Documentation section's owning-path reconciliation. Environment note: one regression-checker run hit a transient vitest worker EPIPE while the concurrent Playwright run held resources on this 4-core host; both checks pass standalone and on re-run — recorded so the hardening section does not misread a repeat as a regression.

---

## Regression and contract hardening

### Objective

- Prove end-to-end that behaviour is unchanged: full unit suite, CI-equivalent lint, and the three heatmap-related Playwright E2E suites running **without modification**.

### Constraints

- Prefer focused runs first, then breadth; do not proceed to E2E until the full unit suite is green.
- No test file outside those already enumerated may require changes; any such need indicates a missed coupling — stop and reconcile against SPEC.md before continuing.

### Delegation mandatory reads

Playwright (targeted E2E suites) mandatory docs:

- [@ACTION_PLAN.md](ACTION_PLAN.md) §Regression and contract hardening, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-playwright-e2e.md](docs/developer/frontend/frontend-playwright-e2e.md), [@docs/developer/frontend/frontend-testing.md](docs/developer/frontend/frontend-testing.md)
- [@src/frontend/e2e-tests/task-heatmap.spec.ts](src/frontend/e2e-tests/task-heatmap.spec.ts), [@src/frontend/e2e-tests/task-preview-card.spec.ts](src/frontend/e2e-tests/task-preview-card.spec.ts), [@src/frontend/e2e-tests/navigation-screenshots.spec.ts](src/frontend/e2e-tests/navigation-screenshots.spec.ts)

Code Reviewer mandatory docs:

- [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Regression and contract hardening

### Acceptance criteria

- `npm run test:frontend` fully green.
- `npm run lint:backend:check && npm run lint:frontend:check && npm run lint:builder:check` green (confirms no accidental cross-component impact).
- E2E green without modification: `npm run test:frontend:e2e -- task-heatmap.spec.ts`, `-- task-preview-card.spec.ts`, `-- navigation-screenshots.spec.ts`.
- Mandatory-read evidence (`Files read`) complete for every delegated regression handoff.

### Required test cases/checks

1. Full frontend unit suite.
2. Triple lint gate (backend/frontend/builder check modes).
3. Three targeted E2E suites.
4. Binding-rule grep (zero classPage imports under the new feature).

### Section checks

- All commands above executed with green results and outputs retained in section notes.

### Implementation notes / deviations / follow-up

- **Implementation notes:** All checks executed post-Section-3-final state, outputs retained here. (1) Full frontend unit suite: 146 files / 1789 tests passed (standalone re-run 09:08; corroborated by regression-checker `frontend-test-coverage-check` pass at 09:14 with coverage summary 94.38% statements / 88.29% branches). (2) Triple lint gate: `lint:frontend:check` exit 0; `lint:builder:check` exit 0; `lint:backend:check` reports **0 errors, the identical 14 pre-existing max-lines warnings documented as baseline accepted debt** — fails its own `--max-warnings 0` threshold exactly as at baseline, so zero cross-component impact is confirmed by delta, not absolute green. (3) Three targeted E2E suites unmodified and green via Playwright delegation: task-heatmap.spec.ts 9/9 passed (22.0s), task-preview-card.spec.ts 4/4 passed (11.9s), navigation-screenshots.spec.ts 2/2 passed (5.9s) — no retries consumed. (4) Binding-rule grep: zero classPage-import matches under `src/frontend/src/features/taskHeatmap/`. Known PNG snapshot churn recurred during E2E runs and was restored before commit.
- **Deviations from plan:** Interpretive only — the hardening gate's "triple lint green" is evidenced as _zero new issues vs the accepted-debt baseline_ for backend lint (fixing pre-existing oversized backend files is explicitly out of scope per §Validation commands hierarchy "Backend/builder: untouched this cycle"). One earlier regression-checker run's vitest coverage check crashed transiently (worker EPIPE under concurrent Playwright memory pressure on a 4-core host); standalone re-run and full checker re-run both green — environmental, not a code regression.

---

## Documentation and rollout notes

### Objective

- Reconcile all documentation invalidated by the extraction; flip planned shared-helper entries from `Not implemented` to implemented state.

### Constraints

- Only documents referencing touched areas are modified.

### Delegation mandatory reads

Docs (documentation reconciliation) mandatory docs:

- [@AGENTS.md](AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Documentation and rollout notes, [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md), [@docs/developer/frontend/navigation-consistency-status.md](docs/developer/frontend/navigation-consistency-status.md)

Code Reviewer mandatory docs:

- [@AGENTS.md](AGENTS.md), [@src/frontend/AGENTS.md](src/frontend/AGENTS.md), [@SPEC.md](SPEC.md), [@ACTION_PLAN.md](ACTION_PLAN.md) §Documentation and rollout notes

### Acceptance criteria

- `src/frontend/AGENTS.md` §3.3 feature-directory list includes `taskHeatmap/` with a one-line description consistent in style with existing entries.
- [docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md](docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md) — **reclassification, not just re-pathing** (SPEC v1.4 documentation notes): because §9.18 is scoped to feature-local classPage helpers, the promoted helpers move into the shared-helper section (§9.17):
  - §9.18.10 `compareStudentNames` → §9.17 entry with owning path `services/dataAnalysis/compareStudentNames.ts` and its new structural parameter shape.
  - The metric-state sorting / rank-maps entry → §9.17 entry with owning path `services/dataAnalysis/metricDisplay/metricStateRank.ts`.
  - §9.18.11 `compareHeatmapStudentName` stays **feature-local**: owning path → `features/taskHeatmap/taskHeatmapModel.ts`, delegation note repointed to the services comparator.
  - **§9.18.12 (`TaskHeatmapTable`: owning path → `features/taskHeatmap/TaskHeatmapTable.tsx`, re-use attribution repointed from `classPageModel.ts` to `taskHeatmapModel.ts`, `compareStudentNames.ts`, and `metricStateRank.ts`)** and **§9.18.13 (TaskHeatmapPage owning path)** updated in place; statuses reconciled against the delivered code.
  - Grep caveat for check #1 below: the stale-reference grep must also cover bare `classPageModel.ts` mentions inside helper entries (e.g. the §9.18.12 re-use note), not only full `features/classPage/...` paths — such mentions survive a path-only grep while still being stale after this cycle.
- Note on known-stale pointers outside this cycle's scope: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:172` (and `dataAnalysis.zod.ts:186`) reference "SPEC.md §Deferrals", a heading that no longer exists. SPEC v1.4 line 204 authorises refreshing stale `@see SPEC.md` pointers only **inside moved file headers**, so these non-moved services files are deliberately **left untouched** this cycle; recorded here so implementers do not "helpfully" widen scope.
- [docs/developer/frontend/navigation-consistency-status.md](docs/developer/frontend/navigation-consistency-status.md) path references (lines ~77, ~189, ~193) updated to `features/taskHeatmap/`.
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`: **no edit** (bare filename only, filename unchanged) — verified during execution.
- `docs/developer/data-shapes/`: confirmed no changes required (recorded in plan gate).

### Required checks

1. Grep docs tree for stale `features/classPage/TaskHeatmap` references **and** stale bare-`classPageModel.ts` helper attributions (see caveat above); resolve or justify each hit.
2. Verify planned shared-helper entries now read as implemented with correct owning paths.
3. Confirm notes/deviations fields in earlier sections are filled.
4. Verify mandatory-read evidence for delegated docs/review handoffs.
5. Optional `@remarks` review: confirm the Section 1 module-header remark and the updated comparator remarks exist; otherwise record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** _to be filled._
- **Deviations from plan:** _to be filled._

---

## Suggested implementation order

1. Section 1 (shared rank module — leaf dependency, smallest blast radius)
2. Section 2 (flat services comparator; repoints three classPage consumers, cast removed in `classPageModel.ts`)
3. Section 3 (atomic: wholesale cluster move + `taskHeatmapModel.ts` wrapper creation + composition/mock repoints)
4. Regression and contract hardening
5. Documentation and rollout notes

_Sections 1–2 deliberately precede the move so each relocation diff stays reviewable in place; Section 3 then moves files exactly once **and** creates the wrapper module atomically, so no intermediate tree ever contains a classPage→taskHeatmap logic import (SPEC v1.4 decision 3 permits composition-only)._
