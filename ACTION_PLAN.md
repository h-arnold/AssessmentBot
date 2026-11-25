# Feature Delivery Plan (TDD-First) — ProgressTracker API Polling

## Delivery status

- Current section: Section 5 — Frontend API surface (complete, pending gate and commit).
- Current phase: Section 5 docs sync + plan compaction in parallel; RED and GREEN loops both PASSED
  review with no findings. Section 4 is complete, compacted, gated, committed (`2acfae65`,
  `e52fdd99`) and pushed.
- Branch: `feat/progress-tracker-api-polling`.
- Regression session ID: `progresstracker-api-polling`.
- Baseline gate: PASSED — 2026-11-25T10:23:32.661Z, `baseline/baseline.txt`, Overall Status GREEN,
  8/8 checks passing, 0 regressions, 0 new failures, 0 existing failures.

## Read-First Context

Before writing or executing this plan:

1. Read `@SPEC.md` as the source of truth for product behaviour and contracts.
2. Read `@docs/developer/data-shapes/progress-tracker.md` plus the planned entries in
   `@docs/developer/data-shapes/assignment.md`, `@docs/developer/data-shapes/trigger-context.md`,
   `@docs/developer/data-shapes/transport-envelope.md` and `@docs/developer/data-shapes/INDEX.md`.
3. Treat those documents as the agreed target contracts; remove their `Not implemented` markers as
   each shape is delivered.
4. No layout spec is required: this task adds no UI surface, modal, polling hook or visible state.

## Scope and assumptions

### Scope

- Backend `requestId` plumbing from `apiHandler` into trigger context and back in the start response.
- Keyed `ProgressTracker` User Properties with an active run context and legacy fallback.
- `getProgress` backend handler and registration.
- Deferred cleanup trigger with per-user cache/marker dedupe and terminal-only deletion with re-arm.
- Frontend typed service wrapper and Zod schemas only; no polling scheduler, hook or UI.

### Out of scope

- Polling interval, `useEffect`/timer/hook implementation and any rendered progress UI.
- Changes to `ApiResponseSchema` or the `callApi` return contract.
- Replacing the legacy unkeyed record used by non-run call sites.

### Assumptions

1. A progress record represents one assessment run; the agreed transport field is `tasks`.
2. The web app keeps `USER_ACCESSING` execution, so progress records and the cleanup marker are
   per-user; the cache flag uses the user cache.
3. `ProgressTracker` remains unfrozen after `ensureInitialized()` because the active context changes
   after initialisation.

---

## Global constraints and quality gates

### Engineering constraints

- Route every frontend request through `apiHandler`; register all methods in
  `ALLOWLISTED_METHOD_HANDLERS`.
- Top-level backend functions carry a trailing underscore; handlers are anonymous closures;
  `getProgress_` needs a guarded `module.exports`.
- Trigger methods are anonymous arrows in `TRIGGER_METHOD_HANDLERS`; no new public GAS function.
- All `PropertiesService` access goes through `GASPropertiesUtils`; `CacheManager` is the cache
  wrapper and requires an explicit TTL.
- Fail loudly on invalid inputs and persistence failures; never catch-and-ignore errors.
- Use British English in comments and documentation.
- GAS concatenation order matters: `01_` and `02_` helper files sort before `ProgressTracker.js`
  and `z_apiHandler.js`; symbols are resolved at call time, not at definition time.
- Do not disable lint rules. Run the relevant `:check` gate before each section is called done.

### TDD workflow (mandatory per section)

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy with all tests still green.
4. Run section-level verification commands.
5. **Docs sync**: update relevant docs in the same section where behaviour changes; record the
   outcome or skip reason in the section's `Implementation notes`.
6. **Plan compaction**: after verification, compact the completed section to a summary retaining
   contracts and follow-ups, preserving later sections and the deferred-findings ledger.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend:check`
- Frontend lint: `npm run lint:frontend:check`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Type checks: `npm run typecheck:all`
- Full local gate: `npm run run-all-checks`

### Canonical-fixture policy note

Transient progress state is outside the analysis graph, so no canonical profile or view applies,
and the synthetic fixture system explicitly excludes trigger simulation. Focused local fixtures
using the existing in-memory `PropertiesService` mock are policy-compliant. Do not add a corpus
profile or generator, and do not relax a shared realism gate. Existing tests touched by the change
are migrated opportunistically where they already mock `ProgressTracker`.

---

## Section 1 — Request-scoped request ID and start response contract

### Outcome (compacted)

Delivered the request-scoped correlation ID path end to end: `ApiDispatcher.handle()` sets
`ApiRequestContext` before the auth gate and overwrites it on every dispatch; `startAssessmentRun_`
returns `{ requestId }` sourced from that accessor while `AssignmentController.startAssessmentRun()`
still returns `null`; the ID is stored in trigger context and validated into
`progressTracker.startTracking(requestId)` by `processSelectedAssignment`. Focused section checks
passed: the backend run covering `tests/api/apiHandler`,
`assignmentController.startAssessmentRun.test.js` and `tests/controllers/assignmentController/`
(20 files / 219 tests) and `npm run lint:backend:check` clean. Contracts, decisions and outstanding
records are retained below; the authoritative evidence and deviations are in the preserved
`Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Controller contract:** `AssignmentController.startAssessmentRun({ definitionKey, assignmentId,
courseId, requestId })` destructures `requestId`, passes it as a fourth positional argument to
  `startProcessing(assignmentId, definitionKey, courseId, requestId)` and returns `null`. The
  transport handler — not the controller — owns the `{ requestId }` response data.
  `startProcessing()` stores `requestId` in `trigger:<uid>:params` for `processSelectedAssignment`.
- **Accessor contract:** `ApiRequestContext` (`set(requestId)`, `get()`, `resetForTests()`) is an
  object literal in `src/backend/z_Api/z_apiHandler.js` (not a public GAS function), exported from
  that module's guarded `module.exports`. `handle()` calls `set()` immediately after
  `_resolveRequestId()`, before the auth gate, and every dispatch overwrites the value; tests reset
  it between cases.
