# Feature Delivery Plan (TDD-First)

## Phase split

This work is intentionally split into two delivery phases:

1. **Phase A — Utility foundation (active now)**  
   Shared keyed `UserProperties` storage, `ProgressTracker` persistence refactor, retention rules, and tracker-wrapper preparation work only.
2. **Phase B — Assessment-run migration (deferred)**  
   API contracts, trigger handoff, workflow injection, frontend polling/services, and end-to-end regression hardening.

This document treats Phase A as the active implementation target. Phase B remains a follow-on plan and must not be started implicitly while the utility foundation is still in progress.

---

## Scope and assumptions

### Active scope: Phase A

- Keep `apiHandler` transport behaviour unchanged, including backend-owned envelope `requestId`.
- Align `ProgressTracker` persistence with the `requestStore` storage model by reusing or extracting the shared keyed-JSON-in-`UserProperties` mechanics instead of re-implementing them separately.
- Update `ProgressTracker` persistence to use the same single-key map pattern as `requestStore` (user-scoped JSON object keyed by `job.id`).
- Define explicit progress-record lifecycle rules for completed/error job records, including deterministic pruning/compaction behaviour.
- Introduce an assessment-specific tracker wrapper (`AssessmentRunTracker`) as a preparation seam so assessment-running code can migrate later without binding workflow semantics directly into `ProgressTracker`.
- Add and run targeted backend tests for shared storage helpers, keyed tracker persistence, retention, and compatibility behaviour.
- Update only the backend documentation needed to explain the new tracker/storage primitives introduced in this phase.

### Deferred scope: Phase B

- Migrate the assessment start flow and long-running assessment execution flow onto `src/backend/Api`.
- Introduce explicit assessment API methods such as `startAssessmentRun` and `getAssessmentRunStatus`.
- Update long-running backend entry points to accept and propagate the `job` object end-to-end.
- Refactor the assessment workflow and downstream collaborators that currently capture `ProgressTracker.getInstance()` so tracked assessment runs use the injected job-bound tracker consistently.
- Move trigger handoff off `DocumentProperties` and onto a dedicated trigger-context model.
- Add frontend non-visual service support for passing a `job` object and polling keyed progress by `job.id`.
- Add end-to-end validation for API, trigger, controller, and frontend integration behaviour.

### Out of scope for Phase A

- Creating visible frontend progress UI components.
- Replacing the placeholder React assignments page with a full assessment-run UX.
- Migrating assignment-selection or definition-creation wizard UI onto React.
- Refactoring unrelated short-running endpoints to require tracking IDs.
- Replacing API admission-control request lifecycle tracking in `requestStore`.
- Migrating the live assessment-running flow to `AssessmentRunTracker` in this phase.
- Migrating trigger handoff away from `DocumentProperties` in this phase.
- Introducing new assessment-running API methods in this phase.
- Broad architectural refactors unrelated to long-running progress scoping.

### Assumptions

1. A `job` object remains the intended identity model for long-running tracked operations and includes, at minimum, `id`, `name`, `type`, and `startedAt`.
2. During Phase A, `job.id` is introduced as the canonical key for tracker persistence even though the live assessment-running flow is not yet migrated to use it end-to-end.
3. Progress data should be stored in user-scoped durable storage (`UserProperties`), keyed by `job.id`.
4. Multiple tracked jobs per user must be able to coexist in storage without overwriting one another.
5. Legacy AdminSheet progress polling remains reference-only and is not an implementation target in Phase A.
6. Progress record lifecycle must be explicit: completed/error records are retained for a bounded period and then removed by deterministic cleanup.
7. Existing document-property-based assessment handoff is a legacy artefact to be replaced later, but not in this phase.
8. `AssessmentRunTracker` may be introduced in Phase A as a wrapper/facade without requiring immediate assessment-workflow adoption.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API and globals wrappers thin; delegate behavioural logic to controller/utility layers.
- Reuse `requestStore` patterns for load/save/prune/compact where they fit progress semantics.
- Prefer a small shared backend utility for keyed `UserProperties` JSON-object storage if it removes duplication cleanly; do not duplicate `requestStore` parsing/save/compaction mechanics under a second implementation.
- Keep `ProgressTracker` writes as direct backend property operations; do not call `apiHandler` for internal progress state updates.
- Treat the future `job.id` as canonical for keyed progress persistence; the backend must not generate secondary tracker identifiers.
- Keep `ProgressTracker` generic and storage-focused; place assessment-flow binding and any workflow-specific helper methods in `AssessmentRunTracker`, not in the base tracker.
- Reuse only storage primitives that are genuinely shared with `requestStore` (property access, JSON parse/reset behaviour, bounded keyed-map persistence, generic prune/compact mechanics). Do not abstract request-lifecycle-specific behaviour such as `createStartedRecord`, `markSuccess`, `markError`, or `apiHandler` lock/admission flow into the tracker.
- Do not treat Phase A as permission to refactor the live assessment-running flow, trigger orchestration, or frontend wiring.
- Never silently swallow errors; preserve existing structured error propagation.
- Keep changes localised and consistent with backend/frontend migration patterns.
- Use British English in comments and documentation.

