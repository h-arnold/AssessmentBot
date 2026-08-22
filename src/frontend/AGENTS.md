# Frontend Agent Instructions (`src/frontend`)

Applies when editing `src/frontend/**`.

## 0. Key Documentation

| Doc                                                                            | Summary                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `docs/developer/frontend/frontend-loading-and-width-standards.md`              | Loading states, skeleton patterns, width tokens               |
| `docs/developer/frontend/frontend-logging-and-error-handling.md`               | Frontend logging and error handling policy                    |
| `docs/developer/frontend/frontend-modal-patterns.md`                           | Modal-family reuse, discovery, extraction rules               |
| `docs/developer/frontend/frontend-playwright-e2e.md`                           | Playwright E2E test conventions and commands                  |
| `docs/developer/frontend/frontend-react-query-and-prefetch.md`                 | React Query baseline, prefetch/warm-up strategy               |
| `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` | Shared helpers, when to create new abstractions               |
| `docs/developer/frontend/frontend-shell-navigation-and-motion.md`              | Shell navigation, decorative icons, reduced-motion            |
| `docs/developer/frontend/frontend-spacing-and-padding-standards.md`            | Spacing tokens, 8px grid, component defaults                  |
| `docs/developer/frontend/frontend-testing.md`                                  | Frontend Vitest testing conventions and commands              |
| `docs/developer/frontend/metric-display-precision.md`                          | Metric score decimal-place convention                         |
| `docs/developer/frontend/metric-icon-display.md`                               | Metric icon rendering, theme-aware colour, stroke conventions |

## 2. Language and Runtime

- Use idiomatic TypeScript targeting modern ECMAScript (ES2024-level standards in project config).
- Frontend code is ESM React + Vite, not GAS runtime code.
- Prefer typed, composable React function components and explicit data contracts.
- Export functions as functions, not constants assigned to arrow functions, for better stack traces and readability. Exporting functions as constants without a very good reason is an anti-pattern and will cause a code review to fail.

## 3. Frontend Structure

- App code: `src/frontend/src/**`
- Frontend package/tooling is self-contained under `src/frontend/package.json`.

Root scripts execute frontend tasks via `npm --prefix src/frontend ...`.

### 3.1 App Composition Boundary (Mandatory)

- Keep `src/frontend/src/App.tsx` thin: composition root and layout shell only.
- Compose feature entry components in `App.tsx`; do not place feature state machines in `App.tsx`.
- Do not call service modules from `App.tsx`; invoke services from feature hooks/components.

### 3.2 Hooks, Services, and Side Effects

- Place async orchestration and side effects in feature hooks (for example `useXyz...`).
- Keep service modules focused on external/runtime API boundaries and transport details.
- Keep presentational feature components declarative; delegate data loading/state transitions to hooks.
- When shared server-state is introduced, define query keys through shared factory helpers rather than ad-hoc array literals so later invalidation and prefetch logic stays consistent.
- Utility functions, custom hooks, validators, and common components must check `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` before creating new abstractions. Flag code that duplicates logic already in shared helpers as a Critical issue during code review.
- For React Query baseline, startup warm-up, and prefetch policy guidance, use `docs/developer/frontend/frontend-react-query-and-prefetch.md`.

### 3.3 Feature Directory Layout

Feature state machines, hooks, modal components, and feature-scoped helpers live under
`src/frontend/src/features/`. Current feature directories:

- `assignmentWizard/` — Assignment definition wizard (extracted from `pages/`)
- `auth/` — Authorisation gate and status
- `classPage/` — Class detail view (per-class overview surface); child of `ClassesPage`, not a top-level page
- `classes/` — Class management, assessment, bulk operations, and table
- `referenceData/` — Cross-cutting reference data management (cohorts, year groups, topics; extracted from `features/classes/management/` and `features/settings/`)
- `settings/` — Backend settings configuration
- `taskHeatmap/` — Task Heatmap analytics surface (extracted from `features/classPage/`)

Pages under `src/frontend/src/pages/` remain thin composition roots that compose feature
components. No feature logic, state machines, or hooks should live in `pages/`.

