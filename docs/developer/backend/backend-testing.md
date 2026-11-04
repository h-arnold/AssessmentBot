# Backend Testing

Guidance for writing and maintaining tests for the Google Apps Script (GAS) backend: the runtime model, test layout, harness rules, and the conventions that keep suites meaningful.

## Overview

AssessmentBot uses **Vitest** in a Node environment. Backend tests exercise logic, serialisation, state management, persistence workflows and error behaviour against mocked GAS services. They never call live GAS, Drive, Classroom or network services.

Production backend code is concatenated into one GAS script, not loaded as a Node module graph. Tests must adapt to that runtime model rather than making production files behave like Node modules.

Configuration lives in `vitest.config.js`, which defines four projects:

| Project                     | Includes                                       | Command                         |
| --------------------------- | ---------------------------------------------- | ------------------------------- |
| `node`                      | `tests/**/*.test.js`                           | `npm run test:backend`          |
| `synthetic-analysis`        | `tests/synthetic-analysis/**/*.test.ts`        | `npm run test:synthetic`        |
| `synthetic-analysis-stress` | `tests/synthetic-analysis-stress/**/*.test.ts` | `npm run test:synthetic:stress` |
| `plugins`                   | `.opencode/plugins/**/*.test.ts`               | `npm run test:plugins`          |

## Test Runtime Model

GAS concatenates backend files in filename order, so file order is part of runtime behaviour. Numeric prefixes encode that order:

| Prefix        | Role                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00_*`        | Foundational primitives and constants, loaded first                                                                                                           |
| `01_*`–`03_*` | Ordered support files used by later files                                                                                                                     |
| `98_*`        | Main implementation for a concern                                                                                                                             |
| `99_*`        | Legacy globals or thin entry helpers loaded after the implementation; do not add new transport here (see [API Layer](api-layer.md#relationship-to-globalsjs)) |
| `y_*`         | Controller layer                                                                                                                                              |
| `z_*`         | API and entry layer, loaded after controllers                                                                                                                 |

Rules:

- Do not rename numbered files, change prefixes, or renumber a file to make a test import resolve; load order is runtime behaviour.
- Load or expose prerequisites before dependent files in tests.
- Point tests at the real current file paths, not stale aliases.

### Production/test boundary

Production files stay GAS-first. The only permitted Node shim is a guarded export block at the end of the file:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    myFunction,
    MyClass,
  };
}
```

Do not add guarded `require()` calls near the top of runtime files to backfill globals for tests. Attach missing globals in `tests/setupGlobals.js` or a test helper instead, and keep production code reading:

```javascript
const STALE_REQUEST_AGE_MS =
  ACTIVE_REQUEST_STALE_MINUTES *
  RuntimeConstants.SECONDS_PER_MINUTE *
  RuntimeConstants.MS_PER_SECOND;
```

The test harness is responsible for:

- attaching globals GAS files expect;
- loading prerequisites in GAS order;
- mocking GAS services and internal singletons;
- keeping test-only configuration out of runtime source.

## Running Tests

```bash
# Backend suite
npm run test:backend

# Watch mode
npm run test:backend:watch

# One file
npm run test:backend -- tests/models/abclass.test.js

# One folder
npm run test:backend -- tests/models/

# Filter by test name
npm run test:backend -- -t "serialise"

# Synthetic-analysis suites
npm run test:synthetic

# Every project in sequence
npm test
```

## Coverage Gate

`npm run test:backend:coverage` enforces the global thresholds in `vitest.config.js`: 85% for statements, branches, functions and lines, measured by V8 across `src/backend/**/*.js`.

- Do not waive, suppress or lower a threshold to make the aggregate green.
- `npm run test:coverage` chains every project and stops at the first failing scope. Run each scope's `:coverage` command explicitly when you need results after an earlier failure.
- The regression checker is **not** a coverage gate. Its `backend-test-coverage-check` runs `npm run test:backend` without coverage, so it can pass while `npm run test:coverage` fails. Use the `:coverage` scripts as evidence, and do not reconfigure the checker to mask the gap.
- Read current totals from the coverage run. Do not copy historical figures into this document; they go stale quickly.

## Test Layout

