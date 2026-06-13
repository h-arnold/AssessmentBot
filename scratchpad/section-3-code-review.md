# Code Review: Section 3 — Sequential Processing Loop (GREEN PHASE)

**Reviewer**: Code Reviewer Agent  
**Date**: 2026-06-13  
**Files reviewed**: `src/frontend/src/services/apiService.ts`, `src/frontend/src/services/apiService.spec.ts`  
**Mandatory docs read**: `src/frontend/AGENTS.md`, `SPEC.md`, `ACTION_PLAN.md`, `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

---

## Automated Verification

| Check                                                      | Result                           |
| ---------------------------------------------------------- | -------------------------------- |
| `npm run lint:frontend`                                    | ✅ Clean (no warnings or errors) |
| `npm exec tsc -- -b src/frontend/tsconfig.json`            | ✅ Clean (no errors)             |
| `npm run test:frontend -- src/services/apiService.spec.ts` | ✅ 27/27 PASS (8.32s)            |

---

## Verdict: **PASS** — Clean, no critical issues.

The implementation correctly satisfies all six acceptance criteria for Section 3, with the synchronous active-flag pattern properly implemented per SPEC decision #8. No bugs, race conditions, or error-swallowing patterns found.

---

## Detailed Findings

### Acceptance Criteria Verification

1. ✅ **Two requests for same jobName execute sequentially (FIFO)**  
   The `processQueue` while-loop (line 289) processes `queue.pending[0]` one at a time, awaiting `callApi` before shifting and proceeding to the next entry. New enqueues during processing are appended to the tail, preserving FIFO order. Tested at spec line 755–791.

2. ✅ **Different jobNames execute concurrently (independent)**  
   Each `jobName` maps to a distinct `QueueStateInternal` in the module-scoped `queues` Map (line 220). Each idle queue starts its own `processQueue` loop independently. Tested at spec line 793–847.

3. ✅ **Resolved data passthrough through the Promise**  
   `entry.resolve(data)` at line 293 passes the return value from `callApi` directly to the caller's Promise, matching `callApi`'s contract exactly. Tested at spec line 849–871.

4. ✅ **Rejected error passthrough (ApiTransportError)**  
   `entry.reject(error)` at line 295 propagates any error (including `ApiTransportError`) from `callApi` to the caller's Promise. Tested at spec line 873–896.

5. ✅ **Idle-after-drain: next enqueue starts fresh loop**  
   After the while-loop exits, `queue.active = false` (line 299). The next `callApiQueued` call computes `wasIdle = true` (line 256) and starts a new `processQueue` — confirmed by the drain test at spec line 898–946.

6. ✅ **Direct `callApi` unaffected by queue processing**  
   `callApi` is not modified and executes independently of any queue. A direct call dispatches immediately alongside a blocked queued request. Tested at spec line 948–997.

---

### SPEC Decision #8 — Synchronous Active-Flag Pattern

**Verdict**: Correctly implemented with no race condition.

Trace of near-simultaneous enqueues to the same `jobName`:

1. **Call 1**: `callApiQueued('A', params, 'x')`
   - `queues.get('x')` → undefined → creates queue `{ pending: [], active: false }`
   - `wasIdle = !queue.active` → `true`
   - **Inside Promise constructor (synchronous)**: pushes entry A, sets `queue.active = true`, calls `void processQueue(queue)`
   - Returns pending Promise A

2. **Call 2**: `callApiQueued('B', params, 'x')` (runs after Call 1's synchronous body completes, per JS single-thread)
   - `queues.get('x')` → existing queue
   - `wasIdle = !queue.active` → `false` (active was set to `true` by Call 1)
   - **Inside Promise constructor**: pushes entry B, `wasIdle` is false → does NOT start another `processQueue`
   - Returns pending Promise B

Result: Exactly one `processQueue` loop processes both entries sequentially. ✅

The `wasIdle` is computed at line 256, outside the Promise constructor. The `active = true` set happens inside the Promise constructor at line 269, which runs synchronously. Since JS is single-threaded, there is no interleaving between these two operations. Correct.

---

### ProcessQueue Loop — Resolve/Reject Handling

**Verdict**: Correct and complete. No error swallowing.

```ts
async function processQueue(queue: QueueStateInternal): Promise<void> {
  while (queue.pending.length > 0) {
    const entry = queue.pending[0]; // peek
    try {
      const data = await callApi<unknown>(entry.method, entry.parameters);
      entry.resolve(data); // pass-through resolve
    } catch (error: unknown) {
      entry.reject(error); // pass-through reject
    }
    queue.pending.shift(); // remove processed entry
  }
  queue.active = false;
}
```

- The `shift()` is **outside** the try/catch — if `entry.resolve()` or `entry.reject()` somehow threw (they don't; Promise resolve/reject are idempotent and safe), the entry would be skipped, but this is not a concern given the Promise API guarantee.
- Errors from `callApi` (including synchronous throws from `getRunner()` or `dispatchAttempt`) are caught by the try/catch because `await` wraps synchronous throws into Promise rejections.
- The `while` condition re-checks `queue.pending.length` each iteration, so newly enqueued entries (pushed during an `await callApi`) are processed in subsequent iterations.
- `catch` block correctly propagates errors to the specific enqueued Promise via `entry.reject(error)` — no silent swallowing.

---

### Peek-Then-Shift Pattern

**Verdict**: Correct.

- `queue.pending[0]` peeks the head without removing it, so `pending.length` accurately reflects remaining items during processing.
- After `await callApi` settles (resolve or reject), `queue.pending.shift()` removes the processed entry.
- New entries pushed during `await callApi` are appended to the tail — FIFO is preserved because the while-loop always processes index 0.
- When the queue drains, `shift()` has removed all entries, `pending.length` is 0, the while-loop exits, and `queue.active = false`.

---

### Code Quality & Anti-Patterns

No critical code quality issues found. Two nitpicks:

---

## Issues Found

### Improvement

**None.**

### Nitpick

**N1 (Naming)**: `_parameters` parameter has misleading `_` prefix (line 243)

- **Location**: `src/frontend/src/services/apiService.ts`, line 243
- **Issue**: The underscore prefix conventionally signals "intentionally unused parameter" in TypeScript/ESLint. However, `_parameters` **is** actively used — it is stored in the queue entry (line 262) and passed to `callApi` at dispatch time (line 292).
- **Root cause**: The `_` prefix was introduced in Section 1 as a stub workaround for `noUnusedParameters` when the parameter was unused. Now that the parameter is consumed, the prefix is misleading.
- **Suggested fix**: Rename `_parameters` to `parameters` throughout the function (signature, line 262). This is safe because the parameter is no longer unused, so `noUnusedParameters` will not fire.

```diff
-  _parameters: unknown,
+  parameters: unknown,
```

And:

```diff
-      parameters: _parameters,
+      parameters: parameters,
```

**N2 (TypeScript safety)**: Non-null assertions `queue!` add noise (lines 260, 269, 270)

- **Location**: `src/frontend/src/services/apiService.ts`, lines 260, 269, 270
- **Issue**: Three `!` non-null assertions are used on `queue`. While these are safe in practice (the queue is guaranteed to exist at these points; single-threaded JS), they indicate the TypeScript compiler cannot track the invariant.
- **Mitigation**: Could be cleaned up in a future refactor by using a local `const q = queue;` after the existence check, or by restructuring the control flow — but this is purely cosmetic. No functional impact.
- **Severity**: Nitpick — not blocking.

---

## Checklist (Frontend)

- [x] No `console.*` calls anywhere
- [x] No empty `catch` blocks
- [x] British English in all comments (verified: "Enqueues", "behaviour" in JSDoc)
- [x] No speculative features or scope beyond the explicit request
- [x] No default values introduced without explicit instruction
- [x] `@remarks` comments present on key functions (`callApiQueued`, `getQueueState`, `processQueue`)
- [x] File is under 500 lines (330 lines) ✅
- [x] TypeScript: no implicit `any`; explicit types on public interfaces
- [x] Functions exported as functions (not constants) — `callApiQueued`, `getQueueState` are `export function`
- [x] No imports from `src/backend/`
- [x] No `@ant-design/v5-patch-for-react-19` additions
- [x] No CDN-dependent runtime assets
- [x] `callApi` unchanged (lines 172–204 preserved)
- [x] Test-only export (`__getQueueInternalsForTest`) is flagged with `__` prefix per convention; expected to be removed in Section 6 (Regression)

---

## Summary

| Category    | Count |
| ----------- | ----- |
| Critical    | 0     |
| Improvement | 0     |
| Nitpick     | 2     |

The Section 3 processing loop implementation is correct, well-structured, and satisfies all acceptance criteria. All 27 tests pass, lint is clean, and TypeScript compiles without errors. The two nitpicks are cosmetic naming/style concerns that do not affect correctness or the review verdict.

**Verdict**: ✅ CLEAN PASS
