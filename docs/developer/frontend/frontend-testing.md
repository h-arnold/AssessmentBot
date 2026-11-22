# Frontend Testing Guidelines

## Overview

Frontend testing uses two layers:

- **Unit/component tests** with Vitest + Testing Library — this document covers these.
- **Browser end-to-end tests** with Playwright — see `docs/developer/frontend/frontend-playwright-e2e.md`.

This document focuses on Vitest patterns. For E2E test patterns, runtime mock infrastructure,
antd interaction helpers, and Playwright best practices, use the Playwright E2E guide.

## Commands

From repository root:

```bash
# Frontend unit/component tests
npm run test:frontend

# Frontend tests in watch mode
npm run test:frontend:watch

# Frontend unit/component coverage check
npm run test:frontend:coverage

# Type-check the frontend app, Node tooling, and E2E projects (see ../builder/TypeScriptAndLintConfigHierarchy.md)
npm run typecheck:all
```

Target a specific unit test pattern:

```bash
npm run test:frontend -- src/App/App.navigation.spec.tsx
```

## Behaviour split: Vitest vs Playwright (authoritative)

Use a strict behaviour split when writing frontend tests:

- **Vitest + Testing Library**: verify **invisible behaviour** and fast component logic checks.
  - state transitions
  - callback wiring
  - conditional rendering decisions
  - data mapping and error mapping outcomes
  - accessibility attributes and semantic structure
- **Playwright**: verify **visible behaviour** in a real browser.
  - what users can see and do end-to-end
  - interactive flows across multiple components/pages
  - keyboard and pointer interaction in runtime context
  - visual state transitions (for example collapsed/expanded navigation, light/dark mode switching)

When both are possible, default to Vitest first for fast feedback, then add Playwright coverage for the highest-value user journeys.
Vitest + Testing Library may still assert user-visible component outcomes; use Playwright when the confidence target is full browser/runtime behaviour across integration boundaries.

**Mandatory rule:** every new or changed **user-visible interaction** must have Playwright coverage.

Do not treat Vitest coverage as sufficient for visible browser behaviour such as:

- clicks
- keyboard interaction
- tab switching
- toggles
- navigation

Where a Vitest test covers visible rendering, add or update a Playwright test that exercises the same interaction in a real browser so visible interaction coverage remains as comprehensive as the supporting Vitest coverage.

### Quick decision matrix

- Is the assertion mostly about internal state or non-visual wiring? → **Vitest**.
- Is the assertion about what a user sees or does in a browser? → **Playwright**.
- Is it a cross-page or runtime integration flow? → **Playwright**.
- Is it pure mapping/derivation logic? → **Vitest**.

### Example split for shell/navigation work

- **Vitest examples (invisible behaviour):**
  - selected menu key updates when a nav item is triggered
  - breadcrumb model derives labels from shared nav metadata
  - theme toggle flips algorithm state in `ConfigProvider`
- **Playwright examples (visible behaviour):**
  - user can click nav items and sees page headings update
  - user sees sidenav collapse/expand after activating hamburger control
  - user sees light/dark mode switch reflected in the rendered UI
  - user sees motion disabled or minimal when reduced-motion preference is active

### Example split for the task-preview source link

The source link's duplicated interaction coverage belongs in the layer that exercises it.

- **Vitest owns the keyboard and focus-readiness matrix.** `TaskMetricPreviewCell.focus.spec.tsx`, `TaskMetricPreviewCell.focusSession.spec.tsx` and `TaskMetricPreviewCell.openChange.spec.tsx` render the real portal and preview card.
- **Playwright owns the browser-visible behaviour.** `task-preview-source-link.spec.ts`, `task-preview-source-link.states.spec.ts` and `task-preview-source-link.visual.spec.ts` cover the tooltip, outgoing editor URL, navigation, source-URL boundaries, unavailable-source rendering and measured layout.

When adding coverage to a duplicated interaction matrix, extend the unit suite. Add an E2E case only when the assertion needs a real browser: layout geometry, native navigation, tooltips, or cross-component runtime integration.

### Example split for error-aware task previews

The preview's error states split the same way.

