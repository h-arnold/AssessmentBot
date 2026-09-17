# Feature Delivery Plan (TDD-First) — Stale Assignment-Definition Recovery (issue #301)

## Read-First Context

Before writing or executing this plan:

1. Read the current `@SPEC.md`.
2. Read `@STALE_RECOVERY_LAYOUT.md` (layout specification).
3. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
4. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec or layout docs.

## Scope and assumptions

### Scope

- Backend: task-equivalence comparator, weighting reconciliation on reparse, `forceReparse`/`expectedDefinitionUpdatedAt` upsert parameters, `DEFINITION_PARSE_FAILED` error contract, timestamp-driven regression coverage.
- Synthetic test data: extension of the fixture generator with a named full editable-definition transport view so walkthroughs, E2E, and unit tests share canonical fixtures.
- Frontend transport contracts: `UpsertAssignmentDefinitionRequestSchema` extension (`forceReparse`, `expectedDefinitionUpdatedAt`, mutual-exclusion `superRefine`) and `DEFINITION_PARSE_FAILED` in the shared frontend error registry.
- Frontend wizard: decomposition of `useAssignmentDefinitionWizard.ts` (1,378 lines) into form-state and orchestrator modules; shell-boundary refactor (chrome-free review-content component); wizard entry-contract extension with recovery entry intent.
- Frontend assessment: decomposition of `AssessTaskModal.tsx` (955 lines) into an assessment orchestration module; in-modal convert of the genuine create path (SPEC decision 9); stale-recovery UX per the layout spec (stale prompt, reparsing, in-modal review, parse failure retry, approval outcomes).
- Frontend Assignments-page wizard: explicit **Reparse documents** action for unchanged URLs.
- Playwright verification: incremental exploratory MCP walkthrough checkpoints after each modal-surface section, plus the consolidated walkthrough and E2E hardening.
- Documentation: planned canonical entries reconciled; data-shape docs updated as contracts land.

### Out of scope

- Automatic reparse on modal open or background refetch.
- Any change to create-flow business behaviour (choice → parse → review → auto-assessment journey, contracts and outcomes) — the create path converts presentation-only (SPEC decision 9).
- Any change to `findMatchingDefinition` matching rules or the existing Drive timestamp checks in `AssignmentController.startAssessmentRun`.
- Mid-review document-change detection (frontend cannot detect it; staleness is knowable only at save time).
- Production consumption of synthetic fixtures (test-only infrastructure, unchanged policy).

### Assumptions

1. `DEFINITION_STALE` from `startAssessmentRun` is the sole recovery trigger; the captured start context (definition key, assignment id, course id) is available to the owning modal.
2. The upsert remains the only write boundary; recovery reparse reuses `upsertAssignmentDefinition` with the new `forceReparse` parameter.
3. Weighting reconciliation is backend-owned; the frontend never matches old task IDs to overwrite returned weightings.
4. Existing tests that assert `transitionToStaleRecovery` routes into `noMatchResolution === 'creating'` are wrong per `SPEC.md` and are rewritten in Section 6, not preserved.
5. SPEC decision 9 is settled: the create path converts to in-modal rendering before recovery UI (Section 8), so recovery builds on a proven in-modal composition.
6. The synthetic generator extension is a firm planned deliverable (Section 2), not an optional assessment.

## Global constraints and quality gates

### Delivery status and baseline evidence (17 September 2026)

- **Current phase:** baseline gate passed with accepted debt; prerequisite tooling repair reviewed clean, awaiting commit/push. Section 1 red phase has not started.
- **User authorisation:** existing line-count warnings are accepted technical debt (10 backend and 48 frontend `max-lines` warnings). This does not permit new warnings or waive the section-specific LOC gates.
- **Commit/push authorisation:** the user explicitly authorised committing and pushing each completed section, superseding the no-commit scope statement in `SPEC.md` for delivery operations.
- **Baseline:** `.ts-regression-checker/reports/session-fix-301-stale-assignment-definitions/baseline/baseline.txt`; backend/frontend/builder tests, Playwright E2E and builder compilation passed. Backend lint reported the accepted 10 warnings. Direct frontend lint reported 0 errors and the accepted 48 warnings.
- **Frontend checker investigation:** the diagnostic sub-agent identified broken argument forwarding through the root `lint:frontend:check` npm wrapper. The saved `checks/frontend-lint-check/raw.json` shows npm consuming `--format` / `--output-file`, followed by ESLint exit 2: `No files matching the pattern "json" were found.` This is a tooling failure, not a source lint error. The failed baseline lacks a frontend derived summary and is not a valid comparison floor for frontend lint.
- **Repair verified:** user-approved trailing `--` added only to `lint:frontend:check` in `package.json`. Exact checker invocation reproduced exit 2 before the fix, then exit 0 with valid JSON, 0 errors and 48 accepted warnings. Independent Code Reviewer returned clean; report `.opencode/scratchpad/review-301-lint-fix.md`.
- **Valid comparison baseline:** fresh session `fix-301-stale-assignment-definitions-verified`, created at `2026-09-17T20:23:12.483Z`; report `.ts-regression-checker/reports/session-fix-301-stale-assignment-definitions-verified/baseline/baseline.txt`. Seven checks pass; backend lint alone fails on the 10 accepted warnings (0 errors). Zero regressions and zero new failures. Use `npm run regression-checker -- fix-301-stale-assignment-definitions-verified` for all subsequent gates. Original crash baseline and comparison evidence remain untouched; its 48 reported frontend regressions were the already accepted warnings becoming observable after the wrapper fix, not source changes.
- **Agent configuration:** user explicitly authorised committing the existing `.opencode/agents/playwright.md` model-only change unchanged. No agent-config edits were made by this delivery.
- **Prerequisite delivery:** commit SHA and push confirmation will be recorded after successful commit/push on `fix/301-stale-assignment-definitions`.

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures; never swallow errors.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.

