# Frontend Playwright E2E Testing Guide

## Overview

This document covers Playwright browser end-to-end testing for the AssessmentBot frontend.
It is the canonical reference for E2E test patterns, the runtime mock infrastructure, and
antd v6 interaction patterns in a real browser.

For unit/component testing with Vitest, see `frontend-testing.md`.

## Commands

From repository root:

```bash
# Full Playwright E2E suite (pass/fail gate)
npm run test:frontend:e2e

# Run a single spec file
npm run test:frontend:e2e -- e2e-tests/auth-status.spec.ts

# Run a specific test by name
npm run test:frontend:e2e -- e2e-tests/auth-status.spec.ts -g "shows Authorised when backend returns true"

# Interactive modes (for debugging only)
npm run test:frontend:e2e -- --ui
npm run test:frontend:e2e -- --headed --debug

# Focused repeated runs for flakiness validation
npm run test:frontend:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts -g "Create cohort button" --repeat-each=10 --workers=1
```

### Chromium Installation

Before the first Playwright run on a fresh machine, dev container, or CI image:

```bash
npm --prefix src/frontend exec -- playwright install --with-deps chromium
```

If Chromium or its system dependencies go missing, reinstall and rerun:

```bash
npm --prefix src/frontend exec -- playwright install --with-deps chromium
npm run test:frontend:e2e
```

## Test File Structure

- E2E tests live in `src/frontend/e2e-tests/**/*.spec.ts`
- Playwright config: `src/frontend/playwright.config.ts`
- Shared E2E runtime mocks: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- Feature-specific E2E helpers: `src/frontend/e2e-tests/helpers/**`
- Vite dev server is used as the web server (configured in `playwright.config.ts`)

## Behaviour Split: Vitest vs Playwright (Authoritative)

| Concern                                          | Tool           |
| ------------------------------------------------ | -------------- |
| State transitions, callback wiring, data mapping | Vitest         |
| Conditional rendering decisions                  | Vitest         |
| Accessibility attributes, semantic structure     | Vitest         |
| What users can **see and do** in a browser       | **Playwright** |
| Interactive flows across components/pages        | **Playwright** |
| Keyboard and pointer interaction                 | **Playwright** |
| Visual state transitions (light/dark, collapse)  | **Playwright** |
| Cross-page or runtime integration flows          | **Playwright** |

**Mandatory rule:** every new or changed **user-visible interaction** must have Playwright coverage.
Do not treat Vitest coverage as sufficient for visible browser behaviour such as clicks,
keyboard interaction, tab switching, toggles, or navigation.

When both are possible, default to Vitest first for fast feedback, then add Playwright coverage
for the highest-value user journeys.

---

## Runtime Mock Infrastructure

The E2E test suite uses a queue-based mock system (`endToEndRuntimeMocks.ts`) to simulate
backend responses without deploying a real server. Each mock method has a FIFO queue of
response entries. When the app calls a backend method via `google.script.run`, the mock
dequeues the next entry and resolves or rejects the call accordingly.

### RuntimeScenario Type

A `RuntimeScenario` is a plain object mapping backend method names to arrays of `ResponseItem` entries:

```typescript
type RuntimeScenario = {
  getAuthorisationStatus?: ReadonlyArray<ResponseItem>;
  getABClassPartials?: ReadonlyArray<ResponseItem>;
  getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>;
  // ... other backend methods
};
```

### ResponseItem Types

Each `ResponseItem` has a `kind` field that controls how the mock behaves:

| Kind               | Behaviour                                                       |
| ------------------ | --------------------------------------------------------------- |
| `success`          | Resolves with `data` as the successful response                 |
| `failureEnvelope`  | Rejects with a structured API error (`code`, `message`)         |
| `transportFailure` | Calls the failure handler with an `Error`                       |
| `deferredSuccess`  | Holds the promise open until `releaseNextDeferredSuccess(page)` |

**Void/delete response rule:** For backend methods that return no data (for example deletes, start-assessment-run), all response entry kinds (`success`, `deferredSuccess`) must include `data: null`. This matches the backend `_success()` contract (`data: data ?? null`) and survives `JSON.stringify` serialisation in the mock factory. Omitting `data` or using `data: undefined` causes the frontend `ApiSuccessResponseSchema.superRefine` to reject the envelope with `"Success response envelope must include a data field."`.

### Installing Mock Scenarios

Use `installRuntimeMock(page, scenario)` **before** navigating. This patches
`google.script.run` at the page level:

