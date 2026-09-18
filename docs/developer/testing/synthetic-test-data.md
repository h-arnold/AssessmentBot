# Synthetic Test Data

## Purpose and audience

The synthetic test data system generates deterministic, relationally valid analysis-domain fixtures for backend, frontend, and analysis tests.

Use this document as the canonical source of truth for the corpus architecture, profile selection, commands, and fixture policy. The backend and frontend testing guides link here and describe only their own loading and round-trip paths.

The corpus is **test-only infrastructure**. It is not a production persistence, API, validation, or transport contract, and no Google Apps Script runtime source may import it.

## Scope and non-goals

In scope:

- deterministic generation of the analysis graph (reference data, classes, definitions, assignments, submissions, assessments, feedback, task artefacts);
- committed compact transport profiles plus an on-demand large stress profile;
- a test-only `apiHandler` round-trip path that exercises the real dispatcher and the existing GAS serialisation harness.

Out of scope:

- production backend, frontend, persistence, validation, API, or transport changes;
- a deployed synthetic-data API, UI, route, or demo mode;
- simulating Google Classroom, Drive, LLM, authentication, triggers, or configuration;
- malformed-data fuzzing: deliberately invalid or boundary fixtures stay local.

## Topology and ownership

| Concern                       | Location                                                           | Notes                                                                                        |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Profile definitions and seeds | `scripts/synthetic-test-data/profileDefinitions.js`                | `PROFILE_NAMES`, `getProfileDefinition`, large-full constants and completion bands.          |
| Graph generators              | `scripts/synthetic-test-data/generate*.js`                         | Deterministic reference data, definitions, rosters, assignments, submissions.                |
| Transport projection          | `scripts/synthetic-test-data/toTransportViews.js`                  | Projects the persistence graph into the five named transport views.                          |
| Validation                    | `scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js`    | Reference integrity, redaction, serialisability, and profile-count invariants.               |
| Staged writer                 | `scripts/synthetic-test-data/fixtureWriter.js`                     | Validates, stages, and atomically replaces committed profiles.                               |
| Regeneration CLI              | `scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js` | Compact regeneration and the explicit full mode.                                             |
| Immutable loader              | `scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js`      | Synchronously reads a named committed view and deep-freezes it.                              |
| Dispatcher round-trip bridge  | `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`         | Installs `apiHandlerTestUtils` seams, dispatches the real `apiHandler`, restores every seam. |
| Frontend round-trip adapter   | `src/frontend/src/test/syntheticApiRoundTripAdapter.ts`            | Composes the in-tree `googleScriptRunHarness`; imports no `scripts/` code.                   |
| Committed fixtures            | `tests/__mocks__/data/synthetic-analysis/<profile>/`               | Transport views and manifest only.                                                           |
| Ignored full output           | `.opencode/scratchpad/synthetic-analysis-full/`                    | On-demand large-full transport/manifest output; never committed.                             |
| Integration project           | `tests/synthetic-analysis/**/*.test.ts`                            | Node Vitest project with the GAS globals from `tests/setupGlobals.js`.                       |
| Stress project                | `tests/synthetic-analysis-stress/**/*.test.ts`                     | Opt-in full-large suite with a raised timeout budget.                                        |

Dependency direction:

- GAS runtime source never imports `scripts/synthetic-test-data/`.
- Production frontend source never imports `scripts/` or `src/frontend/src/test/**`.
- The Node integration spec owns composition: it imports the script-owned bridge **and** the frontend adapter, then installs `google.script.run`. Neither production side gains a cross-package import.

## Graph model and named views

The generator returns one connected graph per profile with these logical views:

| View                                     | Content                                                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                               | Schema version, profile name, seed, own entity counts; the representative projection also records the canonical full-large parameters.                                                                                            |
| `referenceData`                          | Cohorts, Year Groups, and assignment topics.                                                                                                                                                                                      |
| `persistence`                            | In-memory logical graph for every profile: full nested class, definition, assignment, submission, assessment, feedback, and task-artefact records. Never persisted; both CLI modes write only the transport/manifest files below. |
| `transport.classPartials`                | Class partial rows.                                                                                                                                                                                                               |
| `transport.assignmentDefinitionPartials` | Definition partials consumed by the assignment-definition service.                                                                                                                                                                |
| `transport.editableDefinitions`          | Full editable definitions keyed by `definitionKey`, shaped by the backend response-mapper transformation (lightweight task arrays, freshness fields omitted). Full definitions only; partial-only registry rows are excluded.     |
| `transport.classesById`                  | `ClassFull` responses keyed by class identifier, as returned by `getABClass`.                                                                                                                                                     |
| `transport.assignmentsByKey`             | `AssignmentFull` views keyed by assignment identifier.                                                                                                                                                                            |