### File separation by LOC (mandatory)

- `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts` (current 1,378 lines): **Sections 5 and 7** split it into a form-state module (Section 5) and a wizard orchestrator module (Section 7). The final hook file must land **below 500 lines**; that gate is asserted at the end of **Section 7** (the bulk extraction). Each extracted module must land below 500 lines; if the orchestrator still projects above 500 after extraction, split mutation/error mapping into a third feature-local module.
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (current 955 lines): Section 6 extracts the assessment orchestration module (matching, linking, captured context, stale-recovery transitions); Section 8 removes the stacked wizard instance and renders the create path in-modal. The component must land **below 500 lines** after Section 8 at the latest; move body-render helper functions out with the orchestration module if needed.
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js` (current 432 lines): Sections 1 and 3 add the comparator, `forceReparse`, and staleness handling. Projection exceeds 500 lines — extract the task-equivalence comparator into a new `AssignmentDefinitionTaskEquivalence.js` (backend 550-line facade rule also provides headroom, but the frontend 500-line planning gate is applied here as the stricter rule).
- `src/backend/y_controllers/AssignmentController.js` (current 428 lines): **no parameter change** — `startAssessmentRun` keeps `{definitionKey, assignmentId, courseId}`; it is monitored only. The `expectedDefinitionUpdatedAt` comparison lives in the upsert orchestrator (Section 3).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Playwright exploratory walkthrough gates (incremental, then consolidated)

Because this refactor materially changes the `AssessTaskModal` / wizard modal composition across Sections 6–10:

- **Mock mechanism (mandatory, defined once):** walkthroughs of recovery/parse-failure states require the backend to return `DEFINITION_STALE` / `DEFINITION_PARSE_FAILED` envelopes. A bare unmocked page cannot reach these states. **Primary executable path:** in the MCP walkthrough session itself, install mock scenarios **before navigation** using Playwright's code-escape tool (`browser_run_code_unsafe`) to call `page.addInitScript` with the `installRuntimeMock` mechanism (which inlines `googleScriptRunApiHandlerFactorySource` from `src/test/googleScriptRunHarness.ts`, per `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`), then walk the mocked UI with `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_wait_for`, and `browser_take_screenshot`. **Alternative executable path** (when the MCP init-script route proves impractical for a given journey): use the e2e doc's "Previewing Mocked Pages Locally" pattern — run an existing mocked spec in `--ui`/headed mode and walk the mocked UI. In either path, follow the e2e doc's StrictMode rule when hand-building scenario mock implementations: two queue entries per expected API call. An unmocked walkthrough never reaches the recovery states and does not satisfy a walkthrough gate.
- **Fixture source (mandatory):** mocked scenario content (parsed definitions, task rows, weightings, partial lists) is seeded from the canonical committed transport views — the canonical `small` profile **plus the Section 2 `transport.editableDefinitions` extension** — never ad-hoc invented realistic blobs. Error-code scenarios themselves are mock behaviour, not fixtures.
- **Incremental checkpoints:** after each modal-surface section lands, the implementing handoff includes a **brief MCP walkthrough checkpoint** walking the just-delivered surface before the section is signed off (see the per-section "Scripted MCP walkthrough check" items in Sections 8, 9, and 10). A checkpoint is proportional: walk the newly changed journey, record observations in the section's implementation notes, and fix any contradiction against `@STALE_RECOVERY_LAYOUT.md` immediately — bugs are caught per stage, before they compound through later sections.
- **Consolidated gate (Section 11):** before E2E specs are finalised, the `Playwright` agent performs the full manual walkthrough of all minimum journeys using its MCP browser tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_wait_for`, `browser_take_screenshot`) — not headless spec runs — and shapes the E2E journeys from those observations.
- When execution of any walkthrough reveals behaviour contradicting the layout spec, the finding is recorded and fixed before that section (or the E2E specs) is signed off — never silently absorbed into a spec.
- Walkthrough evidence (journeys walked, observations, fixes) is recorded in each section's implementation notes and consolidated in Section 11 as part of the `Files read`-style evidence gate.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

For each delegated phase, the orchestrator lists required documentation as `@`-prefixed worktree-relative paths in the delegation prompt, requires `Files read` evidence, verifies every mandatory file is listed, and returns incomplete handoffs.

Baseline mandatory reads for every delegated handoff in this plan:

- `@AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@ACTION_PLAN.md`

Per-component additions are listed in each section.

### Shared-helper planning gate

Planned helper/modal entries are already recorded as `Not implemented` in:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.23 (wizard orchestrator module; assessment orchestration module; wizard entry-contract extension).
- `docs/developer/frontend/frontend-modal-patterns.md` §3.4 (chrome-free review-content component; second consumer).

Implementing sections move these entries to implemented status as they land; the documentation section verifies reconciliation.

### Data-shape planning gate

Planned contract entries are already recorded as `Not implemented` in:

- `docs/developer/data-shapes/assignment-definition.md` (`forceReparse`, `expectedDefinitionUpdatedAt`, `DEFINITION_STALE`, `DEFINITION_PARSE_FAILED`).
- `docs/developer/data-shapes/transport-envelope.md` (error-code envelope treatment).

Sections 3 and 4 update the relevant entries to remove `Not implemented` as each contract lands (backend envelopes in Section 3, frontend request schema and error registry in Section 4); the documentation section verifies reconciliation.

### Canonical-fixture policy

Per `docs/developer/testing/synthetic-test-data.md`, canonical policy for realistic data; invalid/boundary fixtures stay local.

