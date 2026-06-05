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
npm run frontend:test

# Frontend tests in watch mode
npm run frontend:test:watch

# Frontend Playwright E2E suite (see frontend-playwright-e2e.md)
npm run frontend:test:e2e

# Frontend unit/component coverage check (minimum 85%)
npm run frontend:test:coverage
```

Target a specific unit test pattern:

```bash
npm run frontend:test -- src/App.spec.tsx
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

## Test naming and traceability

Name frontend tests after the behaviour, component, hook, or service they verify.

Avoid temporary planning labels in test names and helpers. In particular, do not use action-plan section numbering such as `Section 1`, `Section 2`, or similar in `describe(...)` blocks, test titles, constants, or fixture names. This is a repository-wide rule and applies even when tests are written directly from an action plan. Those labels become misleading as plans evolve or are deleted.

Prefer names such as `getBackendConfig rejects malformed payloads` or `Configuration service calls callApi with the backend method name` over names that refer only to a planning document.

When frontend work depends on backend configuration transport behaviour, keep the layers separate:

- frontend service validation and `callApi` usage belong in `src/frontend/src/services/backendConfigurationService.spec.ts`
- dedicated backend configuration transport coverage belongs in `tests/api/backendConfigApi.test.js`
- broader backend dispatcher coverage remains in `tests/api/apiHandler.test.js`

For assignment-definition transport work, keep the same split:

- frontend service validation and `callApi` usage belong in `src/frontend/src/services/assignmentDefinitionPartialsService.spec.ts`
- frontend schema-contract coverage belongs in `src/frontend/src/services/assignmentDefinitionPartials.zod.spec.ts`
- dedicated backend transport coverage belongs in `tests/backend-api/assignmentDefinitionPartials.unit.test.js` and `tests/api/assignmentDefinitionDeleteApi.test.js`

## Related standards

For frontend logging, error mapping, and environment-specific diagnostics policy, use:

- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

When tests cover logging/error pathways, keep expectations aligned with that document (for example stack-trace gating by environment and redaction behaviour). Treat that logging/error document as canonical and avoid duplicating policy text here.

## Coverage requirement

Frontend unit/component tests must meet a minimum coverage threshold of **85%** for lines, functions, statements, and branches. The threshold is enforced in `src/frontend/vite.config.ts` and checked via `npm run frontend:test:coverage`.

## Shared test helpers

Use shared helpers to keep fixtures and mocks consistent and avoid duplicate test setup code.

**Important:** for frontend logging assertions, spy on browser console endpoints (`console.debug/info/warn/error`) rather than reading implementation-specific globals.

