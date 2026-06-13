# API Queueing System Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `src/frontend/AGENTS.md`.
3. Treat `SPEC.md` as the source of truth for product behaviour, contracts, and scope boundaries.
4. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

## Scope and assumptions

### Scope

- `src/frontend/src/services/apiService.ts` — add `callApiQueued`, `getQueueState`, `QueueState`, and internal queue infrastructure.
- `src/frontend/src/services/apiService.spec.ts` — add queue-specific test coverage.
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — add planned helper entries.

### Out of scope

- React hook wrapping `getQueueState`
- Queue cancellation, removal, or persistence
- Priority-based queueing
- Queue-level logging events
- Backend changes

### Assumptions

1. The existing `callApi` function is not modified — only new exports are added.
2. The existing `dispatchAttempt`, `shouldRetry`, and retry-loop functions remain unchanged and are reused by the queue.
3. The existing test harness (`src/frontend/src/test/googleScriptRunHarness.ts` and `src/frontend/src/test/google-script-run-harness-factory.js`) is sufficient for queue tests. Any necessary extensions (e.g. controllable delayed responses) are added as test-local helpers in `apiService.spec.ts`.
4. Queue state is module-private (a `Map<string, Queue>` in module scope). It is not persisted and resets on page reload.

---

## Global constraints and quality gates

### Engineering constraints

- Keep `apiService.ts` changes additive — do not restructure existing exports.
- Fail fast on invalid inputs (Zod validation at the call boundary).
- Keep the queue loop simple: a single async function per queue, no external scheduling library.
- Use British English in comments and documentation.
- Export functions as functions, not constants assigned to arrow functions.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents:

- `Testing Specialist`: must read `docs/developer/frontend/frontend-testing.md`, `src/frontend/src/services/apiService.spec.ts` (existing patterns), `src/frontend/src/test/googleScriptRunHarness.ts`, `SPEC.md`.
- `Implementation`: must read `src/frontend/AGENTS.md`, `src/frontend/src/services/apiService.ts`, `SPEC.md`, `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- `Code Reviewer`: must read `src/frontend/AGENTS.md`, `SPEC.md`, `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- `Docs`: must read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`, `SPEC.md`.

### Shared-helper planning gate (mandatory when helper changes are expected)

All sections that introduce new exports must record helper decisions before implementation. See Section 1's shared-helper plan below.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- src/services/apiService.spec.ts`

---

## Section 1 — Types, validation schemas, and input contracts

### Objective

Define the `QueueState` interface, `callApiQueued` function signature, `getQueueState` function signature, and Zod validation schemas. Implement input validation and stub the queue-state query. No queue internals yet.

### Constraints

- Do not touch existing `callApi` or `dispatchAttempt`.
- Define a `JobNameSchema = z.string().min(1)` for `jobName` validation. Reuse `ApiRequestSchema.shape.method` (which is `z.string().min(1)`) for `method` validation in `callApiQueued`. `getQueueState` uses `JobNameSchema` only.
- `callApiQueued` validates `method` and `jobName` via Zod; invalid inputs throw synchronously before any queue interaction.
- `getQueueState` validates `jobName` via Zod; invalid input throws synchronously.
- `getQueueState` for an unknown but valid `jobName` returns `{ pending: 0, active: false }`.
- All three new exports (`QueueState`, `callApiQueued`, `getQueueState`) are exported.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts`
- `src/frontend/src/test/googleScriptRunHarness.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `QueueState` interface
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/apiService.ts`
   - Call-site rationale: exported type consumed by `getQueueState` callers (ABClass creation progress bar in v1; future consumers)
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

2. Helper: `callApiQueued` function
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/apiService.ts`
   - Call-site rationale: ABClass creation (sequentially enqueue class creation calls to avoid race condition); Google Classroom pre-fetch (sequentially enqueue background fetch calls to stay under concurrent ceiling)
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

