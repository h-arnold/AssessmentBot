# `act()` Warning Noise Investigation — Frontend Tests

**Date:** 29 June 2026
**Author:** Testing Specialist

## Summary

All 102 frontend test files pass (1192 tests), but there is significant `act()`-related
noise in the stderr output. This report categorises the warnings, identifies root causes,
and provides actionable recommendations.

---

## Environment

| Package                | Version | Notes                                   |
| ---------------------- | ------- | --------------------------------------- |
| React                  | 19.2.4  | Latest, with strict `act()` enforcement |
| @testing-library/react | 16.3.2  | React 19-compatible                     |
| happy-dom              | 20.9.0  | Lightweight DOM environment             |
| vitest                 | 4.0.18  | Latest                                  |
| @tanstack/react-query  | 5.90.21 | Latest                                  |
| antd                   | 6.3.1   | Latest                                  |

---

## Warning Categories

### 1. `An update to [Component] inside a test was not wrapped in act(...)`

**Components seen:** `ForwardRef`, `CSSMotion`, `Portal`, `AssessTaskModal`, `ClassesManagementPanel`

**Three sub-causes:**

- **(a) Ant Design CSSMotion/Portal animations (antd 6.3.1)** — Components like Select and Modal
  trigger animations via `CSSMotion` which uses `setTimeout` / `requestAnimationFrame`. These
  callbacks fire outside any `act()` wrapper. This is a known cross-cutting issue with any
  antd version using `rc-motion`.

- **(b) React Query cache resolution** — When mocked service functions resolve/reject, React
  Query processes the result and triggers React state updates. If the mock resolves asynchronously
  (as `mockResolvedValue` does via microtask), and the test's `render()` or `fireEvent()` call
  has already exited its `act()` wrapper, the update is unwrapped.

- **(c) Synchronous mock harness (`google-script-run-harness-factory.js`)** — The mock factory's
  `apiHandler` calls `successHandler` / `failureHandler` synchronously. When these handlers
  trigger React state updates, those updates happen in the same synchronous call stack. If the
  outer call is not wrapped in `act()`, the update is unwrapped. Most visible in
  `apiService.spec.ts`.

### 2. `The current testing environment is not configured to support act(...)`

**Root cause:** React 19's `act()` checks `globalThis.IS_REACT_ACT_ENVIRONMENT`.
`@testing-library/react` toggles this to `true` **only** during its own wrapped `act()` calls
(render, fireEvent, waitFor). The variable is restored to `undefined` between operations.
When a state update falls outside an RTL wrapper, React sees
`IS_REACT_ACT_ENVIRONMENT !== true` and emits this warning.

The project's `setup.ts` does **not** explicitly set
`globalThis.IS_REACT_ACT_ENVIRONMENT = true`. An explicit global would suppress this warning
for edge-case state updates that escape act boundaries.

### 3. Non-act noise (separate issues)

- **`Query data cannot be undefined...`** — React Query query functions returning `undefined`.
  Tests where mock setup happens after render, or the query defaults to unmocked state.
- **`No queryFn was passed...`** — Queries fire without a query function set up.
- **`A props object containing a "key" prop is being spread into JSX`** — React 19 warning
  about spreading `key` in JSX props (seen in `BulkSetSelectModal.spec.tsx`).

---

## File-by-File Impact

Stderr entries counted from a full `npm run test:frontend` run:

| File                                                  | stderr entries | Primary cause                                     |
| ----------------------------------------------------- | -------------- | ------------------------------------------------- |
| `AssessTaskModal.spec.tsx`                            | ~294           | CSSMotion/Portal + React Query + fireEvent (sync) |
| `apiService.spec.ts`                                  | ~30            | Synchronous harness callbacks in dispatchAttempt  |
| `AssignmentDefinitionWizardModal.spec.tsx`            | ~18            | `not configured` + CSSMotion                      |
| `ClassesManagementPanel.spec.tsx`                     | ~14            | React Query + antd animations                     |
| `ClassesManagementPanel.bulkMetadataFailure.spec.tsx` | ~9             | Same as above                                     |
| `App.spec.tsx`                                        | ~9             | ForwardRef + page navigation rendering            |
| `ManageTopicsModal.spec.tsx`                          | ~5             | Modal + React Query                               |
| All others                                            | <5 each        | Isolated instances                                |