- Realistic frontend scenarios use the canonical **`small`** profile's committed transport views (`classPartials`, `assignmentDefinitionPartials`, **`editableDefinitions`** after Section 2) — the latter is the decided generator extension delivering full `AssignmentDefinitionSchema` mock fixtures for walkthroughs, E2E, and relevant unit tests.
- **Backend comparator equivalence tests remain local boundary fixtures** (recorded deviation, per SPEC.md: the in-memory persistence view is test-only and equivalence edge cases are boundary tests).
- **No competing realistic corpus:** no hand-built realistic blobs; the generator is the single source of realistic full-definition fixtures (Section 2).
- Existing tests touched by this feature are migrated opportunistically only where the implementing sections already rewrite them.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Synthetic fixtures/CLI: `npm run fixtures:synthetic`, `npm run test:synthetic`, `npm run lint:synthetic:check`
- E2E: `npm run test:frontend:e2e -- <target>` (Section 11)

---

## Section 1 — Backend: task-equivalence comparator and weighting reconciliation

### Objective

- Backend-owned decision of which tasks are "unchanged" across a reparse, preserving stored weightings for equivalent tasks and default 1 for new/changed tasks, preserving assignment weighting and valid zero weightings.

### Constraints

- Equivalence rule per `SPEC.md` §Task equivalence: same task identity and equivalent parsed content (title, notes, task metadata, ordered reference/template artefact collections); compare object keys independent of insertion order; preserve array order; exclude weighting, derived content hashes, generated UIDs, and positional bookkeeping; no hash-equality-only; no fuzzy matching; identify parser-volatile metadata before excluding anything.
- No unconditional parsing for ordinary upserts; `_resolveTaskState` timestamp/ID behaviour retained (the force path arrives in Section 3).
- The frontend must never overwrite returned weightings by matching old task IDs.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/backend/AGENTS.md`, `@SPEC.md`, `@docs/developer/data-shapes/assignment-definition.md`, `@src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`, `@src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskWeighting.js`

### Shared helper plan

1. Helper: `compareTaskEquivalence(previousTask, reparsedTask)` (pure)
   - Decision: `new` (backend feature-local module `AssignmentDefinitionTaskEquivalence.js`)
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js`
   - Call-site rationale: consumed by `_resolveTaskState` for both timestamp-triggered and `forceReparse` reparses; owns a single coherent contract (equivalent-content decision) with policy-defining edge cases that need dedicated unit tests.
   - Relevant canonical doc target: `docs/developer/data-shapes/assignment-definition.md` (behaviour note, not a shape change); LOC separation per global constraints.
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Equivalent parsed content under either old task ID → stored weighting preserved; new or changed tasks default to 1; removed tasks disappear; valid zero weightings preserved.
- Comparator is insertion-order-insensitive on objects and order-preserving on arrays.
- Ordinary upserts (no document change, no force) do not call the comparator.

### Required test cases (Red first)

Backend model/unit tests:

1. Equivalent task content → unchanged; weighting preserved (including 0).
2. Changed title/notes/metadata/artefact order/artefact content → changed; weighting default 1.
3. Object key reordering → equivalent; array reordering → changed.
4. Excluded fields (weighting, hashes, UIDs, `index`/`taskIndex`/`artifactIndex`) do not affect equivalence.
5. Task/page identity change → changed (no fuzzy match).

### Section checks

- `npm run test:backend -- AssignmentDefinitionTaskEquivalence`
- `npm run lint:backend`
- Shared-helper planning entry present in canonical docs.
- LOC check: `AssignmentDefinitionUpsertOrchestrator.js` size after extraction noted in implementation notes.

### Implementation notes / deviations / follow-up

- **Implementation notes:** filled during implementation.
- **Deviations from plan:** note parser-volatile metadata discovered and how it was excluded (justify; never exclude wholesale). Record the local-fixture deviation per the canonical-fixture policy.

---

## Section 2 — Synthetic fixture generator: full editable-definition transport view

### Objective

- Extend the synthetic test-data generator with a named full editable-definition transport view (`transport.editableDefinitions`) so MCP walkthroughs, E2E journeys, and unit tests consume canonical `AssignmentDefinitionSchema`-shaped fixtures instead of ad-hoc blobs.

### Constraints

- Extend `toTransportViews.js` to project `transport.editableDefinitions` — full, schema-valid `AssignmentDefinitionSchema` records keyed by `definitionKey`. **The projection applies the transport transformation** (per the backend response mapper: keyed task `Record` → lightweight `{taskId, taskTitle, taskWeighting}` array with null-weighting filtering; omission of `referenceLastModified`/`templateLastModified`), because a verbatim projection of persistence-shape records would be rejected by the strict frontend contract and would poison every mocked walkthrough scenario consumer.
- The view covers **full definitions only**; partial-only registry rows (`referenceDocumentId`/`templateDocumentId` null, array-form tasks) are excluded from the view.
- Wire the new view file (`editableDefinitions.json`) through the shared file-name contract (`PROFILE_VIEW_FILE_NAMES` in `fixtureWriter.js`), the immutable loader (`loadSyntheticAnalysisProfile.js`), and validation (`validateSyntheticAnalysisGraph.js`: reference integrity, redaction, serialisability, profile-count invariants) — the five-file contract becomes six. Add the view to the dispatcher round-trip bridge (`apiHandlerRoundTripBridge.js`) named-view loading where its round-trip test path requires it.
- Regenerate **all committed compact profiles** (`npm run fixtures:synthetic`) with byte-for-byte reproducibility; consumption in tests and walkthroughs is by the canonical `small` profile per the fixture policy. Update manifests/counts invariants as the validation spec requires.
- Test-only infrastructure: no GAS runtime source may import it; production frontend never imports `scripts/`.
- Preserve the person-name invariant and deterministic-seed reproducibility.
- Document the new view in `docs/developer/testing/synthetic-test-data.md` (view table, six-file list, loading path).
- Frontend round-trip adapter (`src/frontend/src/test/syntheticApiRoundTripAdapter.ts`) and any frontend test-fixture factories are updated to expose the new view where needed.