## 4. Framework and UI Baseline

- Current scaffold uses React + Ant Design.
- Ant Design v6 does not require `@ant-design/v5-patch-for-react-19`; do not add that patch.
- Keep UI work within frontend boundaries; the `src/AdminSheet` directory has been fully removed, so no UI work should reference it.

**Important**: When adding, using or modifying UI components, ALWAYS check the [Ant Design documentation](https://ant.design/llms.txt) and browse the relevant docs for the component or components you are working with. Ant Design has a lot of built-in functionality and options, and it's likely that the behaviour you want to implement is already supported by the library. Familiarise yourself with the documentation to ensure you're using the components effectively and following best practices.

**Mandatory spacing and padding read**: Before adding, modifying, or reviewing any UI element that affects layout spacing, ALWAYS read `docs/developer/frontend/frontend-spacing-and-padding-standards.md`. All padding, margin, and gap values must follow the 8px grid system defined there. Reject any spacing value that is not a multiple of 8 (or a documented 4px exception) during implementation and code review.

## 5. Backend Boundary

- Do not import runtime modules directly from `src/backend` into frontend code.
- Treat frontend/backend integration as an API boundary.
- Keep frontend free of GAS global/service assumptions.

### 5.1 Required API transport pattern

- **Hard rule:** all frontend-to-backend calls must be routed through `src/frontend/src/services/apiService.ts` (`callApi`).
- Never call backend API methods directly from frontend feature code, components, hooks, or services via `google.script.run`, backend globals, or any other transport shortcut.
- Wrap backend methods in a frontend service module that owns request/response validation and calls `callApi(...)`.
- Keep method names aligned with backend `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
- Treat backend responses as envelopes handled by `callApi`; feature services should consume typed `data` results only.
- Keep retry behaviour centralised in `callApi`; do not add per-feature retry loops for rate-limit handling.
- Use `src/frontend/src/services/backendConfiguration/backendConfigurationService.ts` for backend configuration reads and writes; keep request and response validation in `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`.
- Treat `getBackendConfig` and `setBackendConfig` as the canonical backend configuration method names. Do not route configuration UI flows through legacy backend globals.

### 5.2 Serialization boundary

GAS `google.script.run` auto-JSON-stringifies backend return values before passing them to
`withSuccessHandler`. The frontend must reverse this at a single choke point.

- **Deserialization:** `dispatchAttempt` in `apiService.ts` is the sole module that consumes
  `google.script.run` callbacks. It `JSON.parse()`-s string responses before Zod validation.
  No other module should `JSON.parse()` API responses or need to know about this boundary.
- **Downstream code:** feature services, hooks, and components receive parsed, typed objects
  from `callApi`. They must never handle raw GAS transport details.
- **`failureHandler`:** GAS passes raw error strings (not JSON) to `failureHandler`.
  `apiService.ts` handles this without parsing.

### 5.3 Prohibited types in `google.script.run` (critical)

`google.script.run` **prohibits** `Date`, `Function`, and DOM elements in both **parameters and
return values** — including inside nested objects and arrays. If any value in the response graph
is a `Date` object (not an ISO string), GAS falls back to `Object.toString()` serialisation,
producing non-JSON output that breaks `JSON.parse()` and causes the frontend to receive `null`.

Reference: https://developers.google.com/apps-script/guides/html/reference/run
(myFunction section: "Requests fail if you attempt to pass a Date, Function, DOM element
besides a form, or other prohibited type, including prohibited types inside objects or arrays."
Return value note: "return types are subject to the same restrictions as parameter types".)

**Rules for backend code:**

1. Never return live `Date` objects from any method callable via `google.script.run`. Convert to
   ISO 8601 strings (`date.toISOString()`) at the API boundary.
2. Never return `Function` instances or DOM element references.
3. Validate that all array/object fields are plain JS arrays/objects, not Java-backed types
   (e.g. `[Ljava.lang.Object;@...`) that GAS cannot serialise.
4. Apply these rules at the controller-to-transport boundary (e.g. `_getFullAssignmentDefinition`)
   before the response reaches `apiHandler`.

For test mock fidelity rules (do not manually stringify/parse in individual test files), see
`docs/developer/frontend/frontend-testing.md`.

## 6. Error Handling and Quality

### 6.1 Loading and width standards

- Treat the smallest independently usable panel, card, table region, or dialog content as the owned surface for loading, mutation, and width decisions.
- Initial entry with no usable data must render a shape-matched skeleton; once usable data is visible, keep it visible during refresh and show a local busy affordance scoped to the affected surface or subregion.
- Required degraded or untrustworthy data fails closed by default: suppress normal content and show the blocking-state treatment for that owned region; query staleness alone is not degraded data.
- Short-running mutations keep loading on the primary trigger and disable conflicting writes on the same owned surface until the mutation settles; modal confirm-loading remains the standard modal pattern.
- Loading and refresh affordances must expose explicit accessible status or busy semantics; visual indicators alone are not sufficient.
- Keep outer page or tab width separate from inner panel width, and use the shared width tokens rather than feature-local literals. For the full rules, read `docs/developer/frontend/frontend-loading-and-width-standards.md`.

- Fail loudly in development; do not hide failures behind broad catch-and-ignore logic.
- When implementing or refactoring frontend logging/error handling, read `docs/developer/frontend/frontend-logging-and-error-handling.md` first and treat it as the single source of truth.
- Keep this AGENTS file as a signpost only; do not duplicate detailed logging policy here.
- Default hard-failure UI state should be a top-level Ant Design `Alert` unless a stronger user experience case is explicitly documented for a feature.
- Prefer shared frontend error contracts and mapping utilities; add feature-specific error mapping only when a feature has genuinely unique error semantics.
- Never implement or fall back to defaults unless explicitly instructed to do so.
- Keep component state and side effects predictable and testable.

## 7. Builder Compatibility Notes

Frontend build output is consumed by the GAS builder pipeline.

- Avoid introducing runtime assumptions that require external CDN assets at execution time.
- Keep `index.html`-driven asset wiring compatible with builder inlining to HtmlService output.

## 8. Config, Lint, and Testing Delegation

- Before changing TS/ESLint config, read `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.
- Delegate all Vitest unit/component test implementation and test-debugging work to `Testing Specialist` when sub-agent delegation is available.
- Delegate all Playwright E2E test implementation and test-debugging work to `Playwright` when sub-agent delegation is available.
- If delegation is unavailable, follow `.github/agents/Testing.agent.md` and `docs/developer/frontend/frontend-testing.md` for Vitest tests, or `.github/agents/playwright.agent.md` and `docs/developer/frontend/frontend-playwright-e2e.md` for E2E tests.
- Shared frontend test helpers live under `src/frontend/src/test/**`; keep specs co-located in `src/frontend/src/**` and do not import `src/test/**` from production source.
- When a frontend change depends on backend configuration transport behaviour, treat `tests/api/backendConfigApi.test.js` as the dedicated backend transport suite and keep frontend service assertions in `src/frontend/src/services/backendConfiguration/backendConfigurationService.spec.ts`.

## 9. Validation and Type Definition Standard

- Use **Zod** as the validation framework for all new and updated frontend validation logic.
- **Canonical shape definitions live in `docs/developer/data-shapes/`.** Before defining or updating a Zod schema for a backend-facing service, read the relevant contract in `docs/developer/data-shapes/INDEX.md` to ensure your schema matches the authoritative backend contract.
- Define the Zod schema first, then derive TypeScript types from that schema using `z.infer<typeof ...>` to avoid duplicated type declarations.
- Store validation schemas in a dedicated adjacent schema file (for example `*.zod.ts` or `zodSchemas.ts`) near the code consuming them.

- **Void-response schemas must use `.nullable()`:** The backend `_success()` method converts `undefined → null` via `data: data ?? null`. Response schemas for delete/void methods (for example `z.void()`) must use `.nullable()` (for example `z.void().nullable()`) to accept `null` from the backend envelope. A bare `z.void()` rejects `null` and causes a Zod validation error at the transport boundary.

## 10. Shell Navigation and Motion Standards

For shell navigation and motion conventions (menu metadata, decorative icon semantics, and reduced-motion defaults), use:

- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 11. Spacing and Padding Standards

For spacing and padding rules (8px grid, CSS custom property tokens, container-level and component-level spacing, inline style rules, and code-review enforcement), use:

- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

This document **must** be read before adding, modifying, or reviewing any UI element that affects layout spacing.

## 12. Modal Patterns and Reuse

For modal-family discovery, reuse decisions, and extraction rules, use:

- `docs/developer/frontend/frontend-modal-patterns.md`

## 13. Default Values Rule

- Default values must be set in a module's constructor only.
- If defaults are found elsewhere, they should be opportunistically moved to the constructor of the module.

## 14. Service Domain Folder Organisation

When two or more service files in `src/frontend/src/services/` share a common domain prefix,
group them into a subfolder named after that domain prefix.

Domain prefix is the leading camelCase segment before the first capital letter or separator
(e.g. `assignmentDefinition` groups `assignmentDefinitionService.ts`,
`assignmentDefinition.zod.ts`, `assignmentDefinitionPartialsService.ts`,
`assignmentDefinitionPartials.zod.ts`, and all their `.spec.ts` companions).

Example — current services directory grouped by domain:

```
services/apiService.ts
services/apiService.spec.ts

services/assignmentAssessment/
├── assignmentAssessmentService.ts
├── assignmentAssessmentService.spec.ts
├── assignmentAssessment.zod.ts
└── assignmentAssessment.zod.spec.ts

services/assignmentDefinition/
├── assignmentDefinitionService.ts
├── assignmentDefinitionService.spec.ts
├── assignmentDefinition.zod.ts
├── assignmentDefinition.zod.spec.ts
├── assignmentDefinitionPartialsService.ts
├── assignmentDefinitionPartialsService.spec.ts
├── assignmentDefinitionPartials.zod.ts
├── assignmentDefinitionPartials.zod.spec.ts
├── assignmentTopicsService.ts
├── assignmentTopicsService.spec.ts
├── assignmentTopics.zod.ts
├── assignmentTopics.zod.spec.ts
├── taskPartial.zod.ts
└── taskPartial.zod.spec.ts

services/authService/
├── authService.ts
├── authService.spec.ts
└── authService.zod.ts

services/dataAnalysis/
├── dataAnalysisService.ts
├── dataAnalysisService.spec.ts
├── dataAnalysis.zod.ts
├── dataAnalysis.zod.spec.ts
└── analysers/

services/backendConfiguration/
├── backendConfigurationService.ts
├── backendConfigurationService.spec.ts
├── backendConfiguration.zod.ts
└── backendConfigurationValidation.ts

services/googleClassrooms/
├── googleClassroomsService.ts
├── googleClassroomsService.spec.ts
├── googleClassrooms.zod.ts
├── googleClassrooms.zod.spec.ts
├── googleClassroomAssignmentsService.ts
├── googleClassroomAssignmentsService.spec.ts
├── googleClassroomAssignments.zod.ts
├── googleClassroomAssignments.zod.spec.ts
├── classPartialsService.ts
├── classPartialsService.spec.ts
├── classPartials.zod.ts
├── classPartials.zod.spec.ts
├── classDetail/
│   ├── classDetailService.ts
│   ├── classDetailService.spec.ts
│   ├── classDetailService.zod.ts
│   └── classDetailService.zod.spec.ts

services/referenceData/
├── referenceDataService.ts
├── referenceDataService.spec.ts
├── referenceData.zod.ts
└── referenceData.zod.spec.ts
```

Rules:

- Create a subfolder when **at least 2 files** share a common domain prefix.
- Keep single-file services flat in `services/`. Do not create folders for them.
- Preserve existing import patterns: update all cross-file imports within `src/frontend/src/`
  to reflect the new subfolder paths when moving files.
- Keep `.spec.ts` files co-located with their source file inside the subfolder.
- Do not move files outside `services/` — only reorganise within it.
- Barrel (`index.ts`) exports are optional; prefer direct imports for clarity unless a
  service domain exports many unrelated symbols.