```typescript
import { installRuntimeMock } from './shared/endToEndRuntimeMocks';

const scenario = createAssessTaskScenario();
await installRuntimeMock(page, scenario);
await page.goto('/');
```

When adding new backend methods to the mock system, you must:

1. Add the method name to the `RuntimeScenario` type
2. Add it to `allMethods` inside `installRuntimeMock`
3. Create scenario factory helpers for the new method's response queues

### Scenario Factory Pattern

Instead of constructing `RuntimeScenario` objects inline, use scenario factory functions
that provide sensible defaults and allow optional overrides:

```typescript
// Factory with defaults
const scenario = createAssessTaskScenario();

// Factory with overrides for testing specific states
const errorEntry = {
  kind: 'failureEnvelope' as const,
  code: 'INTERNAL_ERROR' as const,
  message: 'API error',
};
const errorScenario = createAssessTaskScenario({
  getGoogleClassroomAssignments: [errorEntry, errorEntry],
});
```

Factories keep test files concise and centralise fixture maintenance. When adding a new
backend method, extend the relevant factory to include a default queue.

### Tracking Backend Calls

Use `getMethodCalls(page)` to verify which backend methods were invoked and in what order:

```typescript
const callsBefore = await getMethodCalls(page);
expect(callsBefore).toContain('getGoogleClassroomAssignments');

// Perform action that should NOT trigger a backend call
await dialog.getByRole('button', { name: 'Start Assessment' }).click();

const callsAfter = await getMethodCalls(page);
expect(callsAfter).toEqual(callsBefore);
```

### Deferred Response Pattern for Loading States

To test loading/ready transitions, use `deferredSuccess` entries and
`releaseNextDeferredSuccess(page)`:

```typescript
const deferredEntry = {
  kind: 'deferredSuccess' as const,
  data: MOCK_COURSEWORK_ASSIGNMENTS[0].data,
};
const scenario = createAssessTaskScenario({
  getGoogleClassroomAssignments: [deferredEntry, deferredEntry],
});
await installRuntimeMock(page, scenario);
await page.goto('/');

// Trigger the action that opens the modal
await page.getByRole('button', { name: 'Assess Task' }).first().click();

// Assert loading state
await expect(dialog.locator('[role="status"]')).toBeVisible();
await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

// Release the deferred response
await releaseNextDeferredSuccess(page);

// Assert ready state
await expect(dialog.locator('[role="status"]')).toHaveCount(0);
await expect(dialog.getByRole('combobox')).toBeVisible();
```

---

## React 19 StrictMode Double-Effect Rule (Critical)

React 19 StrictMode intentionally double-fires `useEffect` in development builds. Playwright
E2E tests run against the Vite dev server, so **StrictMode is always active**.

**Rule:** Every custom response queue must provide **2 entries per expected real call**
(one for each StrictMode replay).

```typescript
// ❌ Single entry — second StrictMode call fails with "Unexpected call index"
getGoogleClassroomAssignments: [{ kind: 'success', data: [{ id: 'cw-1', title: 'HW' }] }],

// ✅ Two identical entries — both calls succeed, component stabilises
getGoogleClassroomAssignments: [
  { kind: 'success', data: [{ id: 'cw-1', title: 'HW' }] },
  { kind: 'success', data: [{ id: 'cw-1', title: 'HW' }] },
],
```

The same rule applies to `failureEnvelope`, `deferredSuccess`, and `transportFailure` entries.
For tests that open a modal multiple times, multiply accordingly:

- 1 open × 2 effect replays = **2** queue entries
- 2 opens × 2 effect replays = **4** queue entries

Default shared fixtures should provide at least two entries so that callers relying on the
default get StrictMode-safe queues without extra configuration.

---

## Ant Design Interaction Patterns

### Select Component

antd `Select` uses custom dropdown rendering. Never use Playwright's built-in `selectOption`.
Instead, use the project helper `selectVisibleOption(page, label)`:

```typescript
// Open the dropdown
await dialog.getByRole('combobox').click();

// Select an option by its visible text
await selectVisibleOption(page, 'Algebra Homework');

// Verify selection effect
await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
```

### Modal Mask (Backdrop) Clicks

antd v6 uses `.ant-modal-wrap` for mask click handling. Click near the edge of the wrap
element:

```typescript
// ✅ Use .ant-modal-wrap with position offset
await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });
await expect(page.getByRole('dialog')).toHaveCount(0);
```

Do **not** click `.ant-modal-mask` directly — it will not trigger the close handler in antd v6.

### Typography.Text Visibility