### Delegation mandatory reads

- `@AGENTS.md`, `@docs/developer/testing/synthetic-test-data.md`, `@SPEC.md`, `@scripts/synthetic-test-data/toTransportViews.js`, `@scripts/synthetic-test-data/fixtureWriter.js`, `@scripts/synthetic-test-data/profileDefinitions.js`, `@scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js`, `@scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js`, `@scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js`, `@scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`, `@src/frontend/src/test/syntheticApiRoundTripAdapter.ts`, `@docs/developer/data-shapes/assignment-definition.md`

### Acceptance criteria

- `npm run fixtures:synthetic` regenerates all committed compact profiles including `editableDefinitions.json`; regeneration is deterministic and byte-reproducible.
- `loadSyntheticAnalysisProfile.js` returns the new view for every committed profile; the manifest/counts invariants and validation suite cover it.
- Full definitions in the view are schema-valid against the canonical `AssignmentDefinitionSchema` contract (lightweight task array shape, strict fields) and reference-consistent with the partials view: definition keys match the **full-definition rows** of the partials view (partial-only registry rows excluded).
- No production or runtime code path changes.

### Required test cases (Red first)

Synthetic Node integration tests:

1. Projection includes `transport.editableDefinitions` with schema-valid transformed records for the full definitions (lightweight task arrays; freshness fields omitted; partial-only rows excluded).
2. Loader exposes the view; committed `editableDefinitions.json` round-trips through the GAS serialisation harness unchanged (via the round-trip bridge path).
3. Validation suite: reference integrity (definition keys match the full-definition rows of the partials view), redaction, serialisability, profile-count invariants extended to the new view.
4. Regeneration with the recorded seed reproduces committed bytes exactly.
5. Person-name invariant holds for any name content inside full definitions.

### Section checks

- `npm run test:synthetic`
- `npm run lint:synthetic:check`
- `docs/developer/testing/synthetic-test-data.md` updated with the new view.

### Implementation notes / deviations / follow-up

- **Follow-up implications:** Sections 5–11 seed mocked scenario content and fixtures from the canonical extended view; the walkthrough/E2E sections never need an ad-hoc realistic corpus.

---

## Section 3 — Backend: upsert contracts (`forceReparse`, `expectedDefinitionUpdatedAt`, `DEFINITION_PARSE_FAILED`)

### Objective

- Extend the upsert contract so recovery/manual reparse forces full document parsing, the frontend can assert save-time staleness, and parse failure returns `DEFINITION_PARSE_FAILED` without partial persistence.

### Constraints

- `forceReparse` bypasses timestamp/ID short-circuiting for the explicit recovery/manual-reparse path only; ordinary upserts unchanged.
- **Reject `forceReparse: true` combined with `taskWeightings`** (ambiguous patch precedence) — backend validation failure before any parsing or persistence.
- `expectedDefinitionUpdatedAt` mismatch → `DEFINITION_STALE` rejection at save time; no partial write; rollback handling across full definition and registry writes preserved.
- Parse failure: no successful response, no partial persistence, `DEFINITION_PARSE_FAILED` with clear message.
- Stable keys, `createdAt`, alternate titles/topics, document type preserved.
- Update data-shape doc entries (remove `Not implemented`) for the backend envelopes as they land.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/backend/AGENTS.md`, `@SPEC.md`, `@docs/developer/data-shapes/assignment-definition.md`, `@docs/developer/data-shapes/transport-envelope.md`, `@src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js`, `@src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`, `@src/backend/z_Api/z_apiHandler.js`

### Acceptance criteria

- `upsertAssignmentDefinition` accepts optional `forceReparse` and `expectedDefinitionUpdatedAt`; both validated.
- `expectedDefinitionUpdatedAt` mismatch rejects with `DEFINITION_STALE` before any persistence.
- Forced reparse uses the Section 1 comparator for weighting reconciliation; parse failure → `DEFINITION_PARSE_FAILED`, nothing persisted.
- Ordinary upserts behave byte-identically to today (regression suite green).

### Required test cases (Red first)

Backend controller tests:

1. `forceReparse: true` reparses unchanged documents (force path bypasses timestamp short-circuit).
2. Ordinary upsert with unchanged documents does not reparse (regression, per SPEC decision 6 timestamp behaviour).
3. `expectedDefinitionUpdatedAt` mismatch → `DEFINITION_STALE`, no write (persistence spy asserted).
4. Parse failure → `DEFINITION_PARSE_FAILED` envelope, no write.
5. Rollback coverage for forced-reparse persistence failure.
6. `forceReparse: true` + `taskWeightings` → rejected before any parsing/persistence.

API layer tests:

7. Allowlisted handler accepts the new parameters end-to-end through `z_apiHandler`.

### Section checks

- `npm run test:backend -- AssignmentDefinition` suites
- `npm run lint:backend`
- Data-shape canonical entries updated for backend envelopes (no `Not implemented` remainder for landed backend contracts).

### Implementation notes / deviations / follow-up

- **Follow-up implications:** Sections 4, 7, 9, and 10 consume these envelopes.

---

## Section 4 — Frontend: transport contract extension

### Objective

- Extend the frontend request schema and shared error registry so Sections 7 and 9 can exercise the Section 3 contracts without feature-local string matching.

### Constraints

- `UpsertAssignmentDefinitionRequestSchema` grows optional `forceReparse` and `expectedDefinitionUpdatedAt`; **add the `forceReparse` + `taskWeightings` mutual-exclusion `superRefine`** at the schema level.
- `DEFINITION_PARSE_FAILED` added to the shared frontend error registry (`src/frontend/src/errors/map-error-to-ui.ts`) with the SPEC copy — no feature-local matching.
- Derived TypeScript types via `z.infer`; keep the schema strict so unknown fields still fail.
- Data-shape doc entries updated as they land.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@docs/developer/data-shapes/assignment-definition.md`, `@docs/developer/data-shapes/transport-envelope.md`, `@src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`, `@src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts`, `@src/frontend/src/errors/map-error-to-ui.ts`