---

## Root Cause Analysis

### Why happy-dom matters

The project uses `happy-dom@20.9.0` as the test environment. Happy-dom is a lightweight
DOM implementation that does not natively support `act()` — `act()` is a React concept,
not a DOM API. `@testing-library/react` bridges the gap via `withGlobalActEnvironment`,
but the toggling pattern (`IS_REACT_ACT_ENVIRONMENT` set to `true` only during operations,
restored afterwards) means any async update that happens between operations triggers warnings.

With `jsdom` the same warnings would still occur but sometimes less frequently because jsdom
more faithfully emulates browser timing. The warnings are environment-agnostic in principle
— switching to jsdom would reduce some but not all noise.

### Why `fireEvent` is worse than `userEvent`

`@testing-library/user-event` wraps each interaction step inside `act()`, handles async
resolution, and waits for the DOM to settle. `fireEvent` is synchronous and does not
provide this wrapping. The `AssessTaskModal.spec.tsx` file exclusively uses `fireEvent`,
which means every click, mouseDown, and option pick happens outside `act()` boundaries.

### Why `mockResolvedValue` triggers warnings

`vi.fn().mockResolvedValue(value)` creates a function that returns
`Promise.resolve(value)`. The `.then()` microtask executes after the current synchronous
block completes. If the test's `render()` wrapped its work in `act()`, the microtask fires
**after** `act()` has restored `IS_REACT_ACT_ENVIRONMENT`. The state update from the
resolved promise then appears unwrapped.

---

## Recommendations

### High Impact (quickest noise reduction)

1. **Set `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in `setup.ts`**
   - Eliminates the "not configured to support act(...)" messages.
   - Safe: RTL already sets it dynamically during operations; the global makes it `true` by
     default so edge-case async updates do not trigger warnings.
   - Location: `src/frontend/src/test/setup.ts`, add after existing global mocks.

2. **Convert `fireEvent` → `@testing-library/user-event`**
   - `userEvent` wraps interactions in `act()` and awaits async settlement.
   - Single biggest fix for `AssessTaskModal.spec.tsx` (~75% of all noise).

3. **Use `mockImplementation(() => Promise.resolve(value))` instead of `mockResolvedValue`**
   - Provides better integration with `act()` boundaries per community guidance.
   - Most impactful in files where async mocks resolve during render.

### Medium Impact

4. **Ensure `await` on async assertions**
   - Tests using `fireEvent` should wait for the resulting DOM change with
     `await findByRole(...)`, `await waitFor(...)`, or `await act(async () => {...})`.
   - Prevents the test from finishing before React processes state updates.

5. **Use `cleanup()` between lifecycle phases in modal tests**
   - React 19 forbids `rerender()` after `unmount()`. Some modal tests may still need
     explicit `cleanup()` calls between independent renders.

### Low Impact / Investigate Further

6. **CSSMotion warnings** come from antd internals and cannot be fully eliminated without
   upgrading `happy-dom` or suppressing the specific warnings.

7. **In `apiService.spec.ts`, wrap `callApi` invocations in `act()`** where they trigger
   React state updates through React Query. This quiets the 30 entries from synchronous
   harness callbacks.

---

## Severity Assessment

**None of the warnings indicate bugs in application code.** All 1192 tests pass. The
warnings are entirely test-quality issues that:

- Slow down developer feedback by drowning out real errors in `stderr`
- Add visual noise that obscures genuine test failures
- May mask unexpected state transitions when real failures occur

A targeted fix on the top 3–4 files (`AssessTaskModal.spec.tsx`, `apiService.spec.ts`,
`AssignmentDefinitionWizardModal.spec.tsx`, `ClassesManagementPanel.spec.tsx`) would
eliminate >80% of the noise.
