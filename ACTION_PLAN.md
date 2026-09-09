# Synthetic Analysis Test Data — Delivery Plan (TDD-First)

## Read-First Context

- `SPEC.md` is the source of truth. No frontend layout specification is required: the work has no user-visible layout or workflow change.
- The feature adds test-only tooling and fixtures; it does not change production persistence, validation, API, or transport contracts.

## Scope and assumptions

### Scope

- Deterministic Faker-based analysis-graph generation, validation, compact committed profiles, on-demand full large-profile output, and an `apiHandler`/GAS-harness round-trip integration path.
- Root Node tooling commands and configuration needed to lint and test this new test-only domain.
- The frontend round-trip path covers `classDetailService`/`getABClass` and `assignmentDefinitionPartialsService`/`getAssignmentDefinitionPartials`, whose validated results form `DataAnalysisService` input.
- Comprehensive test-data architecture documentation and the planning, testing, and review-agent guidance required to preserve canonical fixture use as the corpus expands.

### Out of scope

- Production backend/frontend code changes, deployed synthetic-data APIs, external Google-service simulation, malformed-data fuzzing, E2E fixture delivery or demo mode, and UI work.

### Assumptions

1. `@faker-js/faker` 10.6.0 can be installed and executed in the repository and CI Node runtimes; fail the setup section if that is not true rather than selecting a substitute.
2. The bridge injects schema-valid generated **transport** views through established `apiHandlerTestUtils.js` seams. It does not mock persistence or re-exercise backend model/controller/response-mapper code.
3. The committed large representative projection is smaller than the canonical 3,000-student/10,000-assignment full graph. Its manifest names both its own counts and the full-profile parameters.
4. A future explicit demo mode may use this corpus, but it must be separately configured; a normal authentication failure remains fail-closed.

---

## Global constraints and quality gates

### Engineering constraints

- Use Node ESM only in `scripts/synthetic-test-data/`; never import its dependencies into GAS source.
- Preserve production frontend/backend boundaries. Tests exercise frontend `callApi` with the existing `googleScriptRunHarness`; neither production module imports backend runtime modules.
- Reuse `tests/helpers/apiHandlerTestUtils.js` and `src/frontend/src/test/googleScriptRunHarness.ts` by composition. Do not add synthetic concerns to the 366-line dispatcher helper, the 447-line `mockFactories.js`, or the 498-line `apiService.ts`.
- Validate generated outputs against existing backend/transport paths and frontend Zod consumers; do not duplicate production contracts as a second source of truth.
- Fail fast and leave committed fixtures untouched on generation/validation failure. Full-corpus output is ignored.

### TDD workflow

For every section: write the listed failing tests first, implement only enough to pass, then refactor while all section tests remain green.

### Delegation evidence gate

Every delegated handoff must list every required `@`-prefixed file under `Files read`. Return incomplete handoffs to the same agent before progressing.

### LOC and separation baseline

| Existing module                                   | Current LOC | Projected LOC | Plan                                                                                                                               |
| ------------------------------------------------- | ----------: | ------------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                    |          69 |           ~78 | Small command/dependency change; remain one file.                                                                                  |
| `vitest.config.js`                                |          36 |           ~58 | Add one isolated Node integration project; remain one file.                                                                        |
| `eslint.config.js`                                |         248 |          ~295 | Add script-tooling and TypeScript-aware synthetic-spec scopes; remain one file.                                                    |
| `.gitignore`                                      |          32 |           ~34 | Add the explicit `.opencode/scratchpad/synthetic-analysis-full/` ignored output path; it is not an ancestor of committed fixtures. |
| `tests/helpers/apiHandlerTestUtils.js`            |         366 |           366 | No edits; compose from a new bridge module.                                                                                        |
| `tests/helpers/mockFactories.js`                  |         447 |           447 | No edits.                                                                                                                          |
| `src/frontend/src/test/googleScriptRunHarness.ts` |          34 |            34 | No edits; reuse it.                                                                                                                |
| `src/frontend/src/services/apiService.ts`         |         498 |           498 | No edits; test through its public API.                                                                                             |

