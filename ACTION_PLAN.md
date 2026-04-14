# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. No frontend layout spec is required for this backend-only change.
3. Treat `SPEC.md` as the source of truth for transport-contract and logging-visibility behaviour.
4. Use this action plan to sequence delivery and testing; do not redefine the frontend envelope contract here.

## Scope and assumptions

### Scope

- Preserve developer-visible backend diagnostics in Google Apps Script execution logs for downstream failures caught by `src/backend/z_Api/apiHandler.js`.
- Keep the frontend response envelope unchanged for all success and failure paths.
- Add or update backend API-layer tests and test helpers so regressions in logging visibility are caught automatically.
- Update backend transport documentation if implementation changes the documented diagnostic expectations.

### Out of scope

- Frontend code or UI changes.
- Broad logging refactors across unrelated backend modules.
- Changing the public error payload sent to the frontend.

### Assumptions

1. `ABLogger` remains the canonical developer-facing logger for backend diagnostics and continues to route to Google Apps Script console output.
2. The implementation may keep request-store failure tracking compact even if execution-log diagnostics become richer.
3. Fidelity assertions for thrown `Error` values will target the top-level `console.error` payload produced by current `ABLogger` serialisation rather than expanding into deeper cause-chain guarantees.
4. The default plan assumes mapped and expected downstream handler failures receive the same single boundary error-level log as unexpected failures, unless implementation review explicitly decides that the additional log volume is not acceptable.

---

## Global constraints and quality gates

### Engineering constraints

- Keep `apiHandler` as a thin transport boundary with existing admission and completion lifecycle behaviour intact.
- Fail fast on invalid inputs and do not hide backend wiring issues.
- Avoid defensive guards that hide missing logger or transport wiring.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Do not widen the frontend error envelope beyond `ok`, `requestId`, and `error { code, message, retriable }`.
- The transport boundary may add one concise contextual error log only; it must not re-emit a second transport-generated series of stack, message, and detail logs when downstream code has already logged those details.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Backend tests: `npm test -- <target>`

---

## Section 1 — Logging Contract Test Harness

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Extend the `apiHandler` test harness so API-layer tests can assert both developer-facing `ABLogger.error(...)` calls and the underlying `console.error` execution-log seam, in addition to the existing timing `info` and `warn` checks.

### Constraints

- Keep the harness focused on transport-boundary observability; do not leak frontend concerns into these tests.
- Reuse `tests/helpers/apiHandlerTestUtils.js` rather than creating one-off logger stubs per test file.
- Maintain existing timing-test support while adding error-log capture.
- Add a targeted seam path that uses the real `ABLogger` with `console.error` spying where fidelity must be proven; do not treat an `ABLogger` mock alone as sufficient evidence for execution-log preservation.

### Acceptance criteria

- Test helpers can capture `ABLogger.error(...)` calls alongside `info` and `warn`.
- Targeted tests can assert the `console.error` payload produced by the real `ABLogger` path.
- Existing timing tests continue to read clearly and do not lose their current assertions.
- The harness supports assertions against both contextual metadata and original thrown values.
- For thrown `Error` values, seam tests can prove preservation of top-level `name`, `message`, and `stack`.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Add a helper-level test or first consumer test that fails until `ABLogger.error(...)` calls are capturable through the shared `apiHandler` test context.
2. Add a targeted seam test that runs through the real `ABLogger.error(...)` path and spies on `console.error` to prove top-level `name`, `message`, and `stack` fidelity for a thrown `Error`.
3. Prove the logger harness can distinguish timing logs from boundary failure logs.

Frontend tests:

1. None.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/apiHandlerLocking.test.js`
- `npm test -- tests/api/apiHandlerTiming.test.js`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** `apiHandler` now emits one boundary `ABLogger.error(...)` entry with `requestId`, `method`, and the original thrown value when a handler throws. The shared harness now captures error logs and the real `ABLogger` -> `console.error` seam behaviour. Existing timing observability remained intact.
- **Delivery evidence:** Branch `chore/apihandler-gas-log-preservation-spec`; commit `e708edfbce5e8364c8274dc9526aa86f0cea08a8` (`feat: complete section 1 logging contract harness`); commit created: Complete; push completed: Complete; push confirmation: succeeded.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** Add direct mapped-failure and non-`Error` failure assertions next; this section proved the core unexpected-`Error` path.

---

## Section 2 — Transport Boundary Failure Logging

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Preserve faithful developer diagnostics in execution logs for all downstream `apiHandler` failure paths while keeping frontend envelope mapping unchanged.

### Constraints

- `apiHandler` must continue returning envelopes rather than throwing to the frontend.
- Known transport-code mapping behaviour must remain unchanged.
- The boundary log should carry request context and the original thrown value without reducing it to a lossy string before logging.
- Boundary logging must stay as one concise contextual error entry and must not replay a transport-generated detail series when downstream code has already logged detailed diagnostics.
- Avoid turning request-store persistence into a full stack-trace store.

### Acceptance criteria

- Unexpected downstream failures still return `INTERNAL_ERROR` with the current generic frontend message.
- Mapped failures such as `ApiValidationError` and `reason === 'IN_USE'` still return their current envelope codes and messages.
- Each downstream failure path produces developer-visible boundary diagnostics suitable for Google Apps Script execution logs.
- For thrown `Error` values, the targeted seam tests prove the emitted execution-log payload preserves top-level `name`, `message`, and `stack`.
- Request completion tracking still records a failed request after the boundary logging change.

### Required test cases (Red first)

Backend model tests:

1. If request-store behaviour changes, add or update `tests/api/requestStore.test.js` to keep the persisted failure summary contract explicit.

Backend controller tests:

1. None.

API layer tests:

1. `apiHandler` returns `INTERNAL_ERROR` for an unexpected handler exception and also emits a single boundary `ABLogger.error(...)` entry containing `requestId`, method name, and the original `Error` object.
2. The corresponding real-logger seam test proves that the emitted `console.error` payload preserves top-level `name`, `message`, and `stack`.
3. `apiHandler` returns `INVALID_REQUEST` for `ApiValidationError` and still emits developer-facing boundary diagnostics without changing the frontend payload.
4. `apiHandler` returns `IN_USE` for the existing delete-blocked path and still emits developer-facing boundary diagnostics.
5. A non-`Error` thrown value still results in deterministic logging plus the existing failure envelope.
6. The failed request remains recorded by the completion flow after boundary logging runs.

Frontend tests:

1. None.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/apiHandlerLocking.test.js`
- `npm test -- tests/api/requestStore.test.js`

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` on `ApiDispatcher.handle(...)` or `_runCompletionPhase(...)` only if the final implementation needs to explain why execution-log preservation and frontend-envelope privacy are intentionally separated.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Direct assertions now cover INVALID_REQUEST, IN_USE, non-Error throws, and failed-request persistence. `apiHandler` now emits the boundary error log before completion tracking, while envelope mapping stays unchanged. Request-store persistence remains compact.
- **Delivery evidence:** Branch `chore/apihandler-gas-log-preservation-spec`; commit `c29fe07d0b5c0e5d0dcfd64da7e7bf9d8260330d` (`feat: complete section 2 boundary failure logging`); commit created: Complete; push completed: Complete; push confirmation: succeeded.
- **Deviations from plan:** Several logging assertions were already satisfied by Section 1's broader boundary-log change.
- **Follow-up implications for later sections:** Residual nearby watchpoint from review: `_runCompletionPhase()` still is not guarded from throwing, but that predates this section and was not changed.

---

## Section 3 — Downstream Log Stream Preservation Regression Coverage

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Prove that `apiHandler` does not suppress downstream logger usage from controlled stubs when a handler both logs and then fails, so a future regression cannot reintroduce the current observability gap.

### Constraints

- Keep assertions at the API boundary and shared logger seam; do not overfit tests to internal controller implementations.
- Assert ordering only where the implementation guarantees it.
- Reuse the existing test helper strategy rather than mocking the entire backend runtime differently per test.
- Do not claim that mocked tests verify the exact production internals of `ProgressTracker`; use strictly accurate wording about non-suppression of controlled downstream logging stubs unless a real class is intentionally loaded with shims.

### Acceptance criteria

- Tests demonstrate that downstream `ABLogger` activity from controlled stubs remains observable when the handler ultimately fails.
- Tests demonstrate that `apiHandler` does not suppress controlled downstream logging patterns shaped like `ProgressTracker.logError(...)` developer logging.
- Timing observability tests remain green alongside the new failure-log assertions.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Add a handler-double test where the downstream handler emits `ABLogger.info(...)` or `ABLogger.warn(...)` and then throws, and assert those calls remain present alongside the boundary failure log.
2. Add a request-path test that uses a controlled downstream stub to emit the same style of `ABLogger.error(...)` traffic that `ProgressTracker.logError(...)` would produce, and assert that `apiHandler` does not suppress those downstream log entries alongside the final failure envelope.
3. Keep or extend the existing completion-timing test so boundary error logging does not suppress completion-phase observability.

Frontend tests:

1. None.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/apiHandlerLocking.test.js`
- `npm test -- tests/api/apiHandlerTiming.test.js`

### Optional `@remarks` JSDoc follow-through

- None unless the final tests reveal a non-obvious ordering rule that needs preserving in code comments.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 3 is regression coverage only; no production changes were required. Added tests proving downstream info/warn/error logging from controlled stubs remains observable alongside the single boundary failure log. Timing observability remained green.
- **Delivery evidence:** Branch `chore/apihandler-gas-log-preservation-spec`; commit `17e9bbc5e25c379acee3fc3b2bd5c7a62c5a9179` (`test: complete section 3 downstream log coverage`); commit created: Complete; push completed: Complete; push confirmation: succeeded.
- **Deviations from plan:** This section did not produce a red failure because the current implementation already satisfied the covered behaviour.
- **Follow-up implications for later sections:** No production gap was identified for the covered cases.

