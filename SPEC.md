# Synthetic Analysis Test Data Specification

## Status

- Draft v1.0

## Purpose

This specification defines a deterministic synthetic-data corpus for robust backend, frontend, and analysis testing.

The feature will be used to:

- provide reusable, realistic and relationally valid test data for current and future data-analysis functions;
- provide stable committed fixtures for focused backend and frontend tests;
- exercise the real `apiHandler` envelope and Google Apps Script JSON serialisation behaviour before frontend data reaches Zod validation.

This feature is **not** intended to:

- add synthetic-data generation to the deployed GAS application or expose it through an API;
- create real Google Classroom, Drive, trigger, configuration, or authentication state;
- replace small hand-crafted fixtures that intentionally represent invalid, boundary, or narrowly targeted cases.

## Agreed product decisions

1. The corpus covers the analysis graph only: reference data, ABClasses, assignment definitions, assignments, submissions, assessments, feedback, and task artefacts. BackendConfig, AuthCache, RequestStore, TriggerContext, and live Google Classroom passthrough responses are out of scope.
2. `@faker-js/faker` 10.6.0 is the generation dependency. It must be pinned as a root development dependency and its Node compatibility must be verified in the repository and CI runtimes during implementation.
3. Generation is deterministic. A profile and integer seed identify a corpus exactly; generated values must never depend on wall-clock time, ambient randomness, or external services.
4. Small, medium, and large profiles are supported. Reusable committed fixtures live alongside the existing backend mock data under `tests/__mocks__/data/`; generator functionality lives under `scripts/`.
5. The large profile represents 3,000 students: 100 classes of 30 students, distributed as evenly as possible across Year Groups 7–30, with 100 assignments per class.
6. Large-profile assignment completion uses four deterministic per-assignment bands: 5% of assignments complete at 20–49%, 10% at 50–79%, 70% at 80–95%, and 15% at 96–100%. A profile seed chooses a percentage within its assigned band; completion count is deterministically rounded to a class roster of 30 students.
7. The committed large **representative projection** is a compact, transport-valid sample plus a manifest that records the canonical large population. It is not represented as, or used as a substitute for, the full 3,000-student stress profile. The full nested persistence corpus is generated deterministically on demand for dedicated stress tests and is not committed.
8. Frontend-service integration tests must not hand-construct a frontend-only equivalent of a backend payload when a synthetic profile can supply it. In v1 they exercise `classDetailService` (`getABClass`) and `assignmentDefinitionPartialsService` (`getAssignmentDefinitionPartials`) through a shared test-only bridge, then use their validated values as `DataAnalysisService` input.
9. The bridge must route a frontend service through `callApi`, invoke the real backend dispatcher and return through the existing harness, which JSON-stringifies success values. It must preserve raw failure-handler values and per-call callback isolation.
10. Synthetic values must be unambiguously fake, must not contain secrets, and must comply with existing identifier-safety and wire-serialisation constraints.
11. All new or changed tests must use a canonical synthetic fixture when the synthetic fixture system provides appropriate data. Invalid/boundary tests and tests whose required data is not yet supported may use local fixtures; the latter must trigger a planned generator extension in the relevant feature-delivery work rather than a competing realistic fixture family.
12. Existing tests are refactored opportunistically to use appropriate canonical synthetic fixtures when they are otherwise changed. This feature does not require a wholesale fixture migration.

## Existing system constraints

### Backend or API constraints already in place

- `src/backend/z_Api/z_apiHandler.js` is the sole frontend transport entry point. It dispatches allowlisted methods, applies authorisation and request tracking, and returns the canonical `{ ok, requestId, data | error }` envelope.
- `google.script.run` forbids live `Date` values. API-visible dates must be ISO strings, and frontend `apiService.ts` is the sole success-response JSON deserialisation point.
- Backend model persistence, API transport transformations, and frontend Zod schemas are documented in `docs/developer/data-shapes/`; generated data must honour the documented variant actually being exercised.
- Backend tests run against GAS-style global dependencies. The synthetic corpus and round-trip bridge must remain test-only and must not introduce Node dependencies into GAS runtime source.

### Current data-shape constraints