Both compact and full CLI modes persist only six files, projected from the logical model: the manifest and five transport views. Neither mode writes the `persistence` view. File names are defined once in `fixtureWriter.js` (`PROFILE_VIEW_FILE_NAMES`) and shared by the writer and loader so they cannot drift:

- `manifest.json`
- `classPartials.json`
- `assignmentDefinitionPartials.json`
- `editableDefinitions.json`
- `classesById.json`
- `assignmentsByKey.json`

A partial-only definition registry row cannot hydrate into a full assignment, so it appears only in the class partial view and never in `assignmentsByKey`.

## Profiles and seeds

Each profile name and its fixed integer seed identify a corpus exactly. Seeds are distinct per profile so a seed change is observable as changed synthetic values while all invariants still hold.

| Profile                |  Seed | Classes | Students per class | Assignments per class | Year groups | Committed               |
| ---------------------- | ----: | ------: | -----------------: | --------------------: | ----------: | ----------------------- |
| `small`                | 17031 |       3 |                  6 |                     4 |           3 | Yes                     |
| `medium`               | 28042 |       4 |                 12 |                     6 |           4 | Yes                     |
| `large-representative` | 39053 |       4 |                  6 |                     5 |           4 | Yes                     |
| `large-full`           | 41064 |     100 |                 30 |                   100 |          24 | No; generated on demand |

The `large-full` profile represents 3,000 students across 100 classes of 30, distributed four or five per Year Group 7–30, with 100 assignments per class. Each class applies the documented 5%/10%/70%/15% completion bands, derived from the class roster and generated submissions rather than stored as a persistence or transport field.

The `large-representative` projection is deliberately small. Its manifest declares its own entity counts **and** the canonical full-large parameters, so it must never be treated as a substitute for the full stress graph.

## Manifests and seeds

Committed manifests record `schemaVersion`, `profile`, `seed`, and `generatedEntityCounts`. The representative manifest additionally records `canonicalFullProfile` (`classCount`, `studentsPerClass`, `assignmentsPerClass`, `yearGroupCount`).

Generation never emits a volatile timestamp. Re-running a profile with its recorded seed reproduces every committed byte exactly.

`generateSyntheticAnalysisGraph(profileName, { seed })` accepts an optional finite-integer seed override for determinism and seed-sensitivity tests. A non-integer seed fails loudly.

## Person-name invariant

`generateClassRosters.js` strips a single leading honourific token — one of `Mr`, `Mrs`, `Miss`, `Ms`, `Dr`, `Prof` (tolerating a trailing full stop, for example `Mrs.`) — from each Faker-generated student and teacher name. Only the leading token is ever removed; every other token, including Faker suffix tokens such as `DDS` or `MD`, is preserved unchanged.

Committed compact fixtures therefore contain no roster or teacher name beginning with any of those honourifics. Do not hand-craft name fixtures that bypass the generator.

Any generator change affecting names requires regenerating the committed profiles with `npm run fixtures:synthetic`, committing only the fixture files that actually change, and keeping regeneration byte-for-byte reproducible per the committed-fixture comparison spec.

## Compact versus full lifecycle

- **Compact (committed):** small, medium, and large-representative transport views plus manifests are checked in under `tests/__mocks__/data/synthetic-analysis/`. Regeneration stages and validates every profile before replacing any committed directory, and rolls every applied replacement back if a later one fails.
- **Full (ignored):** `large-full` is generated on demand under `.opencode/scratchpad/synthetic-analysis-full/` for stress tests. It writes the same six transport/manifest files as compact mode; its nested `persistence` graph stays in memory. The CLI rejects any output root that resolves outside the permitted root, following symlinks in every existing ancestor, so a link inside the root cannot redirect a write outside it. Full mode never overwrites committed representative data.

## Commands