---

## Regression and contract hardening

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Confirm the logging-preservation change holds across touched API-layer paths without regressing transport mapping, request tracking, or lint standards.

### Constraints

- Prefer focused backend test runs before broad validation.
- Do not treat documentation as complete until the transport contract and diagnostic guidance agree.

### Acceptance criteria

- Touched backend API tests pass with the new logging assertions.
- Any touched request-store tests pass if failure-summary persistence changed.
- Backend lint passes.
- Frontend envelope assertions remain unchanged in the touched API tests.

### Required test cases/checks

1. Run `npm test -- tests/api/apiHandler.test.js`.
2. Run `npm test -- tests/api/apiHandlerLocking.test.js`.
3. Run `npm test -- tests/api/apiHandlerTiming.test.js`.
4. Run `npm test -- tests/api/requestStore.test.js` if request-store behaviour changed.
5. Run `npm run lint`.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/apiHandlerLocking.test.js`
- `npm test -- tests/api/apiHandlerTiming.test.js`
- `npm run lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Ran `npm test -- tests/api/apiHandler.test.js`, `npm test -- tests/api/apiHandlerLocking.test.js`, `npm test -- tests/api/apiHandlerTiming.test.js`, and `npm run lint`. All required checks passed for this validation phase. Frontend envelope assertions remained unchanged in the touched API tests, and this section is now fully complete.
- **Delivery evidence:** Branch `chore/apihandler-gas-log-preservation-spec`; commit `888795371aee4c0491bb98c8579932d7f80f7d3c` (`docs: complete regression contract hardening`); commit created: Complete; push completed: Complete; push confirmation: succeeded.
- **Deviations from plan:** `npm run lint` still reports one unrelated existing warning in `src/backend/Models/Cohort.js:139`. `tests/api/requestStore.test.js` was not rerun because request-store behaviour did not change in this phase.

---

## De-sloppification outcome

- **Status:** Clean. Branch state is ready for documentation sync, so docs sync can begin.
- **Findings resolved:** Admission-phase duplication removed by reusing `requestStore` helpers with validated optional timestamps/reference times; unused helper surface reduced; `requestStore` JSDoc aligned.
- **Review confirmation:** No slop remains in the intended `apiHandler`/`requestStore`/test-helper cleanup slice after review.
- **Cleanup commit/push evidence:** Branch `chore/apihandler-gas-log-preservation-spec`; cleanup commit `c13bb34b605536396be154ba8e086b58027c2176` (`refactor: de-sloppify apiHandler request tracking`); push confirmation: succeeded.

---

## Documentation and rollout notes

**Status:** Complete

**Checklist**

- Docs changes drafted: Complete
- Docs review clean: Complete
- Docs checks passed: Complete
- Optional `@remarks` review completed: Complete
- Action plan updated: Complete
- Commit created: Pending
- Push completed: Pending

### Objective

- Update backend documentation to reflect the preserved execution-log diagnostics and unchanged frontend contract.

### Constraints

- Only modify documents relevant to the touched backend transport area.

### Acceptance criteria

- `docs/developer/backend/api-layer.md` still documents the existing frontend envelope contract accurately.
- Backend documentation makes it clear that developer diagnostics are preserved in execution logs even when frontend failures are mapped to generic envelopes.
- Notes and deviations fields in this action plan are completed during implementation.

### Required checks

1. Verify the backend API-layer doc still describes the unchanged frontend envelope.
2. Verify the same doc or another relevant backend doc records the execution-log diagnostic expectation for `apiHandler` failure paths.
3. Confirm notes/deviations fields are filled during implementation.

### Optional `@remarks` JSDoc review

- Review whether any non-obvious separation between execution-log diagnostics and frontend transport privacy should be preserved in `@remarks` within `apiHandler.js`.
- If no such documentation is needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Updated `docs/developer/backend/api-layer.md` to keep the frontend envelope contract explicit while documenting that `apiHandler` now preserves developer diagnostics in execution logs via one boundary `ABLogger.error(...)` entry containing `requestId`, method, and the original thrown value. The same doc now states that downstream developer logs remain visible and that request-store persistence stays compact.
- **Optional `@remarks` review result:** Added a concise `@remarks` note to `ApiDispatcher.handle(...)` in `src/backend/z_Api/apiHandler.js` because the separation between execution-log diagnostics and frontend transport privacy is intentional and not obvious from the envelope code alone. `_runCompletionPhase(...)` and `_mapErrorToFailureEnvelope(...)` JSDoc now also accept non-`Error` thrown values accurately.
- **Deviations from plan:** None.
- **Follow-up implications:** None.

---

## Suggested implementation order

1. Section 1 — Logging Contract Test Harness
2. Section 2 — Transport Boundary Failure Logging
3. Section 3 — Downstream Log Stream Preservation Regression Coverage
4. Regression and contract hardening
5. Documentation and rollout notes
