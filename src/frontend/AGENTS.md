# Frontend Agent Instructions (`src/frontend`)

Applies when editing `src/frontend/**`.

opencode injects this file when you touch a frontend file. The docs it points to are **not** injected — read them when the trigger below applies. Keep this file to non-negotiables and the read gate; move detailed policy, rationale, and inventories into the docs.

## 1. Scope

- Frontend code is ESM React + Vite on TypeScript, targeting modern ECMAScript (ES2024-level project config). It is not GAS runtime code.
- Use idiomatic, typed, composable React function components with explicit data contracts.
- App code lives under `src/frontend/src/**`; the frontend package and tooling are self-contained in `src/frontend/package.json`.
- Run frontend tasks from the repo root with `npm --prefix src/frontend ...`.

## 2. Non-negotiables

- Route every frontend-to-backend call through `callApi` in `src/frontend/src/services/apiService.ts`. Never use `google.script.run`, backend globals, or any other transport shortcut.
- Never import runtime modules from `src/backend` into frontend code; treat the boundary as an API.
- Keep `App.tsx` a thin composition root — compose feature entry components only. No feature state machines and no service calls.
- Keep feature code in `src/frontend/src/features/` and keep `src/frontend/src/pages/` as thin composition roots. No feature logic, state machines, or hooks in `pages/`.
- Never import `features/classPage/**` from `features/taskHeatmap/**`. Share heatmap logic through `services/dataAnalysis/` instead.
- Use Zod for all frontend validation: define the schema first, derive types with `z.infer`, and match the canonical data-shapes contract.
- Fail loudly. Never catch-and-ignore errors or hide them behind defensive checks.
- Export functions as functions, not constants assigned to arrow functions (a review-failing anti-pattern without very good reason).
- Do not add `@ant-design/v5-patch-for-react-19`; Ant Design v6 does not need it.
- Decompose any frontend file over 550 lines that is in scope for your change, in the same change. Never game the threshold with formatting tricks or speculative helpers.
- Set default values in a module's constructor only; root `AGENTS.md` owns this rule.

## 3. Required documentation

Read the matching doc before you act. When in doubt, read it.

| Doc                                                                            | Read before                                                                                                              | Covers                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `docs/developer/frontend/frontend-architecture.md`                             | creating, moving, or reorganising feature or service files, splitting a large file, or changing transport serialisation  | service-folder grouping, feature layout, decomposition, transport serialization |
| `docs/developer/frontend/frontend-loading-and-width-standards.md`              | changing loading, refresh, mutation feedback, degraded-data handling, or page/panel width                                | loading patterns, width tokens, busy and accessibility                          |
| `docs/developer/frontend/frontend-logging-and-error-handling.md`               | changing logging, error mapping, or user-facing failure feedback                                                         | environment logging, error mapping, Ant Design feedback                         |
| `docs/developer/frontend/frontend-modal-patterns.md`                           | adding or changing a modal                                                                                               | modal-family reuse, discovery, extraction                                       |
| `docs/developer/frontend/frontend-playwright-e2e.md`                           | writing or changing E2E tests                                                                                            | E2E conventions, runtime mocks, StrictMode                                      |
| `docs/developer/frontend/frontend-react-query-and-prefetch.md`                 | adding server state, queries, prefetch, or invalidation                                                                  | query-key factories, warm-up, prefetch, freshness                               |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | creating any new utility, hook, validator, or shared component, or adding or changing a table that renders student names | canonical helpers, when to extract                                              |
| `docs/developer/frontend/frontend-shell-navigation-and-motion.md`              | changing shell navigation, menu metadata, or motion                                                                      | navigation, decorative icons, reduced-motion                                    |
| `docs/developer/frontend/frontend-spacing-and-padding-standards.md`            | any change that affects layout spacing                                                                                   | 8px grid, spacing tokens, component defaults                                    |
| `docs/developer/frontend/frontend-testing.md`                                  | writing or changing Vitest tests                                                                                         | test split, commands, helpers, mock rules                                       |
| `docs/developer/frontend/data-analysis-architecture.md`                        | changing data-analysis or heatmap projection surfaces                                                                    | analyser pipeline and projection architecture                                   |
| `docs/developer/frontend/metric-display-precision.md`                          | rendering metric scores                                                                                                  | decimal-place convention                                                        |
| `docs/developer/frontend/metric-icon-display.md`                               | rendering metric icons                                                                                                   | icon rendering, theme colour, stroke                                            |
| `docs/developer/data-shapes/INDEX.md`                                          | defining or updating a backend-facing Zod schema                                                                         | canonical backend contracts                                                     |
| `docs/developer/frontend/navigation-consistency-status.md`                     | reference                                                                                                                | page-title/nav-card pattern status                                              |