- Reference-data keys must resolve: `ABClass.cohortKey` and `.yearGroupKey` reference generated Cohorts and YearGroups; `AssignmentDefinition.primaryTopicKey` and `.yearGroupKey` reference generated AssignmentTopics and YearGroups.
- Assignment partials embedded in a class use `assignmentDefinitionKey`; full assignments embed a full AssignmentDefinition. Partial views redact artefact content and assessment reasoning according to the Assignment and ABClass contracts.
- Every generated submission belongs to a generated student and assignment. Every submission item references an existing task; task IDs, artefact UIDs, document IDs, and assessment/feedback maps remain internally consistent.
- Scores, nullable fields, ISO timestamps, document types, artefact discriminators, and partial/full differences must satisfy the authoritative contract docs rather than a duplicated synthetic schema.
- No synthetic fixture may contain a live `Date`, function, DOM value, undefined success-envelope `data`, unsafe path characters in identifiers, or a raw secret.

### Frontend or consumer architecture constraints

- Frontend code accesses the backend only through `src/frontend/src/services/apiService.ts` (`callApi`). Production code cannot import backend runtime modules.
- The existing `src/frontend/src/test/googleScriptRunHarness.ts` is mandatory for frontend `google.script.run` mocks. Its factory performs the required success-path `JSON.stringify()` and leaves failures raw.
- Backend dispatcher tests already use `tests/helpers/apiHandlerTestUtils.js` to load the actual `apiHandler` and install isolated handler/controller behaviour. The new bridge must compose this established path rather than reimplementing envelope behaviour or appending synthetic-data logic to that helper.
- The present data-analysis service consumes `ClassFull` results and assignment-definition partials; its fixture graph must therefore include realistic complete, partial, missing, and not-attempted assessment states.

## Domain and contract recommendations

### Why this approach is preferable

- Faker supplies maintained fake names, emails, text, dates and primitive variation; narrow domain generators retain ownership of referential integrity, partial/full transformations, assessment distribution, and contract-specific invariants that no generic library can infer.
- A seeded, versioned corpus makes failures reproducible and makes reviewable fixture changes explicit.
- Reusing the actual dispatcher plus the shared GAS serialisation harness catches both envelope/serialisation defects and frontend Zod drift without allowing individual tests to double-stringify or bypass `callApi`.
- Compact committed transport profiles retain quick local test feedback; the full generated corpus provides credible volume testing without permanently imposing its storage and checkout cost on every contributor.

### Recommended corpus model

The generator produces a graph, not unrelated rows. Each profile contains these named views of the same graph:

```ts
{
  manifest: {
    schemaVersion: 1,
    profile: 'small' | 'medium' | 'large',
    seed: number,
    generatedEntityCounts: Record<string, number>,
  },
  referenceData: { cohorts: Cohort[], yearGroups: YearGroup[], assignmentTopics: AssignmentTopic[] },
  transport: {
    classPartials: ClassPartial[],
    assignmentDefinitionPartials: AssignmentDefinitionPartial[],
    classesById: Record<string, ClassFull>,
    assignmentsByKey: Record<string, AssignmentFull>,
  },
  persistence: {
    // Full profile output only; follows documented stored forms, including keyed tasks.
  },
}
```

The exact serialised file organisation may differ from this logical model, but every committed or generated view must be traceable to one documented persistence or transport form. Fixture consumers must select an explicit view; they must not transform an unrelated frontend-only fixture into a pretend backend response.

### Generation rules

- Use a fixed seed for each checked-in profile. Persist the seed and expected entity counts in its manifest; do not emit a volatile generation timestamp.
- Use ISO 8601 UTC strings selected deterministically from a bounded academic timeline. Preserve ordering relations such as `createdAt <= updatedAt` where the contract and analysis behaviour rely on them.
- Generate both `SLIDES` and `SHEETS` assignment definitions and supported task-artefact variants appropriate to analysis. Include valid sparse and dense submissions, no submission/document cases, numeric scores, `'N'` scores in partial assessment views, score boundaries, feedback, and nullable contract fields.
- Vary assignment and task counts by profile while preserving a tractable compact fixture. The large full corpus must have 100 assignments per class and must apply the agreed weighted completion distribution.
- Make identifiers deterministic, unique within their documented scope, and safe for backend transport/persistence validation. Use reserved synthetic email domains such as `example.test`.
- Validate generated output before writing it: model/transport shape conformance, reference integrity, uniqueness, partial/full redaction rules, serialisability through `JSON.stringify`/`JSON.parse`, and profile-count invariants.