### TDD workflow (mandatory per active section)

For each active section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`

---

## Phase A — Active implementation

## Section 0 — Shared keyed `UserProperties` store model

### Objective

- Define and implement the shared persistence model that `ProgressTracker` should reuse from the same family of behaviour as `Api/requestStore`.

### Constraints

- Keep the abstraction minimal and focused on storage mechanics only.
- Prefer refactoring `requestStore` to consume shared helpers if that reduces duplication without obscuring request-specific behaviour.
- Do not move `apiHandler` admission/completion logic into shared storage utilities.
- Do not create a broad repository/DAO abstraction for Apps Script properties.

### Reuse versus refactor boundary

- **Reuse/extract:** resilient `UserProperties` access, single-property JSON-object loading, malformed-value reset behaviour, keyed-object save, generic prune/compact helpers where the caller supplies the record-specific predicate/identity rules.
- **Keep requestStore-specific:** request record factories (`createStartedRecord`), request lifecycle mutators (`markSuccess`, `markError`), active-request counting, and lock-scoped admission/completion sequencing inside `apiHandler`.
- **Keep ProgressTracker-specific:** progress record shape, step/message/error semantics, retention policy for completed/error jobs, and any tracker-facing default status payloads.

### Acceptance criteria

- `requestStore` and `ProgressTracker` both persist to `UserProperties` using the same single-property keyed-object model.
- Shared storage helpers, if introduced, are generic over property key and record type and contain no request- or progress-specific field names.
- Shared storage helpers recover safely from missing, malformed, or non-object property values by resetting to an empty keyed object with contextual logging.
- Shared storage helpers preserve unrelated keyed entries across writes, prune passes, and compaction passes.
- Shared compaction/pruning helpers, if extracted, are caller-driven via predicates or selectors so `requestStore` and `ProgressTracker` can retain their different lifecycle semantics.
- `requestStore` behaviour remains unchanged after any refactor to shared helpers.
- `ProgressTracker` uses the shared storage helpers for the parts that truly overlap instead of maintaining a second bespoke parse/save implementation.
- No new abstraction forces `ProgressTracker` to depend on `apiHandler`, transport-layer constants, or request-specific terminology.

### Required test cases (Red first)

Backend utility tests:

1. Shared store loader returns an empty object when the target property is absent.
2. Shared store loader returns an empty object when the target property contains malformed JSON.
3. Shared store loader returns an empty object when the target property contains a valid non-object value.
4. Shared store saver persists a keyed object so a subsequent load returns the same data.
5. Shared prune helper removes only entries matched by the caller-supplied predicate.
6. Shared prune helper preserves unrelated entries and returns the mutated store.
7. Shared compact helper preserves entries classified as active by the caller and evicts the oldest non-active entries first when above the configured limit.
8. Shared compact helper leaves stores at or below the configured limit unchanged.
9. `requestStore` tests remain green when wired through the shared helpers, proving no behaviour regression in API admission tracking.
10. `ProgressTracker` tests exercise the same shared helper path for load/save/reset behaviour rather than duplicating persistence logic privately.

Backend code-structure checks:

1. Shared storage code does not reference request-specific fields such as `requestId`, `status: 'started'`, `markSuccess`, or `markError`.
2. Shared storage code does not reference progress-specific fields such as `step`, `message`, `completed`, or `error`.
3. `requestStore` retains ownership of request-lifecycle factories and mutators after the refactor.
4. `ProgressTracker` retains ownership of progress-record construction and status-shape decisions after the refactor.

### Section checks

- `npm test -- tests/api/<request-store-target>`
- `npm test -- tests/utils/<shared-user-properties-store-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Start by extracting the smallest useful shared helpers from `requestStore`, then switch `requestStore` itself to consume them before adopting them in `ProgressTracker`.
- **Deviations from plan:** Record if the shared helper surface must stay inside `src/backend/Api` temporarily before later relocation.
- **Follow-up implications for later sections:** Section 1 should build on this storage model rather than re-specifying load/save behaviour independently.