### Acceptance criteria

- Schema accepts the two optional fields; rejects `forceReparse` with `taskWeightings`; stays strict on unknown fields.
- Error registry maps both error codes to user-facing copy with no feature-local matching.

### Required test cases (Red first)

Frontend schema tests:

1. Schema accepts `forceReparse: true` alone and with `expectedDefinitionUpdatedAt`.
2. Schema rejects `forceReparse: true` combined with `taskWeightings`.
3. Unknown-field strictness regression (schema still rejects unexpected keys).
4. Registry test: `DEFINITION_PARSE_FAILED` maps to the SPEC copy; `DEFINITION_STALE` mapping unchanged.

### Section checks

- `npm run test:frontend -- services/assignmentDefinition errors`
- `npm run lint:frontend`
- Frontend data-shape entries updated (no `Not implemented` remainder for landed frontend contracts).

---

## Section 5 — Frontend: wizard decomposition (form-state module and shell-boundary refactor)

### Objective

- Split the form-state concerns of `useAssignmentDefinitionWizard.ts` into a form-state module and introduce the chrome-free review-content component, with **all existing create/update/link behaviour green** before any behavioural work lands.

### Constraints

- Pure refactor: no behavioural change; existing specs move with their modules, not rewritten.
- Extracted review-content component covers both wizard stages (`hasParsedTasks` gating); consumed by the existing full-shell modal which keeps its own `Modal` chrome and behaviour.
- Section-level LOC gate applies to the **extracted modules only** (each below 500 lines); the hook's <500-line gate is Section 7's acceptance criterion (see global LOC plan).
- Canonical docs `Not implemented` entries (shared-helper registry §9.23; modal-patterns §3.4) updated to implemented as delivered.
- Where tests need realistic full-definition data they seed from the Section 2 `editableDefinitions` canonical view; Reparse documents (Section 10) is NOT included here.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-modal-patterns.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/frontend/frontend-loading-and-width-standards.md`, `@docs/developer/testing/synthetic-test-data.md`, `@src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModalShell.tsx`

### Shared helper plan

1. Helper: form-state module (wizard form hydration, dirty-state rules, document-change state, task-row state)
   - Decision: `new` (feature-local extraction within `src/frontend/src/features/assignmentWizard/`)
   - Owning module/path: `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.ts`
   - Call-site rationale: pure, deterministically testable state derivation shared by the hook and the orchestrator; decomposition mandated by SPEC.
   - Relevant canonical doc target: shared-helper registry §9.23
   - Planned doc status: `Not implemented` (recorded via §9.23)
2. Helper: chrome-free review-content component
   - Decision: `new` (extraction from shell)
   - Owning module/path: `src/frontend/src/features/assignmentWizard/` (co-located with the shell; exact filename at implementation)
   - Call-site rationale: consumed by the existing shell modal and by Sections 8–9 (converted create path and recovery surface); the one-modal rule requires body/footer content without `Modal` chrome.
   - Relevant canonical doc target: `frontend-modal-patterns.md` §3.4
   - Planned doc status: `Not implemented` (recorded)

### Acceptance criteria

- All existing wizard specs green with no behavioural diff; dirty-state, re-parse gating, discard confirm, and stage-two editing behave identically.
- Extracted form-state module and review-content component each below 500 lines (implementation notes record `wc -l` evidence).
- Shell renders via the extracted review-content component; create/update wizard UI unchanged (visual and behavioural).

### Required test cases (Red first)

Frontend tests (regression-first; move existing specs, add structural tests):

1. Existing full wizard suite green post-refactor (assert identical interactions: parse, reparse gating, dirty close confirm, weighting edits, save).
2. Shell consume test: full modal renders same DOM-regions as before extraction (footer actions, form fields, task rows).
3. Review-content component renders stage one and stage two correctly under `hasParsedTasks` gating, seeded from the canonical `editableDefinitions` view where full-definition data is needed.

### Section checks

- `npm run test:frontend -- features/assignmentWizard`
- `npm run lint:frontend`
- Canonical entries reconciled for the delivered items (review-content component in modal-patterns §3.4).

### Optional `@remarks` JSDoc follow-through

- Record on the review-content component: why chrome-free extraction exists (one-modal rule) and the expected consumers (converted create path + recovery surface + Assignments-page shell).

### Implementation notes / deviations / follow-up

- **Follow-up implications:** Sections 8–9 build on the extracted modules.

---

## Section 6 — Frontend: AssessTaskModal decomposition (assessment orchestration module)

### Objective

- Extract matching, linking, captured start context, and stale-recovery transitions from `AssessTaskModal.tsx` into a feature-local orchestration module, correcting the stale-recovery routing.

### Constraints

- `transitionToStaleRecovery` no longer selects `creating`; stale `DEFINITION_STALE` transitions to a recovery state on the assessment orchestration state machine.
- **Stub contract for Sections 7–9:** this section defines the recovery state slot on the orchestration hook (`assessmentRecoveryState: 'idle' | 'stale-prompt'` plus a `transitionToStaleRecovery(definitionKey)` signature); Section 7 finalises the recovery entry intent on the wizard orchestrator, Section 8 converts the create path in-modal (validating the composition), and Section 9 implements the recovery prompt/review UI. Tests here assert routing only, not UI.
- The stacked `AssignmentDefinitionWizardModal` instance remains in place (Section 8 converts it); its surrounding wiring moves with the orchestration module as pure moves.
- Existing no-match choice/link/create/selection behaviours unchanged in this section.
- Component comfortably below 500 lines before the Section 8 conversion.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/frontend/frontend-modal-patterns.md`, `@src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`