- **Explicit second argument:** the allowlist entry is
  `startAssessmentRun: (parameters) => startAssessmentRun_(parameters, ApiRequestContext.get())`.
  The value is passed explicitly because `assignmentAssessment.js` is loaded separately in Node
  tests and cannot resolve the script-scope accessor as a global. `startAssessmentRun_` validates it
  with `Validate.validateNonEmptyString('requestId', requestId)` and returns `{ requestId }`.
- **Trigger path:** trigger params for `processSelectedAssignment` include `requestId`; the method
  validates it with `Validate.validateNonEmptyString()` before calling
  `progressTracker.startTracking(requestId)`. Section 2 consumes this bound ID; Section 3 aggregates
  the resulting keyed records.
- **Transport and data shapes:** `startAssessmentRun` response `data` is `{ requestId: string }`
  equal to the envelope `requestId`; the shared envelope shape is unchanged, so
  `transport-envelope.md` needs no shape change (its planned-endpoint marker is removed when
  `getProgress` lands in Section 3). Trigger context params gain `requestId`; the planned markers in
  `assignment.md` and `trigger-context.md` are owned by this section's doc-sync slot below.
- **Legacy fallback decision:** validation and propagation are conditional on
  `requestId !== undefined`, so direct calls and legacy non-run call sites keep the unkeyed key while
  the real dispatch path always supplies and validates the ID. The conditional-on-undefined
  deviation and its rationale are recorded in the preserved `Implementation notes / deviations /
follow-up` subsection.
- **Export-key pin:** `tests/api/apiHandler/dispatcher-integration.test.js` asserts
  `Object.keys(sandbox.module.exports)` equals `['apiHandler', 'ApiDispatcher',
'ALLOWLISTED_METHOD_HANDLERS', 'ApiRequestContext']`; any new export must update that assertion.
- **Shared-helper reconciliation:** the `ApiRequestContext` helper entry (previously planned
  `Not implemented` in the Section 1 shared-helper plan) is delivered; its canonical doc target is
  `docs/developer/data-shapes/progress-tracker.md`, reconciled in the final Documentation and
  rollout notes section. Shared-helper entries for future sections remain `Not implemented` and
  unchanged.
- **`@remarks` JSDoc commitments fulfilled:** `z_apiHandler.js` documents why the accessor is an
  object literal (global-exposure guard) and that the value is overwritten per dispatch;
  `assignmentAssessment.js` documents why the dispatcher passes the accessor value explicitly (the
  module is loaded separately in Node tests) and that the controller still returns `null`.