---

## Section 1 — ProgressTracker keyed persistence in UserProperties

### Objective

- Update `ProgressTracker` to persist and read progress records keyed by `job.id`.
- Introduce `AssessmentRunTracker(job)` as a migration seam only; do not migrate the live assessment-running flow in this phase.

### Constraints

- Retain `ProgressTracker` as the singleton façade.
- Do not introduce a new persistence abstraction unless blocked.
- Ensure keying strategy is deterministic and safe for Apps Script property storage.
- Reuse the Section 0 shared keyed-store helpers for generic persistence behaviour rather than re-implementing parse/save/reset logic inside `ProgressTracker`.
- Do not require `AssignmentController`, trigger globals, API entry points, or frontend services to adopt the new wrapper in this phase.

### Acceptance criteria

- Progress start/update/complete/error operations can target a key derived from `job.id`.
- `getStatus` (or equivalent) can read by `job.id` and never cross-read another job’s data.
- Persistence uses `PropertiesService.getUserProperties()` for keyed progress records.
- Progress persistence shape mirrors `requestStore`: one property containing a keyed object, with explicit prune/compact lifecycle rules.
- Progress updates are written directly by backend runtime code and never mediated through `apiHandler`.
- Long-running tracker APIs fail fast when the required `job` object or required `job` fields are missing/invalid.
- Progress retention and cleanup are explicit (for example TTL-based pruning for completed/error jobs).
- `ProgressTracker.complete()` side effects that currently serialise `DocumentProperties` are explicitly reviewed and either removed, adapted, or documented as intentionally retained.
- `AssessmentRunTracker(job)` exists as a named wrapper around the base tracker and preserves the existing workflow call surface (`startTracking`, `updateProgress`, `logError`, `logAndThrowError`, `complete`) bound to `job.id`.
- Existing assessment-running consumers may remain on `ProgressTracker.getInstance()` during Phase A, but the wrapper contract must be stable enough for later migration.

### Required test cases (Red first)

Backend utility/singleton tests:

1. `startTracking(job)` writes a new record using `job.id` and initialises the expected default shape without removing unrelated job records.
2. `updateProgress(...)` updates only the matching keyed record and preserves unrelated job records.
3. `complete()` marks only the matching keyed record complete and preserves unrelated job records.
4. `logError()`/`logAndThrowError()` only mutate the matching keyed record and leave other jobs unchanged.
5. `getStatus(job.id=A)` never returns data from `job.id=B`.
6. `getStatus(job.id)` returns the agreed empty/default status shape when the job record does not exist.
7. Missing or invalid `job`/required job-field paths throw for tracker APIs that require them, including invalid `id`, `name`, `type`, and `startedAt` values.
8. Completed/error records older than the configured retention threshold are pruned while active records remain.
9. Completed/error records at or inside the retention boundary are not pruned prematurely.
10. Behaviour of `complete()` document-property serialisation branch is verified against the chosen migration decision.
11. Progress store read/write lifecycle follows the single-key map pattern and preserves unrelated job entries across updates.
12. No progress update path depends on `apiHandler` invocation.
13. `AssessmentRunTracker(job)` delegates to `ProgressTracker` using `job.id` without requiring callers to pass `job` or `job.id` on each update.
14. `AssessmentRunTracker(job)` rejects invalid/missing job payloads and does not allow construction without a valid `job.id`.
15. `AssessmentRunTracker(job)` preserves the existing call surface while binding every call to the same `job.id`.
16. Rebinding or reconstructing `AssessmentRunTracker(job)` for a different job does not mutate or cross-read the original job record.
17. Shared backend test helpers/mocks provide isolated `UserProperties` support so keyed progress-store tests do not rely on document-property mocks.
18. Progress-store reads recover safely when the backing property is missing, malformed JSON, or a non-object value, following the same resilience rules as `requestStore`.
19. Step progression is isolated per `job.id`; updates for one job do not inherit or mutate the step counter for another job.
20. Resetting/restarting tracking for an existing `job.id` rewrites only that job record and leaves unrelated jobs untouched.
21. `ProgressTracker` compaction/pruning uses the shared keyed-store helper path for generic store manipulation while keeping progress-specific retention rules in tracker-owned predicates/selectors.
22. Wrapper introduction does not require changes to the live assessment-running controller, trigger, or frontend tests in this phase.