### Shared helper plan

1. Helper: assessment orchestration module (`useAssessTaskFlow` or equivalent hook owning both state machines)
   - Decision: `new` (feature-local extraction)
   - Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/`
   - Call-site rationale: SPEC-mandated decomposition; moves state machines and API flows out of the rendering component.
   - Relevant canonical doc target: shared-helper registry §9.23 (entry 2)
   - Planned doc status: `Not implemented` (recorded)

### Acceptance criteria

- Existing selection/choice/linking/create specs green (with the two incorrect stale-recovery assertions rewritten per SPEC decisions 1/2 — Cancel closes the modal; Update targets the existing key).
- `AssessTaskModal.tsx` below 500 lines after extraction; orchestration module owns matching/link/stale transitions.
- Obsolete async completions guard: an assessment-start/upsert completion after modal close or selection change cannot act on a different assignment.

### Required test cases (Red first)

Frontend tests:

1. Rewritten stale-routing tests: `DEFINITION_STALE` from matched path enters recovery routing (not `creating`).
2. Link-flow `DEFINITION_STALE` preserves the committed link and enters recovery routing.
3. Obsolete-completion guard: API resolution after close/reopen does not mutate the new session's state.
4. Full existing AssessTaskModal regression suite green post-extraction.
5. LOC gate evidence recorded.

### Section checks

- `npm run test:frontend -- features/classes`
- `npm run lint:frontend`
- Shared-helper registry §9.23 entry 2 reconciled.

### Implementation notes / deviations / follow-up

- **Follow-up implications:** Section 7 finalises the recovery entry intent on the orchestrator; Section 8 converts the create path in-modal; Section 9 implements the recovery prompt/review UI.

---

## Section 7 — Frontend: wizard orchestrator module and recovery entry intent

### Objective

- Deliver the dedicated wizard orchestrator file owning create/update/explicit-reparse/recovery entry modes and the parse → review → save sequence, wired to the Section 3/4 contracts.

### Constraints

- Orchestrator is a separate readable file; the hook becomes a thin composition (form-state module + orchestrator). **Hook file below 500 lines completed here.**
- Recovery entry: existing `definitionKey` + approval-success callback; never `mode="create"`; only successful parse/persist opens stage two.
- `forceReparse` sent on recovery/manual reparses; `expectedDefinitionUpdatedAt` captured from the stale definition and sent on save; approve success resumes the captured assessment context (same definition/coursework/class identifiers).
- Orchestrator below 500 lines; split mutation/error mapping into a third module if projected above.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `@docs/developer/data-shapes/assignment-definition.md`, `@src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`, `@src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts`, `@src/frontend/src/errors/map-error-to-ui.ts`, `@src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts`

### Shared helper plan

1. Helper: wizard orchestrator module
   - Decision: `new` (extraction from hook; recovery is an additional orchestrator entry, not a duplicate flow)
   - Owning module/path: `src/frontend/src/features/assignmentWizard/` (separate orchestrator file; name at implementation)
   - Call-site rationale: SPEC-mandated single readable orchestration file for the whole wizard process.
   - Relevant canonical doc target: shared-helper registry §9.23 (entries 1 and 3)
   - Planned doc status: `Not implemented` (recorded)

### Acceptance criteria

- Orchestrator handles all four entry modes; unit tests cover entry-mode selection, reparse flow, save flow, error mapping for `DEFINITION_STALE` / `DEFINITION_PARSE_FAILED`.
- Recovery entry refuses a null key (fail fast); approval-success callback receives the same definition key.
- Existing create/update/explicit-reparse behaviours unchanged (Section 5 regression suite green).
- Hook file below 500 lines with `wc -l` evidence.

### Required test cases (Red first)

Frontend tests (orchestrator unit level):

1. Entry-mode selection for create / update / explicit reparse / recovery (recovery with null key throws).
2. Recovery reparse calls `upsertAssignmentDefinition` with `forceReparse: true` and the existing key (exercises Section 4 schema; never feature-local error strings).
3. Save sends `expectedDefinitionUpdatedAt`; `DEFINITION_STALE` rejection surfaces the prompt-level error; `DEFINITION_PARSE_FAILED` surfaces the parse-failure treatment via the shared registry.
4. Approval success invokes the callback exactly once with the same definition key.
5. Reparse-persists-immediately rule: cancelling review after successful reparse does not roll back and does not start assessment.
6. Update-time definition load failure → blocking error state; never falls back to create.
7. Hook LOC gate evidence recorded in implementation notes.

### Section checks

- `npm run test:frontend -- features/assignmentWizard`
- `npm run lint:frontend`
- Global LOC plan reconciled: hook < 500 lines evidenced.

### Optional `@remarks` JSDoc follow-through

- Document the orchestrator's entry-mode taxonomy and stale-protection flow for future developers.

---

## Section 8 — Frontend: in-modal create-path conversion

### Objective

- Replace the stacked `AssignmentDefinitionWizardModal` instance inside `AssessTaskModal` with in-modal rendering via the extracted chrome-free review-content component and the orchestrator, per SPEC decision 9 — delivered as a gated step so recovery builds on a proven in-modal composition.

### Constraints

- Presentation-only conversion: the create journey (choice → parse → review → auto-assessment) and its outcomes are unchanged.
- One-modal-at-a-time: the stacked instance is removed; wizard content (both stages) renders in the owning modal body; owning footer suppressed while wizard content is active.
- Modal width: adopt `--app-modal-width-wide-data` while wizard content is active; default otherwise (layout spec responsive rule).
- The `flushSync`/`hasCreateSucceeded` stacked-modal choreography is replaced by equivalent in-modal state rules.
- `AssessTaskModal.tsx` final shape below 500 lines after this section.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-modal-patterns.md`, `@docs/developer/frontend/frontend-loading-and-width-standards.md`, `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`, `@src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`