| Path                               | Covers                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `tests/models/`                    | Domain models: serialisation, validation, hashing, business logic           |
| `tests/controllers/`               | Controller orchestration, persistence workflows, rehydration                |
| `tests/api/`                       | `z_Api` transport wrappers and dispatcher behaviour                         |
| `tests/api/apiHandler/`            | Allowlist, dispatcher routing, auth, envelopes, real-path dispatcher suites |
| `tests/backend-api/`               | Backend API units: mutation, validation and definition helpers              |
| `tests/requestHandlers/`           | LLM request handling, caching and image hydration                           |
| `tests/assignment/`                | Assignment state, factory creation, serialisation and persistence           |
| `tests/assessors/`                 | Spreadsheet and Sheets assessment logic                                     |
| `tests/parsers/`                   | Slides and Sheets document extraction and artifact creation                 |
| `tests/singletons/`                | Singleton lifecycle, idempotency and global-pollution guards                |
| `tests/configurationManager/`      | Configuration loading, saving and property serialisation                    |
| `tests/triggers/`                  | Trigger controller, handlers and required scopes                            |
| `tests/dbManager/`                 | Database manager and collection behaviour                                   |
| `tests/googleClassroom/`           | Classroom API client                                                        |
| `tests/googleDriveManager/`        | Drive facade, file and folder operations                                    |
| `tests/feedbackPopulators/`        | Sheets feedback population                                                  |
| `tests/y_controllers/`             | Assignment-definition controller task parsing and equivalence               |
| `tests/utils/`                     | Shared utilities, logging and validation                                    |
| `tests/synthetic-analysis/`        | Synthetic corpus generation, validation and round trips (TypeScript)        |
| `tests/synthetic-analysis-stress/` | Opt-in large-graph stress suites, excluded from normal runs                 |
| `tests/helpers/`                   | Shared harnesses, factories and mocks                                       |
| `tests/__mocks__/`, `tests/mocks/` | Committed mock data and domain mocks                                        |
| `tests/setupGlobals.js`            | Global environment installed before every backend and synthetic suite       |

## Canonical Synthetic Fixtures