All implementation modules are new and must be grouped by concern below, with a target of under 250 LOC each. If a module is projected beyond 500 LOC, split it before implementation; backend facade decomposition is not applicable because no existing GAS production facade is modified.

---

## Section 1 — Establish isolated synthetic tooling

### Objective

- Add the pinned dependency, ignored full-output location, root lint scope, and root Vitest project required to execute the test-only domain without changing runtime ownership.

### Constraints

- Read `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md` before changing lint/configuration.
- Add explicit `lint:synthetic`, `lint:synthetic:check`, and `test:synthetic` commands; include them in aggregate `lint`, `lint:check`, `test`, `test:coverage`, and `run-all-checks` as applicable.
- The dedicated Vitest project must use Node, `tests/setupGlobals.js`, and `tests/synthetic-analysis/**/*.test.ts`. The existing root project continues to include only `tests/**/*.test.js`, so synthetic integration specs cannot double-run there.
- Its first smoke spec imports `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` and `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` in Node, installs the existing harness, and proves their transport-only dependency chains can execute without React or DOM globals. Do not use an arbitrary fixture or type-only import as this smoke target.
- The integration project resolves those frontend TypeScript modules through Vitest's Vite transform and explicit relative imports from `tests/synthetic-analysis/`; it uses the root `zod` dependency already available to the test runner. Do not add a frontend-package alias or mutate the normal frontend Vitest project.
- Add only the explicit ignored `.opencode/scratchpad/synthetic-analysis-full/` output path, which is not an ancestor of `tests/__mocks__/data/synthetic-analysis/`.
- Add a root ESM scope for `scripts/synthetic-test-data/**` and a TypeScript-parser-aware root test scope for `tests/synthetic-analysis/**/*.test.ts`. `lint:synthetic` must lint both paths; `lint:builder` and `scripts/builder` configuration remain unchanged.

### Delegation mandatory reads

Testing Specialist:

- @SPEC.md
- @package.json
- @vitest.config.js
- @tests/setupGlobals.js
- @docs/developer/backend/backend-testing.md

Implementation:

- @SPEC.md
- @AGENTS.md
- @src/backend/AGENTS.md
- @src/frontend/AGENTS.md
- @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md
- @package.json
- @vitest.config.js
- @eslint.config.js
- @.gitignore

### Shared-helper and data-shape plan

- Helper decision: **keep local**. Tooling configuration owns no reusable runtime helper.
- Data-shape plan: **none**. This section changes only test tooling; do not add a data-shape entry.

### Required test cases (Red first)

1. A synthetic-project smoke spec proves the Node project loads `tests/setupGlobals.js` and the two selected frontend service modules through their real TypeScript imports.
2. A command-level check proves the new lint and test commands target the synthetic domain without silently excluding it.

### Acceptance criteria and checks

- `@faker-js/faker` is recorded at exactly `10.6.0` in root development dependencies and lockfile.
- `npm run lint:synthetic:check` and `npm run test:synthetic` are available; aggregate commands include equivalent checks, and the `.test.ts` integration specs run only in the dedicated project.
- Run: `npm run lint:synthetic:check`, `npm run test:synthetic`, and the smoke test through the aggregate `npm test` path.

### Optional `@remarks` JSDoc follow-through

- None.

---

## Section 2 — Build and validate deterministic analysis graphs

### Objective

- Implement small, medium, representative-projection, and full-large deterministic graph generation with contract-aware views and invariant validation.

### Constraints

