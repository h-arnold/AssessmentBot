# Frontend Testing Guidelines

## Overview

Frontend testing currently uses two layers:

- Unit/component tests with Vitest + Testing Library
- Browser end-to-end tests with Playwright

This document is intentionally minimal for now and should evolve as shared helpers, fixtures, and larger suites are added.

## Commands

From repository root:

```bash
# Frontend unit/component tests
npm run frontend:test

# Frontend tests in watch mode
npm run frontend:test:watch

# Frontend Playwright E2E suite
npm run frontend:test:e2e

# Frontend unit/component coverage check (minimum 85%)
npm run frontend:test:coverage
```

## Playwright execution

Before the first Playwright run on a fresh machine, dev container, or CI image, install Chromium and its required system dependencies once:

```bash
npm --prefix src/frontend exec -- playwright install --with-deps chromium
```

Use the non-interactive Playwright command as the pass/fail gate:

```bash
npm run frontend:test:e2e
```

If Chromium or its system dependencies are later missing or have been removed, rerun the install command and then rerun the suite:

```bash
npm --prefix src/frontend exec -- playwright install --with-deps chromium
npm run frontend:test:e2e
```

Use `--ui` or `--headed --debug` only for interactive diagnosis. The required completion signal is a clean `npm run frontend:test:e2e` run.

Target a specific unit test pattern:

```bash
npm run frontend:test -- src/App.spec.tsx
```

## Previewing mocked frontend pages locally

If you want to inspect page rendering and usability with the same mocked runtime states used in E2E tests, use Playwright in interactive mode.

### Quick preview options

From repository root:

```bash
# Open Playwright UI (good for clicking through scenarios)
npm run frontend:test:e2e -- --ui

# Run in a visible browser with Playwright Inspector
npm run frontend:test:e2e -- --headed --debug
```

Run a single mocked scenario by test name:

```bash
npm run frontend:test:e2e -- --headed --debug e2e-tests/auth-status.spec.ts -g "shows Authorised when backend returns true"
```

`src/frontend` is already the working directory for these scripts (via `npm --prefix src/frontend`), so pass test paths relative to `src/frontend/` (for example `e2e-tests/...`), not `src/frontend/e2e-tests/...`.

### How this maps to existing mocks

- `src/frontend/e2e-tests/auth-status.spec.ts` already installs `google.script.run` mocks before the app loads.
- Each test scenario then navigates to `/` and asserts user-visible state.
- In `--ui` or `--headed --debug` mode, those same scenarios double as a manual preview harness.

### Recommended VS Code workflow

- Install and use the Playwright Test extension.
- Run or debug individual tests from the Testing panel.
- Keep a dedicated preview-style spec for key UI states (for example authorised, unauthorised, backend error, delayed loading) so you can quickly verify usability during development.

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
- Frontend `apiHandler` mock helper: `src/frontend/src/test/googleScriptRunHarness.ts`.
- Builder JsonDb source fixture helpers: `scripts/builder/src/test/jsondb-source-test-helpers.ts` (shared by JsonDb source builder specs to build release archives, create path fixtures, and write release files/manifests).

When adding test scenarios, prefer extending an existing helper before copying setup logic into each spec.

### Mandatory `apiHandler` mock rule

When a frontend test needs to mock `google.script.run.apiHandler`, you must use the shared helper in `src/frontend/src/test/googleScriptRunHarness.ts`.

- **Vitest / jsdom tests:** use `createGoogleScriptRunApiHandlerMock(...)`.
- **Playwright browser init scripts:** inline `googleScriptRunApiHandlerFactorySource` inside `page.addInitScript(...)`.

Do not introduce new ad-hoc `google.script.run` mocks that mutate one shared runner object or store handlers on shared mutable state. Each mocked call must model GAS-style per-call callback isolation so overlapping requests cannot overwrite one another's success or failure handlers.

## Current Structure

- Unit/component tests: `src/frontend/src/**/*.spec.{ts,tsx}`
- Test setup: `src/frontend/src/test/setup.ts`
- E2E tests: `src/frontend/e2e-tests/**/*.spec.ts`
- Playwright config: `src/frontend/playwright.config.ts`

## Current Approach

- Use Vitest for invisible behaviour and fast deterministic checks.
- Use Playwright for visible, user-observable behaviour in a real browser.
- Keep tests decoupled from implementation details.
- Maintain a balanced pyramid: broad Vitest coverage, targeted Playwright journeys.

## Notes

- Frontend tests run in the frontend package (`src/frontend`) through root scripts.
- If frontend architecture changes substantially, update this file and `.github/agents/Testing.agent.md` together.