Ant Design's `Typography.Text` renders as a `<span>`. When `type="secondary"` or other styling
props are applied, Playwright may resolve the element as **hidden** even though it is visible
to a human user. `toBeVisible()` assertions on `Typography.Text` elements can therefore fail.

Prefer structural locators that do not depend on visibility checks:

```typescript
// ❌ May resolve as hidden — flaky
await expect(dialog.getByText('Algebra Homework').first()).toBeVisible();

// ✅ Structural check — reliable
await expect(dialog.locator('.ant-typography-secondary').getByText('Algebra Homework')).toHaveCount(
  1
);
```

### Select Placeholder Text

antd v6 attaches `role="combobox"` to a void `<input type="search">` element. Void elements
have no `textContent`, so `expect(select).toHaveTextContent('placeholder')` always fails.
Use `getByText` or a class-based locator instead:

```typescript
// ❌ Fails — void element has no textContent
expect(page.getByRole('combobox')).toHaveTextContent('Select an assignment');

// ✅ Works
await expect(page.getByText('Select an assignment')).toBeVisible();
```

---

## Playwright Best Practices

### Use Web-First Assertions

Web-first assertions (`toBeVisible()`, `toBeEnabled()`, `toBeDisabled()`) automatically wait
for the expected state. Always prefer them:

```typescript
// ✅ Auto-waits for element to be visible
await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

// ✅ Auto-waits for element to be enabled
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();

// ✅ Auto-waits for element to be disabled
await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
```

Never use manual assertions that don't await:

```typescript
// ❌ No auto-wait — checks immediately and likely fails
expect(await page.getByText('welcome').isVisible()).toBe(true);
```

### Use Role-Based Locators

Prefer `page.getByRole(...)` over CSS or XPath selectors. Role-based locators are more
resilient to DOM changes and reflect how users interact with the page:

```typescript
// ✅ Resilient
page.getByRole('button', { name: 'Submit' });
page.getByRole('dialog');
page.getByRole('combobox');
page.getByRole('alert');
page.getByRole('menuitem', { name: 'Classes' });

// ❌ Fragile — breaks on DOM/class changes
page.locator('button.buttonIcon.episode-actions-later');
page.locator('#some-dynamic-id');
```

Use chaining and filtering to narrow locators:

```typescript
const product = page.getByRole('listitem').filter({ hasText: 'Product 2' });
await product.getByRole('button', { name: 'Add to cart' }).click();
```

### Never Use Hard-Coded Timeouts

```typescript
// ❌ Anti-pattern — always waits full duration, flaky
await page.waitForTimeout(1000);
await expect(page.getByText('Loaded')).toBeVisible();

// ✅ Let Playwright auto-wait
await expect(page.getByText('Loaded')).toBeVisible();
```

### Assertion Order Must Match Code Execution

When code closes a modal before showing a message, assert in that order:

```typescript
// Code: close modal → refetch → show success message

// ✅ Match execution order
await expect(page.getByRole('dialog')).toHaveCount(0); // Modal closed first
await expect(page.getByText(/deleted\./i)).toBeVisible(); // Then message appears
```

### Test Isolation

Each test must be independently runnable with its own scenario and mock install. Tests should
not depend on state from previous tests. Use `test.describe` blocks for grouping.

### Mock External Dependencies

Never make real backend calls in E2E tests. Always use `installRuntimeMock` to provide
deterministic responses. This keeps tests fast and eliminates flakiness from external services.

### Summary of Anti-Patterns

| Anti-Pattern                                                | Why It's Bad                                                                                                                             | Correct Approach                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `page.waitForTimeout(N)`                                    | Always waits full duration, causes flakiness                                                                                             | Use web-first assertions                                               |
| CSS/XPath selectors                                         | Break on DOM/class changes                                                                                                               | Use `getByRole`, `getByLabel`                                          |
| Manual `isVisible()` assertions                             | No auto-wait, fails immediately                                                                                                          | Use `expect(...).toBeVisible()`                                        |
| Single-entry StrictMode queues                              | Second effect call gets "Unexpected index"                                                                                               | Double every queue entry                                               |
| `selectOption` on antd Select                               | antd uses custom dropdown, not `<select>`                                                                                                | Use `selectVisibleOption(page, ...)`                                   |
| `.ant-modal-mask` click                                     | antd v6 uses `.ant-modal-wrap` for mask                                                                                                  | Click `.ant-modal-wrap` edge                                           |
| `toBeVisible` on Typography.Text                            | Playwright may resolve as hidden                                                                                                         | Use `toHaveCount(1)` or structural                                     |
| Mocks installed AFTER `page.goto`                           | Component renders with stale defaults                                                                                                    | Install mocks before `page.goto`                                       |
| `{ kind: 'success' }` without `data: null` for void methods | Backend `_success` sends `data: null`; `JSON.stringify` strips `undefined`, and `ApiSuccessResponseSchema` requires `data` to be present | Always use `{ kind: 'success', data: null }` for void/delete responses |