- Frontend runtime setup helper: `src/frontend/src/test/setup.ts` (Testing Library + jest-dom integration).
- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx` (QueryClient + startup-warmup providers for component tests; prefer this over ad-hoc `QueryClientProvider` wrappers).
- Frontend `apiHandler` mock helper: `src/frontend/src/test/googleScriptRunHarness.ts`.
- Classes fixture/state helper: `src/frontend/src/test/classes/classesTestHelpers.ts` (shared rows, ready-state builders, and batch-result builders for Classes table/toolbar/panel specs).
- Classes modal test helpers: `src/frontend/src/test/classes/modalTestHelpers.tsx` (shared interaction helpers, assertion utilities, and mock creators for Classes modal components).
- Classes Page test helpers: `src/frontend/src/test/classes/classesPageTestHelpers.tsx` (shared ClassPartial/YearGroup fixtures, rendering helpers, assertion utilities, and E2E serialisation helpers for ClassesPage component tests).
- Builder fixture helpers: `scripts/builder/src/test/builder-fixture-test-helpers.ts` (shared by builder specs to build release archives, create path fixtures, and write release files/manifests).

When adding test scenarios, prefer extending an existing helper before copying setup logic into each spec. In particular, Classes feature specs should reuse `src/frontend/src/test/classes/classesTestHelpers.ts` for row fixtures and state builders, `src/frontend/src/test/classes/modalTestHelpers.tsx` for modal interaction patterns, and `src/frontend/src/test/classes/classesPageTestHelpers.tsx` for ClassesPage fixtures and rendering, rather than redefining near-identical test utilities in each file.

Shared frontend test helpers belong under `src/frontend/src/test/**`. Feature-scoped subfolders are allowed when they keep related fixtures together, but production feature folders should stay free of shared test helpers.

### Classes Modal Test Helpers

The `src/frontend/src/test/classes/modalTestHelpers.tsx` module provides reusable utilities for testing modal components in the Classes feature:

- **Interaction helpers:**
  - `changeCourseLength(value: string): void` - Changes the course length input value
  - `chooseOption(fieldLabel: string, optionLabel: string): Promise<void>` - Opens a selector and chooses an option by visible label

- **Assertion utilities:**
  - `assertValidationMessage(message: string): Promise<void>` - Asserts that a validation message is displayed
  - `assertErrorMessage(message: string): Promise<void>` - Asserts that an error message is displayed
  - `assertControlDisabled(role: string, name: string): void` - Asserts that a control is disabled

- **Mock creators:**
  - `createMockConfirm(): Function` - Creates a mock confirm function for successful submissions
  - `createMockConfirmWithError(error: Error): Function` - Creates a mock confirm function that rejects with an error

These helpers eliminate duplication across modal test files and ensure consistent testing patterns.

### Classes Page Test Helpers

The `src/frontend/src/test/classes/classesPageTestHelpers.tsx` module provides reusable fixtures, rendering utilities, and assertion helpers for ClassesPage component tests:

- **Rendering helpers:**
  - `renderClassesPage(options?: RenderClassesPageOptions)` — Renders ClassesPage with pre-populated query client data. Accepts optional `classPartials` and `yearGroups` overrides; defaults to `MOCK_CLASS_PARTIALS` and `MOCK_YEAR_GROUPS`.
  - `renderEmptyClassesPage()` — Renders ClassesPage with empty query data for empty-state tests.
  - `renderInvalidClassesPage()` — Renders ClassesPage with invalid class partials for trust-failure tests.
  - `createQueryClientWithClassesData(classPartials, yearGroups)` — Creates a query client with pre-populated ClassesPage data for setup-before-render workflows.

- **Model verification helpers:**
  - `verifyClassesPageModel(classPartials, yearGroups)` — Builds and verifies the ClassesPage view model, returning the model result plus `isInvalid` and `isEmpty` flags.
  - `isValidPanelViewModel(modelResult)` / `isInvalidDataViewModel(modelResult)` — Type guards for discriminated model results.

- **Assertion utilities:**
  - `assertCollapseRegion(namePattern?)` / `assertNoCollapseRegion(namePattern?)` — Assert presence/absence of year-group collapse regions.
  - `assertBlockingAlert()` / `assertNoBlockingAlert()` — Assert presence/absence of trust-failure blocking alerts.
  - `assertLoadingSkeleton()` / `assertNoLoadingSkeleton()` — Assert presence/absence of skeleton loading indicators.
  - `assertEmptyState(messagePattern?)` — Assert empty-state message is present.
  - `assertClassesPageHeading()` — Assert the page heading is present.
  - `getClassCardByName(namePattern)` / `assertClassCardExists(namePattern)` — Locate and assert class cards.
  - `assertPanelHasClassCount(modelResult, yearGroupKey, expectedClassCount)` — Assert a panel has the expected number of classes.
  - `assertPanelHeader(labelPattern)` / `assertPanelHeaderExpanded(labelPattern, expectedExpanded)` — Assert panel header presence and expansion state.
  - `assertPanelContainsClass(panelLabelPattern, cardNamePattern)` — Assert a panel contains a specific class card.
  - `assertPanelEmpty(panelLabelPattern)` — Assert a panel shows an empty-state message.

- **Shared ClassPartial/YearGroup fixtures (use these instead of defining local duplicates):**
  - `MOCK_YEAR_GROUPS` / `MOCK_CLASS_PARTIALS` — Default three-year-group fixture with three classes.
  - `MOCK_EMPTY_YEAR_GROUPS` / `MOCK_EMPTY_CLASS_PARTIALS` — Empty fixtures for empty-state tests.
  - `MOCK_INVALID_CLASS_PARTIALS` — Invalid data fixture for trust-failure tests.
  - `MIXED_ORDER_YEAR_GROUPS` / `MIXED_ORDER_CLASS_PARTIALS` — Year groups in mixed order (sorted alphabetically by the page).
  - `YEAR_GROUPS_WITH_EMPTY` / `CLASS_PARTIALS_FOR_EMPTY_PANEL` — Year 9 has no classes, Year 10 has one class (empty-panel tests).
  - `ALPHABETICAL_ORDER_CLASS_PARTIALS` — Three classes needing alphabetical ordering by className.
  - `TIE_BREAK_CLASS_PARTIALS` — Classes with same className but different classId for tie-break sort tests.
  - `SINGLE_YEAR_GROUP` — Single year group for focused tests.

**Fixture factories — `createFixtureClassPartial` and `createFixtureYearGroup`:**

All shared fixture constants are built from two exported factory functions that provide sensible defaults and keep fixture construction concise:

`createFixtureClassPartial(overrides)` — Creates a `ClassPartial` fixture. Only `classId` is required; all other fields default to the project's conventional fixture defaults (`className: 'Test Class'`, `cohortKey: null`, `courseLength: 1`, `yearGroupKey: 'default-yg'`, `classOwner: null`, `teachers: []`, `active: null`).

`createFixtureYearGroup(key, name)` — Creates a `YearGroup` fixture with the given key and name.

Usage example — creating a minimal fixture with only the fields you care about:

```typescript
const myClass = createFixtureClassPartial({
  classId: 'c-1',
  className: 'My Class',
  yearGroupKey: 'yg-10',
});
// All other fields use defaults (cohortKey: null, courseLength: 1, etc.)

const myYearGroup = createFixtureYearGroup('yg-10', 'Year 10');
```

The six shared fixture constant arrays (`MOCK_CLASS_PARTIALS`, `MOCK_INVALID_CLASS_PARTIALS`, `MIXED_ORDER_CLASS_PARTIALS`, `CLASS_PARTIALS_FOR_EMPTY_PANEL`, `ALPHABETICAL_ORDER_CLASS_PARTIALS`, `TIE_BREAK_CLASS_PARTIALS`) are all built from these factories, typically one line per class partial entry. When adding new fixture constants, prefer these factories over ad-hoc object literals.

**Fixture naming convention:** Fixtures holding `ClassPartial[]` arrays use the `_CLASS_PARTIALS` suffix (for example `ALPHABETICAL_ORDER_CLASS_PARTIALS`, not `ALPHABETICAL_ORDER_CLASSES`). This aligns with the `ClassPartial` type name and avoids ambiguity with full `Class` model fixtures held in `src/frontend/src/test/classes/classesTestHelpers.ts`.

**E2E serialisation helper — `toPlainClassPartials(classPartials)`:**
Converts typed `ClassPartial[]` fixtures to plain JavaScript objects suitable for JSON serialisation in Playwright `addInitScript` scenarios. Use this instead of ad-hoc `.map()` spread operators:

```typescript
// ✅ Correct: use the canonical helper
classPartials: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS);

// ❌ Avoid: ad-hoc spread in each scenario factory
classPartials: MIXED_ORDER_CLASS_PARTIALS.map((cp) => ({
  classId: cp.classId,
  className: cp.className /* ... */,
}));
```

**E2E scenario factory — `createClassesOrderScenario(classPartials)`:**
The E2E helper `src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts` provides a single parameterised `createClassesOrderScenario(classPartials)` factory instead of separate `createClassesAlphabeticalOrderScenario()` and `createClassesTieBreakOrderScenario()` functions. Pass `ALPHABETICAL_ORDER_CLASS_PARTIALS`, `TIE_BREAK_CLASS_PARTIALS`, or any other `ClassPartial[]` fixture:

```typescript
import { createClassesOrderScenario } from '../helpers/classes-page-end-to-end-helpers';
import {
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
} from '../../src/test/classes/classesPageTestHelpers';