API layer tests:

1. None in this section.

Frontend tests:

1. None in this section.

### Section checks

- `npm test -- tests/singletons/<progress-tracker-target>`
- `npm test -- tests/utils/<progress-tracker-target>`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Keep method names and call patterns as close as possible to existing usages by introducing a named assessment-specific wrapper rather than rewriting every progress call to pass `job.id`.
- **Deviations from plan:** Record any compatibility shims required for existing callers.
- **Follow-up implications for later sections:** Phase B can migrate controller, trigger, API, and frontend consumers onto the wrapper once the utility foundation is stable.

---

## Phase A documentation notes

### Objective

- Keep canonical docs aligned with the new storage and tracker primitives introduced in Phase A without documenting unimplemented API or trigger contracts.

### Acceptance criteria

- Backend docs describe user-scoped keyed progress persistence and cleanup expectations.
- Backend docs describe `AssessmentRunTracker(job)` as a wrapper/facade introduced for later assessment-flow migration, not as a fully adopted runtime contract.
- Backend docs do not claim that the live trigger handoff or API layer has already migrated to `job.id`.
- This action plan clearly separates active utility work from deferred assessment-run migration work.

### Required checks

1. Update only the backend docs that describe `ProgressTracker` persistence or tracker construction.
2. Confirm that no documentation claims `startAssessmentRun`, `getAssessmentRunStatus`, or trigger-context routing already exist if they are still deferred.
3. Confirm this action plan remains accurate as Phase A implementation progresses.

---

## Phase B — Deferred assessment-run migration

The items below are intentionally deferred until Phase A is complete. They are planning notes, not current acceptance criteria.

### Deferred Section 2 — API contract and validation

- Add explicit long-running assessment API methods such as `startAssessmentRun` and `getAssessmentRunStatus`.
- Preserve the existing `apiHandler` envelope contract and backend-owned `requestId`.
- Validate `params.job` and any start payload required to replace the current start flow cleanly.
- Add backend API tests and method-name parity checks once these endpoints actually exist.

### Deferred Section 3 — Trigger handoff and workflow migration

- Propagate one `job` object across initial call, trigger setup, and trigger execution.
- Move assessment trigger handoff off `DocumentProperties` and onto a dedicated trigger-context model.
- Update installable-trigger entry points to accept the Apps Script event object and use `triggerUid` for trigger-context lookup.
- Migrate the live assessment-running controller and trigger path onto `AssessmentRunTracker(job)`.

### Deferred Section 4 — Frontend non-visual services and polling

- Add frontend service/hook support for passing `job` and fetching keyed progress without GUI assets.
- Keep transport parsing/retry logic centralised in `apiService`.
- Use Zod for new validation contracts and derive types with `z.infer<typeof ...>`.
- Update backend/frontend docs alongside the actual API and polling contract changes.

### Deferred Section 5 — Regression and contract hardening

- Validate end-to-end job-scoped progress tracking for long-running flows without transport regressions.
- Run backend/controller/API/frontend suites relevant to the migrated path.
- Confirm the live assessment workflow no longer depends on direct `ProgressTracker.getInstance()` lookups once the migration is complete.

### Deferred documentation and rollout notes

- Distinguish transport `requestId` from long-running `job.id`.
- Document trigger-context routing separately from progress identity once those mechanisms exist.
- Keep frontend docs aligned with `callApi` boundaries and error-handling policy once service-level assessment integration lands.

---

## Suggested implementation order

1. Phase A, Section 0: Shared keyed `UserProperties` store model
2. Phase A, Section 1: `ProgressTracker` keyed persistence in `UserProperties` and `AssessmentRunTracker(job)` seam introduction
3. Phase A documentation notes
4. Reassess Phase B scope once Phase A is complete and stable
5. Phase B, Section 2: API contract and validation
6. Phase B, Section 3: Trigger handoff propagation and workflow migration
7. Phase B, Section 4: Frontend non-visual service/handler wiring
8. Phase B, Section 5: Regression and hardening