- New modules, each under 250 projected LOC: `profileDefinitions`, `generateReferenceData`, `generateAssignmentDefinitions`, `generateAssignments`, `generateSubmissions`, `toTransportViews`, and `validateSyntheticAnalysisGraph` under `scripts/synthetic-test-data/`.
- Use fixed profile seeds and bounded UTC ISO timestamps; never emit generation time, ambient randomness, live `Date`, unsafe identifiers, secrets, or non-serialisable values.
- The full large profile has 100 classes of 30 distinct students; classes are distributed four or five per Year Group 7–30; each class has 100 assignments.
- Apply the agreed 5%/10%/70%/15% completion bands with deterministic rounding from a 30-student roster. The representative projection must not claim full-population counts.

### Delegation mandatory reads

Testing Specialist:

- @SPEC.md
- @docs/developer/data-shapes/INDEX.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/data-shapes/assignment-definition.md
- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/reference-data.md
- @docs/developer/data-shapes/transport-envelope.md
- @docs/developer/backend/backend-testing.md

Implementation:

- @SPEC.md
- @AGENTS.md
- @src/backend/AGENTS.md
- @docs/developer/data-shapes/INDEX.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/data-shapes/assignment-definition.md
- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/reference-data.md
- @docs/developer/data-shapes/transport-envelope.md
- @tests/setupGlobals.js

### Shared-helper and data-shape plan

1. Helper: Synthetic analysis corpus and dispatcher bridge (generator/validator portion).
   - Decision: **new**.
   - Owning path: `scripts/synthetic-test-data/` domain modules.
   - Rationale: shared by fixture regeneration, backend bridge, and focused tests; it must not enlarge existing generic mock helpers.
   - Canonical doc: @docs/developer/backend/backend-testing.md, `Synthetic analysis corpus and dispatcher bridge` — status already **Not implemented**; update it only after delivery.
2. Data-shape plan: **none**. The generator conforms to documented production shapes but does not alter them; do not add or edit `docs/developer/data-shapes/` unless a genuine existing contract discrepancy is found.

### Required test cases (Red first)

1. The same seed/profile produces byte-identical logical views and manifest; a changed seed changes allowed synthetic values while retaining all invariants.
2. Every reference key, class roster member, assignment-definition reference, task ID, artefact UID, assessment, and feedback map resolves within its graph.
3. Full and partial views retain semantic identifiers while applying documented redactions.
4. Small/medium include valid empty, missing, no-submission, partial-assessment, `'N'` score, nullable, Slides, Sheets, and artefact scenarios.
5. Full large profile meets exact class, student, Year Group, assignment, and completion-band counts; representative projection declares its smaller counts accurately.
6. Every generated view round-trips through `JSON.stringify`/`JSON.parse` and contains no prohibited transport values.
7. Generated `getABClass` and `getAssignmentDefinitionPartials` transport views parse through the actual `classDetail` and assignment-definition-partials frontend Zod schemas, not only the custom graph validator.

### Acceptance criteria and checks

- The generator returns the logical model in `SPEC.md`; its validators produce actionable invariant failures.
- Focused generator and validator specs pass via `npm run test:synthetic`.
- Run fixture-independent backend model/API validation tests selected by generated shapes, then `npm run lint:synthetic:check`.

### Optional `@remarks` JSDoc follow-through

- Document why the representative projection must not be treated as the canonical large stress graph.

---

## Section 3 — Regenerate committed profiles and protect full output

### Objective

- Add an explicit generation CLI, immutable fixture loader, manifests, and committed small/medium/representative-projection data.

### Constraints

- New modules remain under 250 LOC: `generateSyntheticAnalysisFixtures` CLI, `fixtureWriter`, and `loadSyntheticAnalysisProfile`.
- Write to a staging directory and replace committed profile files only after every graph and serialisation validation passes.
- Commit only `tests/__mocks__/data/synthetic-analysis/{small,medium,large-representative}/` transport views and deterministic manifests. Generate full output only under the ignored root defined in Section 1.
- Fixtures must be readable synchronously and returned as immutable data; tests explicitly clone before local mutation.