### Acceptance criteria

- No second stacked modal remains in `AssessTaskModal`; the create flow renders through the extracted review-content component in-modal.
- Existing create-flow outcomes identical: successful save triggers the auto-assessment run with the same identifiers; cancel/discard semantics match today.

### Required test cases (Red first)

Frontend tests:

1. Choice → Create renders in-modal (no second stacked modal in the DOM); owning footer suppressed; wide-data token applied.
2. Stage-one URL entry renders (extracted component, stage one); parse success transitions to stage two in-modal.
3. Dirty-state and discard-confirm behaviour; save → auto-assessment begins only after wizard content unmounts (in-modal equivalent of the current flushSync contract, asserted via API-call/mount ordering).
4. Cancel returns to the choice prompt per existing semantics.
5. Parse failure during create uses the existing blocking-error treatment; no partial-run start.
6. Regression: full create/choice/linking/selection suites green.

### Scripted MCP walkthrough check (early bug catch)

- After this section's suites are green, the implementing handoff performs a brief incremental MCP walkthrough of the converted create journey (mocked via `installRuntimeMock`, per the global walkthrough gate) — observing no-stacked-modal composition, stage transition, footer suppression, and width behaviour — and records observations in the section notes before sign-off.

### Section checks

- `npm run test:frontend -- features/classes features/assignmentWizard`
- `npm run lint:frontend`
- Scripted MCP walkthrough check recorded.

---

## Section 9 — Frontend: stale-recovery UX in AssessTaskModal

### Objective

- Implement the user-visible recovery states in the owning modal per `STALE_RECOVERY_LAYOUT.md`: stale prompt (Update/Cancel), reparsing (skeleton, Cancel), in-modal review (extracted review-content component, owning footer suppressed, wide-data width while active), parse failure (Retry/Cancel), approval outcomes (stale → prompt; non-stale failure → error alert + retained edits + retry).

### Constraints

