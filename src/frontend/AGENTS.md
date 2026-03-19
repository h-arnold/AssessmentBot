# Frontend Agent Instructions (`src/frontend`)

Applies when editing `src/frontend/**`.

## 1. Language and Runtime

- Use idiomatic TypeScript targeting modern ECMAScript (ES2024-level standards in project config).
- Frontend code is ESM React + Vite, not GAS runtime code.
- Prefer typed, composable React function components and explicit data contracts.
- Export functions as functions, not constants assigned to arrow functions, for better stack traces and readability. Exporting functions as constants without a very good reason is an anti-pattern and will cause a code review to fail.

## 2. Frontend Structure

- App code: `src/frontend/src/**`
- Frontend package/tooling is self-contained under `src/frontend/package.json`.

Root scripts execute frontend tasks via `npm --prefix src/frontend ...`.

### 2.1 App Composition Boundary (Mandatory)

- Keep `src/frontend/src/App.tsx` thin: composition root and layout shell only.
- Compose feature entry components in `App.tsx`; do not place feature state machines in `App.tsx`.
- Do not call service modules from `App.tsx`; invoke services from feature hooks/components.

### 2.2 Hooks, Services, and Side Effects

- Place async orchestration and side effects in feature hooks (for example `useXyz...`).
- Keep service modules focused on external/runtime API boundaries and transport details.
- Keep presentational feature components declarative; delegate data loading/state transitions to hooks.
- When shared server-state is introduced, define query keys through shared factory helpers rather than ad-hoc array literals so later invalidation and prefetch logic stays consistent.
- For React Query baseline, startup warm-up, and prefetch policy guidance, use `docs/developer/frontend/frontend-react-query-and-prefetch.md`.

## 3. Framework and UI Baseline

- Current scaffold uses React + Ant Design.
- Ant Design v6 does not require `@ant-design/v5-patch-for-react-19`; do not add that patch.
- Keep UI work within frontend boundaries; do not add new UI behaviour in deprecated `src/AdminSheet/UI` unless explicitly requested.

**Important**: When adding, using or modifying UI components, ALWAYS check the [Ant Design documentation](https://ant.design/llms.txt) and browse the relevant docs for the component or components you are working with. Ant Design has a lot of built-in functionality and options, and it's likely that the behaviour you want to implement is already supported by the library. Familiarise yourself with the documentation to ensure you're using the components effectively and following best practices.

## 4. Backend Boundary

- Do not import runtime modules directly from `src/backend` into frontend code.
- Treat frontend/backend integration as an API boundary.
- Keep frontend free of GAS global/service assumptions.

### 4.1 Required API transport pattern

- **Hard rule:** all frontend-to-backend calls must be routed through `src/frontend/src/services/apiService.ts` (`callApi`).
- Never call backend API methods directly from frontend feature code, components, hooks, or services via `google.script.run`, backend globals, or any other transport shortcut.
- Wrap backend methods in a frontend service module that owns request/response validation and calls `callApi(...)`.
- Keep method names aligned with backend `API_METHODS` in `src/backend/z_Api/apiConstants.js`.
- Treat backend responses as envelopes handled by `callApi`; feature services should consume typed `data` results only.
- Keep retry behaviour centralised in `callApi`; do not add per-feature retry loops for rate-limit handling.
- Use `src/frontend/src/services/backendConfigurationService.ts` for backend configuration reads and writes; keep request and response validation in `src/frontend/src/services/backendConfiguration.zod.ts`.
- Treat `getBackendConfig` and `setBackendConfig` as the canonical backend configuration method names. Do not route configuration UI flows through legacy backend globals.

## 5. Error Handling and Quality

- Fail loudly in development; do not hide failures behind broad catch-and-ignore logic.
- When implementing or refactoring frontend logging/error handling, read `docs/developer/frontend/frontend-logging-and-error-handling.md` first and treat it as the single source of truth.
- Keep this AGENTS file as a signpost only; do not duplicate detailed logging policy here.
- Default hard-failure UI state should be a top-level Ant Design `Alert` unless a stronger user experience case is explicitly documented for a feature.
- Prefer shared frontend error contracts and mapping utilities; add feature-specific error mapping only when a feature has genuinely unique error semantics.
- Never implement or fall back to defaults unless explicitly instructed to do so.
- Keep component state and side effects predictable and testable.

## 6. Builder Compatibility Notes

Frontend build output is consumed by the GAS builder pipeline.

- Avoid introducing runtime assumptions that require external CDN assets at execution time.
- Keep `index.html`-driven asset wiring compatible with builder inlining to HtmlService output.

## 7. Config, Lint, and Testing Delegation

- Before changing TS/ESLint config, read `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.
- Delegate all test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/frontend/frontend-testing.md` before changing tests.
- When a frontend change depends on backend configuration transport behaviour, treat `tests/api/backendConfigApi.test.js` as the dedicated backend transport suite and keep frontend service assertions in `src/frontend/src/services/backendConfigurationService.spec.ts`.

## 8. Validation and Type Definition Standard

- Use **Zod** as the validation framework for all new and updated frontend validation logic.
- Define the Zod schema first, then derive TypeScript types from that schema using `z.infer<typeof ...>` to avoid duplicated type declarations.
- Store validation schemas in a dedicated adjacent schema file (for example `*.zod.ts` or `zodSchemas.ts`) near the code consuming them.

## 9. Shell Navigation and Motion Standards

For shell navigation and motion conventions (menu metadata, decorative icon semantics, and reduced-motion defaults), use:

- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`