- **Open record slots:** the preserved `Implementation notes / deviations / follow-up` subsection
  still needs its doc-sync outcome, regression gate record and commit record filled in. No new
  record is created here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review PASSED after one in-scope header correction; GREEN review
  PASSED with no in-scope findings. Focused section tests: 20 files / 219 tests passing;
  `lint:backend:check` clean. Out-of-scope nitpick (bare `delete globalThis.*` in
  `assignmentController.startAssessmentRun.test.js:119-129`) logged as `disregarded` in
  `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`. Docs sync updated
  `docs/developer/data-shapes/assignment.md`, `trigger-context.md`, `progress-tracker.md`,
  `docs/developer/backend/api-layer.md` and `AssessmentFlow.md`; no new pages created. It removed
  Section-1-owned markers, left later-section markers intact, and reported pre-existing drift
  (validation descriptions in `assignment.md:399` / `api-layer.md:596`; `progress-tracker.md`
  absent from `mkdocs.yml` nav and `docs/README.md`) — logged as minor out-of-scope nitpicks in
  the deferred-findings log. No code files changed in docs sync, so no extra lint/type run needed.
  User-directed changes: the graphify commit `b814ab1d` ("chore(graphify): add self-contained
  offline graph viewer") is already on this branch and pushed to origin; it is part of this
  section's commit history. `.opencode/agents/action-plan-implementer.md` was updated per the
  user's request to run `graphify update .` at the end of every section before context compaction,
  with regenerated graph outputs committed and pushed with the section (new §2.75, exit criteria,
  quick reference).
- **Section regression gate:** PASSED — 2026-11-25T11:12:15.204Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T11-12-15.204Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline was fully green).
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,885 nodes /
  29,634 edges and rewrote the tracked `graphify-out/` artifacts (`graph.json`, `graph.html`,
  `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and the dated
  backup directory remain untracked; they are not committed.
- **Commit record:** `32a81015` — `feat(backend): add request-scoped correlation ID to assessment
runs` — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`b814ab1d..32a81015`). Earlier branch commit
  `b814ab1d` (graphify viewer) was already pushed by the user and is retained in history.
  Pre-commit hooks (Prettier, backend lint, `typecheck:all`) passed.
- **Deviations from plan:** Validation and propagation are conditional on `requestId !== undefined`
  so untouched direct-call tests and legacy non-run call sites keep working with the unkeyed key.
  On the real dispatch path the value is always supplied and validated. GREEN reviewer classified
  this as acceptable; SPEC's literal "missing fails loudly" wording conflicts with its legacy
  fallback decision — recorded as a follow-up, not a behaviour change. Line counts: 483 / 159 / 498.
- **Follow-up implications for later sections:** Section 2 starts tracking with the validated ID;
  Section 3 aggregates keyed records. Docs sync and regression gate records to be added here.

---

## Section 2 — Keyed ProgressTracker store and active run context

### Outcome (compacted)

Delivered per-run keyed progress records with an active run context so existing callers need no
signature changes, plus a store facade split that gives keyed persistence and cleanup scheduling
distinct owners and test surfaces. The key scheme is `ProgressTracker<requestId>` with no separator;
a missing ID selects the legacy `ProgressTracker` key. Section checks passed: focused backend run
(`npm run test:backend -- tests/utils/progressTracker.test.js tests/singletons`) 7 files / 53 tests,
`npm run lint:backend:check` clean, full backend suite 288 files / 3807 tests, Prettier clean.
Mandatory-read evidence gate passed, the planned helper entry carried `Not implemented` before
implementation, and the canonical-fixture note was honoured with an in-memory property mock and no
corpus change. Contracts and follow-ups are retained below; authoritative evidence and deviations
are in the preserved `Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Key scheme and record shape:** keyed User Property key is `ProgressTracker<requestId>` with the
  ID appended directly (no separator); the legacy unkeyed record remains at `ProgressTracker`.
  Keyed fields are `requestId`, `step`, `message`, `completed`, `error` (`string | null`) and
  `timestamp` (ISO 8601 string from `toISOString()`). Section 3 exposes only keyed records; Section 4
  deletes terminal records under both key forms.
- **Store helper (`src/backend/Utils/01_ProgressTrackerStore.js`):** owns `keyFor`, `read`, `write`,
  `delete` and `readAll`. `readAll(properties)` returns raw `{ key, value }` entries for keyed keys
  only (legacy key excluded) and deliberately does no decoding or malformed-record parsing — Section 3
  aggregation and Section 4 cleanup own that. `write` injects `requestId` into keyed records; a missing
  ID targets the legacy key. The facade supplies the `GASPropertiesUtils`-sourced property store; all
  property access goes through `GASPropertiesUtils`.
- **Facade (`src/backend/Utils/ProgressTracker.js`):** owns `activeRequestId`. `startTracking(id?)`
  binds the context, with no argument selecting legacy; `complete()` writes the terminal record
  through the still-bound context before clearing it (clearing first would strand a non-terminal
  keyed record); `resetForTests()` clears the context and the singleton cache. `getCurrentProgress()`,
  `getStatus()` and `getStepAsNumber()` read the bound record when a context is active and the legacy
  record otherwise. `FREEZE_AFTER_INIT` is not set because the context is mutated after
  `ensureInitialized()`. `propertyKey` was removed, and the facade is 375 lines against the ~330 plan
  guidance — both judged acceptable in GREEN review.
- **Error-write seam:** `logError()` and `logAndThrowError()` accept an optional
  `{ deferCleanup?: boolean }`; the default calls `globalThis.ProgressTrackerCleanup.schedule()` while
  `deferCleanup: true` skips it. `captureError()` is unchanged. Section 4 supplies the real cleanup
  coordinator and re-wires `startTracking`, `updateProgress`, `logError` and `complete` to invoke
  `schedule()`; its `toHaveBeenCalledTimes(1)` spy count may need adjusting once the other write
  methods gain a `schedule()` call.
- **Test bootstrap (`tests/setupGlobals.js`):** provides a default no-op `ProgressTrackerCleanup`
  seam (focused suites replace it with a spy) and loads `ProgressTrackerStore` before the facade in
  GAS concatenation order. Section 4 must replace the no-op seam with the real cleanup module. Section 3
  needs `getProperties()` on the in-memory `PropertiesService` mock for `readAll()`.
- **Shared-helper reconciliation:** the keyed property access helper (planned `Not implemented` in the
  Section 2 shared-helper plan) is delivered by `01_ProgressTrackerStore.js` and reconciled in
  `docs/developer/data-shapes/progress-tracker.md`; `GASPropertiesUtils` is reused unchanged. Helpers
  planned for later sections (Section 4 cleanup coordinator, `CacheManager` extension and
  `TriggerController` extension) remain `Not implemented`.
- **`@remarks` JSDoc commitment:** the per-execution active context and the unfrozen facade are
  documented in the `ProgressTracker.js` class JSDoc and remain on the final `@remarks` review.
- **Open record slots:** docs-sync outcome, regression gate, graphify refresh and commit record are
  still `...` in the notes below and are to be filled by the orchestrator. No new record is created
  here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review PASSED with no findings (9 intentional `AssertionError`
  failures, all six singleton files passing, lint clean, no scope drift). GREEN review PASSED with
  zero findings; the 375-line facade and removal of `propertyKey` were explicitly judged acceptable
  (below the 500-line checklist and 550-line hard trigger, and key derivation now owned by the
  store). Focused checks after GREEN: 7 files / 53 tests passing, `lint:backend:check` clean, full
  backend suite 288 files / 3807 tests passing, Prettier clean. Docs sync updated
  `docs/developer/data-shapes/progress-tracker.md`, `data-shapes/INDEX.md`,
  `backend/AssessmentFlow.md`, `backend/singletons.md` and added the ProgressTracker contract to the
  Data Shapes list in `.opencode/agents/code-reviewer.md`; no new pages created. It removed the
  Section-2-owned `Not implemented` markers (whole-document status, persistence, sub-entities,
  shared helpers, file index, keyed-store helper) and left later-section markers intact (cleanup,
  transport/getProgress, validation, `CacheManager`, `createTimeBasedTrigger`). Post-docs-sync
  JSDoc edits in `ProgressTracker.js` were comments only; scoped `lint:backend:check` and the focused
  53-test run were re-run and remain green. Four out-of-scope doc findings were logged as
  `disregarded` nitpicks in `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`.
- **Deviations from plan:** facade is 375 lines against the ~330 guidance (judged acceptable in GREEN
  review); the store helper is 80 lines against the ~120 guidance. The cleanup-scheduling seam is
  established in Section 2 as a global call site with a no-op harness stub; the real coordinator is
  Section 4 work.
- **Follow-up implications for later sections:** cleanup coordinator consumes the store helper and
  is wired into the four write methods listed above. Section 4 must replace the `setupGlobals.js`
  no-op `ProgressTrackerCleanup` with the real `02_ProgressTrackerCleanup.js` module; its
  `toHaveBeenCalledTimes(1)` spy count may need adjusting once the other write methods gain
  `schedule()`. Section 3 needs `getProperties()` on the in-memory `PropertiesService` mock for
  `readAll()` and must remove the remaining transport/validation markers.
- **Section regression gate:** PASSED — 2026-11-25T12:09:34.185Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T12-09-34.185Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline fully green).
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,889 nodes /
  29,637 edges / 612 communities and rewrote the tracked `graphify-out/` artifacts (`graph.json`,
  `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and
  the dated backup directory remain untracked; they are not committed.
- **Commit record:** `c96acb0e` — `feat(backend): add keyed progress records and active run context`
  — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`d30cf523..c96acb0e`). Pre-commit hooks (Prettier,
  backend lint, `typecheck:all`) passed.

---

## Section 3 — `getProgress` transport handler and registration

### Outcome (compacted)

Delivered the allowlisted `getProgress` transport. `getProgress_` reads all keyed User Properties through
`GASPropertiesUtils.getUserProperties()` and `ProgressTrackerStore.readAll()`, skips malformed records with a
warning, sorts deterministically and returns `{ tasks }` (or `{ tasks: [] }`). It is registered as a
parameterless closure in `ALLOWLISTED_METHOD_HANDLERS`; the shared envelope and public GAS surface are
unchanged. Section checks passed: `npm run test:backend -- tests/api/apiHandler` (16 files / 190 tests),
`npm run lint:backend:check` clean, Prettier clean, `globalExposure.test.js` (6 tests) and the full backend
suite (289 files / 3812 tests). Mandatory-read evidence gate passed; the planned shared-helper entry
(`readAll()` reuse) was honoured and the canonical-fixture note was respected (local property fixtures, no
corpus change). Contracts and follow-ups are retained below; authoritative evidence and records are in the
preserved `Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Handler module and interface:** `getProgress_` lives in `src/backend/z_Api/progressTracker.js` (57 lines)
  as a top-level trailing-underscore function with a guarded `module.exports` (`{ getProgress_ }`). It takes
  no parameters, obtains the property store via `GASPropertiesUtils.getUserProperties()` and delegates key
  filtering to `ProgressTrackerStore.readAll(properties)`, which returns keyed entries only (the legacy
  unkeyed `ProgressTracker` key is excluded).
- **Malformed-record and failure handling:** invalid JSON, or records with a missing, empty or non-string
  `requestId`, are logged via `ABLogger.getInstance().warn()` and skipped so one bad entry cannot fail the
  request. Property-store read errors propagate to the apiHandler error boundary; there is no catch-and-ignore
  around `getUserProperties()` or `readAll()`.
- **Sort and payload contract:** records are sorted by `timestamp` ascending then `requestId` ascending using
  plain string comparison; `SORT_BEFORE = -1` is a named constant to avoid a `no-magic-numbers` lint warning.
  Returns `{ tasks }` / `{ tasks: [] }` and no `Date` values.
- **Registration:** `getProgress: () => getProgress_(),` is in `ALLOWLISTED_METHOD_HANDLERS` (now 32 methods).
  No new envelope fields and no new public GAS function; the global-exposure guard is green.
- **Test harness:** `tests/setupGlobals.js` now loads `progressTracker.js` as a global
  (`Object.assign(g, require('../src/backend/z_Api/progressTracker.js'))`) and the in-memory
  `PropertiesService` mock exposes `getProperties()`; both are additive changes.
- **Frozen specification:** `tests/api/apiHandler/progressTrackerTransport.test.js` holds four handler cases
  (empty array with only the legacy key, deterministic sort excluding the legacy record, malformed-record skip
  with a logged warning, and read-failure propagation), `tests/api/apiHandler/registry.test.js` asserts the
  32 allowlist keys and `tests/api/apiHandler/dispatcher-core.test.js` holds one dispatch case. Test files are
  a frozen exclusion, so no new coverage is added there.
- **Shared-helper reconciliation:** the Section 3 entry reused `readAll()` from
  `src/backend/Utils/01_ProgressTrackerStore.js` (decision `reuse`); no new helper was added and no
  `Not implemented` marker belonged to this section. Helpers planned for Section 4 (cleanup coordinator,
  `CacheManager` extension and `TriggerController` extension) remain `Not implemented` and unchanged.
- **`@remarks` JSDoc commitment:** the `getProgress_` JSDoc explains why the legacy unkeyed key is excluded
  from the transport payload and why malformed records are skipped; this remains on the final `@remarks`
  review.
- **Informational follow-up from GREEN review:** coverage shows two defensive branches not exercised by tests
  (the no-`requestId` skip and the reverse sort direction). Accepted with rationale because test files are a
  frozen exclusion; no code change.
- **Workflow note (not a deviation):** the implementation agent was denied `edit` on `tests/**` by its own
  permission rule, so the orchestrator dispatched the single harness line in `tests/setupGlobals.js` to the
  Testing Specialist, who applied it and revalidated.
- **Open record slots:** docs-sync outcome, regression gate, graphify refresh and commit record are still `...`
  in the notes below and are to be filled by the orchestrator. No new record is created here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review PASSED with no findings (6 intentional `AssertionError`
  failures: four transport cases on the missing module, dispatcher `UNKNOWN_METHOD`, registry 31 vs
  32; lint and Prettier clean, exposure guard green). GREEN review PASSED with zero findings; the
  `SORT_BEFORE = -1` constant (introduced to clear two `no-magic-numbers` warnings) and the 57-line
  module were explicitly accepted. Focused checks after GREEN: 16 files / 190 tests passing,
  `lint:backend:check` clean, Prettier clean, exposure guard 6 tests green, full backend suite 289
  files / 3812 tests passing. Docs sync updated `docs/developer/data-shapes/progress-tracker.md`,
  `data-shapes/transport-envelope.md`, `data-shapes/INDEX.md`, `backend/api-layer.md` and the
  ProgressTracker contract description in `.opencode/agents/code-reviewer.md`; no pages created. It
  removed the Section-3-owned `Transport`/`Validation` `Not implemented` markers and the planned
  endpoint note in `transport-envelope.md`, and left Section 4 cleanup and Section 5 frontend
  markers intact. No source JSDoc was edited by the docs agent, so no scoped lint re-run was needed.
  One new out-of-scope doc nitpick (`readAll()` "parsing" rationale wording) was logged as
  `disregarded` in `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`.
- **Deviations from plan:** none. The implementation agent could not edit `tests/**` because its own
  permission rule denies it; the orchestrator dispatched the single authorised harness line in
  `tests/setupGlobals.js` to the Testing Specialist, who applied it and revalidated. This is a
  workflow routing note, not a deviation.
- **Follow-up implications for later sections:** GREEN review noted two defensive branches not
  covered by tests (the no-`requestId` skip and the reverse sort direction); accepted with rationale
  because test files are a frozen exclusion. No code change required. Section 4 must add the real
  cleanup coordinator and Section 5 the frontend wrapper and `GetProgressResponseSchema`; the
  canonical docs retain those markers.
- **Section regression gate:** PASSED — 2026-11-25T12:48:57.687Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T12-48-57.687Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline fully green).
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,900 nodes /
  29,644 edges / 609 communities and rewrote the tracked `graphify-out/` artifacts (`graph.json`,
  `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and
  the dated backup directory remain untracked; they are not committed.
- **Commit record:** `5ce30ff9` — `feat(backend): add getProgress transport handler and registration`
  — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`42400598..5ce30ff9`). Pre-commit hooks (Prettier,
  backend lint, `typecheck:all`) passed.

---

## Section 4 — Deferred cleanup trigger

### Outcome (compacted)

Delivered the deferred cleanup coordinator, its dedupe wiring and the terminal-only sweep:
`02_ProgressTrackerCleanup.js` (`schedule`/`sweep`/`rearm`) is invoked from every progress write and
dispatched through `triggerHandler`, with `CacheManager` and `TriggerController` extended for the
user-cache flag and quota-safe trigger creation. RED and GREEN loops both PASSED review with no
outstanding findings; no refactor was required. Section checks passed: focused suite 6 files /
92 tests, full backend suite 290 files / 3835 tests, `lint:backend:check` exit 0, Prettier clean,
global-exposure guard green, and the mandatory-read evidence gate. Contracts, interfaces and
follow-ups are retained below; authoritative records are in the preserved
`Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Cleanup coordinator:** `src/backend/Utils/02_ProgressTrackerCleanup.js` (188 lines) exposes
  `ProgressTrackerCleanup` with `schedule(properties?)`, `sweep()` and `rearm()`; the guarded
  `module.exports` is retained. The object must be attached to `globalThis` via
  `Object.assign(globalThis, { ProgressTrackerCleanup })`: a top-level `const` is a lexical binding,
  not a global property in the concatenated GAS runtime, where symbols resolve at call time. The
  `02_` helper sorts before the facade and `z_apiHandler.js`.
- **Keys, TTL and timing:** marker User Property key `AB_PROGRESS_CLEANUP_TRIGGER` holding the
  trigger UID; per-user cache flag `AB_PROGRESS_CLEANUP_FLAG` = `pending` with a 600-second TTL
  passed explicitly to `CacheManager.put()`; trigger delay `new Date(now + 10 minutes)` derived as
  `CLEANUP_DELAY_MINUTES * RuntimeConstants.SECONDS_PER_MINUTE * RuntimeConstants.MS_PER_SECOND`
  (values verified stable); `{ skipTooManyTriggersRecovery: true }` on every cleanup trigger
  creation.
- **Dedupe:** `schedule(properties?)` short-circuits on a cache hit; on a cache miss with a valid
  marker it repopulates the flag without creating a trigger; otherwise it acquires
  `LockService.getUserLock()`, rechecks flag and marker under the lock, then calls `rearm()` inside a
  `try`/`finally` that releases the lock. A failed `tryLock()` warns via `ABLogger` and never throws
  or schedules. `createTimeBasedTrigger` returning `null`/`undefined` leaves marker and flag unset so
  a later write retries. The optional `properties` argument avoids redundant `getUserProperties()`
  calls and keeps lazy-init tests green.
- **Sweep:** deletes terminal keyed records (`completed === true` or non-null `error`) plus a terminal
  legacy `ProgressTracker` record, keeps non-terminal records, and warns-and-skips malformed keyed
  values (never deleting or rewriting them). Marker and cache flag are cleared in a `finally` on
  every sweep; exactly one trigger is re-armed only after a successful sweep that observed a
  non-terminal record, rewriting marker and flag for the new UID. A sweep failure rethrows after the
  `finally` without re-arming, so the next progress write re-arms. `triggerHandler` still owns
  deletion of the fired trigger and its context.
- **Wiring:** `startTracking`, `updateProgress` and `complete` call `schedule(this.properties)`;
  `logError` still calls `schedule()` no-arg and honours `deferCleanup`; `triggerMethodHandlers.js`
  registers `cleanupProgress` as an anonymous arrow dispatching
  `globalThis.ProgressTrackerCleanup.sweep(parameters)`; `triggerHandler`'s catch passes
  `{ deferCleanup: true }` to `logAndThrowError` so a failed sweep cannot re-arm through the error path.
- **Extended helpers:** `CacheManager` constructor accepts an optional cache instance with
  `CacheService.getScriptCache()` as the constructor-owned default and adds best-effort `remove(key)`;
  `TriggerController.createTimeBasedTrigger(functionName, triggerTime, options)` returns `null` with
  an `ABLogger` warning under `skipTooManyTriggersRecovery`, never deleting triggers, never
  re-arming and never retrying (no 5-second retry), while preserving default behaviour for
  assessment scheduling (quota error → `removeTriggers()` + retry; other errors →
  `logAndThrowError()`).
- **Frozen spec and harness:** `tests/utils/progressTrackerCleanup.test.js` (309 lines, 9 `it` cases)
  is the frozen cleanup-coordinator spec; the 13 required cases are spread across six test files.
  `tests/setupGlobals.js` now requires the real coordinator at the `02_` load
  position and exposes a separate `getUserCache()` mock with `_resetUserCache()`. The
  canonical-fixture note was respected: local property/cache mocks only, no corpus change.
- **Shared-helper reconciliation:** the three Section 4 entries previously planned `Not implemented`
  — cleanup coordinator (`02_ProgressTrackerCleanup.js`), `CacheManager` supplied-cache and
  `remove(key)` extension, and `TriggerController.createTimeBasedTrigger`
  `skipTooManyTriggersRecovery` extension — are delivered and reconciled in
  `docs/developer/data-shapes/progress-tracker.md`. The fourth entry,
  `TriggerController.storeTriggerContext` (with `clearTriggerContext`), was reused unchanged
  (decision `reuse`). No Section 4 `Not implemented` markers remain; entries for future sections are
  untouched.
- **Deviation affecting later sections:** `Object.assign(globalThis, { … })` is used instead of a
  literal `globalThis.ProgressTrackerCleanup = …` because
  `unicorn/no-global-object-property-assignment` permits the literal form only on an eslint exempt
  list outside this section's surface. Two `mockClear()` insertions in pre-existing `deferCleanup`
  tests isolate spy counts now that `startTracking` schedules.
- **`@remarks` JSDoc commitments:** still outstanding on the final review — why the marker is
  user-scoped, why `removeTriggers()` must not be used, why re-arming follows only a successful
  sweep, and why the top-level `const` needs an explicit `globalThis` attachment.
- **Open record slots:** docs-sync outcome, regression gate, graphify refresh and commit record
  remain `...` in the notes below and are to be filled by the orchestrator. No new record is
  created here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED review returned 1 Improvement and 2 Nitpicks (unpinned 10-minute
  delay/600-second TTL, header comment inaccuracy, unasserted cache flag on lock failure); all fixed
  and RED re-review PASSED with no findings. GREEN review returned one Critical finding (the top-level
  `const` coordinator was never attached to `globalThis`, so all five production GAS reads would
  throw `TypeError`); fixed with `Object.assign(globalThis, { ProgressTrackerCleanup })` and GREEN
  re-review PASSED with no findings. Focused suite: 6 files / 92 tests passing; full backend suite
  290 files / 3835 tests passing; `lint:backend:check` exit 0; Prettier clean; global-exposure guard
  green. Two stale spy-count assertions in pre-existing `deferCleanup` tests needed
  `cleanupScheduleSpy.mockClear()` after `startTracking` now that it schedules. Docs sync updated
  `docs/developer/data-shapes/progress-tracker.md`, `data-shapes/trigger-context.md`,
  `backend/AssessmentFlow.md` and the ProgressTracker contract description in
  `.opencode/agents/code-reviewer.md`; no pages created. It removed all Section-4-owned planned
  markers, marked the three delivered helpers `Implemented`, kept `storeTriggerContext` as `reuse`,
  and left only Section-5 frontend markers. It also corrected JSDoc in `TriggerController.js` and
  added a `deferCleanup` `@remarks` note in `triggerHandler.js` (comment-only); scoped
  `lint:backend:check` re-run clean after those edits. Pre-existing drift (`mkdocs.yml` /
  `docs/README.md` missing the progress-tracker.md entry) reported but not fixed, already logged.
- **Deviations from plan:** `schedule()` takes an optional properties-store argument passed as
  `this.properties` from three write sites to avoid redundant `getUserProperties()` calls and keep
  lazy-init tests green (`logError` still calls it no-arg). The 10-minute delay is derived via
  `RuntimeConstants` rather than a literal to clear `no-magic-numbers`. `Object.assign(globalThis, {
… })` is used instead of a literal `globalThis.ProgressTrackerCleanup = …` because that form is
  only permitted on an eslint exempt list outside this section's surface; inline disables are
  discouraged. New module is 188 lines against the ~180 guidance; all files remain below 500.
- **Follow-up implications for later sections:** Section 5 must add the frontend wrapper and
  `GetProgressResponseSchema`; the canonical docs retain those markers. The optional `properties`
  argument and `Object.assign` global attachment are established patterns later sections should
  preserve.
- **Section regression gate:** PASSED — 2026-11-25T14:47:41.826Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T14-47-41.826Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline fully green). Two earlier gate attempts in this section were blocked by an
  out-of-scope pre-existing E2E flake (`post-analysis-metadata.feedback.spec.ts` narrow-theme
  dropdown test: first attempt failed, retry passed, Playwright `unexpected 0 / flaky 1`, a different
  theme variant each run, no frontend file changed). Recorded as `noted` in
  `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`; the third run was clean.
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,918 nodes /
  29,668 edges / 610 communities and rewrote the tracked `graphify-out/` artifacts (`graph.json`,
  `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and
  the dated backup directory remain untracked; they are not committed.
- **Commit record:** `2acfae65` — `feat(backend): add deferred cleanup coordinator with
terminal-only sweep` — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`beeee68d..2acfae65`). Pre-commit hooks (Prettier,
  backend lint, `typecheck:all`) passed.

---

## Section 5 — Frontend API surface

### Outcome (compacted)

Delivered the typed frontend API surface: `startAssessmentRun()` resolves to `{ requestId }` with
no cast and `getProgress()` is a parameterless wrapper returning `{ tasks }`, both validated at
the service boundary. RED and GREEN loops both PASSED review with no findings. Section checks
passed: focused service spec 18/18, combined service+zod 59/59, `test:frontend -- AssessTaskModal`
19 files / 173 tests, `test:frontend -- AssessTaskRecoveryFlow` 5 tests, full frontend coverage
362 files / 3300 tests (the `assignmentAssessment` folder at 100% lines/functions),
`lint:frontend:check` exit 0, `typecheck:all` clean (frontend `tsc -b` 0 errors) and Prettier
clean. Mandatory-read evidence gate passed; `callApi`/`parseApiResponse` were reused and the
canonical-fixture note was respected (local typed fixtures, no corpus change). Contracts,
patterns and outstanding records are retained below; authoritative evidence and records are in
the preserved `Implementation notes / deviations / follow-up` subsection.

### Retained for later sections

- **Start-run response contract:** `StartAssessmentRunResponseSchema` is the non-nullable
  `z.object({ requestId: z.string().min(1) })`; `startAssessmentRun()` returns
  `Promise<StartAssessmentRunResponse>` with no `as null` cast. The `StartAssessmentRunResponse`
  type name was preserved so migrated specs needed only mechanical typing changes.
- **Progress schemas:** `ProgressRecordSchema` and `GetProgressResponseSchema` live in
  `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (253 lines).
  `ProgressRecordSchema` requires `requestId: z.string().min(1)`, `step: z.number()`,
  `message: z.string()`, `completed: z.boolean()`, `error: z.string().nullable()` and
  `timestamp: z.iso.datetime()` (the non-deprecated Zod 4 API); Zod 4's `z.number()` rejects
  non-finite `step` values. `GetProgressResponseSchema` is `{ tasks: ProgressRecord[] }` and
  accepts an empty array. No split into `progressTracker.zod.ts` was needed because both files
  stayed under 500 lines.
- **Service interface:** `getProgress()` is a parameterless function (not an arrow constant) in
  `assignmentAssessmentService.ts` (89 lines). `GET_PROGRESS_METHOD = 'getProgress'` matches
  `ALLOWLISTED_METHOD_HANDLERS`; it calls `callApi(method)` with no parameters and
  `parseApiResponse`, so invalid record shapes fail at the service boundary.
- **`@remarks` commitment:** the JSDoc on `startAssessmentRun` explains why the start response
  carries the correlation ID despite the envelope having one: `callApi` discards the envelope
  `requestId`, so the data payload is the frontend's source for correlating later `getProgress`
  records. This fulfils the plan's optional follow-through; the plan wording was ambiguous about
  placement, so the note sits on `startAssessmentRun`.
- **Mock migrations:** 12 files — the 8 AssessTaskModal/recovery specs, `test-utilities.tsx`,
  `recovery-helpers.ts` and the two service specs — migrated `Promise<null>`,
  `mockResolvedValue(null)`, `withResolvers<null>` and `as null` to the new contract with a
  `{ requestId: 'test-run-id' }` constant; all 134 assertions and titles were verified unchanged.
  `linkFlow.spec.tsx` also dropped a pre-existing `as any` plus disable directive (now typed
  `UpsertAssignmentDefinitionResponse`) and 14 blank lines to stay under 500.
- **Shared-helper reconciliation:** Section 5 reused `callApi` and `parseApiResponse` from
  `src/frontend/src/services/apiService.ts` (decision `reuse`); no new helper was added, so the
  shared-helper entry is unchanged.
- **Constraints honoured:** no polling loop, hook or UI component was introduced and all calls
  still go through `callApi`, not `google.script.run`. The five `useAssessTask*Flow` hooks ignore
  the resolved start-run value, so the `null`→object change needed no production edits beyond the
  service file.
- **Open record slots:** docs-sync outcome, regression report and commit record remain to be
  filled by the orchestrator after this compaction. No new record is created here.

### Implementation notes / deviations / follow-up

- **Implementation notes:** RED and GREEN reviews passed with no outstanding findings. Section
  checks passed: focused service spec 18/18, combined service+zod 59/59,
  `test:frontend -- AssessTaskModal` 19 files / 173 tests,
  `test:frontend -- AssessTaskRecoveryFlow` 5 tests, full frontend coverage 362 files / 3300 tests
  (assignmentAssessment folder 100% lines/functions), `lint:frontend:check` exit 0,
  `typecheck:all` clean (frontend `tsc -b` 0 errors), Prettier clean, mandatory-read evidence gate
  passed.
- **Deviations from plan:** none in production code. The `@remarks` was placed on
  `startAssessmentRun` because the plan wording was ambiguous about placement. The service file is
  89 lines against the ~80 guidance and the zod file 253 against ~245; both are under 500, so no
  `progressTracker.zod.ts` split was required.
- **Follow-up implications for later sections:** none. All five feature sections are delivered;
  the remaining passes are the regression-hardening and documentation sections. Later UI work can
  poll using the returned ID.
- **Docs sync (including the gate-found additions):** updated
  `docs/developer/data-shapes/progress-tracker.md`, `data-shapes/assignment.md`,
  `backend/api-layer.md` and the ProgressTracker contract description in
  `.opencode/agents/code-reviewer.md`; no pages created. Removed all four Section-5-owned planned
  markers plus the `Planned change (Not implemented)` callout in `assignment.md`, so no
  `Not implemented` marker remains for any delivered ProgressTracker shape. After the first gate
  run, the docs agent also corrected two stale testing-doc lines that cited `startAssessmentRun`
  as a void method (`frontend-testing.md`, `frontend-playwright-e2e.md`). No source JSDoc was
  edited, so no scoped lint re-run was needed. Two new pre-existing doc nitpicks (`assignment.md`
  File Index omits `getProgress()`; `api-layer.md:606` path typo) logged as `disregarded` in
  `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md`.
- **E2E regression fix (found by the first gate run):** the gate failed with 13 genuine E2E
  failures (`flaky 0, unexpected 13`): the runtime-mock entries for `startAssessmentRun` still
  returned `data: null`, which the new non-nullable schema rejects at the service boundary. The
  Playwright agent updated every start-run mock entry (8 sites across 7 files, one found by
  re-grep) to `{ requestId: 'e2e-run-id' }` with no assertion or scenario change, corrected one
  stale JSDoc line, and the full E2E suite passed 356 / 0 failed / 0 flaky. Code review of the
  fix: PASSED with zero findings.
- **Section regression gate:** PASSED — 2026-11-25T18:06:42.883Z,
  `.ts-regression-checker/reports/session-progresstracker-api-polling/runs/2026-11-25T18-06-42.883Z/comparison.txt`,
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; no pre-existing
  failures (baseline fully green). The first gate attempt failed with the 13 E2E failures recorded
  above; this run is the section-completion gate against the fixed tree and supersedes it.
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; it rebuilt 11,959 nodes /
  29,712 edges / 631 communities and rewrote the tracked `graphify-out/` artifacts (`graph.json`,
  `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`). Local build caches and
  the dated backup directory remain untracked; they are not committed.
- **Commit record:** `80640aa8` — `feat(frontend): add typed getProgress service and non-nullable
start response` — on branch `feat/progress-tracker-api-polling`, pushed successfully to
  `origin/feat/progress-tracker-api-polling` (`01082518..80640aa8`). Pre-commit hooks (Prettier,
  frontend lint, `typecheck:all`) passed. Note: the pre-existing uncommitted `model:` edits in five
  `.opencode/agents/*.md` files were left unstaged and are not part of any commit by this plan.

---

## Regression and contract hardening

### Objective

Verify backend, frontend and transport contracts after all sections land.

### Constraints

- Prefer focused suites before the full gate.
- Do not relax lint, type or fixture gates.

### Acceptance criteria

- Backend, frontend, API and trigger suites pass.
- Lint and type checks pass.
- No `Not implemented` marker remains for delivered shapes.

### Required test cases/checks

1. `npm run test:backend -- tests/utils/progressTracker.test.js tests/api/apiHandler tests/triggers`
2. `npm run test:frontend -- assignmentAssessmentService.spec.ts`
3. `npm run lint:check`
4. `npm run typecheck:all`
5. `npm run build:production` (compiles the builder first, then builds the GAS bundle)

### Section checks

- All commands green; deviations recorded.

### Implementation notes / deviations / follow-up

- **Implementation notes:** verification-only section; no code, test or documentation file was
  changed. All five required checks green: (1) `test:backend -- progressTracker/apiHandler/
triggers` 21 files / 257 tests passed; (2) `test:frontend -- assignmentAssessmentService.spec.ts`
  1 file / 18 tests passed; (3) `lint:check` exit 0; (4) `typecheck:all` exit 0; (5)
  `build:production` exit 0 (132 files materialised, determinism checksums printed). Acceptance
  criterion "no `Not implemented` marker remains for delivered shapes" verified by grep: the only
  occurrence in `docs/developer/` is the convention description at `api-layer.md:25` (policy text,
  not a marker). Docs sync skipped: the section changed no documented behaviour; the following
  Documentation section owns doc reconciliation. Plan compaction: no reduction needed — the
  section records outcomes directly and has no delivery history to remove.
- **Deviations from plan:** none.
- **Section regression gate:** PASSED — run `2026-11-25` (session `progresstracker-api-polling`),
  Overall Status GREEN, 8/8 checks passing, 0 regressions, 0 new failures, 0 fixes; report under
  `.ts-regression-checker/reports/session-progresstracker-api-polling/`.
- **Graphify refresh (§2.75):** `graphify update .` ran after the gate; this section changed no
  source files, so the tracked `graphify-out/` artifacts were already current from the Section 5
  commit and were not rewritten. Record to follow with the commit.
- **Commit record:** record to follow.

---

## Documentation and rollout notes

### Objective

Align canonical docs with the delivered code and remove planned-only markers.

### Constraints

- Only modify docs relevant to touched areas.
- Keep AGENTS references brief; detailed policy stays in the owning docs.

### Required checks

1. `docs/developer/data-shapes/progress-tracker.md`, `assignment.md`, `trigger-context.md`,
   `transport-envelope.md` and `INDEX.md` match delivered shapes with no `Not implemented` marker.
2. `docs/developer/backend/AssessmentFlow.md` describes keyed records rather than a single key.
3. `docs/developer/backend/api-layer.md` lists `getProgress`.
4. Planned shared-helper entries are reconciled.

### Docs delegation reads (when sub-agents are used)

- @docs/developer/data-shapes/progress-tracker.md
- @docs/developer/data-shapes/assignment.md
- @docs/developer/data-shapes/trigger-context.md
- @docs/developer/data-shapes/transport-envelope.md
- @docs/developer/data-shapes/INDEX.md
- @docs/developer/backend/AssessmentFlow.md
- @docs/developer/backend/api-layer.md

### Optional `@remarks` JSDoc review

- Confirm the active-context, unfrozen-singleton and cleanup dedupe decisions are captured in code
  JSDoc; otherwise record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** ...
- **Deviations from plan:** ...

---

## Suggested implementation order

1. Section 1 — request context and start response contract.
2. Section 2 — keyed store and active run context.
3. Section 3 — `getProgress` transport handler.
4. Section 4 — deferred cleanup trigger.
5. Section 5 — frontend API surface.
6. Regression and contract hardening.
7. Documentation and rollout notes.

No teacher tutorials or explainers section is required: the change adds no teacher-facing journey or
UI concept.

---

## Deferred and Out-of-Scope Findings

| Finding                                   | Severity | Scope rationale                                      | Evidence                                                   | Disposition | User decision                         |
| ----------------------------------------- | -------- | ---------------------------------------------------- | ---------------------------------------------------------- | ----------- | ------------------------------------- |
| Frontend polling scheduler and hook       | Material | Explicitly excluded from this task; API surface only | User decision (frontend scope = API surface only)          | `noted`     | API surface only; polling deferred    |
| Replacing the legacy unkeyed record       | Material | Many non-run call sites have no request context      | 100+ `ProgressTracker` references across backend and tests | `noted`     | Retain legacy key                     |
| Envelope exposes requestId to all callers | Minor    | Would change the shared transport contract           | `callApi` resolves data only                               | `noted`     | Start response carries the ID instead |
| UI progress display                       | Material | No UI elements in this task                          | User request                                               | `noted`     | Deferred to a UI task                 |

Open nitpicks are logged in `.opencode/scratchpad/progresstrackerrefactor-deferred-findings.md` if
needed.