- One modal at a time; no second stacked modal for any state; child dialogs (Manage Topics/Year Groups, discard confirm) rendered by the recovery wiring.
- Cancel (prompt) closes the modal; never opens the no-match/create choice.
- Review Cancel ends recovery on the selection body in `idle` state; never closes the owning modal.
- Width: owning modal adopts `--app-modal-width-wide-data` while wizard content is active; default otherwise.
- Alert copy asserted per layout spec regions 1–4.
- Recovery reuses the composition proven by Section 8; this section adds recovery-specific states only.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-modal-patterns.md`, `@docs/developer/frontend/frontend-loading-and-width-standards.md`, `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`, `@src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`

### Acceptance criteria

- Full recovery state machine per the layout workflow table renders inside the single `AssessTaskModal`.
- Stacked wizard instance absent for every state; create path already converted (Section 8).
- All layout-spec states present and asserted.

### Required test cases (Red first)

Frontend tests (component level):

1. Stale prompt: warning alert copy; footer Cancel then Update; Update opens review in-modal; Cancel closes the modal (asserts no choice prompt).
2. Update-time definition load failure → blocking error; never falls back to the create panel (per SPEC §Feature architecture).
3. Reparsing: skeleton with accessible busy semantics; Cancel-only footer.
4. Review: owning footer suppressed (no "Start Assessment"); review-content form rendered; wide-data token applied; caveat copy present.
5. Review dirty-state gating and discard-confirm dialog function inside the in-modal review.
6. Parse failure: error alert; footer Cancel then Retry; Retry re-triggers the reparse mutation; Cancel closes.
7. Approval: save busy on review footer; success resumes assessment lifecycle with same identifiers; stale rejection returns to prompt; a second consecutive `DEFINITION_STALE` repeats the prompt (no automatic loop); non-stale failure retains edits with error alert and retry.
8. Review Cancel ends recovery on the selection body in `idle` state; owning modal stays open.
9. Regression: existing AssessTaskModal suites (selection/choice/linking/create) green.

### Scripted MCP walkthrough check (early bug catch)

- After this section's suites are green, the implementing handoff performs an incremental MCP walkthrough of the full recovery journey (stale prompt → reparse → review → save → resumed assessment, plus parse-failure → Retry), mocked per the global walkthrough gate, recording observations and fixing any layout-spec contradiction before sign-off.

### Section checks

- `npm run test:frontend -- features/classes`
- `npm run lint:frontend`
- Scripted MCP walkthrough check recorded.

---

## Section 10 — Frontend: Reparse documents action (Assignments-page update wizard)

### Objective

- Add the explicit **Reparse documents** action for unchanged URLs in update mode, per the layout spec state list (enabled conditions, disabled explanation, busy, failure, in-place refresh).

### Constraints

- New stage-one placement; not added to create mode; never triggered by modal open or background refetch.
- Enabled only when: update mode, URLs unchanged, loaded definition trustworthy, no mutation pending, no unsaved metadata/weighting edits or pending URL changes; disabled state carries a visible explanation.
- Uses `forceReparse: true`; regression coverage for the existing timestamp-driven upsert behaviour (Section 3 test 2) must remain green.

### Delegation mandatory reads

- `@AGENTS.md`, `@src/frontend/AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@docs/developer/frontend/frontend-modal-patterns.md`, `@src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx`, `@src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModalShell.tsx`

### Acceptance criteria

- Button present in update mode; gating conditions and disabled explanation asserted; reparse refreshes tasks/weights in place; failure uses existing blocking-error treatment.

### Required test cases (Red first)

Frontend tests:

1. Button rendered and enabled only under the enabling condition set.
2. Disabled state explanation visible (not tooltip-only).
3. Click issues `forceReparse` upsert via the orchestrator; busy state on the button; in-place task refresh.
4. Failure shows the existing blocking-error treatment; no partial persistence.

### Scripted MCP walkthrough check (early bug catch)

- After this section's suites are green, the implementing handoff performs an incremental MCP walkthrough of the update wizard's new Reparse documents journey (enabled, disabled-with-explanation, busy, failure, in-place refresh states) and records observations before sign-off.

### Section checks

- `npm run test:frontend -- features/assignmentWizard`
- `npm run lint:frontend`
- Scripted MCP walkthrough check recorded.

---

## Section 11 — E2E: consolidated exploratory walkthrough and recovery journeys

### Objective

- Consolidate the incremental walkthrough evidence, perform the full MCP walkthrough of all minimum journeys, and deliver Playwright E2E coverage for the primary user journeys.

### Constraints

- Delegate to the `Playwright` agent; follow `docs/developer/frontend/frontend-playwright-e2e.md`.
- **Before writing/finalising specs:** the agent performs the full consolidated manual MCP walkthrough defined in the global walkthrough gate (mock mechanism and canonical `editableDefinitions` fixture seeding included), verifies the incremental checkpoint observations from Sections 8–10 still hold, fixes any confirmed contradiction, and shapes the E2E journeys from those observations.

### Delegation mandatory reads

- `@AGENTS.md`, `@SPEC.md`, `@STALE_RECOVERY_LAYOUT.md`, `@ACTION_PLAN.md`, `@docs/developer/frontend/frontend-playwright-e2e.md`, `@.opencode/agents/playwright.md`, `@src/frontend/src/test/googleScriptRunHarness.ts`, `@src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`

### Acceptance criteria

1. Consolidated walkthrough evidence recorded (all journeys walked, observations, contradictions found and resolved, incremental checkpoint verification).
2. Journey: matched assignment → stale rejection → Update → review (weighting preserved for unchanged task) → approve → assessment started success state.
3. Journey: forced reparse → parse failure → Retry succeeds (or Cancel closes; assert no review panel on failure).
4. Journey: converted in-modal create path (choice → create → parse → review → auto-assessment).
5. Journey: update wizard Reparse documents action on unchanged URLs (or a documented justification that the Section 10 component coverage plus journey 3's forced-reparse path subsumes it — with the incremental walkthrough evidence still mandatory for that surface).

### Section checks

- `npm run test:frontend:e2e -- <targets per playwright doc>`

---

## Regression and contract hardening

### Objective

- Prove no drift in existing behaviour and contract integrity across both runtimes.

### Acceptance criteria

1. Touched backend suites (`AssignmentDefinition*`, `AssignmentController`, `z_apiHandler`) green.
2. Touched frontend suites (`features/assignmentWizard`, `features/classes`, `services/assignmentDefinition`, `errors`) green.
3. `npm run lint:backend && npm run lint:frontend` clean.
4. Full frontend unit suite green (wizard/AssessTaskModal refactor surface area is broad).
5. Synthetic integration suite green after the Section 2 extension: `npm run test:synthetic` (committed profiles regenerated and byte-reproducibility proven).
6. Mandatory-read evidence complete for every delegated regression handoff.

---

## Documentation and rollout notes

### Objective

- Update canonical docs to match the implemented feature.

### Acceptance criteria

- `docs/developer/data-shapes/assignment-definition.md` and `transport-envelope.md`: entries fully reconciled (no `Not implemented` remainder for landed contracts).
- `frontend-shared-helpers-and-abstraction-standards.md` §9.23 and `frontend-modal-patterns.md` §3.4 entries reconciled to implemented status.
- `docs/developer/testing/synthetic-test-data.md`: the `transport.editableDefinitions` view documented (mandated, landed in Section 2), including regeneration behaviour and view contents.
- Notes/deviations fields across sections filled; incremental walkthrough evidence from Sections 8–10 and consolidated evidence from Section 11 referenced; `@remarks` follow-through from Sections 5 and 7 verified in code.

---

## Suggested implementation order

1. Section 1 — backend comparator + weighting reconciliation (pure, no dependencies)
2. Section 2 — synthetic fixture generator extension (no dependencies; enables all later fixture consumption)
3. Section 3 — backend upsert contracts (depends on 1)
4. Section 4 — frontend transport contract extension (depends on 3)
5. Section 5 — wizard decomposition + shell-boundary refactor (depends on 2 for full-definition fixtures)
6. Section 6 — assessment orchestration decomposition (depends on Section 5; stub contract recorded)
7. Section 7 — wizard orchestrator + recovery entry intent (depends on 3, 4, 5)
8. Section 8 — in-modal create-path conversion (depends on 5, 7; validates the composition before recovery)
9. Section 9 — recovery UX (depends on 6, 7, 8)
10. Section 10 — Reparse documents action (depends on 3, 7)
11. Section 11 — consolidated walkthrough + E2E (incremental checkpoints verified; depends on 8, 9, 10)
12. Regression and contract hardening
13. Documentation and rollout notes
