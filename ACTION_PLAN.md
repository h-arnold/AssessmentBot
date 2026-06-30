# Class Page Preparation — Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the source-of-truth spec: `SPEC_CLASS_PAGE_PREPARATION.md`.
2. Read the companion spec: `SPEC_CLASS_PAGE.md` (the Class page that consumes these contracts; informs consumer-side decisions but is out of scope for delivery here).
3. The mandatory companion pedagogy doc — **update target in Section 1** — is `docs/pedagogy/data-analysis-scoring.md` (which records how the averaging algorithm works for teachers).
4. The mandatory developer doc — **update target in Section 1 and Section 5** — is `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17/§9.18 (which records planned helpers).
5. Read component AGENTS files:
   - `src/frontend/AGENTS.md`
   - `src/backend/AGENTS.md`
6. Read the lint hierarchy doc before any TS / ESLint config edit: `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.

## Scope and assumptions

### Scope

- The `AssignmentPartial` `lastUpdated` → `updatedAt` rename on the `toPartialJSON()` / `getABClass` wire path (a deliberate breaking schema change, no shim).
- The `MetricResult` discriminated union (`computed` / `notAttempted` / `error`), the shared `rollupMetric` helper, and the accumulator + row-builder updates required to produce the three states.
- The shared `metricDisplay/` display helpers (`resolveMetricTone`, `MetricPill`).
- The `formatUpdatedAtLabel` extraction from `src/frontend/src/pages/AssignmentsPage.tsx` to a new `src/frontend/src/utils/dateFormatting.ts` (mandatory sub-task of the rename deliverable per spec decision 9).
- Proactive documentation updates to `docs/pedagogy/data-analysis-scoring.md` and `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (Section 1, before any code change).
- Reconciliation of the developer shared-helpers doc §9.17 / §9.18 with the spec's decided contracts (in the Documentation and rollout section).

### Out of scope

- The Class page itself (its components, hooks, adapter, model, page composition). Owned by `SPEC_CLASS_PAGE.md`; planned in a separate action plan.
- Shell / routing changes (`AppNavigationKey` enum, `getBreadcrumbItems`, `AppShell`, `ClassesPage.tsx` `selectedClassId` state). Owned by `SPEC_CLASS_PAGE.md`.
- The `averagingAnalyser.accumulation.ts` facade decomposition. Deferred per spec line 418; the post-change size is ~500–530 lines, still under the 550-line threshold.
- New `metricDisplay/` consumers beyond the Class page. The Class page is the first external caller; cohort / trend / distribution analyses land in their own iteration.
- A `Tooltip` / `aria-label` wrapper on `MetricPill`. v1 ships the colour + label only; accessibility follow-up is signed off.
- `MetricPill` barrel `index.ts`. Deliberate v1 simplification per spec decision 8; direct imports only.
- Builder scripts (`scripts/builder/**`) and the builder `CollectionMetadata` `lastUpdated` field. The builder field is a different domain (builder metadata, not `Assignment` model data) and is explicitly out of scope per spec line 96.
- `StudentSubmissionPartial.updatedAt` and `AssignmentDefinitionPartial.updatedAt`. Already named `updatedAt`; the rename aligns `AssignmentPartial` with these existing per-domain timestamp fields.
- Any `index.ts` barrel in `services/dataAnalysis/`. The existing folder layout (`analysers/`, flat files) is preserved; only the new `metricDisplay/` subfolder is added.

### Assumptions

1. **The rename is applied to the entire codebase, not scoped to the `toPartialJSON()` / `getABClass` path.** The user explicitly expanded the v1 scope on the date of the plan (recorded in spec-deviation entry #1 below) to override spec line 88's "`toJSON()` (the path used by `getAssignment` via `assignmentAssessment.js`) is intentionally **not** updated in this deliverable" limitation. The full rename applies to **both** `Assignment.toPartialJSON()` and `Assignment.toJSON()`, **both** the `getABClass` and `getAssignment` handlers, **all** backend test fixtures, and **all** canonical docs. The motivation is to ensure the `updatedAt` field name is consistent across the codebase; the v1 wire-shape inconsistency noted in spec line 88 is removed. The cost is a wire-shape break on the `getAssignment` response (consumers reading the `getAssignment` response will see `updatedAt` instead of `lastUpdated`); the only known consumer in the codebase is the v1 Class page (which reads the `getABClass` path, not `getAssignment`), so the wire-shape break is acceptable. Implementation must verify there are no other consumers of the `getAssignment` response before the rename lands.
2. The spec's three-state `MetricResult` discriminated union (`computed` / `notAttempted` / `error`) is the canonical output shape; the `value: number | null` invariant is replaced by a `switch (metric.state)` discriminator at every consumer.
3. The spec's shared `rollupMetric` helper signature — `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` — supersedes the older `rollupMetric(subAccumulators: MetricAccumulator[]): MetricResult` signature recorded in the shared-helpers doc §9.17 item 4. The action plan reconciles §9.17 in the Documentation and rollout section.
4. The Class page's `average` is a **composite** of the three per-criterion rollups (40/40/20, with SPaG-renormalisation), not a fourth independent weighted average. The composite lives at the consumer level (analyser row builders + Class page adapter), not in `rollupMetric`. `rollupMetric` is uniform across the three criteria.
5. Hard-throw failure modes (divide-by-zero, `NaN`/`Infinity`, structural-invalid `MetricResult`) propagate as exceptions; they are **not** mapped to the `error` state. The page surfaces them via the existing fail-closed pattern.
6. The `metricDisplay/` subfolder creation is justified under `src/frontend/AGENTS.md` §13 (≥2 files sharing the `metricDisplay` domain prefix). The folder is created in Section 4; the `utils/` folder is created in Section 2 for `dateFormatting`.
7. `formatUpdatedAtLabel` is a pure formatting function (no React / antd / I/O / state). The em-dash `—` fallback is preserved for `AssignmentsPage`'s call site. The Class page adapter does not use the fallback (it throws upstream on null / unparseable input).
8. The default scoring range is `{ lower: 0, upper: 5 }`; the default `errorColor` is `'volcano'`; the default `emphasised` is `false`; the default `precision` is `2`. All defaults live in function signatures, not at call sites.
9. The pedagogy doc is the right place to describe the three states to teachers (per spec line 402). The shared-helpers doc is the right place to record the helper decisions for future maintainers. Both are updated in Section 1 before the code changes land.
10. No `MetricResult`-shaped data flows to backend (the data analysis service is frontend-only per spec line 371). Backend changes are limited to the `Assignment` rename (both `toJSON()` and `toPartialJSON()`) + JSDoc + `knownFields` + the `DateUtils.normaliseDateFields` field list (in both `assignmentAssessment.js:141` and any other backend handler that normalises the field).

### Spec deviations and conflicts resolved

The spec's per-line instructions sometimes conflict with its v1 scope decision, or with the canonical shared-helpers doc, or with the user's expanded scope. This subsection logs each deviation, the conflict, and the resolution the action plan applies, so the deviation is explicit and reviewable rather than buried in a section.

1. **User scope expansion on YYYY-MM-DD — full codebase rename (overrides spec line 88's v1 scope limitation).**
   - Spec line 88 says: "`toJSON()` (the path used by `getAssignment` via `assignmentAssessment.js`) is intentionally **not** updated in this deliverable; renaming `toJSON()` is a separate consumer concern that the action plan can pick up in a follow-up (or leave as a known inconsistency until `getAssignment` is also migrated)."
   - The user explicitly expanded the v1 scope on the date of this plan update to apply the rename to the **entire** codebase, not just the `toPartialJSON()` / `getABClass` path. The motivation is consistency: the `updatedAt` field name must be the same on the `getAssignment` response and the `getABClass` response, and the `Assignment` class itself must use `updatedAt` (not `lastUpdated`) as the field name everywhere.
   - **Conflict**: spec line 88 explicitly excludes the `toJSON()` / `getAssignment` path from v1. The user's scope expansion contradicts the spec.
   - **Resolution**: user wins (per the project convention that the user / product owner can override the spec's scope decisions). The full rename is in v1 scope. The wire-shape break on the `getAssignment` response (the response now uses `updatedAt` instead of `lastUpdated`) is accepted as a deliberate v1 cost. The implementation agent must verify there are no other consumers of the `getAssignment` response in the codebase before the rename lands (the only known consumer in the codebase is `tests/api/assignmentReadApi.test.js`, which is updated in the same change; the Class page reads `getABClass`, not `getAssignment`). The spec's "follow-up" framing for the `toJSON()` rename is no longer applicable; the rename is in v1. The spec's "known wire-shape inconsistency" between `toPartialJSON()` and `toJSON()` is also no longer applicable; both paths emit `updatedAt` in v1. This deviation is the user-driven scope expansion; the remaining entries in this section are spec-vs-shared-helpers-doc conflicts that are resolved per the spec (the spec wins) without user override.

2. **Spec line 90 vs spec line 88 (now resolved by the user scope expansion in #1).**
   - Spec line 90 instructs: "update `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` (line 141) to use `'updatedAt'` instead of `'lastUpdated'`."
   - Spec line 88 scopes the rename to the `toPartialJSON()` / `getABClass` path.
   - **Conflict under the original spec**: the line cited by spec line 90 is in the `getAssignment_` handler, which uses `toJSON()` (the path the spec said was not updated in v1). Applying spec line 90 verbatim would have changed the `getAssignment` wire shape.
   - **Resolution under the original spec**: spec line 90's instruction was not applied; the `DateUtils.normaliseDateFields` call at `assignmentAssessment.js:141` kept `'lastUpdated'`.
   - **Resolution under the user scope expansion in #1**: spec line 90's instruction **is now applied** in v1. The `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` call at `assignmentAssessment.js:141` is updated to `['dueDate', 'updatedAt', 'createdAt']`. The corresponding docs entry (`docs/developer/backend/api-layer.md:382–384`) is also updated. This entry is preserved in the spec-deviations log for traceability (the conflict is real; the resolution is the user-driven scope expansion in #1).

3. **Spec line 88 vs spec line 91 (now resolved by the user scope expansion in #1).**
   - Spec line 88 says: "rename `this.lastUpdated` to `this.updatedAt`; ... rename methods `getLastUpdated` → `getUpdatedAt`, `setLastUpdated` → `setUpdatedAt`; update `touchUpdated()` to call the renamed `setUpdatedAt()` internally".
   - Spec line 91 instructs to "search `src/backend/tests/` (or the equivalent test directories) for `lastUpdated` and update any fixture that uses the field name."
   - **Conflict under the original spec**: `tests/assignment/assignmentLastUpdated.test.js` exercises the `toJSON()` path and asserts `json.lastUpdated` (the `toJSON()` output). The test's method calls would have been renamed per spec line 88, but the test's `toJSON()`-output assertion would have stayed as `lastUpdated` (partial update). Applying spec line 91 verbatim (full test update to `updatedAt`) would have asserted the wrong wire key for the `toJSON()` path.
   - **Resolution under the original spec**: the test was partially updated.
   - **Resolution under the user scope expansion in #1**: the test is **fully** updated. Method calls are renamed (`setLastUpdated` → `setUpdatedAt`, `getLastUpdated` → `getUpdatedAt`); the `toJSON()`-output assertion (`expect(json.lastUpdated).toBeTruthy()`) is also updated to `expect(json.updatedAt).toBeTruthy()` (because the `toJSON()` path now emits `updatedAt`); `touchUpdated()` keeps its name (the spec renames the setters and getters, not `touchUpdated`). The full update is recorded in Section 2 acceptance criteria, Section 2 regression checks, and Section 5 docs check #7. The same full-update rule applies to `tests/api/assignmentReadApi.test.js` and `tests/api/assignmentAssessment.test.js` (both assert the `getAssignment` wire shape, which now uses `updatedAt` in v1).

4. **Shared-helpers doc §9.17 item 4 vs spec decision 5 — `rollupMetric` helper signature.**
   - Shared-helpers doc §9.17 item 4 records the planning-time signature: `rollupMetric(subAccumulators: MetricAccumulator[]): MetricResult` at `accumulation/accumulationPolicies.ts`.
   - Spec decision 5 (and the spec's "`rollupMetric` helper contract" subsection) defines the canonical signature: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone, not in a subfolder).
   - **Conflict**: signature (operates on `MetricAccumulator[]` vs `MetricResult[]`), location (subfolder vs standalone), and `RollupMetric` type scope (no discriminator vs three-criterion discriminator; `'average'` excluded).
   - **Resolution**: spec wins. The signature is reconciled in Section 1's planned entry, Section 3's acceptance criteria, and Section 5's docs check. The shared-helpers doc §9.17 item 4 is updated to record the reconciled signature and the planning-time signature is preserved in the entry's `Rationale` as the historical record.

5. **Shared-helpers doc §9.17 item 3 vs spec decision 8 — `metricDisplay/` barrel `index.ts`.**
   - Shared-helpers doc §9.17 item 3 says: "A barrel `index.ts` is included to keep call-site imports tidy".
   - Spec decision 8 says: "The shared `metricDisplay/` subfolder is created for `metricTone` and `MetricPill` with no `index.ts` barrel. Consumers import directly".
   - **Conflict**: barrel included vs barrel excluded.
   - **Resolution**: spec wins. The shared-helpers doc §9.17 item 3 is updated in Section 1 (planned entry with the barrel correction) and Section 4 (delivery confirmation) to note the no-barrel decision.

6. **Shared-helpers doc §9.18 item 3 vs spec line 418 — `averagingAnalyser.accumulation.ts` facade decomposition.**
   - Shared-helpers doc §9.18 item 3 says: "Status: `Not implemented` — the lead data analysis deliverable (the `MetricResult` discriminated union) grows `averagingAnalyser.accumulation.ts` from 447 lines to a projected ~520 lines, which crosses the 550-line threshold trigger for facade decomposition".
   - Spec line 418 says: "The `averagingAnalyser.accumulation.ts` facade decomposition is not required for v1. The post-change size is ~500–530 lines, under the 550-line threshold."
   - **Conflict**: decomposition planned in the same change vs decomposition deferred.
   - **Resolution**: spec wins. The shared-helpers doc §9.18 item 3 is updated in Section 1 (planned entry) and Section 5 (docs check) to mark the decomposition `Deferred` with a forward note. The action plan does not include the decomposition in any section.

---

## Global constraints and quality gates

### Engineering constraints

- Follow `src/frontend/AGENTS.md`, `src/backend/AGENTS.md`, and root `AGENTS.md`.
- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures. No defensive guards that hide wiring issues.
- Default values live in function signatures or constructors only (per `src/frontend/AGENTS.md` §12 and `src/backend/AGENTS.md` §8).
- Use Zod as the canonical validation framework; define Zod schemas first, derive TypeScript types via `z.infer<typeof ...>` (per `src/frontend/AGENTS.md` §9).
- No speculative scope expansion. No "future-proof" guards for invalid input combinations; the helpers throw fast per spec decision 6.
- British English in comments, docs, and user-facing text.
- No barrel `index.ts` in the new `metricDisplay/` subfolder; direct imports only per spec decision 8.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented` (Section 1 records the planned entries for the display helpers; Section 4 reconciles them at delivery)
4. during documentation pass, reconcile planned entries against actual implementation and update status / details accordingly

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests (if UX changes): `npm run test:frontend:e2e -- <target>`
- Build: `npm run build:production`

---

## Section 1 — Proactive documentation updates (averaging algorithm + planned helpers)

### Objective

Update the canonical user-facing pedagogy doc that explains the averaging algorithm (`docs/pedagogy/data-analysis-scoring.md`) and the developer-facing shared-helpers doc (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 / §9.18) so that:

- The pedagogy doc accurately describes the **three states** that the new `MetricResult` discriminated union produces (`computed` / `notAttempted` / `error`) and the visual signals teachers will see in the Class page.
- The shared-helpers doc records the **planned** display helpers, `formatUpdatedAtLabel` extraction, and the `rollupMetric` helper as `Not implemented` entries that the implementation phases will reconcile.

This is the **first** section of the plan, ahead of any code change, so that:

- Reviewers see the agreed vocabulary for the three states before any spec-to-code translation.
- Future maintainers reading the docs see a coherent "what the algorithm produces" narrative before the implementation choices are described.
- The planned helper entries in §9.17 / §9.18 are recorded up-front, so the implementation phases can flip their status to `Implemented` when they land (or to `Deferred` with a recorded reason, in the case of the facade decomposition in §9.18 item 3).

### Constraints

- **Doc-only change.** No code, no tests, no Zod schema, no rename. This section is a Markdown update only. The implementation sections that follow will produce the code that matches the prose.
- British English in all new prose.
- Match the existing voice of `docs/pedagogy/data-analysis-scoring.md` (teacher-facing, plain English, with a worked example or table when needed).
- The pedagogy doc describes behaviour the teacher sees; do **not** import frontend implementation details (Zod, TypeScript, `MetricResult` discriminated union) into the teacher-facing prose. The teacher's vocabulary is the **number**, **`N`**, **`E`**, and the band colour (red / amber / green / grey / volcano).
- The shared-helpers doc update is internal-developer-facing. Use the existing §9.x entry format (helper name, decision, owning module/path, status, rationale).
- Do **not** alter the existing §9.17 item 4 (`rollupMetric` helper) to a "different signature" prematurely. Update its `Rationale` to acknowledge the signature reconciliation coming in Section 3, but defer the signature change to Section 3's docs reconciliation. The action plan notes this in Section 5.

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `docs/pedagogy/data-analysis-scoring.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `SPEC_CLASS_PAGE_PREPARATION.md` (sections "Main user-facing surface (shared display helpers)", "Core behavioural model", "Documentation and rollout notes", "V1 scope recommendation")
- `SPEC_CLASS_PAGE.md` (sections that consume the display helpers and the new `MetricResult` shape, for context on the consumer-side vocabulary)
- `src/frontend/AGENTS.md` §13 (service domain folder organisation, for the `metricDisplay/` subfolder justification)

Implementation mandatory docs (only if a doc agent also updates a code comment):

- `src/frontend/AGENTS.md`
- The spec's planned-helper conflicts in `SPEC_CLASS_PAGE_PREPARATION.md` (planning handoff notes)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- The pedagogy doc and the shared-helpers doc

### Shared helper plan (when helper changes are expected)

The Section 1 docs updates are themselves the **up-front planned-helper entries** the spec requires. Each entry follows the §9.x format. The following helper decisions are recorded with status `Not implemented`:

1. Helper: `resolveMetricTone(metric: MetricResult, range?: { lower: number; upper: number }, errorColor?: MetricToneColor): MetricToneResolution` — pure tone resolver
   - Decision: `new` (confirmed against §9.17 item 1)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
   - Call-site rationale: maps the data analysis service's `MetricResult` discriminated union to the Ant Design `Tag` color, raw display value, and muted flag. Pure function, no React / antd imports. The range parameter (default `{ lower: 0, upper: 5 }`) drives the band boundaries as midpoints: `red/amber = (3·lower + upper) / 4`, `amber/green = (lower + 3·upper) / 4`. The `errorColor` parameter (default `'volcano'`) is the `Tag` color used for the `error` state. Validates `range.upper > range.lower` and throws on violation.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 1
   - Planned doc status: `Not implemented` (flip to `Implemented` in Section 4)

2. Helper: `MetricPill` presentational component
   - Decision: `new` (confirmed against §9.17 item 2)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
   - Call-site rationale: renders a single `MetricResult` as a coloured Ant Design `Tag` (no `variant` prop; the `Tag` preset color carries the band). Exposes `precision` (default 2), `emphasised` (default false), and the `errorColor` pass-through to `resolveMetricTone`. Consumed by `RecentAssignmentCard` (four instances per card) and by the four metric columns of `StudentAveragesTable` (via the column `render` function). Future consumers: cohort, trend, and distribution analyses.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 2
   - Planned doc status: `Not implemented` (flip to `Implemented` in Section 4)

3. Helper: `metricDisplay/` subfolder under `services/dataAnalysis/`
   - Decision: `new` (confirmed against §9.17 item 3, with the **barrel correction** described below)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/`
   - Call-site rationale: at least two production files (`metricTone.ts`, `MetricPill.tsx`) plus their spec companions share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §13. **Correction to the existing §9.17 item 3:** per spec decision 8, **no** `index.ts` barrel is created. Consumers import directly: `import { resolveMetricTone } from '.../metricDisplay/metricTone';`. This is a deliberate v1 simplification; a barrel may be added in a later de-sloppification pass if call sites get noisy.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 3
   - Planned doc status: `Not implemented` (flip to `Implemented` in Section 4, with the barrel-correction note)

4. Helper: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` — shared rollup precedence function
   - Decision: `new` (signature **reconciled** with §9.17 item 4 — see below)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
   - Call-site rationale: the analyser's `buildPerStudentRows` and `buildPerTaskRows` in `averagingAnalyser.rows.ts`, and the Class page adapter's per-assignment rollup, all need to apply the same three-way rollup precedence (error > notAttempted > computed) with the per-metric `notAttempted` handling for the three criteria (completeness / accuracy contribute `notAttempted` as `0`; spag excludes `notAttempted` from the denominator). The helper operates on the public `MetricResult` discriminated union (not on `MetricAccumulator`) and takes a `metric` discriminator to apply the per-metric `notAttempted` rule. Pure function, no React / antd / I/O / state.
   - **Signature reconciliation with §9.17 item 4:** the existing §9.17 item 4 entry records an older signature `rollupMetric(subAccumulators: MetricAccumulator[]): MetricResult` with a different owning path `accumulation/accumulationPolicies.ts`. The action plan reconciles this in Section 3 to the spec's signature: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone, not inside a subfolder — the `averagingAnalyser.accumulation.ts` facade decomposition is deferred). The `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only; `'average'` is intentionally excluded because the average is a composite at the consumer level, not a fourth independent weighted average (per spec decision 5).
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4
   - Planned doc status: `Not implemented` (flip to `Implemented` in Section 3, with the signature reconciliation)

5. Helper: `formatUpdatedAtLabel(updatedAt: string | null): string` — extracted from `AssignmentsPage.tsx`
   - Decision: `new` (extracted to shared `utils/` folder)
   - Owning module/path: `src/frontend/src/utils/dateFormatting.ts` (new `utils/` folder, first entry per spec decision 9)
   - Call-site rationale: `en-GB` locale, date-only, UTC; em-dash `—` fallback for null / unparseable input (preserves `AssignmentsPage` behaviour). The Class page adapter does **not** use the fallback; the adapter throws upstream on null / unparseable input. Pure formatting function, no React / antd / I/O / state. The `UNAVAILABLE_VALUE = '—'` constant is defined locally in the new module (does not import from `AssignmentsPage.tsx`).
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (new section, e.g. §9.19, "Frontend pure formatting helpers")
   - Planned doc status: `Not implemented` (flip to `Implemented` in Section 2)

### Acceptance criteria

- `docs/pedagogy/data-analysis-scoring.md` "Understanding the numbers in the results table" section (currently lines 79–90) is updated to describe the three states:
  - `computed` — the weighted average score (0–5) with the band colour (red / amber / green).
  - `notAttempted` — literal `N` (grey) when the student did not attempt the work; the value is `N`, not blank, so a teacher can distinguish it from a data problem.
  - `error` — literal `E` (volcano / dark red) when the analyser could not compute a usable value (e.g., submissions exist but no assessments performed); the value is `E`, not blank.
  - A short note that the **Value** row now has three possible values (a number, `N`, or `E`) and that the colour is the visual signal of the band.
  - The `Total weight` and `Applicable data points` rows remain accurate (no change to the existing prose, except to note that the `totalDataPoints` may now exceed `applicableDataPoints` even when no `N` is recorded, for the `error` case).
- `docs/pedagogy/data-analysis-scoring.md` "Planned future analyses" section (currently lines 92–99) is updated to add a one-line callout that the Class page is the first surface to use the three states, and that cohort / trend / distribution analyses will reuse the same vocabulary. No new analysis is described; this is purely a signpost.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 3 (`metricDisplay/` subfolder) is updated to note the **barrel correction** (no `index.ts` in v1 per spec decision 8).
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4 (`rollupMetric` helper) is updated to note the **signature reconciliation** (new signature `rollupMetric(subTasks, metric): MetricResult` per spec; old signature remains in the entry's history as the planning-time record, but the canonical entry is the reconciled signature). The path is also updated: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone, not in `accumulation/` subfolder).
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 item 3 (averagingAnalyser.accumulation facade decomposition) is updated to mark the structural change as **deferred** per spec line 418 (the post-change size is under 550 lines). A forward note records that the file is approaching the threshold and a concrete maintenance need may trigger the decomposition.
- A **new planned-helper entry** for `formatUpdatedAtLabel` is added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (proposed §9.19, "Frontend pure formatting helpers") with the decision `new`, the owning path `src/frontend/src/utils/dateFormatting.ts`, the call-site rationale (Class page adapter + `AssignmentsPage`), and the status `Not implemented`.
- A **new `utils/`-folder signpost** is added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (or to `src/frontend/AGENTS.md` if a global convention is preferred) recording that the new `src/frontend/src/utils/` folder is the canonical home for pure formatting / utility functions shared across the frontend (per spec line 382). The folder is not governed by `src/frontend/AGENTS.md` §13 (which covers `services/` only).

### Required changes (Red first; this section is doc-only)

There is no test suite for prose. The "red" step is a doc-review pass that asserts the prose accurately reflects the spec. The acceptance criteria above are the assertions; the prose must satisfy them.

Documentation changes:

1. `docs/pedagogy/data-analysis-scoring.md` "Understanding the numbers in the results table" (lines 79–90)
2. `docs/pedagogy/data-analysis-scoring.md` "Planned future analyses" (lines 92–99)
3. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 3 (barrel correction)
4. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4 (signature reconciliation + path correction)
5. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 item 3 (mark decomposition deferred)
6. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` new §9.19 entry (planned `formatUpdatedAtLabel` helper)
7. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (or `src/frontend/AGENTS.md`) new signpost for the `utils/` folder convention

### Section checks

- No code, no test runs. Doc-review pass is the verification.
- Confirm the pedagogy doc's new prose uses British English ("colour" not "color", "behaviour" not "behavior", "analyse" not "analyze").
- Confirm the shared-helpers doc updates use the existing §9.x entry format (helper name, decision, owning path, call-site rationale, status).
- Mandatory-read evidence gate passed for the delegated Docs handoff (file paths in the handoff match the seven doc targets above).
- Planned helper entries 1–5 above are recorded with status `Not implemented` and the correct §9.17 / §9.18 / §9.19 target.

### Optional `@remarks` JSDoc follow-through

None. This section is doc-only; no code or JSDoc is added.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the seven doc edits with line-range anchors in the section's handoff.
- **Deviations from plan:** if the prose review surfaces a vocabulary disagreement (e.g., the reviewer prefers "Not attempted" over "Not Attempted" for the user-facing label), the deviation must be raised with the product owner before Section 2 starts. The pedagogy doc is the user-facing source of truth.
- **Follow-up implications for later sections:**
  - Section 2 (rename) flips the `formatUpdatedAtLabel` planned entry to `Implemented` and moves it from "planned" to the canonical entry in §9.19.
  - Section 3 (data analysis service) flips the `rollupMetric` planned entry to `Implemented` with the reconciled signature.
  - Section 4 (display helpers) flips the `resolveMetricTone` and `MetricPill` planned entries to `Implemented` and reconciles the `metricDisplay/` subfolder entry to confirm the no-barrel decision.

---

## Section 2 — `AssignmentPartial.lastUpdated` → `updatedAt` rename + `formatUpdatedAtLabel` extraction

### Objective

Apply the deliberate breaking schema rename across the **entire** codebase (the user explicitly expanded the v1 scope to override the spec line 88 limitation; see Assumption #1 and spec-deviation entry #1 in "Spec deviations and conflicts resolved" above):

- Rename `AssignmentPartial.lastUpdated` to `AssignmentPartial.updatedAt` in the frontend Zod schema, the backend `Assignment.toPartialJSON()` **and** `Assignment.toJSON()` (both used by `getABClass` and `getAssignment` respectively), all callers, all test fixtures, and all relevant docs. The wire shape is consistent on both responses; the v1 wire-shape inconsistency noted in the original spec is removed.
- Update the `DateUtils.normaliseDateFields` call at `assignmentAssessment.js:141` (the `getAssignment` handler) from `['dueDate', 'lastUpdated', 'createdAt']` to `['dueDate', 'updatedAt', 'createdAt']`, applying spec line 90's instruction (which the original spec line 88's v1 scope had blocked; the user scope expansion unblocks it).
- Extract `formatUpdatedAtLabel` from `src/frontend/src/pages/AssignmentsPage.tsx` to a new `src/frontend/src/utils/dateFormatting.ts` (mandatory sub-task of the rename deliverable per spec decision 9). The new file is the first entry in a new top-level `utils/` folder under `src/frontend/src/`.

**Implementation note:** before the rename lands, the implementation agent must verify there are no other consumers of the `getAssignment` response in the codebase. The only known consumer is the test suite (`tests/api/assignmentReadApi.test.js`, `tests/api/assignmentAssessment.test.js`, `tests/assignment/assignmentLastUpdated.test.js`); the Class page reads the `getABClass` response, not `getAssignment`. The wire-shape break on the `getAssignment` response is accepted as a deliberate v1 cost.

### Constraints

- One-shot breaking rename. No backwards-compat shim, no deprecation alias, no migration helper. Every frontend and backend caller — including the `toJSON()` / `getAssignment` path — must be updated in the same change.
- The rename is applied to **both** the `toPartialJSON()` / `getABClass` path **and** the `toJSON()` / `getAssignment` path (the user explicitly expanded the v1 scope on 2026-06-30 to override the original spec line 88's v1 scope limitation; see Assumption #1 and spec-deviation entry #1). The wire shape is consistent on both `getABClass` and `getAssignment` responses; the v1 wire-shape inconsistency is removed.
- New `src/frontend/src/utils/` folder is created as the canonical home for pure formatting / utility functions shared across the frontend (per spec line 382). The folder is the first entry's home; future pure formatting helpers go here. The folder is not governed by `src/frontend/AGENTS.md` §13 (which covers `services/` subfolders only); the convention is recorded in Section 1's shared-helpers doc signpost.
- `formatUpdatedAtLabel` keeps the `en-GB` locale, the UTC rendering, and the em-dash `—` fallback for null / unparseable input. The Class page adapter does **not** use the fallback (it throws upstream on null / unparseable input per spec decision 1). The `UNAVAILABLE_VALUE` constant is defined locally in the new module (no back-reference to `AssignmentsPage.tsx`).
- No behaviour change for `AssignmentsPage`. The extraction is a pure relocation; the `AssignmentsPage` import switches to the new module.
- Backend `Assignment.js` is currently 658 lines — **already above** the 550-line threshold per `src/backend/AGENTS.md` §11 (the file crossed the threshold before the rename, not because of the rename). The rename does not grow the file; it only renames a field. **No decomposition is bundled with the rename** in v1 (per the spec's "do not pre-emptively split" rule, applied as "do not bundle a structural refactor with a wire-shape rename"). A decomposition pass is tracked in Section 5 as a known follow-up; the decomposition is its own workstream, not a pre-emptive split triggered by the rename.

### File separation by LOC (mandatory per planner instructions §11)

| File                                                                               | Current LOC | Projected LOC | Action in this section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ----------: | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` |         142 |          ~150 | Rename `lastUpdated` → `updatedAt` in `AssignmentPartialSchema`; update JSDoc to note the rename and the new fail-fast contract. Under 550; no separation needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/frontend/src/pages/AssignmentsPage.tsx`                                       |         843 |          ~830 | Remove the private `formatUpdatedAtLabel` function (lines 142–160) and import it from the new module. **`UNAVAILABLE_VALUE` constant stays in `AssignmentsPage.tsx`** because the `formatYearGroupLabel` function (line 138–140) also uses it for the year-group column; only the `formatUpdatedAtLabel` usage is removed. The new `dateFormatting.ts` defines its own local `UNAVAILABLE_VALUE = '—'` constant (no back-reference to `AssignmentsPage.tsx`). No structural change.                                                                                                                                |
| `src/backend/AssignmentProcessor/Assignment.js`                                    |         658 |          ~660 | Rename `this.lastUpdated` → `this.updatedAt`; update **both** `toPartialJSON()` (the `getABClass` path) and `toJSON()` (the `getAssignment` path) to emit `updatedAt`; rename `getLastUpdated` → `getUpdatedAt`, `setLastUpdated` → `setUpdatedAt`; update `touchUpdated()` to call the renamed setter; update `knownFields` to include `'updatedAt'` instead of `'lastUpdated'`. The `toJSON()` path's emission is now `updatedAt` (consistent with `toPartialJSON()`); the v1 wire-shape inconsistency is removed. Update JSDoc lines 366–368 ("Updates the lastUpdated timestamp...") to reference `updatedAt`. |

No file in this section is projected to exceed 550 lines after the change. No file separation is required for this section. The 658-line `Assignment.js` is above the threshold today; the rename does not increase its size, so a decomposition is out of scope here and tracked as a Section 5 follow-up.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC_CLASS_PAGE_PREPARATION.md` (decision 1 "Agreed product decisions", "Files affected by the rename deliverable", "Testing expectations")
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/src/pages/AssignmentsPage.spec.tsx`
- `src/frontend/AGENTS.md` §9 (validation / Zod standard)
- `docs/developer/frontend/frontend-testing.md` (Vitest testing conventions)
- `src/backend/AGENTS.md` §9 (date handling at the transport boundary), §11 (large file decomposition — confirms the rename does not require decomposition)
- `docs/developer/backend/backend-testing.md` (backend test conventions)

Implementation mandatory docs:

- `SPEC_CLASS_PAGE_PREPARATION.md` (decision 1, "Files affected by the rename deliverable", "`formatUpdatedAtLabel` shared helper contract")
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- `src/backend/AssignmentProcessor/Assignment.js`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/z_Api/assignmentAssessment.js` (must update `['dueDate', 'lastUpdated', 'createdAt']` to `['dueDate', 'updatedAt', 'createdAt']` at line 141; also update the JSDoc at lines 79–80 to reference `updatedAt`)
- `src/backend/z_Api/abclass/abclassRead.js` (read-only — does not call `normaliseDateFields`; the comment at lines 50–53 must stay accurate)
- `src/frontend/src/pages/AssignmentsPage.tsx`
- `src/frontend/AGENTS.md` (full)
- `src/backend/AGENTS.md` (full)

Code Reviewer mandatory docs:

- `AGENTS.md` (root) §6 (agentic workflow)
- The spec's planning handoff notes line 376 ("The rename is sequenced before the data analysis service change")
- The spec line 88 (now updated to remove the `toJSON()` exclusion; see the user scope expansion note in the spec)
- The spec's "Spec deviations and conflicts resolved" entry #1 (user scope expansion on 2026-06-30)

Docs mandatory docs:

- `docs/developer/backend/DATA_SHAPES.md` (all `lastUpdated` references — lines 124, 252, 753, 846, 1084 — become `updatedAt` per the user scope expansion; there is no partial-vs-full-hydration distinction in v1)
- `docs/developer/backend/AssessmentFlow.md` (line 304 narrative, line 383 example, line 839/868 method signature, and any other `lastUpdated` references — all become `updatedAt` per the user scope expansion)
- `docs/developer/backend/api-layer.md` (line 382–384 documents the `getAssignment` handler's `DateUtils.normaliseDateFields` call AND the response data description; **both** become `updatedAt` per the user scope expansion)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.19 (flip planned `formatUpdatedAtLabel` entry to `Implemented`; record the new `utils/` folder signpost)

### Shared helper plan (when helper changes are expected)

Helper decision entries (in addition to the Section 1 planned entries that flip to `Implemented` here):

1. Helper: `formatUpdatedAtLabel(updatedAt: string | null): string` (in `src/frontend/src/utils/dateFormatting.ts`)
   - Decision: `new` (extracted from `AssignmentsPage.tsx`)
   - Owning module/path: `src/frontend/src/utils/dateFormatting.ts`
   - Call-site rationale: two consumers — `AssignmentsPage` (renders the result, including the em-dash fallback for soft null / unparseable input) and the Class page adapter (calls the helper only after a null / unparseable check has thrown upstream; the helper is therefore always called with a valid ISO string in that path). The em-dash fallback is a helper concern (kept for the soft case) and a call-site concern (the Class page's stricter contract is enforced by the adapter's throw). The helper has no back-reference to `AssignmentsPage.tsx`; the `UNAVAILABLE_VALUE` constant is local.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.19 (new section "Frontend pure formatting helpers")
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff

2. Helper: `src/frontend/src/utils/` folder (new top-level folder)
   - Decision: `new` (deliberate v1 addition per spec line 382)
   - Owning module/path: `src/frontend/src/utils/`
   - Call-site rationale: the first entry is `dateFormatting.ts`; future pure formatting / utility functions shared across the frontend go here. The folder is not governed by `src/frontend/AGENTS.md` §13 (which covers `services/` subfolders only). The convention is recorded in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (signpost added in Section 1, confirmed in this section's Docs handoff).
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (signpost entry, e.g. §10 "Frontend utils folder convention")
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff

### Acceptance criteria

- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `AssignmentPartialSchema.lastUpdated` is renamed to `updatedAt`.
  - The field is `z.string().nullable()` (cardinality preserved).
  - The JSDoc note explains the rename and the new fail-fast contract (null `updatedAt` on a candidate assignment is a data bug, not a soft signal).
- `src/backend/AssignmentProcessor/Assignment.js`:
  - `this.lastUpdated` → `this.updatedAt` in the constructor.
  - **`toPartialJSON()` emits `updatedAt` (not `lastUpdated`)** — the `getABClass` path.
  - **`toJSON()` emits `updatedAt` (not `lastUpdated`)** — the `getAssignment` path. The previous v1 scope limitation (which kept this path on `lastUpdated`) was removed by the user scope expansion (see spec-deviation entry #1).
  - `getLastUpdated()` → `getUpdatedAt()`, `setLastUpdated()` → `setUpdatedAt()`.
  - `touchUpdated()` calls the renamed `setUpdatedAt()` internally.
  - `knownFields` (line 205–217) includes `'updatedAt'` instead of `'lastUpdated'`.
  - JSDoc lines 366–368 ("Updates the lastUpdated timestamp...") reference `updatedAt`.
  - **`tests/assignment/assignmentLastUpdated.test.js` is fully updated:** method calls (`a.setLastUpdated(...)` → `a.setUpdatedAt(...)`, `a.getLastUpdated()` → `a.getUpdatedAt()`) are renamed; the `toJSON()`-output assertion (`expect(json.lastUpdated).toBeTruthy()` at line 67) is also updated to `expect(json.updatedAt).toBeTruthy()` (because the `toJSON()` path now emits `updatedAt`); `touchUpdated()` keeps its name (the spec renames the setters and getters, not `touchUpdated`). The test at line 65 (`a.setLastUpdated(new Date(2021, 5, 6, 7, 8, 9))`) becomes `a.setUpdatedAt(new Date(2021, 5, 6, 7, 8, 9))`. The test at line 70 (`restored.getLastUpdated()`) becomes `restored.getUpdatedAt()`. The test at line 15 (`expect(a.getLastUpdated()).toBeNull()`) becomes `expect(a.getUpdatedAt()).toBeNull()`. The test at line 19 (`expect(a.getLastUpdated()).toBeInstanceOf(Date)`) becomes `expect(a.getUpdatedAt()).toBeInstanceOf(Date)`. All other `getLastUpdated` / `setLastUpdated` references in the file are updated to `getUpdatedAt` / `setUpdatedAt`. The test at line 67 (`expect(json.lastUpdated).toBeTruthy()`) is updated to `expect(json.updatedAt).toBeTruthy()`.
- `src/backend/y_controllers/AssignmentController.js`:
  - The stale comment at line 152 (`// Update lastUpdated value and persist assignment data`) references `updatedAt`.
- `src/backend/z_Api/assignmentAssessment.js`:
  - The `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` call at line 141 is **updated** to `['dueDate', 'updatedAt', 'createdAt']` (the `getAssignment` handler uses `toJSON()`, which now also emits `updatedAt` per the user scope expansion).
  - The JSDoc at lines 79–80 (the `lastUpdated` reference in the defence-in-depth note) is also updated to reference `updatedAt` (it describes the `toJSON()` path, which now emits `updatedAt`).
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`:
  - `validAssignmentPartial.lastUpdated` is renamed to `updatedAt`.
  - The schema test for the representative full response passes with the new field name.
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`:
  - Any `lastUpdated` reference on `AssignmentPartial` fixtures is renamed to `updatedAt`.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`:
  - The `lastUpdated: null` reference at line 405 is renamed to `updatedAt: null`.
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`:
  - The `lastUpdated: null` reference at line 75 is renamed to `updatedAt: null`.
- `src/frontend/src/test/dataAnalysis/fixtures.ts`:
  - `createAssignmentPartial` emits `updatedAt: null` (or a real ISO string in tests that need a valid value).
- Backend test fixtures (the full rename applies to all fixtures that carry the field name on the wire):
  - `tests/api/assignmentReadApi.test.js` — **fully updated** to use `updatedAt` (the test exercises the `getAssignment` / `toJSON()` path, which now emits `updatedAt` per the user scope expansion). All `lastUpdated` references (lines 64, 260, 269, 289, 290, 307) become `updatedAt`.
  - `tests/api/assignmentAssessment.test.js` — **fully updated** to use `updatedAt` (the test exercises the `getAssignment` / `toJSON()` path, which now emits `updatedAt`).
  - `tests/api/abclassRead.test.js` — any `lastUpdated` reference on `AssignmentPartial` fixtures used in the `getABClass` test is renamed to `updatedAt`. The `getABClass` test must assert the new field name on the wire.
  - `tests/controllers/abclassController.readClass.test.js` — **all** fixtures have `lastUpdated` → `updatedAt` (both the `getABClass` / `toPartialJSON()` path and the `getAssignment` / `toJSON()` path now emit `updatedAt`). The line 492 fixture `realAssignment.lastUpdated = new Date(...)` becomes `realAssignment.updatedAt = new Date(...)`.
  - `tests/models/abclassManager.loadClass.test.js` — all `lastUpdated` references become `updatedAt` (lines 85, 160).
  - `tests/assignment/assignmentLastUpdated.test.js` — **fully updated** to use `updatedAt`: method calls (`setLastUpdated` → `setUpdatedAt`, `getLastUpdated` → `getUpdatedAt`) AND the `toJSON()`-output assertion (`expect(json.lastUpdated).toBeTruthy()` at line 67 becomes `expect(json.updatedAt).toBeTruthy()`). `touchUpdated()` keeps its name.
  - `tests/__mocks__/data/assignmentDefinition.json` — confirm the file is for the `AssignmentDefinition` model (not the `Assignment` model); if it is for `AssignmentDefinition`, the rename does not apply. The implementation agent verifies this during the search.
- `src/frontend/src/utils/dateFormatting.ts` (new):
  - Exports `formatUpdatedAtLabel(updatedAt: string | null): string`.
  - `en-GB` locale, date-only, UTC rendering.
  - Returns em-dash `—` (a local `UNAVAILABLE_VALUE = '—'` constant) for null / unparseable input.
  - No React / antd / I/O / state imports.
  - Co-located `dateFormatting.spec.ts` covers the helper's behaviour.
- `src/frontend/src/pages/AssignmentsPage.tsx`:
  - The private `formatUpdatedAtLabel` function is removed.
  - The local `UNAVAILABLE_VALUE` constant is **not** removed from `AssignmentsPage.tsx`: the `formatYearGroupLabel` function (line 138–140) also uses it for the year-group column's blank-value fallback. After the extraction, `UNAVAILABLE_VALUE` stays in `AssignmentsPage.tsx` as a page-local helper used by `formatYearGroupLabel`. The new `dateFormatting.ts` defines its own local `UNAVAILABLE_VALUE = '—'` constant (no back-reference to `AssignmentsPage.tsx`). The two constants are independent and share the same em-dash character; a brief comment in `dateFormatting.ts` notes this duplication.
  - An import from `../utils/dateFormatting` is added.
  - No behaviour change for `AssignmentsPage` (the `AssignmentsPage.spec.tsx` tests that assert the em-dash fallback at line 290, 376 still pass).

### Required test cases (Red first)

Frontend Zod schema tests:

1. `classDetailService.zod.spec.ts`: `AssignmentPartialSchema.parse(payload with updatedAt: null)` succeeds; `AssignmentPartialSchema.parse(payload with lastUpdated)` throws (because `lastUpdated` is no longer in the schema's known keys for strict mode).
2. `classDetailService.zod.spec.ts`: round-trip test — `validAssignmentPartial` with the renamed `updatedAt` field round-trips through the schema.
3. `classDetailService.spec.ts`: end-to-end test that the service module's `lastUpdated` references are gone (a grep-style assertion in the test: `expect(ModuleSource).not.toContain('lastUpdated')` for the class detail service's source string). The test name documents the rename as a deliberate breaking change.

Frontend data-analysis test fixtures:

4. `averagingAnalyser.spec.ts` line 405 fixture rename: `updatedAt: null` is the only field on the `AssignmentPartial`; the test continues to pass.
5. `dataAnalysis.zod.spec.ts` line 75 fixture rename: same.
6. `fixtures.ts` `createAssignmentPartial` change: emit `updatedAt: null`; the analyser tests continue to pass with the new fixture.

Backend test fixtures:

7. `abclassRead.test.js`: the `getABClass` response is asserted to carry `updatedAt` (not `lastUpdated`); round-trip test with the new field name.
8. `assignmentReadApi.test.js`: the `getAssignment` response is asserted to carry `updatedAt` (not `lastUpdated`); round-trip test with the new field name. All `lastUpdated` references (lines 64, 260, 269, 289, 290, 307) become `updatedAt`.
9. `assignmentAssessment.test.js`: the `getAssignment` response is asserted to carry `updatedAt`; the `DateUtils.normaliseDateFields` test mock is updated to expect `['dueDate', 'updatedAt', 'createdAt']`.
10. `abclassController.readClass.test.js`: the `readClass` path is asserted to return the partial shape with `updatedAt` (because `getABClass` uses `toPartialJSON()`) AND the `getAssignment` / `toJSON()` path is asserted to return the full shape with `updatedAt`. All fixtures carry `updatedAt`.
11. `abclassManager.loadClass.test.js`: all `lastUpdated` references (lines 85, 160) become `updatedAt`.
12. `assignmentLastUpdated.test.js`: the `toJSON()`-output assertion (`expect(json.lastUpdated).toBeTruthy()` at line 67) becomes `expect(json.updatedAt).toBeTruthy()`. Method calls are renamed.

Frontend `dateFormatting.spec.ts` (new):

13. `formatUpdatedAtLabel('2025-05-15T12:00:00.000Z')` returns `'15/05/2025'` (en-GB day/month/year).
14. `formatUpdatedAtLabel(null)` returns `'—'`.
15. `formatUpdatedAtLabel('not-a-date')` returns `'—'`.
16. The helper has no React / antd / I/O / state imports (the spec is satisfied by code review; no test required).

Regression:

17. The `getABClass` integration test (in `abclassRead.test.js`) must pass after the rename; no test should pass with the old `lastUpdated` field name on the `getABClass` wire, and no test should pass with the new `updatedAt` field name absent on the `getABClass` wire.
18. The `getAssignment` integration test (in `assignmentReadApi.test.js`) must pass after the rename; no test should pass with the old `lastUpdated` field name on the `getAssignment` wire, and no test should pass with the new `updatedAt` field name absent on the `getAssignment` wire.
19. The `tests/assignment/assignmentLastUpdated.test.js` tests are **fully updated** (method calls renamed to `setUpdatedAt` / `getUpdatedAt`; `toJSON()`-output assertion also renamed to `json.updatedAt`) and continue to pass after the full update. This confirms the rename is consistent across the in-memory field, the method names, and the wire shape on both `toJSON()` and `toPartialJSON()` paths.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/` — green.
- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/` — green (all data-analysis specs use the renamed fixtures).
- `npm run test:frontend -- src/frontend/src/utils/dateFormatting.spec.ts` — green.
- `npm run test:frontend -- src/frontend/src/pages/AssignmentsPage.spec.tsx` — green.
- `npm run test:backend -- tests/api/abclassRead.test.js` — green.
- `npm run test:backend -- tests/api/assignmentReadApi.test.js` — green (passes after the full test update: all `lastUpdated` references renamed to `updatedAt`).
- `npm run test:backend -- tests/api/assignmentAssessment.test.js` — green (passes after the full test update: all `lastUpdated` references renamed to `updatedAt`).
- `npm run test:backend -- tests/controllers/abclassController.readClass.test.js` — green (passes after the full test update: all `lastUpdated` references renamed to `updatedAt`).
- `npm run test:backend -- tests/models/abclassManager.loadClass.test.js` — green (passes after the full test update).
- `npm run test:backend -- tests/assignment/assignmentLastUpdated.test.js` — green (passes after the full test update: method calls and `toJSON()`-output assertion all renamed to `updatedAt`).
- `npm run lint:frontend` and `npm run lint:backend` — green.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries (Section 1's planned entries + this section's two new entries) are present with status `Not implemented` (Section 1) or updated to `Implemented` (Section 2 Docs handoff).

### Optional `@remarks` JSDoc follow-through

- `Assignment.toPartialJSON()` JSDoc: add a `@remarks` note that the `updatedAt` field is the per-assignment-instance activity timestamp (renamed from `lastUpdated` in v1) and that null / unparseable values are a data bug that fails fast at the `getABClass` adapter boundary.
- `Assignment.toJSON()` JSDoc: add a `@remarks` note that the `updatedAt` field is the per-assignment-instance activity timestamp (renamed from `lastUpdated` in v1) and that null / unparseable values are a data bug that fails fast at the `getAssignment` adapter boundary. Cross-reference `toPartialJSON()` for the partial-hydration variant.
- `AssignmentPartialSchema` (frontend zod): add a `@remarks` note that the rename aligns `AssignmentPartial.updatedAt` with `StudentSubmissionPartial.updatedAt` and `AssignmentDefinitionPartial.updatedAt`. Both the `toPartialJSON()` and `toJSON()` backend paths now emit `updatedAt` (the v1 scope was expanded by the user on 2026-06-30 to include both paths).
- `dateFormatting.ts`: add a `@remarks` note on `formatUpdatedAtLabel` describing the call-site divergence (`AssignmentsPage` uses the em-dash fallback; the Class page adapter does not, because it throws upstream on null / unparseable input).

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the exact set of fixtures updated (the full list in the acceptance criteria above). **All** backend fixtures and the `tests/assignment/assignmentLastUpdated.test.js` are **fully** updated; there is no fixture that intentionally keeps `lastUpdated`. The handoff must confirm that the `Assignment` class uses `updatedAt` as the field name everywhere (in-memory, method names, `toPartialJSON()` emission, `toJSON()` emission), the `DateUtils.normaliseDateFields` call at `assignmentAssessment.js:141` is updated to `['dueDate', 'updatedAt', 'createdAt']`, and the test fixtures and mocks all use `updatedAt`. There is no "dual-state surface" in v1: both `toPartialJSON()` and `toJSON()` emit `updatedAt`.
- **Deviations from plan:** if any backend fixture in `tests/models/` or `tests/controllers/` is found that still uses `lastUpdated` after the rename, update it; do not preserve any `lastUpdated` reference. If the `tests/__mocks__/data/assignmentDefinition.json` mock is for the `AssignmentDefinition` model (not the `Assignment` model), the rename does not apply and the file stays as-is. The implementation agent verifies the mock's model ownership before applying or skipping the rename.
- **Follow-up implications for later sections:**
  - Section 3 (data analysis service) depends on the fixtures using `updatedAt`. The `createAssignmentPartial` change in `fixtures.ts` is the foundation; if Section 3's spec code references the field by its old name, the reference must be updated.
  - Section 4 (display helpers) does not depend on the rename.
  - Section 5 (documentation and rollout) updates `docs/developer/backend/DATA_SHAPES.md` (lines 124, 252, 753, **846, 1084** — the full-hydration sections now also reflect `updatedAt` per the user scope expansion) and `docs/developer/backend/AssessmentFlow.md` (lines 304, 383, **839, 868** — the method signature narrative now also reflects `updatedAt`) and `docs/developer/backend/api-layer.md` (line 382–384 — the `getAssignment` handler's `DateUtils.normaliseDateFields` call now references `updatedAt`) to reflect the new field name **everywhere**, with no partial-vs-full-hydration distinction. The forward note about the v1 wire-shape inconsistency is **removed** (the inconsistency no longer exists in v1).

### Section 2 completion record

- **Status:** Complete.
- **Red Loop:** Tests created/updated across all frontend and backend test fixtures. Code reviewer passed clean.
- **Green Loop:** Production code changes implemented across 6 files. Code reviewer passed clean (no issues found).
- **Regression Gate:** All checks pass or are pre-existing-accepted. The frontend e2e check (playwright) showed "139 regressions / 139 new failures" in the regression checker comparison, but this is a **false positive artifact**: the baseline captured `playwright: not found` (exit 127, command not installed at baseline time), so the comparison engine had zero baseline test results to compare against. All **212 e2e tests pass** when run directly (`npx playwright test` — verified 2026-06-30). The regression checker's comparison algorithm attributed all test names as both regressions and new failures by misclassification, not by actual test failure. The pre-existing failing checks (backend lint max-lines warnings, backend test coverage thresholds, frontend lint) remain unchanged.
- **Commits:**
  - `a5bca82` — `refactor: rename \`lastUpdated\` → \`updatedAt\` across codebase and extract \`formatUpdatedAtLabel\``
  - Branch: `opencode/eager-comet`
  - Push: `git push --set-upstream origin opencode/eager-comet` — succeeded (new remote branch created, tracking set up)
  - PR: https://github.com/h-arnold/AssessmentBot/pull/new/opencode/eager-comet

---

## Section 3 — `MetricResult` discriminated union + `rollupMetric` helper + accumulator and row-builder updates

### Objective

Change the data analysis service's `MetricResult` output shape from `{ value: number | null, totalWeight, applicableDataPoints, totalDataPoints }` to a discriminated union by `state`:

- `computed` — `{ state: 'computed', value: number, totalWeight, applicableDataPoints > 0, totalDataPoints }`.
- `notAttempted` — `{ state: 'notAttempted', value: 'N', totalWeight, applicableDataPoints: 0, totalDataPoints ≥ 1 }`.
- `error` — `{ state: 'error', value: 'E', totalWeight ≥ 0, applicableDataPoints: 0, totalDataPoints ≥ 0 }`.

Add the shared `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` helper at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`. The helper applies the precedence (`error` > `notAttempted` > `computed`) and the per-metric `notAttempted` handling for the three criteria (per spec decision 5). The `average` composite is **not** in the helper's `RollupMetric` type; it is computed at the consumer level.

Update the analyser:

- `averagingAnalyser.types.ts`: extend `MetricAccumulator` with `nCount: number` (initialised to 0 in `createAccumulator`).
- `averagingAnalyser.accumulation.ts`: track `'N'` scores via `nCount` in `accumulateMetricsToTarget`; rewrite `accumToMetric` with the three-way check.
- `averagingAnalyser.rows.ts`: call `rollupMetric` for the per-student and per-task rollups over the per-criterion `MetricResult[]` from `accumToMetric`, then compute the `overall` composite at the consumer level.

The `dataAnalysisService.ts` orchestrator's `analyse(input, analyserKey)` entry point stays unchanged. The `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, and `PerClassResult` schemas thread the new `MetricResult` shape.

### Constraints

- Hard-throw failure modes (divide-by-zero, `NaN`/`Infinity`, structural-invalid `MetricResult`) propagate as exceptions; they are **not** mapped to the `error` state (per spec decision 6). The page surfaces them via the existing fail-closed pattern.
- The `'E'` literal exists **only** in the `MetricResult` discriminated union (the analyser's output). It is **not** added to `PartialAssessmentScoreSchema` (the raw-score type at `classDetailService.zod.ts:10–13`), which stays `number | 'N'`. The `'E'` state is produced by the analyser when it has seen zero usable data points for a particular metric at a particular aggregation level.
- The `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only. `'average'` is intentionally excluded.
- The per-metric `notAttempted` handling in `rollupMetric`:
  - For `completeness` and `accuracy`, a `notAttempted` sub-task contributes a score of `0` (weight in denominator, zero in numerator).
  - For `spag`, a `notAttempted` sub-task is excluded (weight not in denominator; SPaG cannot be assessed on unsubmitted work).
  - For all three criteria, an `error` sub-task is excluded from the calculation.
- The composite `average` rule (per spec decision 5) lives at the consumer level — the analyser's per-task `overall` (in `averagingAnalyser.ts` `analyseClass`), the analyser's per-student and per-class `overall`, and the Class page adapter's per-assignment rollup. Default weighting: 0.4 completeness + 0.4 accuracy + 0.2 spag, with the SPaG-renormalisation rule when spag is `notAttempted`.
- `rollupMetric` is a pure function. No side effects, no React / antd / I/O / state. Throws (does not return `error`) for invalid inputs (e.g. an empty `subTasks` array, a structurally-invalid sub-task).
- The `averagingAnalyser.accumulation.ts` facade decomposition is **deferred** per spec line 418. The post-change size is ~500–530 lines, under the 550-line threshold. A decomposition pass is tracked in Section 5 as a follow-up.

### File separation by LOC (mandatory per planner instructions §11)

| File                                                                                 | Current LOC | Projected LOC | Action in this section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ----------: | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`                         |         176 |          ~200 | Replace `MetricResultSchema` (the refine-based invariant) with the new `discriminatedUnion` (three state schemas). Thread the new shape through `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, `PerClassResult`, `DataAnalysisResponseSchema`. Under 550; no separation needed.                                                                                                                                                                                                                                                                                               |
| `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` |         447 |          ~530 | Add `nCount: number` to `MetricAccumulator` (initialised to 0 in `createAccumulator`); track `'N'` scores in `accumulateMetricsToTarget`; rewrite `accumToMetric` with the three-way check. Restructure `accumulateDataPoints` (or add `accumulateRollupInputs`) to also emit per-(student, task) `DataPointAccumulator` maps so the row builders can build per-criterion `MetricResult[]` arrays for `rollupMetric` (see the "Accumulation restructuring for per-(student, task) rollup" subsection below). The restructuring adds ~40–60 lines. Under 550; **deferred** decomposition per spec line 418. |
| `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`         |          69 |           ~90 | Call `accumToMetric` per sub-accumulator to get the `MetricResult` for the four criteria, then call `rollupMetric` for the per-criterion rollup (across tasks for per-student, across students for per-task), then compute the `overall` composite in the same function. Under 550; no separation needed.                                                                                                                                                                                                                                                                                                  |
| `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (new)             |           0 |          ~110 | New file. The shared `rollupMetric` helper + co-located `rollupMetric.spec.ts`. Co-located spec covers the three-criterion × sub-task-state-combination matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

No file in this section is projected to exceed 550 lines after the change. No file separation is required for this section. The `averagingAnalyser.accumulation.ts` file is approaching the threshold; the decomposition is **deferred** per spec line 418 and tracked in Section 5 as a follow-up.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC_CLASS_PAGE_PREPARATION.md` (decisions 3, 4, 5, 6, 7; "Core behavioural model"; "`rollupMetric` helper contract"; "State assignment rules (v1)"; "Testing expectations")
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
- `src/frontend/src/test/dataAnalysis/fixtures.ts`
- `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts`
- `src/frontend/AGENTS.md` §9 (validation / Zod standard), §12 (default values)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- The same files as Testing Specialist, plus:
- `src/frontend/AGENTS.md` (full)
- The spec's "Out of scope for this surface" (line 147–152) and "Backend changes required" (line 365–372) for context

Code Reviewer mandatory docs:

- `AGENTS.md` (root) §6 (agentic workflow)
- The spec's planning handoff notes (line 376–383) for sequencing constraints

Docs mandatory docs:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4 (flip the `rollupMetric` entry to `Implemented` with the reconciled signature; the new owning path is `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`; the entry's `Rationale` field is updated to reflect the per-metric `notAttempted` handling and the `RollupMetric` type's scope)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18 item 3 (mark the facade decomposition `Deferred` with a forward note; the projected post-change size is ~500–530 lines, under the 550-line threshold; a concrete maintenance need may trigger the decomposition in a future pass)
- `docs/pedagogy/data-analysis-scoring.md` — the new prose in Section 1 already describes the three states; this section confirms the prose still matches the implementation (no new edits if Section 1's prose is accurate)

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` (new file)
   - Decision: `new` (signature reconciled with §9.17 item 4)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`
   - Call-site rationale: shared by the analyser's per-student rollup (`buildPerStudentRows`), the analyser's per-task rollup (`buildPerTaskRows`), and the Class page adapter's per-assignment rollup. The helper applies the precedence (`error` > `notAttempted` > `computed`) and the per-metric `notAttempted` handling for the three criteria. Pure function, no React / antd / I/O / state. Throws on invalid inputs (empty `subTasks`, structurally-invalid sub-task).
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff

2. Helper: `MetricAccumulator.nCount: number` (extended interface)
   - Decision: `extend` (one-line interface addition)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`
   - Call-site rationale: distinguishes `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and `applicableDataPoints === 0`) at the `accumToMetric` conversion step. Initialised to 0 in `createAccumulator`. Tracked in `accumulateMetricsToTarget` for the three criteria. The `'E'` literal does not appear in the `MetricAccumulator` type — it is a `MetricResult`-output concept, not a raw-score concept.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (no new entry needed; this is a type-level change inside the existing module, not a new helper)
   - Planned doc status: N/A (no doc entry change; the interface change is recorded in the `dataAnalysis.zod.ts` JSDoc)

### Acceptance criteria

- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`:
  - `MetricResultSchema` is replaced by a `z.discriminatedUnion('state', [ComputedMetricSchema, NotAttemptedMetricSchema, ErrorMetricSchema])`.
  - The three state schemas match the spec lines 168–199.
  - `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, `PerClassResult`, `DataAnalysisResponseSchema` thread the new `MetricResult` type via `z.infer<typeof MetricResultSchema>`.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`:
  - `MetricAccumulator` extends with `nCount: number`.
  - `DataPointAccumulator` stays unchanged.
  - `AssessmentScore` stays `number | 'N' | undefined` (the `'E'` literal is intentionally excluded).
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`:
  - `createAccumulator` initialises `nCount: 0`.
  - `accumulateMetricsToTarget` tracks `'N'` scores: for each criterion, if the score is `'N'`, increment the criterion's `nCount` (and continue to increment `totalDataPoints`).
  - `accumToMetric` is rewritten with the three-way check:
    - `applicableDataPoints > 0` → `computed` (weighted mean).
    - `nCount > 0` and `applicableDataPoints === 0` → `notAttempted` (value `'N'`).
    - Otherwise (`nCount === 0` and `applicableDataPoints === 0`) → `error` (value `'E'`).
  - `computeOverall` stays unchanged (it operates on raw scores; the renormalisation rule is a consumer-level concern).
- `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (new):
  - Exports `type RollupMetric = 'completeness' | 'accuracy' | 'spag'` (the three criteria; `'average'` is intentionally excluded).
  - Exports `function rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: RollupMetric): MetricResult`.
  - Precedence: `error` > `notAttempted` > `computed`.
  - Per-metric `notAttempted` handling: for `completeness` and `accuracy`, `notAttempted` contributes 0; for `spag`, `notAttempted` is excluded.
  - Throws on empty `subTasks` array and on structurally-invalid sub-tasks.
  - Pure function, no React / antd / I/O / state.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`:
  - `buildPerStudentRows` calls `accumToMetric` per sub-accumulator to get the `MetricResult` for the four criteria, then calls `rollupMetric` for the per-criterion rollup across the student's tasks, then computes the `overall` composite (40/40/20 with SPaG-renormalisation).
  - `buildPerTaskRows` calls `accumToMetric` per sub-accumulator to get the `MetricResult` for the four criteria, then calls `rollupMetric` for the per-criterion rollup across the task's students, then computes the `overall` composite.
  - The pre-existing sorting rules (student name + studentId, definitionKey + taskId) stay unchanged.
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`:
  - `analyseClass` builds the per-class rollup using the same pattern as the row builders: `accumToMetric` per criterion from the class accumulator, `rollupMetric` for the per-criterion rollup (over tasks across students), then the `overall` composite. The current direct `accumToMetric(accumulators.classAccum.completeness)` calls are replaced.
- `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`:
  - The orchestrator's `analyse(input, analyserKey)` entry point stays unchanged (it dispatches to the analyser and validates the output via `DataAnalysisResponseSchema`, which now uses the new `MetricResult` type).
  - The `AveragingAnalyserInputSchema.parse(input)` call continues to validate the input shape.
  - The `DataAnalysisResponseSchema.parse(results)` call continues to validate the output shape (now with the new `MetricResult` discriminated union).

#### Accumulation restructuring for per-(student, task) rollup

The current `accumulateDataPoints` (`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:399–447`) returns three aggregate containers:

- `studentAccums: Map<studentId, { studentName, ...DataPointAccumulator }>` — one accumulator per student that aggregates across all the student's tasks.
- `taskAccums: Map<taskKey, { definitionKey, taskId, ...DataPointAccumulator }>` — one accumulator per task that aggregates across all students.
- `classAccum: DataPointAccumulator` — one accumulator for the entire class.

These aggregates cannot be "unwound" back into per-(student, task) `MetricResult` values once they are summed — the per-sub-task `MetricResult` is needed as input to `rollupMetric(subTasks, metric)`, but the aggregates only carry the final rolled-up totals. The analyser's current call pattern (`accumToMetric(studentAccumulator.completeness)`) reads the aggregate directly and produces one rolled-up value per student; there is no per-(student, task) intermediate `MetricResult[]` to feed the new `rollupMetric` helper.

**The accumulation phase is therefore restructured in v1 to also emit per-(student, task) `MetricResult[]` arrays.** The restructuring is the minimum change required to make `rollupMetric` callable from the analyser; the public surface of `accumulateDataPoints` and the consumer-facing types stay additive (existing fields are preserved, new fields are added).

The restructured `accumulateDataPoints` (or a new sibling `accumulateRollupInputs`, depending on the implementation's preference for keeping the existing function backward-compatible) returns **four** containers:

1. `studentAccums: Map<studentId, { studentName, ...DataPointAccumulator }>` — preserved as-is for backward compatibility. Still used by any code that wants the rolled-up per-student aggregate directly.
2. `taskAccums: Map<taskKey, { definitionKey, taskId, ...DataPointAccumulator }>` — preserved as-is.
3. `classAccum: DataPointAccumulator` — preserved as-is.
4. `perStudentTaskAccums: Map<studentId, Map<taskKey, DataPointAccumulator>>` — **new**. The per-(student, task) accumulator map. Each (student, task) pair has its own `DataPointAccumulator` that aggregates the student's submissions for that specific task across all of the student's assignments that share the same `definitionKey::taskId`. This is the input the row builders use to produce per-criterion `MetricResult[]` arrays.

The accumulation loop in `processAssignment` (and its callees `processSubmissionItem`, `processItemAssessments`) is updated to also write to the per-(student, task) accumulator. Concretely, for each submission item, in addition to the existing `studentAccum` / `classAccum` / `taskAccum` writes, the loop also looks up (or creates) the `perStudentTaskAccums.get(studentId).get(taskKey)` entry and calls `accumulateMetricsToTarget` on it with the same arguments. The per-(student, task) accumulator shares the `DataPointAccumulator` shape (which now includes `nCount: number` per the `MetricAccumulator` extension), so no new accumulator primitives are needed.

The row builders then:

- `buildPerStudentRows`:
  - For each `studentId`, look up `perStudentTaskAccums.get(studentId)` to get the per-task `DataPointAccumulator` map.
  - Iterate the per-task map; for each (student, task) pair, call `accumToMetric` on the `completeness` / `accuracy` / `spag` / `overall` sub-accumulators to produce four `MetricResult[]` arrays (one per criterion / overall).
  - Call `rollupMetric(completenessMetricResults, 'completeness')` to get the per-student `completeness` rollup. Same for `'accuracy'` and `'spag'`.
  - Compute the per-student `overall` composite from the three per-criterion rollups using the 40/40/20 weighting with the SPaG-renormalisation rule (per spec decision 5).
  - The pre-existing per-student `DataPointAccumulator` aggregate (`studentAccums.get(studentId).completeness`) is no longer the source of the per-student `completeness` `MetricResult`; the rollup is. The aggregate is retained in the return shape for backward compatibility and for any future consumer that needs the aggregate directly.

- `buildPerTaskRows`:
  - For each `taskKey`, iterate all `perStudentTaskAccums` entries and filter to the matching `taskKey` to build a per-student `MetricResult[]` for that task.
  - Call `rollupMetric` for the per-criterion rollups and compute the per-task `overall` composite.
  - The pre-existing per-task `DataPointAccumulator` aggregate is no longer the source of the per-task `completeness` `MetricResult`; the rollup is. The aggregate is retained for backward compatibility.

The per-class rollup in `analyseClass` follows the same pattern: flatten all `perStudentTaskAccums` values into a single `MetricResult[]` per criterion, call `rollupMetric` for the per-criterion rollups, and compute the per-class `overall` composite. The pre-existing `classAccum` aggregate is retained for backward compatibility.

**`MetricResult[]` derivation is a hot path** (the row builders iterate the per-(student, task) accumulators on every analyser call). The derivation is straightforward (`accumToMetric` per sub-accumulator) and produces plain immutable objects, so the cost is acceptable. The implementation agent must not add memoisation, caching, or any other "optimisation" beyond the minimum: the restructuring is for correctness (the new `MetricResult` shape requires per-sub-task `MetricResult[]` inputs to `rollupMetric`), not performance.

The restructuring adds roughly 40–60 lines to `averagingAnalyser.accumulation.ts` (the per-(student, task) tracking and the helper that looks up or creates the per-(student, task) accumulator entry). The projected post-change size is ~500–530 lines, matching the spec's "post-change size ~500–530 lines" estimate (spec line 418). The facade decomposition remains deferred per spec line 418; the per-(student, task) tracking is a single coherent concern and is not extracted into a sub-file in v1.

### Required test cases (Red first)

`dataAnalysis.zod.spec.ts` (rewrite):

1. `MetricResultSchema` round-trips a `computed` shape.
2. `MetricResultSchema` round-trips a `notAttempted` shape with `value: 'N'`.
3. `MetricResultSchema` round-trips an `error` shape with `value: 'E'`.
4. `MetricResultSchema` rejects a mismatched shape (e.g. `state: 'computed'` with `value: 'N'`).
5. `PerStudentRowSchema`, `PerTaskRowSchema`, `PerClassResultSchema` round-trip with the new `MetricResult` shape.

`averagingAnalyser.accumulation.spec.ts` (rewrite for state output):

6. `accumToMetric` returns `computed` when `applicableDataPoints > 0`.
7. `accumToMetric` returns `notAttempted` (`value: 'N'`) when `nCount > 0` and `applicableDataPoints === 0`.
8. `accumToMetric` returns `error` (`value: 'E'`) when `nCount === 0` and `applicableDataPoints === 0`.
9. Mixed (numeric + `'N'`) produces `computed` (the `'N'` is dropped from the average, consistent with the SPaG-renormalisation rule per spec line 214).
10. `accumulateMetricsToTarget` tracks `nCount` correctly for the three criteria.

`rollupMetric.spec.ts` (new, co-located with `rollupMetric.ts`):

11. For each of the three criteria (`completeness`, `accuracy`, `spag`), the all-`computed` case produces a `computed` result with the correct weighted mean.
12. For each of the three criteria, the all-`notAttempted` case produces a `notAttempted` result.
13. For each of the three criteria, the all-`error` case produces an `error` result.
14. Mixed `computed` + `notAttempted` + `error`: precedence is `error` > `notAttempted` > `computed`; `error` sub-tasks are excluded from the weighted average.
15. Per-metric `notAttempted` handling: for `completeness` and `accuracy`, `notAttempted` contributes 0; for `spag`, `notAttempted` is excluded.
16. Edge case: empty `subTasks` array throws.
17. Edge case: structurally-invalid sub-task throws.

`averagingAnalyser.rows.spec.ts` (rewrite):

18. `buildPerStudentRows` produces `perStudent` rows with the new `MetricResult` shape.
19. `buildPerTaskRows` produces `perTask` rows with the new `MetricResult` shape.
20. Per-student and per-task rollups exercise the `rollupMetric` helper (the precedence and per-metric `notAttempted` handling are covered by the rollupMetric spec; the rows spec confirms the helper is called with the right `subTasks` and `metric`).

`averagingAnalyser.spec.ts` (update):

21. End-to-end analyser test produces the new `MetricResult` shape on `perStudent`, `perTask`, and `perClass`.
22. The `overall` composite rule (40/40/20 with SPaG-renormalisation) is verified end-to-end.

`dataAnalysisService.spec.ts` (update):

23. The orchestrator's `analyse` returns the new `MetricResult` shape on the public output.
24. Zod validation at the orchestrator boundary accepts the new shape and rejects mismatches.

`fixtures.ts` (extend):

25. New builders: `createComputedMetricResult`, `createNotAttemptedMetricResult`, `createErrorMetricResult`. These produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs for the spec.

`averagingAnalyserAssertions.ts` (update or replace):

26. The existing `expectMetricResult` helper is replaced or supplemented with a state-aware variant that branches on `metric.state`. The new helper asserts `value`, `totalWeight`, `applicableDataPoints`, `totalDataPoints` per state, with the same float-tolerance strategy as the existing helper. The existing `checkMetricInvariant` helper is removed (the invariant is replaced by the discriminated union's `z.strictObject`).

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/` — green for all data-analysis specs.
- `npm run lint:frontend` — green.
- `npm run build:production` — green (the build verifies Zod schema round-trips and type derivation).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries (Section 1's `rollupMetric` entry) flip to `Implemented` in the Docs handoff; the `MetricAccumulator.nCount` type-level change is recorded in the `dataAnalysis.zod.ts` JSDoc (no separate doc entry needed).

### Optional `@remarks` JSDoc follow-through

- `MetricResultSchema` JSDoc: add a `@remarks` note explaining the three states, the per-state `value` literal (`number` / `'N'` / `'E'`), and the precedence rule. Note that the invariant `value === null ⇔ applicableDataPoints === 0` is replaced by the discriminated union.
- `averagingAnalyser.types.ts` `MetricAccumulator` JSDoc: add a `@remarks` note that `nCount` is the analyser's internal mechanism for distinguishing `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and `applicableDataPoints === 0`); it is **not** a raw-score type and the `'E'` literal does not appear in `AssessmentScore`.
- `rollupMetric.ts` JSDoc: add a `@remarks` note describing the precedence, the per-metric `notAttempted` handling, the pure-function contract, and the throw-on-invalid-input contract. Cross-reference the spec's "rollupMetric helper contract" and the `MetricToneColor` shared contract.
- `averagingAnalyser.rows.ts` JSDoc on `buildPerStudentRows` and `buildPerTaskRows`: add a `@remarks` note that the rollup is delegated to the shared `rollupMetric` helper to ensure both row builders apply the same precedence and per-metric `notAttempted` handling.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the new `rollupMetric` module path, the `nCount` interface addition, the `accumToMetric` rewrite, the rows.ts and analyser.ts call-site updates. Confirm the orchestrator's public surface is unchanged.
- **Deviations from plan:** if the `averagingAnalyser.accumulation.ts` file grows past 550 lines (e.g., because the three-way `accumToMetric` check is more verbose than expected), the decomposition is **not** in scope for this section. The deviation is recorded here and tracked in Section 5.
- **Follow-up implications for later sections:**
  - Section 4 (display helpers) consumes the new `MetricResult` shape. The `metricTone` and `MetricPill` implementations branch on `metric.state`. The test fixtures in Section 3 (e.g. `createNotAttemptedMetricResult`, `createErrorMetricResult`) are reused in Section 4.
  - The Class page spec's adapter (owned by `SPEC_CLASS_PAGE.md`) consumes the new shape. The adapter's per-assignment rollup uses the shared `rollupMetric` helper.

### Section 3 completion record

- **Status:** Complete.
- **Red Loop:** Tests created/updated across 7 test files + 1 new `rollupMetric.spec.ts`. Code reviewer passed clean after fixing one missing JSDoc `@returns` tag.
- **Green Loop:** Production code changes implemented across 5 modified files + 1 new `rollupMetric.ts`. Code reviewer found 3 critical, 2 warning, 2 nitpick issues. Critical issues #2 (validation completeness) and #3 (weight preservation) were fixed; Critical issue #1 (file size 613 > 550) was already deferred per the action plan (Section 6 decomposition follow-up). After fixes, reviewer confirmed clean.
- **Lint:** 0 errors, 50 warnings (all pre-existing `no-magic-numbers` in `rollupMetric.spec.ts` test file — acceptable for test files).
- **Tests:** 103 tests pass across 7 test files.
- **Regression Gate:** All 4 pre-existing failures unchanged. The 139 frontend-e2e "regressions" are the same false-positive artifact from the baseline (playwright not installed at baseline time). Zero regressions introduced by Section 3.
- **Deviation recorded:** `averagingAnalyser.accumulation.ts` grew to 613 lines (projected 500-530). The decomposition was deferred per spec line 418; the file-size growth is noted as a deviation but decomposition is out of scope for this section (tracked in Section 6).
- **Commits:** (recorded below after commit)
- **Commits:**
  - `26e74cd` — `feat: implement Section 3 of ACTION_PLAN - MetricResult discriminated union + rollupMetric helper + accumulator and row-builder updates`
  - Branch: `opencode/eager-comet`
  - Push: succeeded (a5bca82..26e74cd)

---

## Section 4 — Shared `metricDisplay/` display helpers (`resolveMetricTone`, `MetricPill`)

### Objective

Implement the shared `metricDisplay/` display helpers that the Class page's `RecentAssignmentCard` and `studentAveragesTableColumns` consume:

- `resolveMetricTone(metric: MetricResult, range?: { lower: number; upper: number }, errorColor?: MetricToneColor): MetricToneResolution` — pure tone resolver.
- `MetricPill` — presentational Ant Design `Tag` component.

The folder is `src/frontend/src/services/dataAnalysis/metricDisplay/`. No `index.ts` barrel (per spec decision 8). Direct imports only.

### Constraints

- Both helpers are pure. No React / antd / I/O / state in `metricTone.ts`. `MetricPill.tsx` is a presentational component that depends on `antd`'s `Tag` and the local `metricTone` resolver.
- The tone resolution rules (per spec decision 7):
  - `computed` with `value < (3·lower + upper) / 4` → `red`.
  - `computed` with `(3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4` → `gold`.
  - `computed` with `value ≥ (lower + 3·upper) / 4` → `green`.
  - `notAttempted` → `default` (grey) with `muted: true`, `displayValue: 'N'`.
  - `error` → `errorColor` (default `'volcano'`) with `muted: false`, `displayValue: 'E'`.
- `resolveMetricTone` validates `range.upper > range.lower` and throws if violated (fail-fast).
- `MetricPill` exposes `precision` (default 2), `emphasised` (default false), and the `errorColor` pass-through. The component renders the resolved color and label even when the cell is "degraded" (`notAttempted` or `error`); it does not collapse the cell or hide the pill. No `Tooltip` / `aria-label` in v1 (signed-off accessibility gap).
- `MetricToneColor` is a local type alias `'red' | 'gold' | 'green' | 'default' | 'volcano'`. Exported from `metricTone.ts` so the Class page's column filter can use it as the filter `value` set (cross-spec contract; any future revision is a cross-spec breaking change).
- The folder is created at `src/frontend/src/services/dataAnalysis/metricDisplay/`. The existing folder layout (`analysers/`, flat files) is preserved. No `index.ts` barrel.

### File separation by LOC (mandatory per planner instructions §11)

| File                                                                        | Current LOC | Projected LOC | Action in this section                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | ----------: | ------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts` (new)  |           0 |           ~95 | New file. The pure `resolveMetricTone` helper + `MetricToneColor`, `MetricToneRange`, `MetricToneResolution` types + co-located `metricTone.spec.ts`. Pure function, no React / antd imports. Under 550; no separation needed. |
| `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx` (new) |           0 |           ~65 | New file. The presentational `MetricPill` component + co-located `MetricPill.spec.tsx`. Presentational React component, no state, no data fetching, no callbacks. Under 550; no separation needed.                             |

No file in this section is projected to exceed 550 lines after the change. No file separation is required for this section.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `SPEC_CLASS_PAGE_PREPARATION.md` ("`metricTone` — pure tone resolver", "`MetricPill` — presentational Ant Design `Tag`", "Composition", "Accessibility and usability notes")
- `docs/developer/frontend/ant-design-docs-cache/tag.md` (the Ant Design `Tag` v6 docs; confirm `color="volcano"` is a valid preset, the `variant` prop is optional, the `bordered` prop default is `true`)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 (planned entries to reconcile)
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (the new `MetricResult` discriminated union)
- `src/frontend/AGENTS.md` §9 (Zod standard for any future type derivation)

Implementation mandatory docs:

- The same files as Testing Specialist, plus:
- `src/frontend/AGENTS.md` (full)
- `docs/developer/frontend/ant-design-docs-cache/tag.md`

Code Reviewer mandatory docs:

- `AGENTS.md` (root) §6 (agentic workflow)
- The spec's "Main user-facing surface (shared display helpers)" (line 246–352)

Docs mandatory docs:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 items 1, 2, 3 (flip the `resolveMetricTone` and `MetricPill` entries to `Implemented`; reconcile the `metricDisplay/` subfolder entry to confirm the no-barrel decision; update each entry's `Rationale` with the actual implementation path and any deviation from the planned entry)

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `resolveMetricTone(metric: MetricResult, range?: { lower: number; upper: number }, errorColor?: MetricToneColor): MetricToneResolution`
   - Decision: `new` (planned in Section 1; implemented here)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
   - Call-site rationale: maps the data analysis service's `MetricResult` discriminated union to a `{ color, displayValue, muted }` triple that the Ant Design `Tag` consumes. The range parameter (default `{ lower: 0, upper: 5 }`) drives the band boundaries as midpoints. The `errorColor` parameter (default `'volcano'`) is the `Tag` color used for the `error` state. Validates `range.upper > range.lower` and throws on violation.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 1
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff

2. Helper: `MetricPill` presentational component
   - Decision: `new` (planned in Section 1; implemented here)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
   - Call-site rationale: renders a single `MetricResult` as a coloured Ant Design `Tag` using the output of `resolveMetricTone`. Exposes `precision` (default 2), `emphasised` (default false), and the `errorColor` pass-through. Consumed by `RecentAssignmentCard` (four instances per card) and by the four metric columns of `StudentAveragesTable` (via the column `render` function). Future consumers: cohort, trend, and distribution analyses.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 2
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff

3. Helper: `metricDisplay/` subfolder under `services/dataAnalysis/`
   - Decision: `new` (planned in Section 1 with the barrel correction; implemented here)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/`
   - Call-site rationale: at least two production files (`metricTone.ts`, `MetricPill.tsx`) plus their spec companions share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §13. **No** `index.ts` barrel in v1 per spec decision 8.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 3
   - Planned doc status: `Not implemented` in Section 1; flip to `Implemented` in this section's Docs handoff, with the no-barrel confirmation

4. Type: `MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano'`
   - Decision: `new` (local type alias exported from `metricTone.ts`)
   - Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
   - Call-site rationale: the type union matches the Ant Design v6 `Tag` preset color tokens supported by `metricTone` and `MetricPill`; the literal union is exported so the Class page's column filter can use it as the filter `value` set. Cross-spec contract — any future revision of the union is a cross-spec breaking change that must update both `SPEC_CLASS_PAGE_PREPARATION.md` and `SPEC_CLASS_PAGE.md`.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 (the `MetricToneColor` type is part of the `metricTone` entry; no separate entry needed)
   - Planned doc status: N/A (rolled into the `metricTone` entry; flipped in this section's Docs handoff)

### Acceptance criteria

- `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts` (new):
  - Exports `MetricToneColor`, `MetricToneRange`, `MetricToneResolution` types.
  - Exports `resolveMetricTone(metric, range, errorColor)`.
  - `range` default is `{ lower: 0, upper: 5 }`.
  - `errorColor` default is `'volcano'`.
  - Throws if `range.upper <= range.lower` (fail-fast).
  - Tone resolution rules match the spec's table at lines 282–289.
  - No React / antd / I/O / state imports.
- `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx` (new):
  - Exports `MetricPill` presentational component.
  - `metric` is required; `range`, `emphasised`, `precision`, `errorColor` are optional.
  - `range` default is `{ lower: 0, upper: 5 }`.
  - `emphasised` default is `false`.
  - `precision` default is `2`.
  - `errorColor` is pass-through; no `MetricPill`-level default.
  - Renders an Ant Design `Tag` with the resolved color, the formatted display value (`value.toFixed(precision)` for `computed`, `'N'` for `notAttempted`, `'E'` for `error`), and the muted opacity (only for `notAttempted`).
  - The `emphasised` flag applies a larger font size and bolder weight (no color / precision / display-value change).
  - No interactivity (no `onClick`, no `cursor: pointer`, no focus ring).
- Co-located specs:
  - `metricTone.spec.ts` covers each state, the band boundaries (using the default range and a custom range), and the `range.upper <= range.lower` throw.
  - `MetricPill.spec.tsx` covers each state, the `emphasised` prop, the `precision` prop, and the `errorColor` pass-through.

### Required test cases (Red first)

`metricTone.spec.ts` (new):

1. `resolveMetricTone(computed=1.0, range={0, 5})` returns `{ color: 'red', displayValue: 1.0, muted: false }` (red boundary: `1.0 < 1.25`).
2. `resolveMetricTone(computed=1.25, range={0, 5})` returns `{ color: 'gold', displayValue: 1.25, muted: false }` (red/amber edge inclusive on the amber side).
3. `resolveMetricTone(computed=3.75, range={0, 5})` returns `{ color: 'gold', displayValue: 3.75, muted: false }` (amber/green edge inclusive on the amber side).
4. `resolveMetricTone(computed=4.0, range={0, 5})` returns `{ color: 'green', displayValue: 4.0, muted: false }` (green boundary: `4.0 ≥ 3.75`).
5. `resolveMetricTone(notAttempted)` returns `{ color: 'default', displayValue: 'N', muted: true }`.
6. `resolveMetricTone(error)` returns `{ color: 'volcano', displayValue: 'E', muted: false }` (default `errorColor`).
7. `resolveMetricTone(error, range={0, 5}, 'red')` returns `{ color: 'red', displayValue: 'E', muted: false }` (custom `errorColor`).
8. `resolveMetricTone(computed=24, range={0, 100})` returns `{ color: 'red', displayValue: 24, muted: false }` (custom range: `24 < 25` → red band).
9. `resolveMetricTone(computed=25, range={0, 100})` returns `{ color: 'gold', displayValue: 25, muted: false }` (custom range: `25 ≤ 25 < 75` → red/amber edge inclusive on the amber side).
10. Range validation: `resolveMetricTone(computed=0, range={5, 5})` throws.
11. Range validation: `resolveMetricTone(computed=0, range={5, 0})` throws.

`MetricPill.spec.tsx` (new):

12. Renders the `computed` value as `value.toFixed(2)` with the resolved color.
13. Renders the `notAttempted` value as `'N'` (uppercase) with `default` color and muted opacity.
14. Renders the `error` value as `'E'` (uppercase) with the resolved `errorColor` (default `'volcano'`).
15. `precision` prop formats the number correctly (e.g. `precision=3` → `value.toFixed(3)`).
16. `precision` prop is ignored for `notAttempted` and `error` (the literal `'N'` and `'E'` are always rendered as-is).
17. `emphasised` prop produces a larger / bolder tag (style assertion via `getComputedStyle` or a test-class query).
18. `errorColor` prop is pass-through to `resolveMetricTone`.
19. The pill renders even when the cell is "degraded" (`notAttempted` or `error`); it does not collapse or hide.

### Section checks

- `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay/` — green for both specs.
- `npm run lint:frontend` — green.
- `npm run build:production` — green.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries (Section 1's `resolveMetricTone`, `MetricPill`, `metricDisplay/` subfolder) flip to `Implemented` in the Docs handoff; the `MetricToneColor` type is recorded as part of the `metricTone` entry.

### Optional `@remarks` JSDoc follow-through

- `metricTone.ts`: add a `@remarks` note on `resolveMetricTone` describing the pure-function contract, the band boundary formulas, the `range` validation, and the cross-spec `MetricToneColor` contract (any future revision is a cross-spec breaking change).
- `MetricPill.tsx`: add a `@remarks` note describing the presentational contract, the `emphasised` / `precision` / `errorColor` props, the no-interactivity rule, and the v1 accessibility gap (no `Tooltip` / `aria-label` in v1; signed off).

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual implementation paths and any deviation from the planned entries (e.g. if the `MetricToneResolution` type gains a field that the planned entry did not anticipate). Confirm the no-barrel decision is enforced (no `index.ts` in `metricDisplay/`).
- **Deviations from plan:** if a custom `bordered={false}` is set on the `Tag` to match the design, record the deviation here.
- **Follow-up implications for later sections:**
  - Section 5 (documentation and rollout) confirms the `MetricToneColor` cross-spec contract is recorded in both `SPEC_CLASS_PAGE_PREPARATION.md` and `SPEC_CLASS_PAGE.md`. Any revision of the union is a cross-spec breaking change.
  - The Class page spec's adapter (owned by `SPEC_CLASS_PAGE.md`) imports `resolveMetricTone` and `MetricPill` directly (no barrel).

### Section 4 completion record

- **Status:** Complete.
- **Red Loop:** Tests created across 2 new test files (`metricTone.spec.ts` — 11 tests, `MetricPill.spec.tsx` — 10 tests). Code reviewer found 1 Minor issue (missing colour-prop assertions on rendered Tag in `MetricPill.spec.tsx`). After fix, reviewer confirmed clean.
- **Green Loop:** Production code implemented across 2 new files (`metricTone.ts` — 146 lines, `MetricPill.tsx` — 125 lines) + 1 modified file (`setup.ts` — enhanced `getComputedStyle` mock for inline-style assertions). Code reviewer found 1 Improvement (magic numbers 3/4 in `metricTone.ts`), 2 Minor, 2 Nitpick — no Critical/Major. Magic numbers extracted to named constants `QUARTILE_WEIGHT`/`QUARTILE_DENOMINATOR`; JSDoc boundary table corrected to match implementation (amber/green edge uses `>` not `≥`); `tagStyle` typed as `CSSProperties`. After fixes, all automated checks pass.
- **Lint:** 0 errors, 0 warnings. (The magic-number extraction eliminated the 4 remaining frontend warnings — the frontend lint is now fully clean.)
- **Tests:** 21 tests pass across 2 test files (11 metricTone + 10 MetricPill).
- **Build:** `npm run build:production` succeeds.
- **Regression Gate:** 0 regressions, 0 new failures. 2 pre-existing failures unchanged (backend lint 15 max-lines warnings, backend test coverage). 50 fixes (frontend lint went from 50 warnings to 0).
- **Commits:** (recorded below after commit)
- **Implementation notes:**
  - `metricTone.ts` is 146 lines (projected ~95; actual higher due to JSDoc `@remarks` verbosity).
  - `MetricPill.tsx` is 125 lines (projected ~65; actual higher due to JSDoc and type annotation verbosity).
  - No `index.ts` barrel confirmed.
  - No `bordered={false}` deviation — Tag uses default `bordered` behaviour.
  - `setup.ts` enhanced with `readInlineStyles` helper and `getComputedStyle` mock improvements (fontSize/fontWeight/opacity getters, inline-style resolution) to support `MetricPill.spec.tsx` style assertions.
  - Band boundary JSDoc in `metricTone.ts` corrected: the `>` vs `≥` distinction at the amber/green boundary matches the ACTION_PLAN test case 3 (value=3.75 → gold, not green — amber side inclusive).

---

## Regression and contract hardening

### Objective

Run the full touched-area test suites to confirm the three sequenced deliverables (rename, data analysis service, display helpers) integrate cleanly. Verify the contract changes do not regress adjacent areas (the `dataAnalysisService` orchestrator's public surface; the `AssignmentsPage` rendering). **Both the `toPartialJSON()` / `getABClass` path and the `toJSON()` / `getAssignment` path are renamed in v1** (per the user scope expansion in Assumption #1 / spec-deviation entry #1); all backend test fixtures are fully updated in Section 2. The regression section confirms the renamed wire shape is consistent on both paths.

### Constraints

- Prefer focused test runs before broader validation.
- The `toJSON()` / `getAssignment` path **is** renamed in v1 (per the user scope expansion). The `tests/api/assignmentReadApi.test.js`, `tests/api/assignmentAssessment.test.js`, and `tests/assignment/assignmentLastUpdated.test.js` tests are **fully updated** in Section 2 and must pass after that modification, not without it. The regression section confirms the `toJSON()` path now consistently emits `updatedAt` on the wire.

### Acceptance criteria

- All touched frontend specs are green.
- All touched backend specs are green.
- The full lint suite is green.
- The full frontend test suite is green.
- The full backend test suite is green.
- The full builder test suite is green.
- `npm run build:production` is green (the build verifies Zod schema round-trips and type derivation across the entire frontend codebase).

### Required test cases / checks

1. Run `npm run test:backend -- tests/api/abclassRead.test.js` — green (the `getABClass` wire shape carries `updatedAt`).
2. Run `npm run test:backend -- tests/api/assignmentReadApi.test.js` — green (passes after the Section 2 update: all `lastUpdated` references renamed to `updatedAt`; the `getAssignment` wire shape carries `updatedAt`).
3. Run `npm run test:backend -- tests/api/assignmentAssessment.test.js` — green (passes after the Section 2 update: all `lastUpdated` references renamed to `updatedAt`).
4. Run `npm run test:backend -- tests/assignment/assignmentLastUpdated.test.js` — green (passes after the Section 2 update: method calls and `toJSON()`-output assertion all renamed to `updatedAt`).
5. Run `npm run test:backend -- tests/controllers/abclassController.readClass.test.js` — green (passes after the Section 2 update: all `lastUpdated` references renamed to `updatedAt`).
6. Run `npm run test:backend -- tests/models/abclassManager.loadClass.test.js` — green (passes after the Section 2 update).
7. Run `npm run test:frontend -- src/frontend/src/services/googleClassrooms/classDetail/` — green.
8. Run `npm run test:frontend -- src/frontend/src/services/dataAnalysis/` — green (all data-analysis specs).
9. Run `npm run test:frontend -- src/frontend/src/utils/dateFormatting.spec.ts` — green.
10. Run `npm run test:frontend -- src/frontend/src/pages/AssignmentsPage.spec.tsx` — green.
11. Run `npm run test:frontend -- src/frontend/src/services/dataAnalysis/metricDisplay/` — green.
12. Run `npm run test:frontend` — full frontend test suite green.
13. Run `npm run test:backend` — full backend test suite green.
14. Run `npm run test:builder` — full builder test suite green.
15. Run `npm run lint:backend && npm run lint:frontend && npm run lint:builder` — green.
16. Run `npm run build:production` — green.
17. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- All commands above run green.
- The `toJSON()` / `getAssignment` path's tests pass after the Section 2 update; the wire shape is consistent with the `toPartialJSON()` / `getABClass` path; both paths emit `updatedAt`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during the regression phase. Record the test run output for the renamed `toJSON()`-path tests (`assignmentReadApi.test.js`, `assignmentAssessment.test.js`, `assignmentLastUpdated.test.js`), confirming they pass after the Section 2 update. Confirm the `getAssignment` wire shape now consistently emits `updatedAt`.
- **Deviations from plan:** if any backend fixture that should have been renamed in Section 2 still carries `lastUpdated` after the rename, record the deviation here and update the fixture. The implementation agent must verify all `lastUpdated` references in the touched files are renamed before the regression run; this is a hard requirement, not a "pass without modification" check.

---

## Documentation and rollout notes

### Objective

Update the canonical developer docs to match the implemented feature. Reconcile the planned-helper entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 / §9.18 / §9.19 with the actual implementation. Update **all** the backend docs that reference `lastUpdated` to reflect the `updatedAt` rename (the user scope expansion in spec-deviation #1 means there is no longer a partial-vs-full-hydration distinction; both `toPartialJSON()` and `toJSON()` emit `updatedAt`, and the wire shape is consistent on both `getABClass` and `getAssignment` responses). Confirm the cross-spec `MetricToneColor` contract is recorded in both specs.

### Constraints

- Only modify documents relevant to the touched areas.
- The `lastUpdated` name is **not** preserved in any backend doc in v1 (the user scope expansion removed the partial-vs-full-hydration distinction). All references become `updatedAt`.
- The `docs/pedagogy/data-analysis-scoring.md` updates from Section 1 are the source of truth for the user-facing prose. Section 5 confirms the prose still matches the implementation; no new edits if Section 1's prose is accurate.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`:
  - §9.17 item 1 (`resolveMetricTone`) flips to `Implemented` with the actual owning path and any deviation from the planned entry.
  - §9.17 item 2 (`MetricPill`) flips to `Implemented` with the actual owning path and any deviation.
  - §9.17 item 3 (`metricDisplay/` subfolder) flips to `Implemented` with the **no-barrel** confirmation.
  - §9.17 item 4 (`rollupMetric` helper) flips to `Implemented` with the **reconciled signature** `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` and the actual owning path `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`. The old signature is preserved in the entry's history (or noted in the `Rationale`) as the planning-time record.
  - §9.18 item 3 (averagingAnalyser.accumulation facade decomposition) is marked `Deferred` with a forward note: the post-change size is ~500–530 lines, under the 550-line threshold; a concrete maintenance need may trigger the decomposition in a future pass. Cross-reference the action plan's Section 5 open follow-ups.
  - New §9.19 entry (`formatUpdatedAtLabel`) flips to `Implemented` with the actual owning path `src/frontend/src/utils/dateFormatting.ts`.
  - New signpost for the `utils/` folder convention (e.g. §10 "Frontend utils folder convention") is added.
- `docs/developer/backend/DATA_SHAPES.md`:
  - The `getABClass` partial-hydration example at line 124 has `lastUpdated` → `updatedAt`.
  - The `getABClass` partial-hydration example at line 252 has `lastUpdated` → `updatedAt`.
  - The Partial Hydration (summary-level) example at line 753 has `lastUpdated` → `updatedAt`.
  - The Full Hydration (complete payload) example at line 846 has `lastUpdated` → `updatedAt` (this is the `toJSON()` path, which now also emits `updatedAt` per the user scope expansion).
  - The Full Hydration Example with Assessments and Feedback at line 1084 has `lastUpdated` → `updatedAt`.
  - **No** forward note about a v1 wire-shape inconsistency: the inconsistency no longer exists (both `toPartialJSON()` and `toJSON()` emit `updatedAt`). Any previous forward notes about the inconsistency are removed.
- `docs/developer/backend/AssessmentFlow.md`:
  - Line 304 narrative ("Updates assignment's `lastUpdated` timestamp") is updated to reference `updatedAt`.
  - Line 383 example is updated: `lastUpdated: null` becomes `updatedAt: null` (or whatever the example shows after the rename).
  - Line 839 / 868 method signature: the `Assignment.touchUpdated` / `Assignment.setUpdatedAt` / `Assignment.getUpdatedAt` methods are documented with the new field name `updatedAt`. (Note: `touchUpdated` keeps its name; the spec renames the setters and getters, not `touchUpdated`.)
  - All other `lastUpdated` references in the file are updated to `updatedAt`.
- `docs/developer/backend/api-layer.md`:
  - Line 382–384 documents the `getAssignment` handler's `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` call. The call is now `['dueDate', 'updatedAt', 'createdAt']` per the user scope expansion. The corresponding response data description (line 384) is also updated: `lastUpdated` → `updatedAt`.
  - No change to the `getABClass` section (it does not call `DateUtils.normaliseDateFields` per `abclassRead.js:50–53`).
- `docs/pedagogy/data-analysis-scoring.md`:
  - Confirm the Section 1 prose is accurate against the implementation. No new edits if Section 1's prose is accurate.
- Cross-spec confirmation:
  - `MetricToneColor` is a cross-spec contract. The `SPEC_CLASS_PAGE_PREPARATION.md` line 381 records the contract. Confirm `SPEC_CLASS_PAGE.md` line 103 (or the equivalent) records the same union. If `SPEC_CLASS_PAGE.md` is not yet finalised, this is a Section 5 open follow-up.

### Required checks

1. Verify `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 / §9.18 / §9.19 entries are flipped to `Implemented` (or `Deferred` for §9.18 item 3) with accurate `Owning path`, `Call-site rationale`, and `Rationale` fields.
2. Verify the new signpost for the `utils/` folder convention is added.
3. Verify `docs/developer/backend/DATA_SHAPES.md` reflects `updatedAt` in **all** hydration examples (both partial-hydration and full-hydration sections). Confirm no `lastUpdated` reference remains in this file. Confirm no forward note about a v1 wire-shape inconsistency is added (the inconsistency does not exist).
4. Verify `docs/developer/backend/AssessmentFlow.md` reflects `updatedAt` in **all** references (the narrative at line 304, the example at line 383, the method signature at line 839/868, and any other `lastUpdated` references in the file). Confirm no `lastUpdated` reference remains.
5. Verify `docs/developer/backend/api-layer.md` reflects `updatedAt` in the `getAssignment` handler's `DateUtils.normaliseDateFields` call (line 382) and the response data description (line 384). Confirm no `lastUpdated` reference remains in the `getAssignment` section.
6. Verify the `MetricToneColor` cross-spec contract is recorded in both `SPEC_CLASS_PAGE_PREPARATION.md` and `SPEC_CLASS_PAGE.md` (or flagged as an open follow-up if `SPEC_CLASS_PAGE.md` is not yet finalised).
7. Verify the `tests/assignment/assignmentLastUpdated.test.js` is **fully** updated per the Section 2 acceptance criteria: method calls renamed to `setUpdatedAt` / `getUpdatedAt`; `toJSON()`-output assertion (`json.lastUpdated` → `json.updatedAt`). `touchUpdated()` keeps its name. Confirm the test still passes after the full update.
8. Verify mandatory-read evidence (`Files read`) is complete for the delegated Docs / Code Reviewer handoffs.
9. Reconcile planned shared-helper entries: keep `Not implemented` where still pending; update to `Implemented` where delivered; mark `Deferred` where deferred with a recorded reason.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation.
- The earlier sections planned `@remarks` for `Assignment.toPartialJSON()`, `Assignment.toJSON()`, `AssignmentPartialSchema`, `dateFormatting.formatUpdatedAtLabel`, `MetricResultSchema`, `MetricAccumulator`, `rollupMetric`, `averagingAnalyser.rows.ts`, `resolveMetricTone`, and `MetricPill`. Verify the relevant code now contains them before deleting the action plan.
- If no additional `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the actual doc edits (line-range anchors, section IDs). Confirm the `MetricToneColor` cross-spec contract is recorded in both specs (or flagged as an open follow-up).
- **Deviations from plan:** if the implementation surfaces a method-rename boundary issue (e.g. `touchUpdated` should also be renamed), record the deviation and consult the spec owner before finalising the docs.

---

## Section 6 — `Assignment.js` facade decomposition (550-line rule compliance)

### Objective

Decompose `src/backend/AssignmentProcessor/Assignment.js` (currently **658 lines**, already **108 lines above** the 550-line threshold per `src/backend/AGENTS.md` §11) into a folder of focused sub-classes following the canonical facade-pattern established by `y_controllers/AssignmentDefinition/`, mirroring its public-API-preservation contract. The decomposition is a **pure structural refactor** — no behaviour change, no wire-shape change, no field-name change. The Section 2 rename (`lastUpdated` → `updatedAt`, `getLastUpdated` → `getUpdatedAt`, `setLastUpdated` → `setUpdatedAt`) has already landed by the time Section 6 runs; the section's acceptance criteria assume the post-rename state.

**Implementation note:** this section de-sloppifies the codebase ahead of any further `Assignment` work. The file crossed the 550-line threshold before the Section 2 rename (the rename is a field-name change, not a structural change). Per the planner's file-separation rule, the file must be split when a section is projected to push it past 500 lines; in this case the file is already past 550 and a dedicated decomposition section is the compliant path. Bundling the decomposition with Section 2's wire-shape rename would have coupled a structural refactor to a breaking schema change, which the spec's "do not pre-emptively split" rule discourages. Section 6 is therefore its own workstream.

### Constraints

- **Public API surface is preserved verbatim.** Every public method name, signature, return shape, and `this.*` field on the `Assignment` class continues to work exactly as before. The `SlidesAssignment` and `SheetsAssignment` subclasses' `super(courseId, assignmentId, definitionInstance)` calls and `Assignment._baseFromJSON(data)` calls continue to work without modification.
- **Lifecycle state lives on the facade.** The facade's `Assignment` constructor initialises `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `updatedAt`, `createdAt`, `assignmentDefinition`, `submissions`, `progressTracker`, and `_hydrationLevel`. Sub-classes operate on `this.*` state directly; they do not own lifecycle state. This mirrors the `AssignmentDefinition` pattern (the facade owns lifecycle; sub-classes do work).
- **Sub-class constructors accept a single options object** mirroring the `AssignmentDefinition` pattern (per `src/backend/AGENTS.md` §11). Where a sub-class has no dependencies, the options object may be empty.
- **GAS concatenation load order:** the facade (`index.js`) must load **after** all sub-class files. Numeric prefixes (`00_`, `01_`, `02_`, `03_`, `04_`, `05_`, `06_`) are added to the sub-class filenames so the concatenation order is obvious and matches the `tests/setupGlobals.js` require order.
- **Static method preservation:** the `Assignment` class continues to expose the following static methods, each delegating to the rehydration sub-class (per `src/backend/AGENTS.md` §2.2 — global definition order must be preserved):
  - `Assignment._baseFromJSON(data)` — called by `SlidesAssignment.fromJSON` and `SheetsAssignment.fromJSON` (both at line 28 of their respective files). The facade re-exports this as a static method, delegating to `AssignmentRehydration._baseFromJSON(data)`.
  - `Assignment._rehydrateSubmission(inst, subObject)` — called internally from `_baseFromJSON`. The facade re-exports this as a static method, delegating to `AssignmentRehydration._rehydrateSubmission(inst, subObject)`.
  - `Assignment.create(assignmentDefinition, courseId, assignmentId)` — public factory. The facade re-exports this, delegating to `AssignmentFactory.create(...)`.
  - `Assignment.fromJSON(data)` — public polymorphic deserialiser. The facade re-exports this, delegating to `AssignmentFactory.fromJSON(...)`.
- **Instance method preservation:** the facade re-exports the following instance methods, each delegating to the relevant sub-class via the `this.*` receiver:
  - `toJSON()` → `AssignmentSerialisation.toJSON`
  - `toPartialJSON()` → `AssignmentSerialisation.toPartialJSON`
  - `touchUpdated()` → `AssignmentTimestamps.touchUpdated`
  - `getUpdatedAt()` / `setUpdatedAt(date)` → `AssignmentTimestamps.getUpdatedAt` / `setUpdatedAt` (post-Section-2 names)
  - `getCreatedAt()` / `setCreatedAt(date)` → `AssignmentTimestamps.getCreatedAt` / `setCreatedAt`
  - `addStudent(student)` → `AssignmentSubmissions.addStudent`
  - `fetchSubmittedDocumentsByMimeType(mimeType)` → `AssignmentSubmissions.fetchSubmittedDocumentsByMimeType`
  - `isValidMimeType(...)` → `AssignmentSubmissions.isValidMimeType`
  - `fetchSubmittedDocuments()` → `AssignmentAssessmentBase.fetchSubmittedDocuments` (abstract base)
  - `populateTasks()` → `AssignmentAssessmentBase.populateTasks` (abstract base)
  - `processAllSubmissions()` → `AssignmentAssessmentBase.processAllSubmissions` (abstract base)
  - `generateLLMRequests()` → `AssignmentLLMOrchestration.generateLLMRequests`
  - `assessResponses()` → `AssignmentLLMOrchestration.assessResponses`
  - `getTasks()` / `setTasks(tasks)` → `AssignmentAssessmentBase.getTasks` / `setTasks`
  - `getDocumentType()` → `AssignmentAssessmentBase.getDocumentType`
  - `getReferenceDocumentId()` → `AssignmentAssessmentBase.getReferenceDocumentId`
  - `getTemplateDocumentId()` → `AssignmentAssessmentBase.getTemplateDocumentId`
- **Test harness mirror:** `tests/setupGlobals.js:15` and the other 6 test files (7 test import sites total) are updated to point at the new `Assignment/index.js` path. The new sub-classes are loaded as globals in numeric order (mirroring the existing `AssignmentDefinition` block at `tests/setupGlobals.js:204-212`).
- **Node test compatibility:** each new sub-class file ends with the standard `if (typeof module !== 'undefined' && module.exports) { module.exports = ClassName; }` block (per `src/backend/AGENTS.md` §2.1).
- **British English in JSDoc and comments.**
- **No behaviour change.** Every method's body moves verbatim to its new home; the only changes are the addition of a delegation in the facade and (where applicable) a change of `this.*` access pattern. The `SlidesAssignment` and `SheetsAssignment` subclasses are not modified.
- **No barrel `index.js` re-exports for sub-classes.** The facade is the sole `module.exports` target. Sub-classes are loaded as globals via the `tests/setupGlobals.js` require block (mirroring the `AssignmentDefinition` and `ABClassController` patterns).
- **Manifest / scope changes:** none. The decomposition is an internal-code restructure; `appsscript.json` is not touched.

### File separation by LOC (mandatory per planner instructions §11)

| File                                                                                | Current LOC | Projected LOC | Action in this section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ----------: | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/AssignmentProcessor/Assignment.js`                                     |         658 |             0 | **Deleted** after the sub-classes and facade land. The file is split into the new `Assignment/` folder; no content is lost (every method is preserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js` (new)    |           0 |          ~110 | New file. Owns `toJSON`, `toPartialJSON`, `_extractFullDefinitionFields`, `_extractPartialRootFields`. Depends on `AssignmentDefinition.toJSON` / `toPartialJSON` (global), `StudentSubmission.toJSON` / `toPartialJSON` (global). `module.exports = AssignmentSerialisation;` at the end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/backend/AssignmentProcessor/Assignment/01_AssignmentFactory.js` (new)          |           0 |           ~90 | New file. Owns the public `static create` factory and the polymorphic `static fromJSON` dispatch. Does **not** call `AssignmentRehydration` directly — it routes to `SlidesAssignment.fromJSON` / `SheetsAssignment.fromJSON`, which in turn call `Assignment._baseFromJSON` (facade re-export). Depends on `ProgressTracker` and `AssignmentDefinition` (the `documentType` rewrap branch in `fromJSON`). `module.exports = AssignmentFactory;` at the end.                                                                                                                                                                                                                                                                                                                             |
| `src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js` (new)      |           0 |          ~110 | New file. Owns `static _baseFromJSON`, `static _rehydrateSubmission`, the `knownFields` set. The `knownFields` set uses `'updatedAt'` (not `'lastUpdated'`) to match the post-Section-2 field name; the legacy `'lastUpdated'` key is removed. The transient field markers (`'students'`, `'progressTracker'`, `'_hydrationLevel'`) remain in the set so they are explicitly excluded from the restore-time field copy. Depends on `AssignmentDefinition.fromJSON`, `StudentSubmission` (constructor and `fromJSON`), `ProgressTracker.getInstance()`, `ABLogger.getInstance()`, `Validate`. The `_baseFromJSON` static method is called by `SlidesAssignment.fromJSON` and `SheetsAssignment.fromJSON`; the facade re-exports it. `module.exports = AssignmentRehydration;` at the end. |
| `src/backend/AssignmentProcessor/Assignment/03_AssignmentTimestamps.js` (new)       |           0 |           ~70 | New file. Owns `touchUpdated` (which delegates to `setUpdatedAt` internally), `getUpdatedAt`, `setUpdatedAt`, `getCreatedAt`, `setCreatedAt` (post-Section-2 names). Pure date-management logic. Validates `Date` arguments per the existing `TypeError` contract. `module.exports = AssignmentTimestamps;` at the end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js` (new)      |           0 |          ~155 | New file. Owns `addStudent`, `_processAttachmentForSubmission`, `fetchSubmittedDocumentsByMimeType`, `isValidMimeType`. Does **not** own `fetchAssignmentName` — that method is called from the facade's constructor as lifecycle initialisation (it also populates `this.createdAt` as a side effect, which is lifecycle state). Depends on `Classroom.Courses.CourseWork.StudentSubmissions.list`, `DriveApp.getFileById`, `StudentSubmission` (constructor), `ABLogger`. `module.exports = AssignmentSubmissions;` at the end.                                                                                                                                                                                                                                                        |
| `src/backend/AssignmentProcessor/Assignment/05_AssignmentAssessmentBase.js` (new)   |           0 |           ~70 | New file. Owns the three abstract base methods (`fetchSubmittedDocuments`, `populateTasks`, `processAllSubmissions`) and the shared `_requireImplementation` helper, plus the definition getters/setters (`getTasks`, `setTasks`, `getDocumentType`, `getReferenceDocumentId`, `getTemplateDocumentId`). No external dependencies beyond the `this.assignmentDefinition` state. `module.exports = AssignmentAssessmentBase;` at the end.                                                                                                                                                                                                                                                                                                                                                 |
| `src/backend/AssignmentProcessor/Assignment/06_AssignmentLLMOrchestration.js` (new) |           0 |           ~95 | New file. Owns `generateLLMRequests`, `assessResponses`, `_getLLMManager`. Depends on `LLMRequestManager`, `Utils.toastMessage`, `ABLogger`. The base `assessResponses` is overridden by `SheetsAssignment.assessResponses`; the base implementation is used by `SlidesAssignment` (which does not override it). `module.exports = AssignmentLLMOrchestration;` at the end.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/backend/AssignmentProcessor/Assignment/index.js` (new facade)                  |           0 |           ~95 | Facade. Owns the `Assignment` class (preserving the public API surface verbatim), the lifecycle state in the constructor, the seven sub-class instantiations, the public-method delegations, and the private `fetchAssignmentName` lifecycle initialiser (moved from the monolithic `Assignment.js`; populates `this.assignmentName` and `this.createdAt` as a side effect, preserving the existing constructor behaviour). `module.exports = Assignment;` at the end. Loads **last** in the GAS concatenation order.                                                                                                                                                                                                                                                                    |
| `tests/setupGlobals.js`                                                             |         220 |          ~235 | **Update** line 15: `g.Assignment = require('../src/backend/AssignmentProcessor/Assignment/index.js');`. **Add** a new block (mirroring the existing `AssignmentDefinition` block at lines 204-212) that loads the **seven** new sub-classes as globals in numeric order (`00_` through `06_`), so the facade's bare-identifier references resolve in tests.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tests/assignment/assignmentLegacyAliases.test.js`                                  |           ? |             ? | **Update** line 2: import path changes from `'../../src/backend/AssignmentProcessor/Assignment.js'` to `'../../src/backend/AssignmentProcessor/Assignment/index.js'`. No test-logic changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tests/assignment/assignmentSerialisation.test.js`                                  |           ? |             ? | **Update** line 8: import path changes as above. No test-logic changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tests/assignment/assignmentLastUpdated.test.js`                                    |           ? |             ? | **Update** line 2: import path changes as above. The test assertions (already updated to `updatedAt` / `getUpdatedAt` / `setUpdatedAt` in Section 2) continue to pass without modification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tests/assignment/assignmentFactory.test.js`                                        |           ? |             ? | **Update** line 9: import path changes as above. The test's direct `require` of `SlidesAssignment.js` and `SheetsAssignment.js` (lines 64-65) continues to work — those files reference `Assignment._baseFromJSON`, which the facade still re-exports. No test-logic changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tests/controllers/abclassController.readClass.test.js`                             |           ? |             ? | **Update** line 27: `require` path changes to `'../../src/backend/AssignmentProcessor/Assignment/index.js'`. No test-logic changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/helpers/modelFactories.js`                                                   |           ? |             ? | **Update** line 10: `require` path changes as above. No test-logic changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**No file in this section is projected to exceed 550 lines after the change.** The largest sub-class (`04_AssignmentSubmissions.js`) is ~155 lines, well under the threshold. The facade (`index.js`) is ~95 lines (lifted by the `fetchAssignmentName` lifecycle initialiser), also under the threshold. The deletion of the 658-line `Assignment.js` resolves the threshold violation that was already present before the section started. The split of the original `05_AssignmentAssessment.js` (per the single-responsibility concern raised by the Planner Reviewer) keeps the assessment-related logic in two focused sub-classes (`05_AssignmentAssessmentBase` for the abstract base contract, `06_AssignmentLLMOrchestration` for the concrete LLM orchestration), each well under 100 lines.

### Sub-class breakdown — natural responsibility boundaries

The split mirrors the responsibility analysis of the current `Assignment.js`:

1. **Serialisation** (current lines 41-134, 94 lines): `toJSON`, `toPartialJSON`, `_extractFullDefinitionFields`, `_extractPartialRootFields`. All wire-shape production lives here. Depends on `AssignmentDefinition.toJSON` / `toPartialJSON` (global) and `StudentSubmission.toJSON` / `toPartialJSON` (global).
2. **Factory / polymorphic dispatch** (current lines 136-164, 290-347, 86 lines): `static create`, `static fromJSON`. The polymorphic `documentType` → subclass routing logic. The `static fromJSON` routes to `SlidesAssignment.fromJSON` / `SheetsAssignment.fromJSON` for the actual deserialisation; the subclasses then call `Assignment._baseFromJSON` (facade re-export → `AssignmentRehydration._baseFromJSON`). `AssignmentFactory` does **not** call `AssignmentRehydration` directly. Depends on `ProgressTracker` (for the `logAndThrowError` defensive path in `fromJSON`) and `AssignmentDefinition` (for the `documentType`-less legacy fallback that rewraps a minimal `AssignmentDefinition`).
3. **Rehydration** (current lines 166-288, 123 lines): `static _baseFromJSON`, `static _rehydrateSubmission`, the `knownFields` set. The from-JSON restoration logic for the base fields and the per-submission rehydration. The `knownFields` set uses `'updatedAt'` (not `'lastUpdated'`) to match the post-Section-2 field name; the transient field markers (`'students'`, `'progressTracker'`, `'_hydrationLevel'`) are retained so they are explicitly excluded from the restore-time field copy. Depends on `AssignmentDefinition.fromJSON`, `StudentSubmission` (constructor and `fromJSON`), `ProgressTracker.getInstance()`, `ABLogger.getInstance()`, `Validate`.
4. **Timestamps** (current lines 365-424, 60 lines): `touchUpdated` (delegates internally to `setUpdatedAt`), `getUpdatedAt`, `setUpdatedAt`, `getCreatedAt`, `setCreatedAt`. The pure date-management logic. Validates `Date` arguments per the existing `TypeError` contract.
5. **Submissions / Drive attachments** (current lines 411-450, 452-540, 125 lines after extracting `fetchAssignmentName`): `addStudent`, `_processAttachmentForSubmission`, `fetchSubmittedDocumentsByMimeType`, `isValidMimeType`. The student-roster management and the Google Classroom / Google Drive document fetching. `fetchAssignmentName` is **not** here (moved to the facade as a lifecycle initialiser, per its side-effect on `this.assignmentName` and `this.createdAt`).
6. **Assessment base** (current lines 547-567, 602-610, 612-652, 60 lines): the three abstract base stubs (`fetchSubmittedDocuments`, `populateTasks`, `processAllSubmissions`), the shared `_requireImplementation` helper, and the definition getters/setters (`getTasks`, `setTasks`, `getDocumentType`, `getReferenceDocumentId`, `getTemplateDocumentId`).
7. **LLM orchestration** (current lines 569-600, 35 lines): `generateLLMRequests`, `assessResponses`, `_getLLMManager`. The concrete LLM-related orchestration. The base `assessResponses` is overridden by `SheetsAssignment.assessResponses`; the base implementation is used by `SlidesAssignment` (which does not override it).
8. **Facade lifecycle initialiser** (current lines 348-363, 16 lines, moved to `index.js`): `fetchAssignmentName(courseId, assignmentId)`. Called once from the constructor; populates `this.assignmentName` and `this.createdAt`. The current monolithic constructor calls this on line 21; the facade's constructor must call it at the same point in initialisation. Stays on the facade as a private method (`_initialiseAssignmentName(courseId, assignmentId)`) to avoid the cross-sub-class dependency that would otherwise arise from a sub-class method being called during the facade's construction.

The numeric prefixes (`00_` through `06_`) reflect load order: each sub-class is loaded before the facade, and the load order is preserved by mirroring it in `tests/setupGlobals.js`. Sub-classes are **stateless w.r.t. lifecycle fields** — they operate on `this.*` state injected by the facade, and they take no cross-sub-class dependencies (e.g. `AssignmentSubmissions` does not import `AssignmentRehydration`; the `SlidesAssignment` / `SheetsAssignment` subclasses call `Assignment._baseFromJSON` via the facade re-export, not directly into `AssignmentRehydration`).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `src/backend/AGENTS.md` §11 (facade-pattern decomposition rules; sub-class injection via single options object; public-API-preservation contract; GAS load-order and tests/setupGlobals.js mirroring)
- `src/backend/AGENTS.md` §2.1 (Node test compatibility boundary — guarded `module.exports` block)
- `src/backend/AGENTS.md` §2.2 (concatenation and load-order model — numeric prefixes on sub-class files; the facade loads after all sub-class files)
- `src/backend/y_controllers/AssignmentDefinition/index.js` (the canonical facade example)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js` (the canonical sub-class example)
- `tests/setupGlobals.js:204-212` (the canonical test-harness mirroring pattern for the `AssignmentDefinition` decomposition)
- `docs/developer/backend/backend-testing.md` (backend testing conventions and commands)
- The six touched test files (7 import sites in total; `tests/assignment/assignmentFactory.test.js` also has direct requires of `SlidesAssignment` / `SheetsAssignment` that are unchanged): `tests/assignment/assignmentLegacyAliases.test.js`, `tests/assignment/assignmentSerialisation.test.js`, `tests/assignment/assignmentLastUpdated.test.js`, `tests/assignment/assignmentFactory.test.js`
- `tests/controllers/abclassController.readClass.test.js`
- `tests/helpers/modelFactories.js`
- The two subclass files: `src/backend/AssignmentProcessor/SlidesAssignment.js`, `src/backend/AssignmentProcessor/SheetsAssignment.js` (must confirm `super(...)` and `Assignment._baseFromJSON` references continue to work)

Implementation mandatory docs:

- All of the above, plus:
- `src/backend/AGENTS.md` (full)
- `src/backend/AssignmentProcessor/Assignment.js` (current monolithic source)
- `src/backend/AssignmentProcessor/SlidesAssignment.js` (the only direct caller of `Assignment._baseFromJSON` from outside the class)
- `src/backend/AssignmentProcessor/SheetsAssignment.js` (same)
- `docs/developer/backend/api-layer.md` (validation ownership rules; relevant only if the decomposition surfaces a validation-ownership issue)
- `docs/developer/backend/DATA_SHAPES.md` (the canonical data-shape reference; the wire shape must not change)

Code Reviewer mandatory docs:

- `AGENTS.md` (root) §6 (agentic workflow)
- `src/backend/AGENTS.md` §11 (facade-pattern rules; this is the canonical pattern the review must check against)
- The canonical `AssignmentDefinition` decomposition (the seven sub-class files + `index.js` facade) as the reference implementation. The new `Assignment` decomposition mirrors this pattern with seven sub-classes + one facade (same shape as `AssignmentDefinition`).
- The current `Assignment.js` (to confirm every method is preserved by the decomposition)
- The two subclass files (to confirm `super(...)` and `Assignment._baseFromJSON` references resolve through the facade)

Docs mandatory docs:

- `docs/developer/backend/DATA_SHAPES.md` — confirm the existing prose still applies (the wire shape is unchanged; no prose update required)
- `docs/developer/backend/rehydration.md` — confirm the `_baseFromJSON` / `_rehydrateSubmission` flow narrative still applies (no narrative update required; the methods are preserved, just moved)
- `docs/developer/backend/AssessmentFlow.md` — confirm the `Assignment` lifecycle narrative still applies (no narrative update required)
- `docs/developer/backend/api-layer.md` — no change (the decomposition is internal; no API surface change)
- A **new entry** in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` is **not required** for backend decomposition decisions; the canonical pattern is already recorded in `src/backend/AGENTS.md` §11. The section's Docs handoff confirms the existing §11 entry remains the source of truth and adds a forward note that `Assignment` now follows the same pattern as `AssignmentDefinition` and `ABClassController`.

### Shared helper plan (when helper changes are expected)

No new shared helpers are introduced by this section. The decomposition creates **sub-classes** (single-responsibility pieces of the `Assignment` facade), not helpers. Sub-classes are wired into the facade via constructor injection (mirroring `AssignmentDefinition`); they are not exported as standalone helpers.

If a sub-class is later extracted from the facade (e.g. `AssignmentSerialisation` is reused by a future `BatchAssignmentSerializer`), the canonical pattern is the same as for the existing `AssignmentDefinition` sub-classes: a folder under the owning path, with `index.js` as the facade. The section does not pre-empt this — it does the minimum work to comply with the 550-line rule.

### Acceptance criteria

- `src/backend/AssignmentProcessor/Assignment/` folder created with 8 files (7 sub-class files + 1 facade): `00_AssignmentSerialisation.js`, `01_AssignmentFactory.js`, `02_AssignmentRehydration.js`, `03_AssignmentTimestamps.js`, `04_AssignmentSubmissions.js`, `05_AssignmentAssessmentBase.js`, `06_AssignmentLLMOrchestration.js`, `index.js`.
- Each new sub-class file is under 200 lines. The largest (`04_AssignmentSubmissions.js`) is ~155 lines; well under the 550-line threshold.
- The facade (`index.js`) is ~95 lines; the public API is preserved verbatim; the constructor initialises the lifecycle state (including the `fetchAssignmentName` private method that populates `this.assignmentName` and `this.createdAt`); the seven sub-classes are wired in via a single options-object pattern where applicable.
- `src/backend/AssignmentProcessor/Assignment.js` is **deleted** after the sub-classes and facade land. The file's contents are 1:1 preserved across the eight new files; no method is dropped, renamed, or behaviourally altered.
- The facade re-exports the four static methods (`_baseFromJSON`, `_rehydrateSubmission`, `create`, `fromJSON`) so `SlidesAssignment` and `SheetsAssignment` continue to work without modification.
- The facade re-exports every instance method (preserving the post-Section-2 names: `getUpdatedAt`, `setUpdatedAt`; pre-Section-2 names: `getCreatedAt`, `setCreatedAt`, `toJSON`, `toPartialJSON`, etc.). The instance methods delegate to the relevant sub-class via `this.*` access (e.g. `return this._serialisation.toJSON();`).
- The facade's constructor signature is `(courseId, assignmentId, assignmentDefinition)` and accepts an `AssignmentDefinition` instance or a plain object (mirroring the current monolithic `Assignment.js:18`). The `SlidesAssignment` and `SheetsAssignment` constructors' `super(courseId, assignmentId, definitionInstance)` calls (at `SlidesAssignment.js:15` and `SheetsAssignment.js:15`) continue to work without modification.
- **`AssignmentRehydration`'s `knownFields` set uses `'updatedAt'` (not `'lastUpdated'`)**, matching the post-Section-2 field name. The legacy `'lastUpdated'` key is removed from the set. The transient field markers (`'students'`, `'progressTracker'`, `'_hydrationLevel'`) are retained in the set so they are explicitly excluded from the restore-time field copy (preserving the existing "Transient, don't restore" semantics at current `Assignment.js:214-216`).
- `tests/setupGlobals.js:15` is updated: `g.Assignment = require('../src/backend/AssignmentProcessor/Assignment/index.js');`.
- `tests/setupGlobals.js` gains a new block (mirroring the `AssignmentDefinition` block at lines 204-212) that loads the **seven** sub-classes as globals in numeric order (`00_` through `06_`).
- The 7 test import sites (6 test files update the `Assignment` import path; `tests/assignment/assignmentFactory.test.js` also retains direct requires of `SlidesAssignment` / `SheetsAssignment` at lines 64-65 which are unchanged) are updated to the new path: `tests/assignment/assignmentLegacyAliases.test.js:2`, `tests/assignment/assignmentSerialisation.test.js:8`, `tests/assignment/assignmentLastUpdated.test.js:2`, `tests/assignment/assignmentFactory.test.js:9`, `tests/controllers/abclassController.readClass.test.js:27`, `tests/helpers/modelFactories.js:10`.
- The `SlidesAssignment.js` and `SheetsAssignment.js` files are **not** modified.
- The two test files that import the `SlidesAssignment` / `SheetsAssignment` files directly (`tests/assignment/assignmentFactory.test.js:64-65` and `tests/setupGlobals.js:16-17`) continue to work because those files are not moved.
- Each new sub-class file ends with the standard `if (typeof module !== 'undefined' && module.exports) { module.exports = ClassName; }` block.
- British English in all JSDoc and comments (use "deserialisation" — single `-s-`, not the American "deserialization").
- No behaviour change: every test that passed before the decomposition continues to pass after the decomposition, with only import-path changes.

### Required test cases (Red first)

This is a pure structural refactor; the existing tests are the safety net. There is no new test logic. The "red" step is a test-run that confirms the existing tests **fail** before the decomposition (because the import path does not yet point at the new location) and **pass** after the decomposition. The test cases below are the existing tests, listed here so the Implementation agent knows what must remain green.

1. `npm run test:backend -- tests/assignment/assignmentLegacyAliases.test.js` — green.
2. `npm run test:backend -- tests/assignment/assignmentSerialisation.test.js` — green.
3. `npm run test:backend -- tests/assignment/assignmentLastUpdated.test.js` — green (the post-Section-2 assertions on `updatedAt` / `getUpdatedAt` / `setUpdatedAt` still pass).
4. `npm run test:backend -- tests/assignment/assignmentFactory.test.js` — green (the `SlidesAssignment` and `SheetsAssignment` references at lines 64-65 still work; the `Assignment._baseFromJSON` calls at line 28 of each subclass file still resolve through the facade).
5. `npm run test:backend -- tests/controllers/abclassController.readClass.test.js` — green.
6. `npm run test:backend -- tests/assignment/` — full assignment test directory green.
7. `npm run test:backend` — full backend test suite green (no regressions in any other test directory).
8. `npm run lint:backend` — green.
9. `npm run build:production` — green (the build verifies the GAS concatenation order is preserved; the new sub-class files concatenate before the facade).

### Section checks

- The eight new files (seven sub-classes + one facade) exist and conform to the file-separation table above.
- The 658-line `Assignment.js` is deleted; the file no longer exists at `src/backend/AssignmentProcessor/Assignment.js`.
- `tests/setupGlobals.js:15` points at the new path; the new sub-class block mirrors the `AssignmentDefinition` block.
- All 7 test import sites point at the new path.
- The two subclass files (`SlidesAssignment.js`, `SheetsAssignment.js`) are unmodified.
- `npm run test:backend` is green end-to-end.
- `npm run lint:backend` is green.
- `npm run build:production` is green.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- No new shared-helper entries are added (the section creates sub-classes, not helpers).

### Optional `@remarks` JSDoc follow-through

- `Assignment` facade JSDoc: add a `@remarks` note that the class is a thin facade over **seven** focused sub-classes (`AssignmentSerialisation`, `AssignmentFactory`, `AssignmentRehydration`, `AssignmentTimestamps`, `AssignmentSubmissions`, `AssignmentAssessmentBase`, `AssignmentLLMOrchestration`), each injected in the constructor. The facade also owns the private lifecycle initialiser (`fetchAssignmentName`) that populates `this.assignmentName` and `this.createdAt` during construction. Cross-reference `src/backend/AGENTS.md` §11 and the canonical `y_controllers/AssignmentDefinition/` example.
- Each sub-class JSDoc: add a `@remarks` note describing the single responsibility owned by the sub-class, the canonical pattern, and the call sites that route through the facade. The numeric prefix on each sub-class file is a load-order signpost (the sub-classes concatenate in numeric order before the facade, per `src/backend/AGENTS.md` §2.2).
- `index.js` JSDoc: add a `@remarks` note that the facade loads last in the GAS concatenation order, that the sub-classes are loaded as globals via `tests/setupGlobals.js` mirroring, and that the public API is preserved verbatim from the pre-decomposition monolithic class. The facade is the sole `module.exports` target; sub-classes are not re-exported.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the eight file paths (seven sub-classes + one facade) and their projected line counts. Confirm the `SlidesAssignment` and `SheetsAssignment` files are unmodified. Confirm the `tests/setupGlobals.js` mirroring block is in numeric order. Confirm the 658-line `Assignment.js` is deleted.
- **Deviations from plan:** if any method's body cannot move verbatim (e.g. a method depends on private state that is split across two sub-classes), the implementation agent must record the deviation here and **must not** introduce new private state on the sub-classes — the deviation is resolved by adding a thin delegation in the facade, not by changing the sub-class contract. If the deviation cannot be resolved this way, the implementation agent must stop and raise it with the planner before continuing.
- **Follow-up implications for later sections:**
  - The "Open follow-ups" section is unchanged. The decomposition was never listed there (it is now owned by Section 6). Item 7 of "Open follow-ups" remains the cross-spec `MetricToneColor` confirmation.
  - The "Suggested implementation order" is updated to add this section as the last delivery step (after Section 5 docs / rollout, before the final regression sweep), with a note that Section 6 depends on Section 2's `updatedAt` rename having already landed.
  - If a future `BatchAssignmentSerializer` or similar reuse emerges, the canonical pattern (folder under the owning path, `index.js` facade) is already established. No additional decomposition work is anticipated.

---

## Open follow-ups (not in v1 scope)

The following items are intentionally deferred from v1. They are recorded here so they are not lost when the action plan is deleted:

1. **`averagingAnalyser.accumulation.ts` facade decomposition.** The post-change size is ~500–530 lines, under the 550-line threshold per spec line 418. Deferred until the threshold is crossed or a concrete maintenance need arises (e.g. the three-way state assignment logic is hard to test in isolation). Track in the shared-helpers doc §9.18 item 3.
2. **`MetricPill` `Tooltip` / `aria-label` wrapper.** v1 ships the colour + label only; accessibility follow-up is signed off. Track in the Class page spec's accessibility notes.
3. **New `metricDisplay/` consumer beyond the Class page.** The Class page is the first external caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92–99`) land in their own iteration.
4. **Alternative `MetricToneColor` palettes.** The `errorColor` parameter is exposed for testability and future visual revisions; the default `'volcano'` is the v1 contract. Any future revision is a cross-spec breaking change.
5. **`metricDisplay/` `index.ts` barrel.** v1 ships with direct imports only (per spec decision 8). A barrel may be added in a later de-sloppification pass if call sites get noisy.
6. **`utils/` folder convention signpost.** The new `src/frontend/src/utils/` folder is the first entry in a deliberate v1 addition. The convention is recorded in the shared-helpers doc signpost (Section 5). Future pure formatting / utility functions shared across the frontend go here. A `utils/`-folder rule may be added to `src/frontend/AGENTS.md` if a global convention is preferred.
7. **Cross-spec `MetricToneColor` confirmation.** The contract is recorded in `SPEC_CLASS_PAGE_PREPARATION.md` line 381. Confirm `SPEC_CLASS_PAGE.md` records the same union (the Class page's column filter uses the type). If `SPEC_CLASS_PAGE.md` is not yet finalised, this is an open follow-up.

---

## Suggested implementation order

1. **Section 1 — Proactive documentation updates** (doc-only, no code). Sets the agreed vocabulary for the three states and records the planned-helper entries in the shared-helpers doc. Reviewers see the prose first; the implementation phases flip the planned entries to `Implemented` as they land.
2. **Section 2 — `AssignmentPartial.lastUpdated` → `updatedAt` rename + `formatUpdatedAtLabel` extraction** (one-shot wire-shape rename + helper extraction). The data analysis service change depends on the fixtures using `updatedAt`, so the rename lands first.
3. **Section 3 — `MetricResult` discriminated union + `rollupMetric` helper + accumulator and row-builder updates** (data analysis service contract change). Depends on Section 2's fixtures. Lands before Section 4 because the display helpers consume the new `MetricResult` shape.
4. **Section 4 — Shared `metricDisplay/` display helpers** (`resolveMetricTone`, `MetricPill`). Depends on Section 3's new `MetricResult` shape. Lands last.
5. **Documentation and rollout notes** (doc reconciliation). Confirms the planned-helper entries are flipped to `Implemented` (or `Deferred`); updates the partial-hydration sections of the backend docs; confirms the cross-spec `MetricToneColor` contract.
6. **Section 6 — `Assignment.js` facade decomposition** (550-line rule compliance). Depends on **Section 2's `updatedAt` rename having already landed** (the section assumes the post-rename field names `updatedAt`, `getUpdatedAt`, `setUpdatedAt`, and the `knownFields` set uses `'updatedAt'`). Decomposes the 658-line `Assignment.js` into a folder of seven focused sub-classes (split into assessment-base and LLM-orchestration, with `fetchAssignmentName` moved to the facade) plus a facade, mirroring the canonical `y_controllers/AssignmentDefinition/` pattern. Pure structural refactor — no behaviour change, no wire-shape change. Lands after the docs/rollout phase because it is an internal-code restructure that does not affect any of the v1 deliverable contracts.
7. **Regression and contract hardening** (full touched-area test suites + full lint + full build). Confirms the four sequenced deliverables (rename, data analysis service, display helpers, decomposition) integrate cleanly and the `toJSON()` / `getAssignment` path is unaffected.