---

## Geometry Assertion Stabilisation

When asserting modal layout geometry for Ant Design tables, use this stabilisation pattern:

1. Measure against the stable project-controlled scaffold `Flex` container (located via `.ant-modal-body > .ant-flex`, the direct parent of both the create button and the table) rather than antd's internal `ant-table-wrapper` or the inner `<table>` bounding box. The `ant-table-wrapper` bounding box can vary between headless CI Chromium and local headed Chromium due to font substitution and antd internal CSS changes across versions.
2. Use `offsetLeft` and `offsetWidth` (layout properties obtained via `locator.evaluate()`) instead of `boundingBox()` (visual properties). This is critical because antd Modal's entrance zoom animation applies a CSS `transform: scale(...)` that makes `boundingBox()` return intermediate visual sizes during the animation. `offsetLeft` and `offsetWidth` are layout properties unaffected by CSS transforms, so they return the final layout dimensions immediately without waiting for the animation to settle.
3. Keep scaffold ready-state layout full-width (`style={{ width: '100%' }}`) on both the scaffold `Flex` container and the `Table`.
4. Recalibrate tolerance constants only after repeated deterministic Playwright runs, not after a single pass. Playwright assertion error messages include expected and received values for calibration.
5. Validate with focused repeated runs (`--repeat-each`) and optionally serialise workers (`--workers=1`) before finalising thresholds.

```bash
npm run test:frontend:e2e -- e2e-tests/classes-crud-manage-cohorts.spec.ts -g "Create cohort button" --repeat-each=10 --workers=1
```

---

## Debugging and Interactive Usage

### Quick Preview

```bash
# Open Playwright UI (good for clicking through scenarios)
npm run test:frontend:e2e -- --ui

# Run in a visible browser with Playwright Inspector
npm run test:frontend:e2e -- --headed --debug

# Run a single mocked scenario by test name
npm run test:frontend:e2e -- --headed --debug e2e-tests/auth-status.spec.ts -g "shows Authorised"
```

### VS Code Extension

Install the Playwright Test extension for VS Code. It allows:

- Running and debugging individual tests from the Testing panel
- Live locator editing and validation
- Breakpoint-based debugging in the browser

### Trace Viewer

Traces are configured as `on-first-retry` in `playwright.config.ts`. To force trace collection:

```bash
npm run test:frontend:e2e -- --trace on
npx playwright show-report
```

---

## Previewing Mocked Pages Locally

E2E test scenarios double as a manual preview harness. Each test installs `google.script.run`
mocks before the app loads, so in `--ui` or `--headed --debug` mode you can interact with
the mocked UI directly. Keep a dedicated preview-style spec for key UI states (authorised,
unauthorised, backend error, delayed loading) to quickly verify usability during development.

---

## Shared Helpers and Imports

- E2E runtime mocks: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- Classes E2E helpers: `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
  - For Playwright init scripts, inline `googleScriptRunApiHandlerFactorySource` inside `page.addInitScript(...)`
- Classes page test helpers (shared fixtures): `src/frontend/src/test/classes/classesPageTestHelpers.ts`
  - Use `toPlainClassPartials(classPartials)` for JSON serialisation in `addInitScript` scenarios
  - Use `createClassesOrderScenario(classPartials)` for ordering tests

**Do not import `src/test/**` from production source.\*\* The frontend ESLint config enforces this boundary.

### Mandatory `apiHandler` Mock Rule

When a Playwright test needs to mock `google.script.run.apiHandler`, inline
`googleScriptRunApiHandlerFactorySource` inside `page.addInitScript(...)`. Do not introduce
new ad-hoc `google.script.run` mocks that mutate one shared runner object.

### Classes CRUD Harness Continuity

Extend the existing scenario harness in `src/frontend/e2e-tests/classes-crud.harness.spec.ts`
and its shared queue/helpers. Do not create a parallel Classes CRUD harness with duplicate
backend queueing logic. New Classes CRUD Playwright specs may be added for focused journeys
but must consume the same shared harness primitives.