> `docs/developer/frontend/ant-design-docs-cache/` holds cached Ant Design notes for offline reference. It is not canonical policy.

## 4. Composition and structure

- Place async orchestration and side effects in feature hooks (`useXyz...`). Keep service modules focused on external/runtime API boundaries and transport. Keep presentational components declarative and delegate data loading and state transitions to hooks.
- Wrap each backend method in a frontend service module that owns request/response validation and calls `callApi(...)`. Keep method names aligned with `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
- Group service files into a domain subfolder when two or more share a common domain prefix; keep single-file services flat. Consult `docs/developer/frontend/frontend-architecture.md` before creating, moving, or reorganising files under `services/`.

## 5. Backend transport

- Treat backend responses as envelopes handled by `callApi`; consume typed `data` results only.
- Keep retry behaviour centralised in `callApi`; do not add per-feature retry loops.
- `google.script.run` auto-JSON-stringifies backend return values; `apiService.ts` (`dispatchAttempt`) is the sole choke point that reverses this. Never `JSON.parse` API responses or handle raw GAS transport details outside `apiService.ts`. Consult `docs/developer/frontend/frontend-architecture.md` before changing deserialisation or the transport failure boundary.
- Use the backend configuration service for configuration reads and writes, with request and response validation in its adjacent Zod schema. Endpoint mapping, file paths, and the contract are in `docs/developer/backend/api-layer.md` and `docs/developer/data-shapes/backend-config.md`. `getBackendConfig` and `setBackendConfig` are the canonical method names; do not route configuration UI through legacy backend globals.
- Keep the frontend free of GAS global/service assumptions.
- `Date`, `Function`, and DOM values are prohibited in `google.script.run` payloads; a live `Date` breaks frontend parsing. See `docs/developer/backend/api-layer.md`.

## 6. Validation and types

- Store validation schemas in a dedicated adjacent schema file (for example `*.zod.ts`) near the code that consumes them.
- Void-response schemas must use `.nullable()`. The backend `_success()` maps `undefined → null`, so a bare `z.void()` rejects `null` and fails validation at the transport boundary.

## 7. UI baseline

- The frontend uses React + Ant Design.
- When adding, using, or modifying UI components, ALWAYS check the [Ant Design documentation](https://ant.design/llms.txt) and browse the docs for the specific component; Ant Design usually already supports the behaviour you want.
- Keep UI work within frontend boundaries.

## 8. Tests and delegation

- Delegate all Vitest unit/component test implementation and debugging to `Testing Specialist`, and all Playwright E2E work to `Playwright`, when sub-agent delegation is available.
- If delegation is unavailable, follow `.opencode/agents/testing-specialist.md` and `docs/developer/frontend/frontend-testing.md` for Vitest tests, or `.opencode/agents/playwright.md` and `docs/developer/frontend/frontend-playwright-e2e.md` for E2E tests.
- Shared frontend test helpers live under `src/frontend/src/test/**`; keep specs co-located in `src/frontend/src/**` and never import `src/test/**` from production source.

## 9. Builder compatibility

- Frontend build output is consumed by the GAS builder pipeline. Do not introduce runtime assumptions that need external CDN assets, and keep `index.html` asset wiring compatible with builder inlining to HtmlService output.
- Consult `docs/developer/builder/builder-script.md` before changing frontend asset wiring or build entry points.