### Delegation mandatory reads

Testing Specialist:

- @SPEC.md
- @.gitignore
- @docs/developer/backend/backend-testing.md

Implementation:

- @SPEC.md
- @AGENTS.md
- @package.json
- @.gitignore
- @docs/developer/backend/backend-testing.md

### Shared-helper and data-shape plan

1. Helper: profile loader.
   - Decision: **new**.
   - Owning path: `scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js`.
   - Rationale: makes profile/view selection explicit and prevents each test from parsing or reshaping files.
   - Canonical doc: @docs/developer/backend/backend-testing.md, `Synthetic analysis corpus and dispatcher bridge` — **Not implemented** entry already recorded.
2. Data-shape plan: **none**; fixture serialisation follows existing contracts without changing them.

### Required test cases (Red first)

1. Regeneration of each committed profile matches checked-in files and manifest byte-for-byte.
2. A validation or write error leaves the existing committed profile directory unchanged.
3. Full mode rejects an output path outside `.opencode/scratchpad/synthetic-analysis-full/`, writes only to that ignored location, and never overwrites committed representative data.
4. Loader rejects unsupported profile/view names and supplies deep-frozen valid named views.

### Acceptance criteria and checks

- A documented root command regenerates compact fixtures deterministically; a separate explicit command creates full-large output.
- Committed manifests record seed, schema version, own entity counts, and canonical full-large parameters.
- Run: regeneration verification, `npm run test:synthetic`, `npm run lint:synthetic:check`, and `git diff --check`.

### Optional `@remarks` JSDoc follow-through

- Document staging/replacement safety and the compact/full boundary on the CLI and writer.

---

## Section 4 — Compose the real dispatcher and frontend transport boundary

### Objective

- Provide isolated backend transport injection and a thin frontend test adapter so tests exercise the real `apiHandler`, existing GAS serialisation harness, `callApi`, and consumer Zod validation.

### Constraints

- New bridge module target: `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js` (~180 LOC); new frontend adapter target: `src/frontend/src/test/syntheticApiRoundTripAdapter.ts` (~100 LOC); neither approaches 500 LOC.
- Do not modify `apiHandlerTestUtils.js`, `mockFactories.js`, `googleScriptRunHarness.ts`, its factory, or `apiService.ts`. The bridge composes their public test seams.
- Each call installs/restores dispatcher globals in test isolation. Success travels once through the harness's JSON stringification; backend failure envelopes and raw failures retain their respective existing semantics; void uses `data: null`.
- The `.test.ts` Node integration spec imports `classDetailService` and `assignmentDefinitionPartialsService`, then passes their validated results to `DataAnalysisService`; it does not duplicate a test-only consumer schema. It selects a known existing synthetic class and asserts the nullable `getABClass` result is non-null before analysis; it must not use an unsafe assertion or treat a not-found result as analysis input.
- The integration spec owns composition: it imports both the scripts-side bridge and the frontend adapter, supplies the bridge invocation to the adapter, and installs `google.script.run`. The adapter imports only the in-tree `googleScriptRunHarness`, so frontend lint and production build have no cross-package import to permit.

### Delegation mandatory reads

Testing Specialist:

- @SPEC.md
- @src/backend/AGENTS.md
- @src/frontend/AGENTS.md
- @tests/setupGlobals.js
- @tests/helpers/apiHandlerTestUtils.js
- @src/backend/z_Api/z_apiHandler.js
- @src/frontend/src/test/googleScriptRunHarness.ts
- @src/frontend/src/test/google-script-run-harness-factory.js
- @src/frontend/src/services/apiService.ts
- @src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
- @src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts
- @src/frontend/src/services/dataAnalysis/dataAnalysisService.ts
- @docs/developer/data-shapes/transport-envelope.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/data-shapes/assignment-definition.md
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/backend/backend-testing.md

Implementation:

- @SPEC.md
- @AGENTS.md
- @src/backend/AGENTS.md
- @src/frontend/AGENTS.md
- @tests/setupGlobals.js
- @tests/helpers/apiHandlerTestUtils.js
- @src/backend/z_Api/z_apiHandler.js
- @src/frontend/src/test/googleScriptRunHarness.ts
- @src/frontend/src/test/google-script-run-harness-factory.js
- @src/frontend/src/services/apiService.ts
- @src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
- @src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts
- @src/frontend/src/services/dataAnalysis/dataAnalysisService.ts
- @docs/developer/data-shapes/transport-envelope.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/data-shapes/assignment-definition.md
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/backend/backend-testing.md

### Shared-helper and data-shape plan

1. Helper: Synthetic analysis corpus and dispatcher bridge (round-trip portion).
   - Decision: **new**.
   - Owning path: `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`.
   - Rationale: owns generated transport-view selection and isolated dispatcher seam setup without growing existing helpers.
   - Canonical doc: @docs/developer/backend/backend-testing.md, `Synthetic analysis corpus and dispatcher bridge` — **Not implemented** entry already recorded.
2. Helper: frontend synthetic round-trip adapter.
   - Decision: **new**.
   - Owning path: `src/frontend/src/test/syntheticApiRoundTripAdapter.ts`.
   - Rationale: the required frontend test-home adapter installs the existing harness; the Node integration spec supplies the bridge invocation, avoiding a cross-package import and a second harness.
   - Canonical doc: @docs/developer/frontend/frontend-testing.md, `Synthetic analysis API round-trip adapter` — **Not implemented** entry already recorded.
3. Data-shape plan: **none**. The bridge only transports existing documented payload variants.

### Required test cases (Red first)

1. Generated `getABClass` and `getAssignmentDefinitionPartials` responses reach `classDetailService` and `assignmentDefinitionPartialsService` through `callApi` and their existing Zod schemas after real dispatcher handling; the parsed results become valid `DataAnalysisService` input.
2. Success is JSON-stringified exactly once; malformed JSON and malformed-but-enveloped payloads surface the existing parser/Zod errors.
3. Backend failure envelope becomes `ApiTransportError`; raw transport failure remains raw.
4. Void response resolves from `data: null`.
5. Overlapping calls retain their own callbacks and selected generated views; globals and handlers are restored between tests.
6. A known existing synthetic class returns a non-null `ClassFull` before its assignments are supplied to `DataAnalysisService`; a `null` class result is asserted as a distinct not-found branch and is never analysed.

### Acceptance criteria and checks

- Focused Node integration specs run in the new Vitest project and demonstrate the complete production transport path except real GAS hosting.
- Existing frontend harness specs and `tests/api/apiHandler/`, `tests/api/apiHandlerLocking.test.js`, and `tests/api/apiHandlerTiming.test.js` remain green.
- Run: `npm run test:synthetic`, `npm run test:backend -- tests/api/apiHandler tests/api/apiHandlerLocking.test.js tests/api/apiHandlerTiming.test.js`, selected class-detail and assignment-definition frontend service specs, and both runtime lint checks.

### Optional `@remarks` JSDoc follow-through

- Preserve the runner-boundary rationale and callback-isolation requirement in bridge/adapter JSDoc.

---

## Section 5 — Regression, documentation, and delivery verification

### Objective

- Reconcile documentation, verify fixture reproducibility and contract adherence, and run the appropriate repository gates.

### Constraints

