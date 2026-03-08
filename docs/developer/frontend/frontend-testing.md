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

## Related standards

For frontend logging, error mapping, and environment-specific diagnostics policy, use:

- `docs/developer/frontend/frontend-logging-and-error-handling.md`

When tests cover logging/error pathways, keep expectations aligned with that document (for example stack-trace gating by environment and redaction behaviour). Treat that logging/error document as canonical and avoid duplicating policy text here.

## Coverage requirement

Frontend unit/component tests must meet a minimum coverage threshold of **85%** for lines, functions, statements, and branches. The threshold is enforced in `src/frontend/vite.config.ts` and checked via `npm run frontend:test:coverage`.

## Shared test helpers

Use shared helpers to keep fixtures and mocks consistent and avoid duplicate test setup code.

**Important:** for frontend logging assertions, spy on browser console endpoints (`console.debug/info/warn/error`) rather than reading implementation-specific globals.

- Frontend runtime setup helper: `src/frontend/src/test/setup.ts` (Testing Library + jest-dom integration).
- Builder JsonDb source fixture helpers: `scripts/builder/src/test/jsondb-source-test-helpers.ts` (shared by JsonDb source builder specs to build release archives, create path fixtures, and write release files/manifests).

When adding test scenarios, prefer extending an existing helper before copying setup logic into each spec.

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