const alphabeticalScenario = createClassesOrderScenario(
  toPlainClassPartials(ALPHABETICAL_ORDER_CLASS_PARTIALS)
);
const tieBreakScenario = createClassesOrderScenario(toPlainClassPartials(TIE_BREAK_CLASS_PARTIALS));
```

Production source must not import from `src/test/**`. The frontend ESLint config enforces that boundary so helper placement and import paths stay explicit.

### Mandatory `apiHandler` mock rule

When a frontend test needs to mock `google.script.run.apiHandler`, you must use the shared helper in `src/frontend/src/test/googleScriptRunHarness.ts`.

- **Vitest / jsdom tests:** use `createGoogleScriptRunApiHandlerMock(...)`.
- **Playwright browser init scripts:** inline `googleScriptRunApiHandlerFactorySource` inside `page.addInitScript(...)`.

Do not introduce new ad-hoc `google.script.run` mocks that mutate one shared runner object or store handlers on shared mutable state. Each mocked call must model GAS-style per-call callback isolation so overlapping requests cannot overwrite one another's success or failure handlers.

#### GAS serialization fidelity rule

The shared harness factory (`src/frontend/src/test/google-script-run-harness-factory.js`)
automatically wraps `successHandler` with `JSON.stringify()`, faithfully simulating real GAS
behaviour where `google.script.run` auto-stringifies return values.

- **Do not add `JSON.stringify()` in individual test files.** The factory handles this.
  Adding manual `JSON.stringify()` in a spec file is redundant and risks double-encoding.
- **Do not add `JSON.parse()` in test callbacks.** The production `apiService.ts` (`dispatchAttempt`)
  handles deserialization before Zod validation. Tests should pass raw objects to the factory's
  `successHandler` — the factory stringifies them, and `apiService.ts` parses them back.
- **`failureHandler` must not be stringified.** Real GAS passes raw error strings to
  `failureHandler`. The factory leaves `failureHandler` unwrapped.
- **All `google.script.run` mocks must use the factory:**
  - Vitest: `createGoogleScriptRunApiHandlerMock(invokeRequest)`
  - E2E: inject `googleScriptRunApiHandlerFactorySource` via `page.addInitScript(...)`
  - Direct assignment to `globalThis.google.script.run` that bypasses the factory is prohibited.

### Classes CRUD harness continuity rule

For Settings-page Classes CRUD browser tests, extend the existing scenario harness in `src/frontend/e2e-tests/classes-crud.harness.spec.ts` and its shared queue/helpers.

- Do not create a parallel Classes CRUD harness with duplicate backend queueing logic.
- Keep new Classes CRUD journeys aligned with the shared harness fixtures so load-state, failure-state, and ordering semantics stay consistent across workstreams.
- New Classes CRUD Playwright specs may be added for focused journeys, but they should consume the same shared harness primitives rather than reimplementing them.

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

// Mock fetchQuery for fire-and-forget calls
vi.spyOn(queryClient, 'fetchQuery').mockImplementation(() => Promise.resolve());

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

## Current Structure

- Unit/component tests: `src/frontend/src/**/*.spec.{ts,tsx}`
- Shared test helpers: `src/frontend/src/test/**`
- Test setup: `src/frontend/src/test/setup.ts`
- E2E tests: `src/frontend/e2e-tests/**/*.spec.ts` (see `frontend-playwright-e2e.md`)
- Playwright config: `src/frontend/playwright.config.ts`

## Current Approach

- Use Vitest for invisible behaviour and fast deterministic checks (this document).
- Use Playwright for visible, user-observable behaviour in a real browser (see `frontend-playwright-e2e.md`).
- Keep tests decoupled from implementation details.
- Maintain a balanced pyramid: broad Vitest coverage, targeted Playwright journeys.

## CSS and Style Testing

### Vitest CSS ?inline Import Handling

**Problem:** By default, Vitest does NOT automatically process CSS files with `?inline` queries during tests. When tests import CSS like `import rawStyles from '../index.css?inline'`, the import returns `undefined` without proper configuration.

**Solution:** Enable CSS processing in the Vite test configuration by setting `css: true` in `vite.config.ts`:

```typescript
export default defineConfig({
  test: {
    // Enable CSS processing for ?inline imports
    css: true,
    // ... other test config
  },
});
```

This allows Vite's CSS plugin to transform `?inline` imports so they return the raw CSS string content during tests.

**Impact:** Without this setting, patterns like `appStylesRaw.ts` that import and parse CSS selectors will fail because the import resolves to `undefined`.

**Reference:**

- [Vitest Configuration - css option](https://vitest.dev/config/#css)

### getComputedStyle Mocking (HappyDOM Limitation)

**Problem:** HappyDOM has incomplete `getComputedStyle` support:

- Missing the `pseudoElement` parameter in the function signature
- Unreliable or missing values for CSS custom properties
- Returns empty strings for common Ant Design properties (width, height, display, position, etc.)

Ant Design components use `getComputedStyle` internally for layout calculations, so incomplete mocks cause rendering issues and test failures.

**Solution:** Provide a global mock that:

- Matches the real signature: `(element: Element, pseudoElement?: string | null) => CSSStyleDeclaration`
- Returns realistic values for properties Ant Design commonly checks

**Minimal recommended mock implementation:**

```typescript
function getComputedStyleMock(
  element?: Element,
  pseudoElement?: string | null
): CSSStyleDeclaration {
  const essentialProperties: Record<string, string> = {
    // Layout
    display: 'block',
    width: '100px',
    height: 'auto',
    'box-sizing': 'border-box',
    position: 'static',
    overflow: 'visible',

    // Spacing
    padding: '0px',
    margin: '0px',

    // Borders
    'border-width': '0px',
    'border-style': 'solid',

    // Colors
    'background-color': 'rgb(255, 255, 255)',
    color: 'rgb(0, 0, 0)',

    // Text
    'font-size': '14px',
    'line-height': '1.5',

    // Positioning (Modal/Dropdown/Tooltip)
    'z-index': 'auto',
    left: '0px',
    top: '0px',
  };

  const propertyNames = Object.keys(essentialProperties);

  return {
    getPropertyValue: (property: string) => essentialProperties[property] || '',
    setProperty: () => {},
    removeProperty: () => {},
    cssText: '',
    length: propertyNames.length,
    parentRule: null,
    item: (index: number) => propertyNames[index] || '',
  } as unknown as CSSStyleDeclaration; // Double assertion required: mock implements only the ~20 properties Ant Design reads, not all 500+ of CSSStyleDeclaration. `unknown` is the type-safe way to assert intentional type override for test doubles.
}