When a test needs realistic analysis-domain data, use the deterministic synthetic corpus. All new or changed tests must use a canonical synthetic fixture when the corpus covers the scenario. For the directive, its exception path and the generator-extension process, see [Synthetic Test Data](../testing/synthetic-test-data.md#policy-canonical-fixtures-for-tests).

Load a committed view with `loadSyntheticAnalysisProfile(profileName, viewName)` from `scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js`. Views are deeply frozen; clone before adapting or mutating. For corpus topology, profile and view selection, mutation isolation and commands, see [Synthetic Test Data](../testing/synthetic-test-data.md).

### Backend model-input adapter

`scripts/synthetic-test-data/toBackendModelInputs.js` is test-only infrastructure. Production backend source must never import it. It changes no production contract.

- Export `loadBackendModelInputs(profileName)`. The profile name is required; use `'small'` by default and `'medium'` for wider variants.
- Return `{ classPartials, classesById, assignmentsByKey }` as independently cloned outputs. The adapter resolves definition views internally and shares no mutable nodes between outputs.
- Class-embedded assignments stay redacted partials with their raw `assignmentDefinitionKey`; the adapter attaches a cloned summary `assignmentDefinition` that `AssignmentDefinition.fromJSON()` accepts.
- Standalone `assignmentsByKey` records keep their full keyed-task definitions so `Assignment.toJSON()` still treats them as full.
- Genuine partial-only definitions stay partial. Never promote them or drop their assignments.
- Preserve raw canonical values, including `assignmentWeighting: null`. Any restoration-time normalisation belongs to the model constructor.
- Never feed a frontend assignment partial directly to `Assignment.fromJSON()`, and never mutate a frozen loader view.
- `ABClass.fromJSON()` does not hydrate `teachers[]`. Wrap owner restoration in `withTemporaryGlobals({ Teacher: () => Teacher }, ...)`; when a test needs the shared `Teacher.toJSON()` serialiser, materialise plain entries with `Teacher.fromJSON()` while composing the class. Do not add production teacher-array hydration.

Shared backend model-input assertions live in `tests/synthetic-analysis/backendModelInputAssertions.js`. They are not reachable through `#test-helpers/*`; import them relative to the suite. `expectMetadataNodesDetached(snapshots)` guards the metadata ownership-isolation contract across cloned copies.

### Import routes

| Specifier           | Maps to                                     | Use                                         |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| `#backend/*`        | `src/backend/*`                             | Backend CommonJS owners                     |
| `#synthetic-data/*` | `scripts/synthetic-test-data/*`             | ESM-only loader, adapter and bridge modules |
| `#test-helpers/*`   | `tests/helpers/*`                           | Shared test helpers                         |
| `#synthetic/*`      | `tests/__mocks__/data/synthetic-analysis/*` | Committed JSON views                        |

- Suites that consume bootstrap globals must load backend CommonJS owners through `#backend/*` with `require()`. Mixing static ESM backend imports with the bootstrap CommonJS globals creates duplicate module identities and silently splits coverage counters.
- The synthetic adapter and loader are ESM-only, so import them with static named `import` from `#synthetic-data/*`.
- `#test-helpers/*` resolves to CommonJS helpers. Use one route for a given helper within a suite; do not mix `require` and `import` of the same module.
- Relative imports may traverse at most one parent. Two or more parents require a configured alias. Nearby helpers reached as `../helpers/...` stay relative.

### Real-path dispatcher suites

`setupApiHandlerTestContext` deliberately stubs `ABClassController` and the transport helpers. Default stubs and prebuilt synthetic responses are not evidence of real domain validation.

When a suite claims a real dispatcher contract, start from the shared setup, then reinstall the real controller and real mutation/read handlers before dispatch, restoring all globals afterwards. `tests/api/apiHandler/dispatcher-integration.test.js` and `tests/api/apiHandler/abclassMetadataTestContext.js` show the pattern.

## API Layer Tests

API-layer tests (`tests/api/`, target `src/backend/z_Api`) cover thin boundary wrappers: delegation to the correct controller method, required parameters and fail-fast error propagation. Do not duplicate deep business logic at this level; cover it in controller and service suites.

Transport-level suite placement is pinned in [Frontend Testing § Test naming and traceability](../frontend/frontend-testing.md#test-naming-and-traceability).

## Suite-Specific Notes

Most suites are self-describing. The following splits are not obvious from filenames alone:

- **LLM terminal outcomes** are split by concern across `llmRequestManager.{eligibility,outcomes,failures,runStop,cache,cacheValidation,provenance}.test.js`. All share the real `BaseRequestManager`, `LLMRequestManager`, `Assessment` and item owners through `llmRequestManagerHarness.js`; run-stop scenarios additionally use `llmRunStopHarness.js`.
- **Image hydration** spans eight `imageManager*.test.js` suites, which share setup through `imageManagerTestHelpers.js`. Most are hermetic manager/model/transport probes. `imageManager.integration.test.js` connects the real `SlidesAssignment.processImages()` caller and controller/store seam, and `imageManagerPhase5.test.js` connects `processAllSubmissions()` extraction orchestration. Neither is durable-persistence or live-GAS evidence.
- **Reference-data controller** cases are split by responsibility into `referenceDataController.test.js` (cohorts) and the `yearGroups`, `assignmentTopics` and `transportResponses` companions, with setup helpers in `referenceDataTestSupport.js`.
- **Backend configuration transport** is covered by `tests/api/backendConfigApi.test.js`. Keep broader dispatcher and allowlist coverage in `tests/api/apiHandler/`.
- **Assignment persistence completion gate** is split across `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js` and `ABClassAssignmentOps.completionGate.test.js`. The unit file owns the criterion-map, coverage and shared-artefact rejection rows plus the prepared-projection and write-order cases. The completion-gate companion owns the marker-1 graph/source contradictions the gate must reject itself: task/submission identity mismatches, unknown-task items, an emptied task universe, missing structure, null-content hash contradictions, artefact identity/role faults, null-parent placeholder metadata/feedback, and the pre-write class-save rejection. Its rows restore the `small` canonical assignment, mutate one local invariant, and assert no store operation, no marker stamp and no serializer call before the hard rejection, so a rejection cannot be satisfied by a later partial-construction or wiring fault.
- **Completed-run failed-task counting** is covered by the `completed-run failed-item counting` block in `tests/controllers/assignmentController.hydration.test.js`. It restores the `medium` canonical assignment and pins once-per-item counting (four failed items across twelve error criteria), plus loud failures for missing submissions, items and assessments structures. The end-to-end completion feedback path, including the separate `N tasks failed.` progress detail, is covered by `tests/controllers/assignmentRunCompletion.test.js`.

## Test Conventions

- Name tests and helpers after the behaviour, domain or transport concept they verify. Do not name them after action-plan sections.
- Assert on observable outcomes: returned values, persisted payloads, emitted logs and envelope contents.
- Derive realistic class and assignment graphs from canonical fixtures. Do not invent them.
- Keep the real domain models, shared transport and normaliser in the chain when a suite claims their contract; mock only external seams such as LLM HTTP, the script cache and Drive.
- Treat hermetic stubs as boundary evidence only. They do not prove live GAS, network, cache-expiry, deployed-logging or durable-persistence behaviour.
- Prefer the shared factories and harnesses over ad-hoc mocks.
- Keep one behaviour per test and avoid ordering dependencies between tests.
- Model vendor-faithful DbManager results: an `_id`-only no-op `updateOne` operator patch (for example `$set`) counts as a match, while a query-filter no-op does not.
- Use British English in descriptions and comments.
- Remove temporary `console.*` debugging output before handing work back.

## Test Helpers

| Helper                        | Owns                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `mockFactories.js`            | GAS and service mocks, controller setup, collection and dual-store mocks |
| `modelFactories.js`           | Model and assignment factories                                           |
| `singletonTestSetup.js`       | Singleton harness and controlled GAS mocks                               |
| `apiHandlerTestUtils.js`      | Dispatcher context; controller and transport seam install/restore        |
| `globalMockManager.js`        | Saving, restoring and temporarily replacing globals                      |
| `testUtils.js`                | Small generic helpers                                                    |
| `llmRequestManagerHarness.js` | Real LLM runtime, native cache and model setup                           |
| `llmRunStopHarness.js`        | Canonical multi-item run-stop fixture                                    |

Remaining helpers are domain-specific and belong with their own suites: `assignmentDefinition*TestHelpers.js`, `backendConfigTestHelpers.js`, `controllerTestHelpers.js`, `driveManagerFacadeMocks.js`, `feedbackTestHelpers.js`, `imageManagerTestHelpers.js`, `slidesParserTestHarness.js` and `validationTestHelpers.js`.

`imageManagerTestHelpers.js` owns the shared setup for the eight `imageManager*.test.js` suites: the dummy and real `BaseRequestManager` global installers, `loadImageManager()`, `buildManager(overrides)`, the `imageArtifact`, `httpOutcome` and `networkOutcome` factories, the global-mock `beforeEach`/`afterEach` registrars, and the shared LLM-bypass expectation.

See the JSDoc in each helper for its API. Do not duplicate that reference here.

## Global Mocks

Never use bare `delete global.X` in cleanup. Deleting a global that `tests/setupGlobals.js` installed pollutes later suites and causes teardown failures.

Use `tests/helpers/globalMockManager.js` instead:

```javascript
import { withTemporaryGlobals } from '../helpers/globalMockManager.js';

it('uses a temporary global', () => {
  const result = withTemporaryGlobals({ ProgressTracker: () => mockProgressTracker }, () =>
    runCodeUnderTest()
  );

  expect(result).toBe('expected');
});
```

For multi-test suites, prefer the `mockGlobals` beforeEach/afterEach pair. For manual control, use `saveGlobals`/`restoreGlobals`. The helper's JSDoc documents every pattern.

`tests/setupGlobals.js` installs the base environment: `BaseSingleton`, core GAS-like globals (`Utils`, `Utilities`, `Logger`, `PropertiesService`, `LockService`, `CacheService`), error types, domain owners such as `ABClassMetadata`, `Assignment`, `TaskDefinition`, `ArtifactFactory`, and a lightweight `ProgressTracker` and `ClassroomManager`.

## Module Cache

Clear `require.cache` only when a module holds state that must reset between tests, such as singletons:

```javascript
beforeEach(() => {
  delete require.cache[require.resolve('#backend/Models/MySingleton.js')];
  MySingleton = require('#backend/Models/MySingleton.js');
});
```

Prefer `Singleton.resetForTests()` when the owner provides it (see [Singleton Pattern](singletons.md)); clear `require.cache` only when module state itself must be re-evaluated.

## Backend Logging Test Expectations

When backend logging behaviour or error boundaries change, add explicit regression coverage.

1. Add regression tests for critical logging boundaries.
2. For execution-log fidelity, assert at the logger-output seam (`ABLogger` → console), not only mocked logger calls.
3. Failure-path tests must verify both the transport or control-flow outcome and developer-log preservation.
4. When touching `apiHandler` failure paths, prove downstream logs stay visible and boundary logs follow policy without widening frontend error envelopes.

See [Backend Logging and Error Handling](backend-logging-and-error-handling.md) for the policy itself.

## Anti-Patterns

Treat these as regressions if they reappear.

### 1. Stale import paths

Use the real current path. The API layer lives in `src/backend/z_Api`, not `src/backend/Api`. Configuration files keep their numeric prefixes (`03_validators.js`, `98_ConfigurationManagerClass.js`). Use `#backend/*` for backend owners in new and touched suites.

### 2. Test fallbacks in production runtime code

Do not add guarded `require()` logic near the top of a GAS file to backfill globals. Attach the global in `tests/setupGlobals.js`; keep production files GAS-style apart from the guarded end-of-file export block.

### 3. Breaking numbered-file references

Numeric prefixes are part of the dependency contract. `require('./1_configKeysAndSchema')` is wrong when the file is `01_configKeysAndSchema.js`.

### 4. Naming tests after action-plan sections

Avoid `describe('Section 1 transport', ...)`, `SECTION_1_API_METHOD_NAMES` and similar. Use behaviour-focused names. Rename legacy section-based names when you next touch those tests.

### 5. Deleting globals without restoring

Do not `delete global.X` in `afterEach`. Save and restore with `globalMockManager` (see [Global Mocks](#global-mocks)).

## Frontend Tests

Frontend unit and E2E tests have their own tooling and policy. See [Frontend Testing](../frontend/frontend-testing.md).