### Library assessment

- **Selected: `@faker-js/faker` 10.6.0.** Its maintained v10 documentation supports deterministic seeding and exposes the person, internet, lorem, date, number, string and helper modules required here. It is MIT-licensed and declares support for Node 24; implementation must verify this in the configured CI runtime because the root package does not declare an `engines` field.
- **Not selected: Fishery.** Fishery 2.4.0 is maintained and could supply generic factory composition, but it does not generate the rich values or graph-level referential integrity required here. Adding it on top of Faker would duplicate the domain factory layer.
- **Not selected: test-data-bot.** Its latest release is 0.8.0 and its registry metadata was last modified in 2022; it depends on the obsolete `faker` package.

## Feature architecture

### Placement

- Test-data generation, profile validation, corpus loading and the Node-side backend `apiHandler` round-trip bridge belong under `scripts/` in a dedicated synthetic-test-data domain.
- Checked-in compact fixtures and manifests belong under `tests/__mocks__/data/` in a clearly named synthetic-data subdirectory.
- A thin frontend test adapter belongs in `src/frontend/src/test/` because that is the mandatory home for a test consumer of `googleScriptRunHarness`. It imports only in-tree frontend test infrastructure and must not become a second harness implementation. The Node integration spec composes that adapter with the script-owned bridge, avoiding a frontend-to-`scripts/` import.
- The round-trip integration project runs in Node with `tests/setupGlobals.js`, imports the actual `classDetailService` and `assignmentDefinitionPartialsService` source so `callApi` and their existing Zod parsing execute, and imports the existing frontend harness. It uses `.test.ts` files in a dedicated synthetic-test directory excluded from the root project's existing `.test.js` glob. This explicit runner boundary is required because the normal frontend Vitest project does not load the GAS globals required by backend code.
- The existing frontend GAS harness and backend dispatcher utilities remain their respective source of truth; no parallel callback, envelope, or JSON-stringification implementation may be added.

### Tooling validation boundary

- Script-owned code uses Node ESM and is covered by a dedicated root ESLint scope and a dedicated root Vitest integration/unit-test project. These checks are incorporated into `npm run lint`, `npm run lint:check`, `npm test`, and `npm run run-all-checks`.
- New tests live under `tests/` so they are tracked by the root test system. The integration project may import frontend service source only for test execution; the production frontend-to-backend import boundary remains unchanged.
- The existing `lint:backend`, `lint:frontend`, and `lint:builder` responsibilities remain runtime-specific. The synthetic-data tooling receives a separate Node tooling lint command rather than being treated as GAS backend or builder source.

### Proposed high-level tree

```text
scripts/
└── synthetic-test-data/
    ├── generation CLI and profile definitions
    ├── graph and documented-view generators
    ├── graph/serialisation validators
    ├── fixture loader
    └── Node-side apiHandler round-trip bridge

src/frontend/src/test/
└── syntheticApiRoundTripAdapter.ts

tests/__mocks__/data/
└── synthetic-analysis/
    ├── small compact transport profile + manifest
    ├── medium compact transport profile + manifest
    └── large representative projection + manifest
```

### Out of scope for this surface

- A UI, route, modal, settings surface, or production command endpoint.
- Backfilling all existing individual unit tests to use the corpus.
- Simulating Google Classroom, Drive, LLM, authentication, triggers, or configuration beyond the minimal test doubles required to execute a chosen backend API handler.
- Invalid-data fuzzing. Deliberately malformed payload fixtures remain an explicit, local test concern.

## Data loading and orchestration

### Required datasets or dependencies

- The `@faker-js/faker` development dependency.
- The existing data-shape contracts for ABClass, AssignmentDefinition, Assignment, Reference Data and the transport envelope.
- Existing frontend GAS harness and backend `apiHandler` test utilities.

### Fixture generation and loading policy

#### Regeneration

- A repository command regenerates all committed compact profiles from their recorded profile and seed.
- Regeneration must fail before modifying fixture files if a graph or serialisation invariant fails.
- A separate explicit mode writes the uncommitted large full persistence corpus to an ignored test-output location for stress tests. It must not silently replace committed compact data.