- **Vitest owns the state matrix.** `TaskPreviewCard.errors.spec.tsx`, `TaskMetricPreviewContent.spec.tsx`, `assembleTaskPreviewData.errors.spec.ts`, `assembleMergedPreviewData.errors.spec.ts`, `heatmapsPreviewQueries.spec.ts`, `buildCellPreviewLookup.errors.spec.ts` and `useHeatmapsPageData.knownErrorPreview.spec.ts` cover card source-region states, body decisions, derivation precedence and the hook-level known-error material.
- **Playwright owns the browser journeys.** `assessment-error-previews.spec.ts`, `assessment-error-merged-previews.spec.ts` and `legacy-assignment-results.spec.ts` cover the embedded, standalone and legacy read surfaces. See [Assessment-error preview journeys](frontend-playwright-e2e.md#shared-helpers-and-imports) for the journeys and their shared helpers.

Keep the state matrix in Vitest and the browser journeys in Playwright; a browser journey must not drive weakened unit assertions.

### Example split for the Select Add new command

`SelectWithAddNew` appends an `Add new` sentinel that dispatches a command rather than selecting a value. Keep the split strict.

- **Vitest owns the command and value matrix.** `SelectWithAddNew.spec.tsx`, `SelectWithAddNew.integration.spec.tsx` and `ClassesManagementPanel.addNew.spec.tsx` render the real `Select` and modal boundaries.
- **Playwright owns the browser journey.** `select-with-add-new-workflow.spec.ts` verifies what only a real browser shows: the accessible names of the stacked dialogs, close motion and the create-and-auto-select journey.

Keep mocks, fixed sleeps, timer advances and weakened retries out of these specs. A delayed assertion is a defect to diagnose.

## Test naming and traceability

Name frontend tests after the behaviour, component, hook, or service they verify.

Avoid temporary planning labels in test names and helpers. In particular, do not use action-plan section numbering such as `Section 1`, `Section 2`, or similar in `describe(...)` blocks, test titles, constants, or fixture names. This is a repository-wide rule and applies even when tests are written directly from an action plan. Those labels become misleading as plans evolve or are deleted.

Prefer names such as `getBackendConfig rejects malformed payloads` or `Configuration service calls callApi with the backend method name` over names that refer only to a planning document.

When frontend work depends on backend configuration transport behaviour, keep the layers separate:

- frontend service validation and `callApi` usage belong in `src/frontend/src/services/backendConfiguration/backendConfigurationService.spec.ts`
- dedicated backend configuration transport coverage belongs in `tests/api/backendConfigApi.test.js`
- broader backend dispatcher coverage lives in `tests/api/apiHandler/` (dispatcher-\*.test.js files) and `tests/api/apiHandlerLocking.test.js`

For assignment-definition transport work, keep the same split:

- frontend service validation and `callApi` usage belong in `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.spec.ts`
- frontend schema-contract coverage belongs in `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts`
- dedicated backend transport coverage belongs in `tests/backend-api/assignmentDefinitionPartials.transport.test.js` and `tests/api/assignmentDefinitionDeleteApi.test.js`

For ABClass metadata contract work, keep the same split:

- frontend schema coverage belongs in `src/frontend/src/services/abClass/abClassMetadata.zod.spec.ts`, using the frozen canonical selectors in `src/frontend/src/test/abClass/abClassMetadataFixtures.ts` (clone with `cloneMetadata` before any deliberate mutation)
- frontend/backend acceptance parity belongs in `tests/synthetic-analysis/syntheticABClassMetadataFrontendParity.test.ts`, which generates the analysis graph directly by profile, imports the real backend `ABClassMetadata.validateMetadata` test-locally, and compares backend and frontend acceptance across generated snapshots plus strict raw-object, score, identifier and timestamp boundary probes. The parity suite does not import the frontend selectors; the two suites cover the same contract independently.
- generator and raw-validator coverage belongs in `tests/synthetic-analysis/syntheticABClassMetadataGeneratorValidator.test.ts`: deterministic five-field generation plus raw-validator acceptance of legacy and current shapes and rejection of malformed nested fields. The parity suite compares acceptance across both sides; this suite pins the generator and raw validator directly.
- five-field dispatcher read/write round-trip coverage belongs in `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts` (see [Post-analysis metadata browser and Node integration coverage](#post-analysis-metadata-browser-and-node-integration-coverage)). Keep these suites split by responsibility rather than merging them.
- backend transport coverage belongs in `tests/api/apiHandler/abclassMetadata*.test.js` and `tests/api/abclassMetadataApi.test.js`

Class-read metadata adoption is covered by responsibility:

- class-read schema suites: `classDetailService.zod.full.spec.ts`, `.submissions.spec.ts`, `.definitions.spec.ts` and `.metadataIntegration.spec.ts`, sharing wire fixtures in `src/frontend/src/test/abClass/classDetailSchemaFixtures.ts`. `metadataIntegration` owns required-nullable retention, missing/malformed rejection, unrelated-field stripping and unchanged-analysis assertions.
- service wrappers: `classDetailService.spec.ts` and `classPartialsService.spec.ts` parse real metadata-bearing responses; do not replace `parseApiResponse` with an always-successful stub that could hide field loss.
- cross-read service contract: `src/frontend/src/services/googleClassrooms/classReadServices.metadata.spec.ts` mocks only `callApi`, retaining the real `parseApiResponse` and response schemas. It compares detached full/partial metadata across all three canonical profiles, rejects missing/undefined/malformed metadata with method-specific diagnostics, preserves unrelated-field stripping and distinguishes not-found null, metadata null and empty lists. Transport failures preserve the original `ApiTransportError` identity, code, request correlation and retryability without being relabelled as parser failures.
- grouped ClassesPage model suites: `classesPageModel.base.spec.ts`, `.sorting.spec.ts` and `.validation.spec.ts`, sharing `classesPageModelTestSupport.ts`.
- ClassesPage component suites: `ClassesPage.spec.tsx` owns loading, trust, recovery and empty states; `.grouping.spec.tsx`, `.cards.spec.tsx`, `.refresh.spec.tsx` and `.shell.spec.tsx` own their named responsibilities. Shared registration lives in `ClassesPage.mockSetup.ts`, typed mock handles/reset in `classesPageComponentTestSetup.ts`, and independent readiness/failure/trust fixtures in `classesPageWarmupFixtures.ts` (all under `src/frontend/src/test/classes/`). Import registration before mocked consumers; keep the refresh-only React Query override local to its suite.
- heatmap projection suites: `heatmapAdapter.spec.ts` and `heatmapAdapter.weighting.spec.ts`, sharing `heatmapAdapterTestSetup.ts`.

Frontend production code must never import backend modules for this contract; the Node parity suite is the only place both sides meet.

ABClass mutation tests keep admission and response parsing real:

- `services/abClass/abClassMutations.zod.spec.ts` covers required non-null string cohort/year-group keys for upsert (null rejects), optional nullable update keys, safe identifiers/course lengths, all protected fields, own undefined (including mixed valid edits), and omitted/null/whole-replacement metadata for both mutations. Nested patches reject; parsed snapshots detach from caller input.
- `services/abClass/abClassMutationService.spec.ts` mocks only `callApi`, retaining the actual queue, request schemas and `parseApiResponse`.
- Shared canonical request/response factories live in `src/test/abClass/abClassMutationFixtures.ts`. Upsert configuration selects committed `small` class-0 with both keys non-null; response selection is independent and may retain nullable configuration keys. Complete replacements use shared canonical metadata; keep deliberate invalid/boundary probes local. Parameterised registrations must execute every row, not merely type-check. Test upsert null-key rejection before enqueue/network separately from update null-key preservation and omission; never replace an explicit null with a fixture fallback.

Queued wrappers must not be awaited inside an active same-lane reservation. Test
reserved-slot writers with direct `callApi` execution and the shared schemas/parser,
not a nested queued wrapper that would deadlock.

### Metadata refresh task and writer tests

The task/writer coverage is split across eight suites:

- `services/dataAnalysis/postAnalysis/metadataProjection.freshness.spec.ts` and
  `metadataProjection.merge.spec.ts`: timestamp gate, exact score/marker mapping,
  detached stable rolling merge and instance IDs.
- `services/dataAnalysis/postAnalysis/refreshABClassMetadata.spec.ts`: cheap
  cached no-ops before queue/network/calculation/clock and timestamp-driven refresh.
- `services/abClass/abClassMetadataService.{calculation,queue,failure,evidence}.spec.ts`:
  fresh-read ordering/recheck, full standard-weight scope, isolated target,
  request/response validation, interleaved owners, failure identity/lane release
  and independent raw-assessment numeric expectations.
- `services/abClass/abClassMetadataService.summaryConsumption.spec.ts`: the writer
  consumes one `ClassSummary`, with target and recent-assignment selection,
  five-field request mapping, clear-on-null and whole replacement.

Shared support is in `src/test/abClass/metadataRefreshFixtures.ts`,
`metadataRefreshTransport.ts` and `metadataEvidenceOracle.ts`. Transport support
uses the shared GAS harness with the real transport, schemas and queue; it is not
real backend dispatcher coverage. The numeric oracle reads assessment evidence
and live weights independently of production calculation/projection; supplied
metadata scores are never an oracle. Other scope/projection assertions also use
the real analyser, so do not present those alone as independent arithmetic proof.

Class-summary analysis and schema coverage sits beside its subject:

- `services/dataAnalysis/classSummaryAnalyser.spec.ts`: composition with `AveragingAnalyser`,
  absolute-mode all-tasks pinning, disjoint top/bottom ranking, tie-break and per-assignment
  score alignment.
- `services/dataAnalysis/classSummaryAnalyser.boundary.spec.ts`: local boundary fixtures,
  baseline unavailability and error propagation for `AttemptBaselineUnavailableError`.
- `services/dataAnalysis/classSummary.zod.spec.ts`: the strict in-memory `ClassSummarySchema`,
  including its disjointness and score-alignment refinements.

Success inputs are **explicit historical-source boundary clones**: the compact
classes ship a null submission `studentName` in their newest assignment, which
existing isolated analysis rejects. The clones omit only the final assignment,
preserving remaining names and scores. Untouched canonical failure probes assert
rejection without write or clock access and with lane release. Exact selected versions and scope limitations are
recorded in [Synthetic Test Data](../testing/synthetic-test-data.md#metadata-refresh-analysis-boundaries).
Invalidation and feedback coverage is described below.

### Shared post-analysis lifecycle tests

The generic lifecycle, feedback and invalidation coverage is split by responsibility:

- `services/dataAnalysis/postAnalysis/postAnalysis.zod.spec.ts`: detached complete
  source context, matching class identity, selected display evidence and strict
  serialisable outcome data without callbacks or technical Errors.
- `runPostAnalysisTasks.spec.ts` in that folder: awaited ordering, duplicate-ID
  rejection before work, empty descriptor list, failure isolation and local Error identity.
- `postAnalysisTasks.spec.ts`: canonical task ID/descriptor factory, newest-first/ascending-ID
  comparator ordering, lazy factory-supplied clock, confirmed-save mapping and source keys
  independent of metadata/live weights, including raw attempt identity when a source
  timestamp is non-canonical.
- `hooks/usePagePostAnalysisTasks.spec.tsx`: shared page eligibility, memoised ready-only
  context, `null` for each missing input, stable descriptor identity and retained
  selected-class ownership when readiness becomes blocking.
- `hooks/usePostAnalysisTasks.state.spec.tsx`: post-commit/null gating, pending state
  and individually reported failures without replacing successful analysis.
- `hooks/usePostAnalysisTasks.lifecycle.spec.tsx`: pending StrictMode reattachment,
  stale completion suppression on navigation/null/unmount and newer-source races.
- `hooks/usePostAnalysisTasks.extensions.spec.tsx`: mount-wide keyed attempt memory,
  including failures and class navigation, new-version/remount permission, null-timestamp
  source identity, and a local unkeyed task continuing independently of metadata
  skip/failure. Throwing source-key computation preserves Error identity or normalises
  scalar failures, caches the failed attempt and still allows later independent work.
- `features/classPage/useClassPageData.postAnalysis.spec.ts` and
  `features/taskHeatmap/useHeatmapsPageData.postAnalysis.spec.ts`: mock
  only the lower-level lifecycle hook and prove each feature's shared page hook passes
  the complete unsliced class, live definitions, the successful averaging result, the
  appropriate class ID — committed for the class page, deferred for Heatmaps — and the
  stable descriptor list from the canonical factory,
  or `null` for loading/failure/adaptation-blocking surfaces. Both include a
  memoised-context identity case so an unstable object cannot re-attach the effect
  each render. These bind features only; lifecycle contracts stay in the hook suites.

The harness is `src/test/abClass/postAnalysisHookTestSupport.tsx`; realistic contexts
reuse the existing metadata refresh fixtures and their historical-source limitation.
It mounts the real Ant Design `App` host, because the notification host is required and
production has no missing-host fallback. Ordering/failure/extension probes are local
descriptors, not future production tasks. Use explicit promise gates for
pending/replay/cleanup checks. Cleanup only suppresses state publication. Future task tests
must cover their own key and eligibility rules; metadata freshness is never a global gate.
See the
[registration contract](data-analysis-architecture.md#shared-post-analysis-lifecycle-and-extension).

These suites render the real context-aware Ant Design `App` host and use the
real query client through `src/test/abClass/postAnalysisFeedbackTestSupport.tsx`:

- `hooks/usePostAnalysisTasks.feedback.spec.tsx` covers persistent polite safe copy,
  focus preservation, dismissal memory/new-source feedback, bounded diagnostics and
  the completion-boundary diagnostic emitted when the required notification host is
  missing.
- `.feedbackCleanup.spec.tsx` covers same-source persistence, owner-only cleanup,
  shared-host siblings, active work finishing without late publication, and retention
  of a shown warning while analysis readiness is temporarily `null` for the same
  selected class.
- `.invalidation.spec.tsx` covers confirmed-save-only detail/list invalidation,
  both settlements, once-per-attempt replay and retained save confirmation.
- `.activeQueries.spec.tsx` subscribes real `QueryObserver`s to prove both active
  refetch failures are observable, independent work continues, and inactive queries
  become stale without fetching unrelated datasets or using imperative reads.

HappyDOM does not run notification CSS animations. After a real dismissal or
cleanup, `completeNotificationLeave` waits for the actual leave-active class,
dispatches `animationend` inside `act`, then asserts actual DOM removal. Do not
disable production motion, manufacture a leave or weaken removal assertions.

Playwright runtime types and the dispatch inventory register `upsertABClass` and
`updateABClass`. The Heatmaps summary journeys set explicit equal-version metadata
boundaries so the metadata task takes its no-op path; the consumer-binding cases
sit in the suites above.

### Post-analysis metadata browser and Node integration coverage

The changed-write and feedback journeys live in browser specs plus a Node
dispatcher suite:

- `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts` builds canonical `small` class-2 historical-source scenarios; keep the committed null-`studentName` boundary rather than "repairing" the corpus.
- `post-analysis-metadata.persistence.spec.ts` covers changed writes and re-reads on both surfaces.
- `post-analysis-metadata.feedback.spec.ts` covers save-failure and confirmed-save feedback, dismissal and navigation cleanup.
- `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts` exercises the `apiHandler` read and mutation round trip through `callApi`, service schemas and queued wrappers; see [Synthetic Test Data](../testing/synthetic-test-data.md#node-dispatcher-metadata-round-trip).

Both browser specs use the existing runtime response queues. Keep strict dispatch:
an unknown method or exhausted queue must still fail. Run the full browser suite
with `npm run test:e2e` from `src/frontend`.

### API transport and queue suites

API transport coverage lives under `services/api/`: `apiTransport.spec.ts`,
`apiTransport.retry.spec.ts` and `apiQueue.{enqueue,processing,state,retry,cancellation}.spec.ts`.
Transport tests exercise `services/apiService.ts`; queue tests exercise
`services/api/apiQueue.ts` directly.

Shared setup lives in `src/test/api/apiServiceTransportTestHelpers.ts`, reusing
`apiServiceTestMocks.ts`. After `vi.resetModules()`, use `loadCallApi()` /
`loadParseApiResponse()` for transport and `loadApiQueue()` for a fresh job
registry. Dynamic imports use the supported owner aliases, not a relative path
to another suite. Keep global/timer/mock cleanup in each suite.

`services/api/apiQueue.tasks.spec.ts` covers the local deferred-task extension:
full read/await/merge/write slot reservation, mixed task/request FIFO and snapshots,
synchronous active marking, independent-job parallelism, failure identity and lane
release, pending-only cancellation behind either entry kind, local result inference
and synchronous empty-job rejection. Use explicit promise gates and scalar probes
with the shared GAS harness; no realistic domain fixture is needed for queue
mechanics. Assert that callbacks are deferred or cancelled without execution and
that only explicit `callApi` requests reach GAS, never callback functions. Do not
test a same-lane nested awaited enqueue by hanging the suite; the owner documents
that deadlock prohibition.

Ordinary transport cases use the shared GAS harness. The focused
`createRawSuccessResponseRunner` seam is only for parser-edge cases that the
harness's automatic JSON serialisation would otherwise make unreachable; do not
use it as a replacement mock transport.

## Related standards

For frontend logging, error mapping, and environment-specific diagnostics policy, use:

- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

When tests cover logging/error pathways, keep expectations aligned with that document (for example stack-trace gating by environment and redaction behaviour). Treat that logging/error document as canonical and avoid duplicating policy text here.

## Coverage requirement

Frontend unit/component tests must meet the coverage threshold enforced in `src/frontend/vite.config.ts`, checked via `npm run test:frontend:coverage`.

`npm run test:coverage` chains the project coverage scripts and stops at the first failing scope. If it stops before the frontend scope, run `npm run test:frontend:coverage` explicitly and report that actual result. Never describe an unreached scope as passing, and do not treat a regression-checker comparison as a coverage gate: its checks can pass without measuring coverage.

## Canonical synthetic fixtures

Use the deterministic synthetic analysis corpus when a test needs realistic analysis-domain data.

All new or changed tests must use a canonical synthetic fixture when the corpus covers the scenario; for the directive, its exception path and the generator-extension process, see [Synthetic Test Data](../testing/synthetic-test-data.md#policy-canonical-fixtures-for-tests).

New and newly touched tests must use corpus fixture data rather than hard-coded literals and derive expectations from the corpus; see [Writing tests against the regenerated corpus](../testing/synthetic-test-data.md#writing-tests-against-the-regenerated-corpus) and [canonical-fixture policy](../testing/synthetic-test-data.md#policy-canonical-fixtures-for-tests).

For frontend service round-trip tests, the Node integration spec composes the script-owned dispatcher bridge with the frontend adapter and supplies `callApi`, the service Zod schemas, and `DataAnalysisService` input. For the corpus topology, profile/view selection, commands and failure behaviour, see the canonical guide: [Synthetic Test Data](../testing/synthetic-test-data.md).

### Importing canonical fixtures

Import canonical fixtures through the `@synthetic/*` alias, which resolves to the committed corpus root `tests/__mocks__/data/synthetic-analysis/*`. The profile folder is the next path segment, for example `@synthetic/small/editableDefinitions.json`. For the alias mapping across TypeScript, Vite, and Playwright, see [TypeScript and ESLint Configuration Hierarchy](../builder/TypeScriptAndLintConfigHierarchy.md).

Keep the two import forms distinct:

- **Vitest specs** import the file as raw text with the `?raw` suffix (for example `@synthetic/small/editableDefinitions.json?raw`) and parse or assert on the returned string.
- **Playwright E2E helpers** import the same `.json` file without `?raw`, which yields the parsed value directly.

This split follows the Vitest/Vite and Playwright/Node runner difference; do not convert one form to the other.

Helpers consumed by both runners must not transitively import Vitest-only `?raw`
selectors. For shared ABClass metadata defaults, import
`src/frontend/src/test/abClass/abClassMetadataSharedFixtures.ts` directly: it loads
JSON without `?raw`, validates and freezes the selected snapshot, and returns
detached clones. `abClassMetadataFixtures.ts` remains the Vitest raw-profile
selector and re-exports the shared canonical bindings for compatibility.

## Shared test helpers

Use shared helpers to keep fixtures and mocks consistent and avoid duplicate test setup code.

**Important:** for frontend logging assertions, spy on browser console endpoints (`console.debug/info/warn/error`) rather than reading implementation-specific globals.

- Frontend runtime setup helper: `src/frontend/src/test/setup.ts` (Testing Library + jest-dom integration).
- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx` (QueryClient + startup-warmup providers for component tests; prefer this over ad-hoc `QueryClientProvider` wrappers).
- Frontend `apiHandler` mock helper: `src/frontend/src/test/googleScriptRunHarness.ts`.
- Classes fixture/state helper: `src/frontend/src/test/classes/classesTestHelpers.ts` (shared rows, ready-state builders, and batch-result builders for Classes table/toolbar/panel specs).
- Classes modal test helpers: `src/frontend/src/test/classes/modalTestHelpers.tsx` (shared interaction helpers, assertion utilities, and mock creators for Classes modal components).
- Classes Page test helpers: `src/frontend/src/test/classes/classesPageTestHelpers.ts` is the compatibility facade and owns `toPlainClassPartials`; the split responsibilities live in `classesPageTestFixtures.ts` (fixture factories and constants), `classesPageRenderHelpers.tsx` (rendering and query-client helpers), `classesPageModelAssertions.ts` (model verification and type guards) and `classesPageScreenAssertions.tsx` (DOM/screen assertions).
- Classes Page grouped view-model support: `src/frontend/src/test/classes/classesPageModelTestSupport.ts` (shared factories and assertion helpers for `classesPageModel.base.spec.ts`, `.sorting.spec.ts` and `.validation.spec.ts`).
- Classes bulk test helpers and registration-only mock setup modules: `src/frontend/src/test/classes/bulkFlowTestHelpers.ts` exports the row fixture `makeRow` and the queued-batch assertions `assertQueuedBatchMutationCalledOnce` and `assertSingleSelectedRowEdit` (shared by the `bulkSetYearGroup` and `bulkSetCohort` flow specs), plus `createBulkPanelMocks`, `createBulkQueueModuleMock`, and `BULK_PANEL_COMPONENT_MOCKS` (shared by the `bulkActiveState` and `bulkDelete` panel specs); the `*.mockSetup.ts` files under `src/frontend/src/test/` — `classes/AssessTaskModal`, `classes/ClassesManagementPanel`, `classes/ClassesPage`, `classes/bulkPanel`, `assignmentDefinition/AssignmentDefinitionWizardModal`, `classPage/useClassPageData`, `taskHeatmap/useHeatmapsPageData`, `abClass/postAnalysisHookMockSetup`, and `auth/appAuthGate` — are registration-only modules that register identical `vi.mock` doubles and export nothing (see [Shared mock-registration pattern](#shared-mock-registration-pattern)).
- Builder fixture helpers: `scripts/builder/src/test/builder-fixture-test-helpers.ts` (shared by builder specs to build release archives, create path fixtures, and write release files/manifests).

When adding test scenarios, prefer extending an existing helper before copying setup logic into each spec. In particular, Classes feature specs should reuse `src/frontend/src/test/classes/classesTestHelpers.ts` for row fixtures and state builders, `src/frontend/src/test/classes/modalTestHelpers.tsx` for modal interaction patterns, and the `classesPageTestHelpers` facade (or its owning companion modules) for ClassesPage fixtures and rendering, rather than redefining near-identical test utilities in each file.

Shared frontend test helpers belong under `src/frontend/src/test/**`. Feature-scoped subfolders are allowed when they keep related fixtures together, but production feature folders should stay free of shared test helpers.

- Shared DOM guard helpers: `src/frontend/src/test/shared/domGuards.ts` — `requireElement` and `requireTableElement` assert-and-narrow queried DOM elements, throwing `TypeError` with a descriptive message instead of using non-null assertions. `resolveStickyTables(wrapper, surface)` resolves a sticky table's split halves to `{ headerHolder, body, headerTable, bodyTable }`, naming the `surface` in each per-element `TypeError`. The three sticky specs resolve their tables this way instead of repeating the selector block; see [Sticky student tables render as a split](#sticky-student-tables-render-as-a-split).
- Shared document-order button-name helpers: `src/frontend/src/test/shared/buttonOrderingTestHelpers.ts` — `getAccessibleButtonNames()` and `getAccessibleButtonIndex(name)` read accessible button names in document order, and `expectReRunButtonOrdering()` asserts the re-run navigation-card placement shared by the class-page and heatmap specs. Use these so relative action placement is asserted against the same accessible names in every spec.
- Data-analysis test fixtures: `src/frontend/src/test/dataAnalysis/fixtures.ts` — the shared-helpers location for data-analysis fixtures.
- Data-analysis assertion helpers: `src/frontend/src/test/dataAnalysis/averagingAnalyserAssertions.ts` — shared module exporting `expectMetricResult` and `checkMetricInvariant` (extracted from `averagingAnalyser.spec.ts`).
- Standings projection oracle: `src/frontend/src/test/dataAnalysis/standingsProjectionOracle.ts` — exports `RecentScoreCount` (`number | 'all'`) and `projectMetricStandings(standings, recentScoreCount)`, which projects analyser-native standings into persisted score sets through the exported `projectAverageScores` rather than the private production projector. `recentScoreCount` is explicit with no default: `'all'` keeps every recent score set and a number truncates with `slice(0, count)`. It replaces three duplicated local helpers in `metadataProjection.merge.spec.ts` and `abClassMetadataService.summaryConsumption.spec.ts` (both pass `'all'`) and `abClassMetadataService.calculation.spec.ts` (passes `1`).
- Class-summary fixtures and derivation helpers: `src/frontend/src/test/dataAnalysis/classSummaryFixtures.ts` — exports `buildMediumInput(analysisMode)`, `buildSummaryOptions(input, recentAssignmentCount)`, `analyseSummary`, `isolatedAbsoluteResult`, `projectMetrics`, `expectedBaselineScores` and the `SummaryOptions` / `MetricScores` types. The two builders take explicit arguments with no defaults: `analysisMode` sets the parsed input filter, and `recentAssignmentCount` truncates the newest-first assignments. It replaces six helpers duplicated in `classSummaryAnalyser.spec.ts` and `classSummaryAnalyser.boundary.spec.ts`; both now import from this single home, so a change to a shared fixture shape shows up in both suites.
- Synthetic analysis API round-trip adapter: `src/frontend/src/test/syntheticApiRoundTripAdapter.ts` — exports `createSyntheticApiRoundTripRunner(invokeRequest)`, a thin test-only adapter that composes the script-owned synthetic `apiHandler` bridge with `googleScriptRunHarness`. The bridge hands the real `apiHandler` JSON string to the harness, which passes strings through unchanged, so the envelope is serialised once by the backend and parsed once by `apiService`. The adapter also preserves raw failures and per-request callback isolation, and it imports no `scripts/` code. See [Synthetic Test Data](../testing/synthetic-test-data.md).
- Heatmap table test fixtures: `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` — exports the `buildHeatmapResult(overrides?)` and `buildCell()` composition helpers plus the pinned task-column constants, cell-preview lookups and the rendered-row/cell probes (`getRenderedRowKeys`, `getHeatmapCellByLabel`) shared by the `TaskHeatmapTable.*` and student-name-column specs.
- Task-preview fixture selection: `src/frontend/src/test/taskHeatmap/previewFixtures.ts` — selects the canonical `small` `class-2` roster and its populated Slides `assignment-2-1` and Sheets `assignment-2-2` records through the frontend raw-JSON import convention, validates every selected full record through `ClassFullSchema` / `AssignmentFullSchema`, and derives and deep-freezes the preview identifiers, labels, metric values and content so the suites assert real record data rather than restated literals. It also exposes clone/build helpers so callers never mutate the shared records.
- Task-preview source-action and focus-session helper: `src/frontend/src/test/taskHeatmap/previewSourceActionTestHelpers.ts` — owns the single shared contract for the task-preview source action and the metric cell's preview focus session: the action's accessible name, the canonical editor URL derived through the production lookup, a no-source boundary cell, and a harness that renders the real `TaskMetricPreviewCell` between focusable neighbours with focus-transfer observation and overlay open/dismiss waits. The no-source boundary cell keeps the canonical per-criterion reasoning and error causes, so only the source link differs. Its four callers are `TaskPreviewCard.sourceLink.spec.tsx`, `TaskMetricPreviewContent.spec.tsx`, `TaskMetricPreviewCell.focus.spec.tsx` and `TaskMetricPreviewCell.focusSession.spec.tsx`.
- Heatmaps hook ready-dataset mock factory: `src/frontend/src/test/taskHeatmap/hookMockFactories.ts` — exports `createReadyHeatmapsDatasetResult(datasetKey)` to build the ready query and dataset-state pair returned by the mocked `usePageDataset`, selecting `classPartials` or `assignmentDefinitionPartials` data for the requested key; shared by `useHeatmapsPageData.spec.ts`, `useHeatmapsPageData.preview.spec.ts`, `useHeatmapsPageData.knownErrorPreview.spec.ts` and `useHeatmapsPageData.postAnalysis.spec.ts`.
- Heatmaps hook mock setup: `src/frontend/src/test/taskHeatmap/useHeatmapsPageData.mockSetup.ts` registers the `useHeatmapsPageData` hook doubles (`useQuery`, `useQueries`, `usePageDataset`, the shared query-options factories, `DataAnalysisService.analyse`, `adaptMetricsToMergedHeatmap`, `assembleMergedPreviewData`) and exports nothing, because `unicorn/no-top-level-side-effects` rejects top-level exports beside registration. Specs import it before `./useHeatmapsPageData`; `useHeatmapsPageData.knownErrorPreview.spec.ts` consumes it. The hoisted doubles are published through `useHeatmapsPageDataMockHandles.ts`, whose `heatmapsPageDataMockHandles.current` slot the setup module fills, because the class-shaped analysis-service mock cannot be reached through `vi.mocked(DataAnalysisService)`. `useHeatmapsPageDataSpecMocks.ts` binds them as `heatmapsPageDataMocks` and exports `installUseQueriesMock`, `createHeatmapsPageDataHarness` and `mockWarmupDatasetsReady`; it has no registration side effects and throws if imported before the setup module.
- Class-page test helpers: `src/frontend/src/test/classPage/classPageFixtures.ts` exports `createReadyClassPageData(overrides?)`, `createClassPageAdapterResult(overrides?)` and `buildStudentAverageRow(overrides?)`, plus the shared class/identifier fixtures for the Class page composition specs (`ClassPage.spec.tsx`, `ClassPageContent.spec.tsx`); `createClassPageAdapterResult` takes a `studentAverages` override, and `buildStudentAverageRow` composes one row from per-metric results, the way `buildHeatmapResult({ rows })` composes heatmap rows from `buildCell()`; `useClassPageDataTestFixtures.ts` provides the pure query/dataset builders and the shared `createClassPageDataWrapper` provider wrapper for the hook suites; and `useClassPageDataMockHandles.ts` exports `createUseClassPageDataMockHandles()`, which binds typed `vi.mocked` handles for the hook's mocked dependencies (`useQuery`, `usePageDataset`, `getABClassQueryOptions`, `DataAnalysisService.analyse`, `adaptClassPageToViewModel`) for the main, blocking, and memoisation hook specs. The hook suites register their doubles through the registration-only `useClassPageData.mockSetup.ts`; `useClassPageData.assignmentQueries.spec.ts` keeps its own handle bindings, and `useClassPageData.diagnostics.spec.ts` declares local hoisted mocks and consumes only `createReadyClassQueryResult`.
- Classes management panel test helpers: `src/frontend/src/test/classes/classesManagementPanelMockFactories.tsx` — `createClassesManagementPanelMocks()` builds the isolated panel module mocks (management state, batch mutation, queue, progress modal, bulk create, bulk delete); registered once by `ClassesManagementPanel.mockSetup.ts` for the `ClassesManagementPanel.*.spec.tsx` specs. The sibling `src/frontend/src/test/classes/classesManagementPanelHarness.tsx` exports `createClassesManagementPanelHarness(...)`, which owns those specs' `reset()` queue/modal behaviour, binds `buildClassesManagementState` to the hook mock, dynamically renders the real panel, and exports the shared `MutableQueueState` type; `ClassesManagementPanel.mockSetup.ts` stays a separate export-free registration module.
- Auth gate test helpers: `src/frontend/src/test/auth/appAuthGateTestHelpers.tsx` — exports the access-result fixtures (`grantedAdminAccess`, `freshInstallAccess`, `brokenConfigAccess`, `deniedAccess`), `EMPTY_STARTUP_WARMUP_RESULT`, and `createQueryWrapper()`. The auth-gate specs under `features/auth/AppAuthGate/` import them statically and register their doubles through the registration-only modules under `src/test/auth/` (`appAuthGate.mockSetup.ts` and `appAuthGateWarmup.mockSetup.ts`).
- Focused analysis input builder: `buildSingleStudentInput(assessments, additionalOverrides?)` in `src/frontend/src/test/dataAnalysis/fixtures.ts` — builds a one-class, one-student `AveragingAnalyserInput` from a criterion-score map for focused analyser/service cases.
- Heatmap adapter suite setup: `src/frontend/src/test/dataAnalysis/heatmapAdapterTestSetup.ts` — shared class/definition/averaging-result builders used by `heatmapAdapter.spec.ts` and `heatmapAdapter.weighting.spec.ts`; each builder returns a fresh instance.
- Class-detail schema wire fixtures: `src/frontend/src/test/abClass/classDetailSchemaFixtures.ts` — shared wire payloads for the split `classDetailService.zod.full.spec.ts`, `.submissions.spec.ts`, `.definitions.spec.ts` and `.metadataIntegration.spec.ts`; `validClassFull` carries a detached canonical metadata snapshot, and deliberate invalid cases clone the shared objects locally.
- ABClass metadata test selectors: `src/frontend/src/test/abClass/abClassMetadataFixtures.ts` — exports `METADATA_PROFILE_CLASS_PARTIALS` (deep-frozen parsed committed `small`, `medium` and `large-representative` class-partial views imported as raw text with `?raw`) and `cloneMetadata` (`structuredClone`). It re-exports `CANONICAL_NON_NULL_METADATA` and `createCanonicalMetadataFixture()` from the runner-neutral `abClassMetadataSharedFixtures.ts`. Callers clone before deliberate mutation; browser-shared providers import the neutral owner directly. The Node parity suite generates its graph directly and does not import these selectors.
- Focused full-class fixture defaults: `src/frontend/src/test/abClass/classFullFixtureDefaults.ts` — constructor-owned defaults shared by `classPageAdapterTestFixtures.classFull` and `dataAnalysis/fixtures.createClassFull`. Omitted/undefined metadata receives a fresh canonical snapshot; explicit null and supplied snapshots are preserved. These are test defaults, not production read-schema fallbacks.
- Averages-basis control test constants: `src/frontend/src/test/averagesBasisTestConstants.ts` — exports `MODE_CONTROL_LABEL` (the control's accessible name) and `READY_AVAILABILITY`, shared by the Class page mode-control, Student Averages card and heatmap specs.

### Shared mock-registration pattern

When several specs mock the same modules identically, prefer a **registration-only mock setup module** over repeating the registrations in each file.

- The module contains only imports and `vi.mock(...)` calls, and exports nothing. Importing it exists solely to register the doubles.
- Import it before the production or test-harness modules it mocks, so registration precedes their first instantiation.
- Obtain typed handles in each spec with `vi.mocked(<service import>)`, then seed and assert on them as usual.
- Keep each spec's own isolation hooks, resetting with `vi.resetAllMocks()` per [Mock Reset Best Practices](#mock-reset-best-practices). Vitest evaluates the setup module once per spec file, so each file gets its own registered doubles; resetting per file keeps implementations and call history clean. Do not substitute `vi.clearAllMocks()`, which clears call history only and leaves mock implementations in place.
- Do not add `eslint-disable` comments to make the pattern fit. The setup module passes the frontend ESLint config unchanged, and disabling a lint rule to accommodate it is not acceptable.

The setup modules named in the helper bullet list above are examples. Apply the pattern when you add or touch a spec whose registrations are identical to a sibling's, instead of repeating the block locally.

When specs need genuinely different registrations — different mocked modules, module shapes, or hoist-time configuration — keep the mocks local instead: build them in a pure factory or `vi.hoisted(...)` block and register them with a local `vi.mock(...)`. `useClassPageData.diagnostics.spec.ts` and `useAuthorisationStatus.spec.tsx` follow this local approach.

### Classes test helpers

`src/frontend/src/test/classes/modalTestHelpers.tsx` owns the Classes modal interaction, assertion and mock helpers. `src/frontend/src/test/classes/classesPageTestHelpers.ts` is the compatibility facade for ClassesPage helpers: it re-exports `classesPageTestFixtures.ts`, `classesPageRenderHelpers.tsx`, `classesPageModelAssertions.ts` and `classesPageScreenAssertions.tsx`, and keeps `toPlainClassPartials` for E2E serialisation. Existing imports through the facade stay valid; new call sites import owning modules directly.

Production source must not import from `src/test/**`. The frontend ESLint config enforces that boundary so helper placement and import paths stay explicit.

### Mandatory `apiHandler` mock rule

When a frontend test needs to mock `google.script.run.apiHandler`, you must use the shared helper in `src/frontend/src/test/googleScriptRunHarness.ts`.

- **Vitest / jsdom tests:** use `createGoogleScriptRunApiHandlerMock(...)`.
- **Playwright browser init scripts:** inline `googleScriptRunApiHandlerFactorySource` inside `page.addInitScript(...)`.

Do not introduce new ad-hoc `google.script.run` mocks that mutate one shared runner object or store handlers on shared mutable state. Each mocked call must model GAS-style per-call callback isolation so overlapping requests cannot overwrite one another's success or failure handlers.

#### GAS serialisation fidelity rule

The shared harness factory (`src/frontend/src/test/google-script-run-harness-factory.js`)
models the real backend boundary: the backend `apiHandler()` returns the envelope as a JSON
string, and `google.script.run` passes a returned string through untouched.

What the factory does with a success value:

- **A string passes through unchanged.** This is what the real backend returns, so a mock should
  deliver a pre-serialised envelope when it is modelling the backend.
- **An object is serialised once after dropping `null` object properties.** Real
  `google.script.run` omits `null` properties from returned objects (which is why the backend
  stringifies). Dropping them keeps object-style mocks faithful; `null` array elements are kept.
  `JSON.stringify` then drops `undefined` properties.
- **Live `Date` values are rejected** on both the request and success graphs, because real
  `google.script.run` prohibits them and `JSON.stringify` would otherwise hide the violation.

Rules:

- **Do not add `JSON.stringify()` around an object you pass to `successHandler`.** The factory
  serialises objects itself; wrapping again double-encodes. Pass a string only when you are
  deliberately modelling the backend's own serialised output.
- **Do not add `JSON.parse()` in test callbacks.** The production `apiService.ts` (`dispatchAttempt`)
  handles deserialisation before Zod validation.
- **`failureHandler` must not be stringified.** Real GAS passes raw error strings to
  `failureHandler`. The factory leaves `failureHandler` unwrapped.
- **Object-style mocks lose `null` properties.** A mock that must prove a required nullable field
  (for example `metadata: null`) survives transport has to deliver a serialised string, as
  `src/frontend/src/test/abClass/metadataRefreshTransport.ts` does. The E2E runtime mock does this
  for every envelope it sends (see
  [Playwright E2E § Runtime Mock Infrastructure](frontend-playwright-e2e.md#runtime-mock-infrastructure)).
- **All `google.script.run` mocks must use the factory:**
  - Vitest: `createGoogleScriptRunApiHandlerMock(invokeRequest)`
  - E2E: inject `googleScriptRunApiHandlerFactorySource` via `page.addInitScript(...)`
  - Direct assignment to `globalThis.google.script.run` that bypasses the factory is prohibited.
  - Install the Vitest harness with `vi.stubGlobal('google', ...)` and restore it with `vi.unstubAllGlobals()`; see [Global stub installation and restoration](#global-stub-installation-and-restoration).

#### Void/delete response guidance: `data: null` required

The factory serialises object success values with `JSON.stringify`. `JSON.stringify` silently
strips `undefined` values from objects, so `{ data: undefined }` becomes `{}` after serialisation.

The backend `_success()` contract converts `undefined → null` via `data: data ?? null`. Therefore,
mock responses for void backend methods (for example deletes, start-assessment-run) **must always
use `data: null`** in the response entry — never omit `data` or use `data: undefined`.

```typescript
// ✅ Correct — matches backend contract and survives JSON.stringify
deleteResponses: [{ kind: 'success', data: null }],

// ❌ Wrong — data: undefined is stripped by JSON.stringify, causing
//    ApiSuccessResponseSchema.superRefine to reject the envelope
deleteResponses: [{ kind: 'success', data: undefined }],

// ❌ Wrong — omitted data is also stripped by JSON.stringify
deleteResponses: [{ kind: 'success' }],
```

This applies equally to Vitest mock responses and E2E `RuntimeScenario` entries.

### Mock Setup Order (Critical Anti-Pattern)

**Problem:** Setting mock return values AFTER `renderWithFrontendProviders()` causes components to receive stale default mock data because React renders immediately with whatever mock values are in place at render time.

**Example - WRONG:**

```typescript
// Component renders with default mock (undefined or stale)
const { queryClient } = renderWithFrontendProviders(<Component />);
// Too late - component already rendered with wrong data
getAssignmentDefinitionMock.mockResolvedValue(initialDefinition);
```

**Example - CORRECT:**

```typescript
// Configure mocks BEFORE rendering
getAssignmentDefinitionMock.mockResolvedValue(initialDefinition);
const { queryClient } = renderWithFrontendProviders(<Component />);
// Now component renders with correct mock data
```

**React Query Specific Guidance:**

- Use `vi.hoisted()` for mock functions defined outside the test
- Use `queryClient.setQueryData()` to set initial query state BEFORE rendering
- For mutation-triggered refetches, you can set mocks for subsequent calls after the initial render

**Debugging Tip:**
If your test is receiving undefined or stale data, add `console.log(getAssignmentDefinitionMock.mock.calls)` to verify when mocks are being called. If calls appear AFTER your mock setup, you've hit this anti-pattern.

## Test Isolation Patterns

### Mock Reset Best Practices

**Preferred Pattern:** Use `vi.resetAllMocks()` in `afterEach` to reset both call history AND mock implementations.

```typescript
afterEach(() => {
  vi.resetAllMocks();
});
```

**Anti-Pattern:** `vi.clearAllMocks()` only clears call history, not mock implementations. This can cause tests to receive stale mock implementations from previous tests.

```typescript
// AVOID: Does not reset mock implementations
afterEach(() => {
  vi.clearAllMocks();
});
```

**Rationale:** `vi.resetAllMocks()` ensures complete isolation between tests by resetting both the call history and any mock implementations. This prevents test pollution where one test's mock setup affects subsequent tests.

### Global stub installation and restoration

To install a mock `google` runtime for a transport test, use `vi.stubGlobal('google', ...)` with the
existing `createGoogleScriptRunApiHandlerMock(...)` harness, and restore it with an explicit
`vi.unstubAllGlobals()`:

```typescript
import { afterEach, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from '../test/googleScriptRunHarness';

const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
  callbacks.successHandler?.({ ok: true, requestId: 'req-1', data: null });
});
vi.stubGlobal('google', { script: { run: runner } });

afterEach(() => {
  vi.unstubAllGlobals();
});
```

`vi.restoreAllMocks()` restores spies but does **not** remove globals installed with
`vi.stubGlobal`, so a stub left in place leaks into later tests. Always pair the stub with an
explicit `vi.unstubAllGlobals()` in the test cleanup, and do not assign to or delete
`globalThis.google` directly.

### userEvent.setup() Isolation

Create a fresh `userEvent` instance per test by initialising in `beforeEach` rather than at
the module level. The `userEvent` instance maintains internal state (keyboard sequences,
timer references) that can leak between tests if shared across the module.

```typescript
// ✅ Correct — fresh instance per test
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

// ❌ Wrong — module-level instance leaks state between tests
const user = userEvent.setup();
```

This rule applies to spec files (**`*.spec.tsx`**). Shared test helper functions that call
`userEvent.setup()` locally within each function are not affected.

## React Query Testing Patterns

When testing components that use `@tanstack/react-query`'s `useMutation`, be aware that the mutation function receives **additional arguments** beyond the request data. The `mutateAsync` method passes mutation context as a second argument:

```typescript
const upsertMutation = useMutation({
  mutationFn: upsertAssignmentDefinition,
});
// When called: await upsertMutation.mutateAsync(request)
// The service receives: upsertAssignmentDefinition(request, context)
// Where context = { client: QueryClient, meta: undefined, mutationKey: undefined }
```

**Testing patterns:**

**✅ Correct**: Check the first argument directly to avoid matching against the extra context object:

```typescript
// Check the first argument of the first call
expect(upsertAssignmentDefinitionMock.mock.calls[0][0]).toMatchObject({
  definitionKey: 'algebra-baseline',
  referenceDocumentUrl: expect.stringContaining('new-ref'),
});
```

**✅ Correct**: If you need to verify the call structure with multiple arguments:

```typescript
// Verify call count and specific argument
expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(1);
expect(upsertAssignmentDefinitionMock.mock.calls[0][0]).toEqual(expectedRequest);
expect(upsertAssignmentDefinitionMock.mock.calls[0][1]).toHaveProperty('client');
```

**❌ Avoid**: Using `toHaveBeenCalledWith` with asymmetric matchers fails when extra positional arguments are passed:

```typescript
// This fails because mock receives 2 arguments, not 1
expect(upsertAssignmentDefinitionMock).toHaveBeenCalledWith(
  expect.objectContaining({ definitionKey: 'algebra-baseline' })
);
```

**Debugging tip**: When matchers fail unexpectedly, inspect the actual calls:

```typescript
// Add this before your assertion
console.log('Actual mock calls:', JSON.stringify(mockFn.mock.calls, null, 2));
// Or use Vitest's built-in error output which shows mock.calls
```

### Query Client and Startup Warmup Mocking

When testing components that depend on React Query and startup warmup state, use the `renderWithFrontendProviders` helper and set query data before or during tests:

```typescript
const { queryClient } = renderWithFrontendProviders(<MyComponent />);

// Mock query for fire-and-forget calls
vi.spyOn(queryClient, 'query').mockImplementation(() => Promise.resolve([]));

// Set query data for existing queries
queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
```

**Mock helper pattern for startup warmup state:**

Create a factory function to standardize startup warmup state mocking across tests:

```typescript
/**
 * Creates a mock startup warmup state for testing.
 *
 * @param options - Override options for dataset readiness/failure states
 * @returns Mock startup warmup state object
 */
function createStartupWarmupState(
  options: {
    assignmentTopicsStatus?: 'loading' | 'ready' | 'failed';
    yearGroupsStatus?: 'loading' | 'ready' | 'failed';
  } = {}
) {
  const { assignmentTopicsStatus = 'ready', yearGroupsStatus = 'ready' } = options;

  return {
    isDatasetReady: (datasetKey: string) =>
      (datasetKey === 'assignmentTopics' && assignmentTopicsStatus === 'ready') ||
      (datasetKey === 'yearGroups' && yearGroupsStatus === 'ready') ||
      datasetKey === 'assignmentDefinitionPartials',
    isDatasetFailed: (datasetKey: string) =>
      (datasetKey === 'assignmentTopics' && assignmentTopicsStatus === 'failed') ||
      (datasetKey === 'yearGroups' && yearGroupsStatus === 'failed'),
    isFailed: false,
    isLoading: false,
    isReady: true,
    warmupState: 'ready' as const,
  };
}
```

## Test file layout

- Unit/component tests: `src/frontend/src/**/*.spec.{ts,tsx}`
- Shared test helpers: `src/frontend/src/test/**`
- Test setup: `src/frontend/src/test/setup.ts`
- E2E tests: `src/frontend/e2e-tests/**/*.spec.ts` (see `frontend-playwright-e2e.md`)
- Playwright config: `src/frontend/playwright.config.ts`

## CSS and style testing

`src/frontend/vite.config.ts` sets `css: true` so Vitest processes `?inline` CSS imports. Specs such as `appStylesRaw.ts` rely on this to read raw CSS strings.

HappyDOM has incomplete `getComputedStyle` support, which Ant Design uses for layout calculations. The shared setup installs `getComputedStyleMock` in `src/frontend/src/test/setup.ts` on both `globalThis` and `window`; use that setup rather than defining a local mock. For the setup location, see [Test file layout](#test-file-layout).

## Ant Design testing patterns

These patterns cover behaviour in the installed Ant Design version (and `@rc-component/dialog`)
that makes older test assumptions fail silently. Apply them when writing modal, select or
state-transition tests. The exact version is pinned in `src/frontend/package.json`.

### Modal mask (backdrop) click

Ant Design delegates modal rendering to `@rc-component/dialog`, which uses a **mousedown‑then‑mouseup
pair** on the `.ant-modal-wrap` element — not the `.ant-modal-mask` sibling. The handler checks
`e.target === wrapperRef.current` on both events.

Because the modal renders in a React portal, React Testing Library's `fireEvent` does **not**
reliably trigger React synthetic event handlers on portal‑mounted elements. The safe pattern
is to use native `dispatchEvent`:

```typescript
const wrap = dialog.closest('.ant-modal-wrap');
expect(wrap).not.toBeNull();

await act(async () => {
  wrap!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  wrap!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  wrap!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

expect(onClose).toHaveBeenCalledTimes(1);
```

Do **not** use `fireEvent.click()` on the mask — it will silently fail in JSDOM.

### Select placeholder text

Ant Design attaches `role="combobox"` to a void `<input type="search">` element. Void elements
have no `textContent`, so `expect(select).toHaveTextContent('placeholder')` always fails.

Use a more specific query instead:

```typescript
// ❌ Fails — void element has no textContent
expect(screen.getByRole('combobox')).toHaveTextContent('Select an assignment');

// ✅ Works
expect(screen.getByText('Select an assignment')).toBeInTheDocument();
// or
expect(container.querySelector('.ant-select-selection-placeholder')).toHaveTextContent(
  'Select an assignment'
);
```

### Selected value rendered in multiple DOM locations

Ant Design renders the currently selected Select value in several places for accessibility
(an `aria-live` region, the Select display area, etc.). `getByText()` will throw
`Found multiple elements` errors.

Either narrow the query or use `getAllByText`:

```typescript
// ❌ May find multiple matches
getByText('Essay');

// ✅ Narrow to the confirmation element
const items = getAllByText('Essay');
expect(items.length).toBeGreaterThan(0);

// ✅ Query a specific container
within(dialog).getAllByText('Essay');
```

### React 19 forbids render after unmount

React 19 throws `Cannot update an unmounted root` when `rerender()` is called after
`unmount()`. Testing state transitions across modal open/close cycles must use
separate `render()` calls with `cleanup()` between them:

```typescript
// ❌ React 19 rejects this
const { unmount, rerender } = render(<Modal open />);
unmount();
rerender(<Modal open={false} />); // 💥 Cannot update an unmounted root

// ✅ Use separate renders
import { cleanup, render } from '@testing-library/react';

render(<Modal open />);
cleanup();
render(<Modal open={false} />);
```

### Playwright-specific Ant Design patterns

For Playwright-specific Ant Design patterns (StrictMode double-effect handling, `Typography.Text`
visibility, E2E runtime mock infrastructure, `selectVisibleOption`, and modal mask clicks in
a real browser), see `docs/developer/frontend/frontend-playwright-e2e.md`.

### Stacked dialogs share the test-only `aria-labelledby` id

The installed `@rc-component/util` `useId` returns the constant `test-id` when
`process.env.NODE_ENV === 'test'`, so every dialog rendered in one test shares
`aria-labelledby="test-id"`. `getByRole('dialog', { name })` then resolves whichever title
element comes first in the document, which is wrong as soon as two dialogs stack (for example a
reference-data manager opened over a bulk form modal).

Locate a specific stacked dialog by its visible title element instead:

```typescript
const dialog = screen
  .getAllByRole('dialog')
  .find((candidate) => within(candidate).queryByText(title, { selector: '.ant-modal-title' }));
```

Treat this as a bounded harness caveat, not as licence to drop accessible-name coverage. Real
browsers assign unique ids, so the Playwright journey still asserts each dialog's true
accessible name.

### rc-select reads legacy `which`/`keyCode`

The installed `@rc-component/select` `OptionList.onKeyDown` switches on `event.which`, but
`user-event` deliberately leaves the deprecated `keyCode`/`which` fields at zero, so
`user.keyboard('{ArrowDown}')` does not navigate a Select dropdown. Dispatch `keydown` on the
focused combobox with explicit `key`/`code` and matching `keyCode`/`which`, wrapped in `act`,
and assert `aria-activedescendant` before pressing Enter. Keep the keyboard expectation intact;
do not replace it with a hidden-option assertion or drop the real-browser keyboard/closemotion
coverage.

### Sticky student tables render as a split

The Student Averages table and the Task Heatmap (embedded and standalone) enable Ant Design's
`sticky` mode, so each renders as two tables plus a scrollbar:

- `.ant-table-header.ant-table-sticky-holder` holds the header table. Base every `columnheader`
  query here.
- `.ant-table-body` holds the body table and owns the horizontal overflow. Base every row and
  cell query here.
- `.ant-table-sticky-scroll` holds the pinned scrollbar, and renders only while the body overflows
  horizontally and its scroll region crosses the viewport bottom. `happy-dom` never measures
  overflow, so component specs assert the holder and body structure only; the bar's behaviour
  belongs to Playwright.

Never resolve a sticky student table by accessible name. Both tables supply a label
(`Task Heatmap`, `Student Averages`) and Ant Design copies it onto both halves, so
`getByRole('table', { name: 'Task Heatmap' })` matches two elements and fails strict mode. Scope
through the owning `Card` or wrapper, then use the structural bases: rows and cells
from `.ant-table-body`, column headers from `.ant-table-header.ant-table-sticky-holder`.
Wrapper-scoped queries remain valid only for roles whose occurrence count the split leaves
unchanged, such as a named column header.

The body `tbody` starts with an `aria-hidden` `tr.ant-table-measure-row` that repeats the column
titles as text. Count data rows with `tbody tr.ant-table-row`; a bare `tbody tr` includes the
measure row. For the same reason, assert headers by role rather than by text.

## `act()` Warning Avoidance

The project runs React 19 with `happy-dom` as the test environment. React 19 enforces
strict `act()` compliance, and the happy-dom / Ant Design / React Query combination can
produce `act(...)` warnings even in correctly passing tests. None of these warnings
indicate bugs in application code, but they clutter output and obscure real failures.

### Causes

1. **happy-dom does not natively support `act()`.** `@testing-library/react` sets
   `globalThis.IS_REACT_ACT_ENVIRONMENT` dynamically during its wrapped operations
   (render, waitFor, userEvent), but restores it between operations. Any async state
   update that fires between these boundaries triggers a warning.

2. **Ant Design CSSMotion / Portal animations.** antd Select, Modal, and Dropdown
   components use `rc-motion` internally, which schedules `setTimeout` /
   `requestAnimationFrame` callbacks outside `act()` boundaries. This is a known
   cross-cutting issue with any antd version using `rc-motion`.

3. **React Query cache resolution after mock settlement.** When mocked service
   functions (e.g. `mockResolvedValue`) resolve, the microtask often fires after
   the current `act()` boundary has closed.

4. **Synchronous mock harness (`google-script-run-harness-factory.js`).** The mock
   calls `successHandler` / `failureHandler` synchronously inside `apiHandler`.
   When these trigger React state updates, the updates occur in the same call stack
   and may not be wrapped in `act()`.

### Prevention rules

1. **Prefer `userEvent` over `fireEvent`.** Always import interaction helpers from
   `@testing-library/user-event` and use `await user.click(...)`,
   `await user.selectOptions(...)`, etc. `fireEvent` is synchronous and does not
   wrap interactions in `act()` — every `fireEvent.click(...)` in a test with async
   side effects is a potential warning source.

2. **Use `mockImplementation(() => Promise.resolve(value))` instead of
   `mockResolvedValue(value)`.** The former integrates more reliably with Testing
   Library's `act` boundaries. The latter creates microtask-based promises that tend
   to resolve after the current `act()` block has finished.

3. **Always `await` async queries.** Use `await screen.findByRole(...)`,
   `await screen.findByText(...)`, or `await waitFor(() => ...)` to wait for DOM
   updates triggered by async work. Synchronous assertions after state-changing
   interactions let the test finish before React settles.

4. **Assert on final visible state for antd animations.** Instead of trying to
   synchronise with animation lifecycles, wait for the expected DOM element to appear:
   `await screen.findByText('expected text')`. Once the element is visible, the
   animation has settled.

5. **The shared setup sets `globalThis.IS_REACT_ACT_ENVIRONMENT = true`.** Specs
   must not set it themselves.

6. **Avoid `fireEvent.mouseDown` / `fireEvent.click` on antd Select components.**
   Ant Design Select triggers dropdown rendering through `rc-motion` via a
   mousedown-then-click sequence. Use `userEvent.click(...)` or
   `userEvent.selectOptions(...)` instead, which handle the full gesture and wait for
   motion to settle.

7. **Wrap direct mock callback calls in `act()`.**
   When tests invoke callbacks obtained from mock components (for example
   `properties.onClose()` or `properties.onCreateSuccess(...)` on a wizard mock),
   those calls trigger synchronous React state transitions inside component state
   reducers that aren't wrapped by any user interaction. Enclose them in
   `await act(async () => { ... })`:

   ```typescript
   await act(async () => {
     properties.onClose();
   });

   await act(async () => {
     properties.onCreateSuccess('new-def-key');
   });
   ```

   If the callback triggers async work (e.g. a `useMutation`), the `act()` wrapper
   prevents the associated state updates from escaping the current test step.

8. **Wrap `rerender()` calls in `act()` when they change component props that
   trigger async initialisation.**
   `rerender(...)` from Testing Library is synchronous and does not wrap the
   component's re-mount / effect re-run inside `act()`. If the re-render changes
   props that trigger data fetching, state transitions, or animation mounts, wrap
   the call in `await act(async () => { ... })`:

   ```typescript
   await act(async () => {
     rerender(
       <QueryClientProvider client={queryClient}>
         <AssessTaskModal {...defaultProperties({ open: false })} />
       </QueryClientProvider>
     );
   });
   ```

   This applies specifically to prop changes that cause the component to mount
   fresh effects (for example toggling `open` on a modal, or changing a `classId`
   that triggers a `useEffect` fetch).

## Notes

- Frontend unit/component tests run in the frontend package (`src/frontend`) through root scripts.
- For Playwright E2E tests, see `docs/developer/frontend/frontend-playwright-e2e.md`.
- If frontend architecture changes substantially, update this file, `frontend-playwright-e2e.md`, and `.opencode/agents/testing-specialist.md` together.