| Command                           | Purpose                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run fixtures:synthetic`      | Regenerate the committed small, medium, and large-representative profiles from their recorded seeds. |
| `npm run fixtures:synthetic:full` | Generate the uncommitted large-full transport views and manifest under the ignored full-output root. |
| `npm run test:synthetic`          | Run the synthetic Node integration project.                                                          |
| `npm run test:synthetic:coverage` | Run the synthetic project with coverage limited to `scripts/synthetic-test-data/**/*.js`.            |
| `npm run test:synthetic:stress`   | Opt-in stress run of the full-large profile.                                                         |
| `npm run lint:synthetic`          | Lint the synthetic scripts and specs with `--fix`.                                                   |
| `npm run lint:synthetic:check`    | Lint the synthetic scripts and specs with a zero-warning budget.                                     |

The synthetic checks are wired into the aggregate commands: `lint` and `lint:check` include the synthetic lint scopes, `test` includes `test:synthetic`, and `test:coverage` includes `test:synthetic:coverage`.

## Loading and mutation isolation

- `loadSyntheticAnalysisProfile(profileName, viewName)` reads one committed view synchronously and recursively deep-freezes it. It rejects unsupported profile or view names, and it rejects `large-full` because that profile is generated, never committed.
- Consumers must clone a loaded view before local mutation, because the loader returns shared frozen data.
- The round-trip bridge installs and restores every `apiHandlerTestUtils` dispatcher seam per call, so overlapping requests cannot leak a selected data set or handler implementation into another test.

## Dispatcher round-trip bridge

The bridge composes existing test seams rather than reimplementing envelope behaviour:

1. It loads the committed `classesById`, `assignmentDefinitionPartials`, and `editableDefinitions` views.
2. Per call, it installs isolated `apiHandlerTestUtils` controller/transport seams that supply those transport views (including the `getAssignmentDefinition_` seam backed by `editableDefinitions`).
3. It dispatches once through the real `apiHandler`.
4. It restores every seam before invoking the caller's callback.

Round-trip semantics:

- A backend success envelope travels through the success path and is JSON-stringified exactly once by the frontend `googleScriptRunHarness`.
- A backend failure envelope reaches `callApi` as an `ApiTransportError`; a raw transport failure is delivered raw through the harness failure handler without JSON serialisation.
- Void responses resolve from envelope `data: null`, matching `apiHandler` behaviour.
- Malformed JSON or a malformed-but-enveloped payload surfaces the existing parser or Zod error; the bridge never converts a failure into a synthetic success.

The test path exercises the complete production transport chain — `callApi`, service Zod schemas, and `DataAnalysisService` input — except real GAS hosting.

## Error behaviour

- Invalid profile names, unsupported views, invalid seeds, failed invariants, and unwritable output paths fail loudly with an actionable error.
- A generation, validation, serialisation, or staging-write failure leaves the existing committed profile set untouched.
- The CLI reports malformed invocations on stderr and sets a non-zero exit code.
- Tests must assert a `null` `getABClass` result as a distinct not-found branch and never pass it to `DataAnalysisService`.

## Policy: canonical fixtures for tests

**Canonical-fixture directive:** All new or changed tests must use an appropriate canonical synthetic fixture when the synthetic fixture system provides data for the scenario. If the required realistic data is not yet supported, the test may use a local realistic fixture only when the owning feature work records a generator-extension plan. Deliberately invalid or boundary fixtures remain local. When you otherwise touch an existing test, migrate it to a canonical fixture opportunistically. This policy is intentionally broader than the analysis graph: it applies automatically as later domains are added, and it does not require a wholesale fixture migration.

**Exception and extension path:** A local realistic fixture is permitted only when no canonical profile or view covers the required scenario. The owning feature work must then record a generator-extension plan — which profile, view, or generator stage to add and where — before or alongside the test, so the gap is tracked rather than hidden. Invalid-data, boundary, and narrowly targeted cases never need canonical fixtures.

## CI and stress policy

- CI runs the compact synthetic project through the aggregate lint, test, and coverage commands.
- The full-large stress suite is opt-in via `test:synthetic:stress` and is not part of `test`, `test:coverage`, or `run-all-checks`.
- The stress project has an explicit raised timeout budget because the full graph is intentionally large.
- Committed fixture regeneration must stay byte-for-byte reproducible: a mismatch fails the committed-fixture comparison spec.

## Safe change and removal

To add or change a profile or view:

1. Update `profileDefinitions.js` (profile parameters and seed) and, for a new persisted view, `PROFILE_VIEW_FILE_NAMES` in `fixtureWriter.js`.
2. Regenerate committed fixtures with `npm run fixtures:synthetic` and commit the changed files.
3. Update this guide and any affected invariant documentation in the same change.

To remove the system:

1. Remove the `scripts/synthetic-test-data/` and `tests/synthetic-analysis/` trees, the committed fixtures, and the `tests/synthetic-analysis-stress/` suite.
2. Remove the synthetic lint scopes and Vitest projects from `eslint.config.js` and `vitest.config.js`.
3. Remove the synthetic commands from `package.json` and the ignored full-output path from `.gitignore`.
4. Remove `src/frontend/src/test/syntheticApiRoundTripAdapter.ts` and confirm no remaining test imports it.
5. Remove this guide and the backend/frontend links to it.

## Related documentation

- [Backend Testing](../backend/backend-testing.md) — backend loading path and dispatcher-seam composition.
- [Frontend Testing](../frontend/frontend-testing.md) — frontend adapter and consumer-schema path.
- [Data Shapes Index](../data-shapes/INDEX.md) — authoritative persistence, transport, and validation contracts the corpus conforms to.