- Do not add a production data-shape document: confirm the feature has not changed a production contract. If tests reveal a pre-existing mismatch, stop and record it as a separate issue rather than silently changing the synthetic data to conceal it.
- Reconcile both planned helper entries from **Not implemented** to implemented details only after the actual paths and commands exist.
- Create `docs/developer/testing/synthetic-test-data.md` as the canonical cross-component architecture guide. It owns the generator/validator/loader/bridge topology, named persistence and transport views, profile selection, manifests/seeds, committed versus ignored output, commands, mutation isolation, error behaviour, CI and opt-in stress policy, and safe change/removal constraints. The backend/frontend testing documents link to it rather than duplicating architecture.
- Update backend/frontend testing policy: all new or changed tests use an appropriate canonical synthetic fixture when the system provides one; unsupported realistic data requires a generator-extension plan in the feature work; invalid/boundary fixtures remain local; touched existing tests migrate opportunistically. This policy is intentionally broader than the initial analysis graph so it applies automatically as later domains are added.
- Before changing `.opencode/agents/**`, load the `customize-opencode` skill. Update Planner and Planner Reviewer to assess fixture capability, choose a canonical profile/view or plan an extension, and identify opportunistic migration of touched tests. Update Testing Specialist with commands, profile/view selection, bridge use, and opt-in full-large stress guidance. Update Code Reviewer to enforce canonical-fixture use or an explicit exception/extension rationale.

### Delegation mandatory reads

Code Reviewer and Docs:

- @SPEC.md
- @ACTION_PLAN.md
- @docs/developer/backend/backend-testing.md
- @docs/developer/frontend/frontend-testing.md
- @.opencode/agents/planner.md
- @.opencode/agents/planner-reviewer.md
- @.opencode/agents/testing-specialist.md
- @.opencode/agents/code-reviewer.md
- @package.json
- @vitest.config.js
- @eslint.config.js
- @.gitignore

### Shared-helper and data-shape plan

- Helper documentation: reconcile the two planned canonical testing-doc entries against the delivered bridge and adapter.
- Policy documentation: create the canonical architecture guide; use it from the backend/frontend testing docs; update the four named agent instructions without duplicating detailed operational policy into each agent file.
- Data-shape plan: confirm **no change**; no `docs/developer/data-shapes/` edit is expected.

### Required checks

1. Re-run deterministic committed-fixture comparison and full-large invariant validation.
2. Run `npm run lint:check` and `npm test`.
3. Run `npm run build:production` and `git diff --check`.
4. Inspect generated full output is ignored and no untracked full corpus is staged.
5. Verify the architecture guide states deterministic fixture lifecycle, compact/full profile selection, cross-runtime bridge composition, mutation isolation, failure behaviour, CI/stress policy, and safe-removal constraints.
6. Verify backend/frontend testing guidance uses the exact canonical-fixture directive and exception path; confirm no wording mandates a wholesale migration.
7. Verify Planner, Planner Reviewer, Testing Specialist, and Code Reviewer instructions respectively cover fixture assessment, review, use, and enforcement.
8. Use Code Reviewer after implementation and return valid findings to Implementation until clean; then use Docs to reconcile the planned helper documentation and policy docs.

### Acceptance criteria

- All focused and aggregate commands pass.
- Committed fixture files are reviewable and the full corpus is absent from tracked changes.
- `docs/developer/testing/synthetic-test-data.md`, `docs/developer/backend/backend-testing.md`, and `docs/developer/frontend/frontend-testing.md` accurately describe the delivered architecture, commands, policy, and helpers without adding an unsupported production-contract claim.
- `.opencode/agents/planner.md`, `.opencode/agents/planner-reviewer.md`, `.opencode/agents/testing-specialist.md`, and `.opencode/agents/code-reviewer.md` consistently require canonical-fixture consideration at their respective workflow stages.

### Optional `@remarks` JSDoc follow-through

- Verify the Section 2–4 rationale comments are present only where they explain non-obvious boundaries.

---

## Suggested implementation order

1. Section 1 — isolated tooling and test runner.
2. Section 2 — deterministic graph generation and validation.
3. Section 3 — fixture writing, loading, and committed profiles.
4. Section 4 — dispatcher/harness round-trip integration.
5. Section 5 — regression, review, and documentation reconciliation.