3. Helper: `getQueueState` function
   - Decision: `new`
   - Owning module/path: `src/frontend/src/services/apiService.ts`
   - Call-site rationale: ABClass creation progress bar polls this for `{ pending, active }` to derive completion metrics
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `QueueState` is exported and has `pending: number` and `active: boolean` fields.
- `callApiQueued` is exported, accepts `(method, parameters?, jobName)`, and returns `Promise<TResponse>`.
- `getQueueState` is exported, accepts `(jobName)`, and returns `QueueState`.
- Empty `method` or `jobName` throws synchronously for both `callApiQueued` and `getQueueState`.
- `getQueueState('nonexistent')` returns `{ pending: 0, active: false }`.
- Existing `callApi` exports and tests are unchanged.

### Required test cases (Red first)

Frontend tests:

1. `callApiQueued` throws when `method` is empty string.
2. `callApiQueued` throws when `jobName` is empty string.
3. `getQueueState` throws when `jobName` is empty string.
4. `getQueueState('unknown-job')` returns `{ pending: 0, active: false }`.
5. `QueueState` type is exported and structurally correct (compile-time check; no runtime test needed beyond type usage in `getQueueState` return).

Note: tests 1–3 are pure validation tests and do not require the `google.script.run` mock. Test 4 requires only the `getQueueState` function stub, not the full queue infrastructure.

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- All existing `callApi` tests still pass.
- Planned helper entries have been added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`.

### Optional `@remarks` JSDoc follow-through

- `callApiQueued`: note that input validation is intentionally duplicated with `callApi`'s `ApiRequestSchema` as defence-in-depth — early rejection at the call site prevents malformed requests from entering the queue.
- `getQueueState`: note that it returns a snapshot; callers polling for progress should not assume monotonicity between calls.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 1 complete. Added `JobNameSchema` (line 10), `QueueState` interface (line 206), `callApiQueued` function (line 225), and `getQueueState` function (line 246). `callApiQueued` validates inputs and throws a stub error for valid inputs (queue internals arrive in Section 2). `getQueueState` returns `{ pending: 0, active: false }` for any valid `jobName`. Planned helper entries added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.14 with status `Not implemented`. Tests in `apiService.spec.ts` (4 new tests in `describe('callApiQueued and getQueueState validation')` block, lines 530–579).
- **Deviations from plan:** `callApiQueued` uses `_parameters: unknown` (required) rather than `parameters?: unknown` (optional) due to TypeScript 5.9 TS1016 restriction (required parameter after optional). The underscore prefix suppresses `noUnusedParameters` for the stub. This will be revisited in Section 2.
- **Follow-up implications for later sections:** Section 2 builds on these exports by adding queue internals.

---

## Section 2 — Queue data structure and enqueue

### Objective

Add the internal queue infrastructure (module-scoped `Map<string, Queue>`) and implement `callApiQueued`'s enqueue path: locate or create a queue, push the request, and return a pending Promise. No dequeue processing yet — enqueued requests remain pending until Section 3 wires up the processing loop.

### Constraints

- Queue state is stored in a module-scoped `Map` keyed by `jobName`. Each value is a `Queue` object with `pending`, `active`, and a processing loop reference.
- `callApiQueued` validates inputs (per Section 1) before touching the queue map.
- Enqueue must be synchronous after validation — the returned Promise is created and stored before `callApiQueued` returns.
- The `active` flag defaults to `false` on queue creation.
- Multiple `callApiQueued` calls for the same `jobName` must not race on queue creation (single-threaded JS makes this safe, but the implementation must still be correct).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts`
- `src/frontend/src/test/googleScriptRunHarness.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

No new helper decisions beyond Section 1. The internal `Queue` data structure is module-private.

### Acceptance criteria

- Calling `callApiQueued('myMethod', { x: 1 }, 'job-a')` returns a Promise that does not resolve or reject until a dequeue loop processes it (verified by test: promise remains pending when no processing loop runs).
- A second call with the same `jobName` also returns a pending Promise, and the internal queue contains two pending items.
- A call with a different `jobName` creates a separate queue.
- The returned Promises are distinct — resolving one does not affect the other.

### Required test cases (Red first)

Frontend tests:

1. Enqueue a single request: Promise is returned and remains pending (not resolved, not rejected) when no dequeue loop is active.
2. Enqueue two requests with same jobName: queue internal state shows two pending items (verify via a future `getQueueState` or a test-only introspection helper).
3. Enqueue requests with different jobNames: two separate queues exist.
4. Enqueued Promises are independent: resolving one should not affect the other.

Note: tests that need to inspect internal queue state before `getQueueState` is fully wired may use a test-only accessor exported from the module (e.g. a `__getQueueInternalsForTest` guard). This is acceptable per the frontend testing policy (`src/frontend/src/test/**` for test helpers). Remove or gate the accessor before finalising the section.

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- All tests from Section 1 still pass.

### Optional `@remarks` JSDoc follow-through

- Internal `Queue` type: note that `active` is set synchronously before any `await` to prevent duplicate processing loops.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 2 complete. Added module-private `QueueEntry` and `QueueStateInternal` types, module-scoped `queues` Map, and test-only `__getQueueInternalsForTest` export. `callApiQueued` now creates/retrieves a queue, stores `resolve`/`reject` in `pending`, and returns a pending Promise. `getQueueState` now reads from the actual queue map. All 21 tests pass (13 original + 4 Section 1 + 4 Section 2).
- **Deviations from plan:** `_parameters` remains non-optional (required) — same TS1016 workaround from Section 1. `QueueEntry` stores only `resolve`/`reject` (not `method`/`parameters` yet) — those will be added in Section 3 when the dequeue loop needs them for dispatch.
- **Follow-up implications for later sections:** Section 3 wires up the dequeue processing loop that resolves/rejects these pending Promises. `__getQueueInternalsForTest` must be removed in Section 6 (Regression).

---

## Section 3 — Sequential processing loop

### Objective

Implement the dequeue processing loop: when a request is enqueued and the queue is idle, synchronously mark active, then process requests one at a time via `callApi`. On settle (resolve or reject), clear active and process the next. Wire this into `callApiQueued` so enqueued Promises resolve/reject with the dispatched result.

### Constraints

- The active flag must be set synchronously before the first `await callApi(...)`. See SPEC.md agreed decision #8.
- Processing order is strict FIFO within a job name.
- `callApi` is reused for dispatch — no duplicate transport logic.
- After a request settles (resolve or reject), the loop checks for the next pending request. If none, the queue becomes idle.
- Different job names' queues must be independent — a blocked queue does not block other queues or direct `callApi` calls.
- The loop must not swallow errors from `callApi` — rejected promises propagate to the individual enqueued request's Promise.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts`
- `src/frontend/src/test/googleScriptRunHarness.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

No new helper decisions. The processing loop is internal to `callApiQueued`'s module.

### Acceptance criteria

- Two requests enqueued for the same jobName execute sequentially: the second does not dispatch until the first settles.
- Requests enqueued for different jobNames can execute concurrently.
- A queued request that resolves passes its data through to the caller's Promise.
- A queued request that rejects passes its error through to the caller's Promise.
- After the last queued request settles, the queue is idle and the next enqueue starts a fresh processing loop.
- Direct `callApi` calls are unaffected and execute immediately alongside any queue processing.

### Required test cases (Red first)

Frontend tests:

1. Sequential execution: enqueue A then B for jobName 'x'. Verify A's `apiHandler` is called before B's. Verify both resolve with their respective data.
2. Parallel independence: enqueue A for 'job-x' and B for 'job-y'. Verify both dispatch without waiting for each other.
3. Resolved data passthrough: enqueue a request; verify the resolved Promise receives the same data that `callApi` would return.
4. Rejected error passthrough: configure the mock to return a failure envelope; verify the queued Promise rejects with the correct `ApiTransportError`.
5. Idle-after-drain: after all queued requests settle, enqueue a new one — verify it dispatches immediately (the `apiHandler` spy is called without advancing any fake timers).
6. Direct `callApi` unaffected: while a queue is processing, a direct `callApi` call dispatches immediately.

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- All tests from Sections 1–2 still pass.

### Optional `@remarks` JSDoc follow-through

- Processing loop: note that the loop runs asynchronously (not awaited by the enqueuer), using `await` internally for each dispatch. The synchronous active-flag set before the first `await` prevents race conditions from near-simultaneous enqueues.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled after implementation)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 4 wires `getQueueState` to return live snapshots from the internal queue map.

---

## Section 4 — `getQueueState` implementation

### Objective

Wire `getQueueState` to the internal queue map so it returns live `{ pending, active }` snapshots. Replace the Section 1 stub.

### Constraints

- Retain the input validation from Section 1 (non-empty `jobName`).
- Unknown but valid `jobName` returns `{ pending: 0, active: false }`.
- `pending` counts queued requests not yet dispatched (excluding the currently active one).
- `active` is `true` when a request is currently in flight for that job name.
- Values are a snapshot at call time — no subscription or reactivity.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts`
- `src/frontend/src/test/googleScriptRunHarness.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

No new helper decisions. `getQueueState` was planned in Section 1.

### Acceptance criteria

- `getQueueState` for a job name with one active request and two pending returns `{ pending: 2, active: true }`.
- `getQueueState` for a job name whose queue has fully drained returns `{ pending: 0, active: false }`.
- Calling `getQueueState` while processing is in-flight returns a consistent snapshot (not a torn read).

### Required test cases (Red first)

Frontend tests:

1. State during active processing: enqueue 3 requests, let processing begin. After the first dispatches but before it settles, call `getQueueState` → `{ pending: 2, active: true }`.
2. State with queued requests during active processing: enqueue 2 requests to the same job name while the mock defers the first request's resolution. After enqueuing both, call `getQueueState` → `{ pending: 1, active: true }` (one active in-flight, one queued).
3. State after drain: enqueue 1 request, let it settle. Call `getQueueState` → `{ pending: 0, active: false }`.
4. State for unknown jobName (existing test from Section 1, verify still passes).

Note: tests 1 and 2 require a mock that can delay resolution so `getQueueState` can be called mid-flight. The existing test harness supports this via a deferred callback pattern — see the concurrent-response test in `apiService.spec.ts` (lines 291–348) for the pattern. Per SPEC decision #8, the active flag transitions synchronously on first enqueue to an idle queue; test 2 captures the state where the first request is in-flight (`active: true`) and the second is queued (`pending: 1`).

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- All tests from Sections 1–3 still pass.

### Optional `@remarks` JSDoc follow-through

- `getQueueState`: document that the return value is a snapshot — between the call and the caller's next statement, the queue may have advanced. Polling consumers should treat values as point-in-time observations.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled after implementation)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 5 adds retry-interaction edge cases.

---

## Section 5 — Retry interaction and failure continuation

### Objective

Verify that the existing retry/backoff logic in `callApi` works correctly inside the queue and that the queue continues processing after individual request failures. This section is primarily test-driven — the implementation should already handle these cases from Sections 2–3; this section hardens the behaviour with targeted edge-case tests.

### Constraints

- Retriable `RATE_LIMITED` failures trigger exponential-backoff retries before the next queued request can start (the queue loop awaits the full `callApi` call including retries).
- After all retries are exhausted and the request ultimately rejects, the queue continues with the next pending request.
- Non-retriable failures immediately reject and the queue continues.
- Tests must use `vi.useFakeTimers()` and coordinate timer advancement with queue processing per the existing retry-policy test pattern in `apiService.spec.ts` (lines 389–457).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/apiService.spec.ts` (especially the retry-policy `describe` block, lines 389–457)
- `src/frontend/src/test/googleScriptRunHarness.ts`
- `SPEC.md`

Implementation mandatory docs:

- `src/frontend/AGENTS.md` (if implementation changes are needed)
- `src/frontend/src/services/apiService.ts`
- `SPEC.md`

Code Reviewer mandatory docs:

- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

None.

### Acceptance criteria

- A queued request that receives `RATE_LIMITED` with `retriable: true` undergoes retries before the next queued request starts.
- The queue's `active` flag remains `true` for the entire retry duration.
- After a retriable request exhausts all attempts and rejects, the next queued request begins processing.
- A non-retriable failure immediately rejects, and the next queued request begins processing.
- The queue does not stall or deadlock after any failure pattern.

### Required test cases (Red first)

Frontend tests:

1. Retry delays block the next request: enqueue A then B for 'job-x'. Configure mock to return `RATE_LIMITED` (retriable) for A's first attempt, then success on the second attempt. Verify B does not dispatch until A's retry completes. Use `vi.useFakeTimers()` and verify `apiHandler` call counts.
2. Retry exhaustion and queue continuation: enqueue A then B. Configure mock to return `RATE_LIMITED` (retriable) for all 4 of A's attempts. Verify A rejects, then B dispatches and resolves.
3. Non-retriable failure and continuation: enqueue A then B. Configure mock to return `INVALID_REQUEST` (non-retriable) for A. Verify A rejects immediately, then B dispatches and resolves.
4. Active flag during retry: enqueue A. While A is in retry (between attempts, before timers advance), call `getQueueState('job-x')` → `{ pending: 0, active: true }`.
5. Synchronous `callApi` failure and queue continuation: enqueue A then B for the same job name. Remove `google.script.run` from the global scope before A's processing begins so `callApi` throws synchronously for A, then restore it before the queue proceeds to B. Verify A's promise rejects; verify B is still processed and resolves.

### Section checks

- `npm run test:frontend -- src/services/apiService.spec.ts`
- `npm run lint:frontend`
- All tests from Sections 1–4 still pass.

### Optional `@remarks` JSDoc follow-through

None — retry behaviour is already documented in `callApi`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled after implementation)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 6 is regression and documentation.

---

## Regression and contract hardening

### Objective

Run the full test suite and lint checks for the touched module. Verify no regressions in existing `callApi` behaviour.

### Constraints

- Prefer focused test runs before broader validation.
- Do not run unrelated suites unless a broader regression surface is suspected.

### Acceptance criteria

- All existing `callApi` tests pass unchanged.
- All new queue tests pass.
- `npm run lint:frontend` passes with no new warnings or errors.
- No test-only exports or debug accessors remain in production code.

### Required test cases/checks

1. Run touched frontend service suite: `npm run test:frontend -- src/services/apiService.spec.ts`
2. Run frontend lint: `npm run lint:frontend`
3. Verify no test-only exports remain (grep for `__` prefixed exports or `export function __`).
4. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled after implementation)
- **Deviations from plan:** (to be filled if any)

---

## Documentation and rollout notes

### Objective

Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` to reflect the delivered helpers. Reconcile planned `Not implemented` entries with actual implementation.

### Constraints

- Only modify `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — no other documentation changes are required.
- Update the three planned entries (`QueueState`, `callApiQueued`, `getQueueState`) from `Not implemented` to `Implemented`.
- Do not add speculative docs or change unrelated sections.

### Acceptance criteria

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` contains three `Implemented` entries under a new subsection (e.g. `9.14 API queueing system`) with:
  - owning path: `src/frontend/src/services/apiService.ts`
  - status: `Implemented`
  - rationale summarising the call sites and contract
- No stale `Not implemented` entries remain for these helpers.

### Required checks

1. Verify doc accurately references the exported names and file path.
2. Verify no other canonical docs require updates for this change.
3. Verify mandatory-read evidence (`Files read`) is complete for delegated docs handoffs.
4. Reconcile planned shared-helper entries: confirm all three are now `Implemented`.

### Optional `@remarks` JSDoc review

- Confirm `@remarks` planned in earlier sections (`callApiQueued` defence-in-depth note, `getQueueState` snapshot note, internal `Queue` active-flag note) are present in the delivered code.

### Implementation notes / deviations / follow-up

- (to be filled after implementation)

---

## Suggested implementation order

1. **Section 1** — Types, validation, and input contracts (enabling contracts land first)
2. **Section 2** — Queue data structure and enqueue (infrastructure before processing)
3. **Section 3** — Sequential processing loop (core behaviour)
4. **Section 4** — `getQueueState` implementation (depends on Sections 2–3 internals)
5. **Section 5** — Retry interaction and failure continuation (hardening)
6. **Regression and contract hardening** — Full suite run
7. **Documentation and rollout notes** — Canonical doc update