// Define on both globalThis and window for compatibility
Object.defineProperty(globalThis, 'getComputedStyle', {
  configurable: true,
  value: getComputedStyleMock,
  writable: true,
});

Object.defineProperty(globalThis.window, 'getComputedStyle', {
  configurable: true,
  value: getComputedStyleMock,
  writable: true,
});
```

**Properties to include:** Focus on what Ant Design components check internally:

- Modal: `position`, `z-index`, `left`, `top`, `width`, `height`, `display`
- Table: `width`, `height`, `overflow`, `display`
- Menu/Dropdown/Tooltip: `width`, `height`, `transform`, `display`, `z-index`
- Select: `width`, `position`, `z-index`, `display`
- Background checks: `background-color`

**Reference:**

- [HappyDOM getComputedStyle limitations](https://github.com/capricorn86/happy-dom/issues)
- [MDN getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)

### Vitest vi.mock Gotchas

**Problem:** Vitest's `vi.mock` accepts only **2 arguments** (importPath, factoryFunction). The Jest pattern of adding `{ virtual: true }` as a third argument does **not** work in Vitest.

```typescript
// ❌ AVOID: Jest-style third argument not supported in Vitest
vi.mock('./some-module', () => ({ ... }), { virtual: true });

// ✅ CORRECT: Use only 2 arguments for Vitest
vi.mock('./some-module', () => ({ ... }));
```

**For virtual modules in Vitest**, use the `vi.hoisted` pattern or configure via `vite.config.ts` mocks instead.

**Reference:**

- [Vitest vi.mock documentation](https://vitest.dev/api/vi.html#vi-mock)

### Ant Design CSS Dependencies

Ant Design components rely on `getComputedStyle` for layout calculations. When mocking this API, ensure your mock returns **non-empty values** for these commonly checked properties:

| Component     | Properties Checked                                                                      |
| ------------- | --------------------------------------------------------------------------------------- |
| Modal         | `position`, `z-index`, `left`, `top`, `width`, `height`, `display`                      |
| Table         | `width`, `height`, `overflow`, `display`                                                |
| Menu/Dropdown | `width`, `height`, `transform`, `display`, `z-index`                                    |
| Select        | `width`, `position`, `z-index`, `display`                                               |
| General       | `box-sizing`, `padding`, `margin`, `border-*`, `background-color`, `color`, `font-size` |

**Common failure pattern:** A mock that returns empty strings for all properties causes Ant Design components to miscalculate dimensions, leading to hidden elements, incorrect positioning, or rendering failures.

## antd v6 Testing Patterns

These patterns address behavioural differences in antd v6 (and `@rc-component/dialog`)
that cause tests written for antd v5 to fail silently. Apply them proactively when writing
modal, select, or state-transition tests against antd v6.

### 1. Modal mask (backdrop) click

antd v6 delegates modal rendering to `@rc-component/dialog`, which uses a **mousedown‑then‑mouseup
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

### 2. Select placeholder text

antd v6 attaches `role="combobox"` to a void `<input type="search">` element. Void elements
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

### 3. Selected value rendered in multiple DOM locations

antd v6 renders the currently selected Select value in several places for accessibility
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

### 4. React 19 forbids render after unmount

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

### 5. Playwright-specific antd v6 patterns

For Playwright-specific antd v6 patterns (StrictMode double-effect handling, `Typography.Text`
visibility, E2E runtime mock infrastructure, `selectVisibleOption`, and modal mask clicks in
a real browser), see `docs/developer/frontend/frontend-playwright-e2e.md`.

## Notes

- Frontend unit/component tests run in the frontend package (`src/frontend`) through root scripts.
- For Playwright E2E tests, see `docs/developer/frontend/frontend-playwright-e2e.md`.
- If frontend architecture changes substantially, update this file, `frontend-playwright-e2e.md`, and `.github/agents/Testing.agent.md` together.