#### Test entry

- Focused backend and frontend tests load a named compact profile synchronously and immutably, then create only the local mutation copies they require.
- Stress tests explicitly request the full large profile; normal unit and frontend suites do not generate it by default.
- Tests needing a frontend service call use the round-trip bridge to select `getABClass` and `getAssignmentDefinitionPartials` generated transport views. The bridge invokes the actual backend dispatcher, returns through the existing GAS harness, and lets `callApi`, `classDetailService`, and `assignmentDefinitionPartialsService` perform normal production-side parsing before their results feed `DataAnalysisService`.

## Core behavioural model

### Profile guarantees

| Profile                         | Intended use                                                    | Required characteristics                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small                           | Fast correctness and contract tests                             | Minimal connected graph; explicit boundary examples including nulls, no-submission cases, score boundaries and both document types.                                                                                               |
| Medium                          | Typical analysis and service integration tests                  | Multiple year groups, topics, classes, assignments and varied completion/assessment patterns.                                                                                                                                     |
| Large representative projection | Fast representative transport, UI, and analysis selection tests | A committed, deterministic and schema-valid sample with a manifest declaring the canonical full large-profile parameters. It preserves every analysis state but deliberately does not claim 3,000 students or 10,000 assignments. |
| Large full                      | Explicit stress and performance tests                           | On-demand nested persistence/transport graph for the 3,000-student population: 100 classes, 30 students per class, 100 assignments per class, and the agreed four-band completion distribution.                                   |

### Referential-integrity rules

1. Each Year Group 7–30 has four or five of the 100 large-profile classes; each class has exactly 30 unique students.
2. Every class's generated `yearGroupKey`, optional `cohortKey`, and every definition's `primaryTopicKey`/`yearGroupKey` resolve in the same profile's reference-data view.
3. Each generated class assignment refers to an existing definition key. Its submissions only reference students on that class roster and task IDs declared by that definition.
4. Full persistence and transport representations of one graph agree on identifiers and semantic values; expected representation changes are limited to the documented response mappings and redactions.
5. The representative projection must remain independently valid for every transport schema it claims to represent. It may be smaller than the full population but must declare its entity counts and its relationship to the canonical large profile in its manifest.

### Round-trip state rules

1. A successful backend result must reach the frontend success handler as one JSON string, exactly once.
2. A backend failure envelope must be handled by `callApi` as an `ApiTransportError`; raw transport failures use the harness failure handler without JSON serialisation.
3. The bridge must create a fresh callback chain per request so concurrent calls cannot overwrite one another's handlers.
4. Void responses use envelope `data: null`, matching `apiHandler` behaviour and surviving JSON serialisation.
5. Each integration test must install and restore backend globals/dispatcher state in isolation; it must not leak a selected generated dataset or handler implementation into another test.

## Error, loading, and empty-state rules

### Generation failure

- Invalid input profile/seed, unsupported profile, a failed invariant, or an unwritable output path fails loudly with an actionable error and non-zero process status.
- The generator must not leave a partially replaced committed fixture set after failure.

### Round-trip failure

- The test bridge must surface backend errors, malformed envelopes, JSON parse failures and frontend Zod failures to the calling test. It must not catch-and-convert them into a synthetic success.

### Empty states

- The small and medium profiles include deliberate valid empty collections or no-submission branches where a documented API contract permits them. Empty data is a scenario in the corpus, not an omitted required field.

## Accessibility and usability notes

- No user-facing surface changes are in scope.
- Generated fixture labels should be clear, stable and visibly synthetic so test diagnostics remain readable.

## Backend changes required to support agreed behaviour

1. No production backend model, persistence, API handler, or transport-envelope change is required.
2. Backend test infrastructure must expose an isolated adapter path that supplies generated **transport** views through the established handler-seam globals before dispatch through the real `apiHandler`. It deliberately does not seed a mock database or re-run controllers and response mappers; dedicated backend tests retain responsibility for model/controller/mapper behaviour.

## Planning handoff notes

