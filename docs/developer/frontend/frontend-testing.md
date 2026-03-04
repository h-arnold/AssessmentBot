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
```

Target a specific unit test pattern:

```bash
npm run frontend:test -- src/App.test.tsx
```

## Current Structure

- Unit/component tests: `src/frontend/src/**/*.test.tsx`
- Test setup: `src/frontend/src/test/setup.ts`
- E2E tests: `src/frontend/tests/**/*.spec.ts`
- Playwright config: `src/frontend/playwright.config.ts`

## Current Approach

- Prefer user-visible behaviour assertions with Testing Library.
- Keep tests decoupled from implementation details.
- Keep unit tests fast and deterministic.
- Use Playwright for top-level smoke and integration journeys.

## Notes

- Frontend tests run in the frontend package (`src/frontend`) through root scripts.
- If frontend architecture changes substantially, update this file and `.github/agents/Testing.agent.md` together.