- No frontend layout specification is required: this work introduces test tooling and test-only infrastructure without changing a user-visible frontend layout or workflow.
- The action plan must document that production data shapes are unchanged. It must add planned-only shared-helper entries before implementation, but must not invent a new production contract file for the test corpus.
- The action plan must keep generated full-corpus output ignored and preserve only small, medium, and a representative compact large-projection fixture plus deterministic manifests in version control.
- The action plan must measure target module line counts before implementation. New files are preferred; the current 447-line `tests/helpers/mockFactories.js` and 366-line `tests/helpers/apiHandlerTestUtils.js` must not absorb a large new synthetic-data concern.
- `apiHandlerTestUtils.js` and `mockFactories.js` are reused by composition only. The bridge must be a new module; it must not append synthetic-data factories, graph logic, or transport logic to either existing helper.
- No `docs/developer/data-shapes/` entry is required before implementation because the feature changes no production persistence, validation, API, or transport contract. Implementation must confirm this remains true and document any discovered pre-existing discrepancy separately.

## Testing expectations

- Red-first tests verify deterministic re-generation byte-for-byte, profile manifests/counts, graph integrity, documented full/partial transformations, and JSON serialisability.
- Tests verify valid synthetic values through the existing backend model/API validation paths and through frontend service Zod validation after a real `apiHandler`/GAS-harness round trip.
- Tests cover the large-profile Year Group distribution, 30-student class size, 100 assignments per class, and weighted completion distribution.
- Tests prove success, error, void and overlapping request behaviour in the composed bridge.
- Focused test commands validate generator modules and fixture integrity; full stress generation is opt-in. Touched backend and frontend suites, lint, and build checks are run before delivery.

## Documentation and rollout notes

- Before implementation, add `Not implemented` shared-helper entries to `docs/developer/frontend/frontend-testing.md` for the frontend synthetic round-trip adapter and to `docs/developer/backend/backend-testing.md` for the corpus/dispatcher bridge. Reconcile both entries to implementation after delivery.
- Create `docs/developer/testing/synthetic-test-data.md` as the canonical architecture guide. It must document module and dependency ownership, the persistence/transport view graph, profile selection, manifests and seeds, fixture locations, regeneration and loader commands, compact/full lifecycle, ignored output, test-tier use, bridge composition, mutation isolation, failure modes, CI/stress-test policy, and safe removal/change constraints.
- Update `docs/developer/backend/backend-testing.md` and `docs/developer/frontend/frontend-testing.md` with the canonical-fixture directive: all new or changed tests use appropriate generated data when available; unsupported realistic data requires planned generator extension; invalid/boundary fixtures remain local; touched existing tests are refactored opportunistically. Document the backend/frontend-specific loading and round-trip paths.
- Update `.opencode/agents/planner.md` and `.opencode/agents/planner-reviewer.md` to require fixture-capability assessment, canonical-fixture selection or a generator-extension plan, and opportunistic migration planning for existing tests touched by a feature.
- Update `.opencode/agents/testing-specialist.md` with corpus commands, profile/view selection, canonical-fixture policy, bridge use, and opt-in full-large performance/stress generation. Update `.opencode/agents/code-reviewer.md` to verify appropriate canonical-fixture use in new or changed tests and that unsupported data has an explicit extension/exception rationale.
- Update relevant data-shape documents only if implementation discovers a current contract discrepancy; this feature does not itself change a production persistence, API, validation, or transport shape.
- A future explicit demo mode may consume the corpus but is a separately planned feature. It must not be activated by authentication failure.

## V1 scope recommendation

### Include in v1

- Faker-based deterministic graph generation and seed/profile manifests.
- Committed small, medium, and compact large analysis fixtures.
- On-demand large full-corpus generation for the agreed 3,000-student, 10,000-assignment population.
- Contract/graph validation and a reusable `apiHandler` round-trip bridge built on existing harnesses.
- Representative backend and frontend integration coverage proving the corpus and bridge.

### Defer from v1

- Full committed large persistence artefacts.
- Property-based invalid-payload fuzzing and randomly generated tests in CI.
- New production API endpoints or synthetic-data administration tooling.
- Synthetic implementations of out-of-scope internal stores and external Google services.
- E2E fixture delivery or public demo mode. A future explicit demo mode may consume this corpus, but normal authentication failures must remain fail-closed and must never silently activate demo data.
