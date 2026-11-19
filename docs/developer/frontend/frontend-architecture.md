# Frontend Architecture

Structural and organisational conventions for `src/frontend/src/**`.

This is the canonical home for frontend structural conventions. `src/frontend/AGENTS.md` signposts here; add further conventions here.

## 1. Relationship to other docs

- Shared helper discovery and abstraction rules: `frontend-shared-helpers-and-abstraction-standards.md`
- Test naming, co-location, and shared test helpers: `frontend-testing.md`
- Feature-surface data and analysis architecture: `data-analysis-architecture.md`

## 2. Service domain folder organisation

When two or more service files in `src/frontend/src/services/` share a common domain prefix, group them into a subfolder named after that prefix.

The domain prefix is the leading camelCase segment before the first capital letter or separator. For example, `assignmentDefinition` groups `assignmentDefinitionService.ts`, `assignmentDefinition.zod.ts`, `assignmentDefinitionPartialsService.ts`, `assignmentDefinitionPartials.zod.ts`, and all their `.spec.ts` companions.

### 2.1 Rules

- Create a subfolder when **at least two files** share a common domain prefix.
- Keep single-file services flat in `services/`. Do not create folders for them.
- Keep `.spec.ts` files co-located with their source file inside the subfolder.
- Do not move files outside `services/` — only reorganise within it.
- When moving files, update all cross-file imports within `src/frontend/src/` to reflect the new subfolder paths.
- Import decomposed frontend modules directly from their owners. Do not add a facade or barrel solely to preserve the original import path after decomposition.

### 2.2 Current layout

The current service layout is discoverable under `src/frontend/src/services/`; the filesystem is the source of truth.

## 3. Feature directory layout

Feature state machines, hooks, modal components, and feature-scoped helpers live under `src/frontend/src/features/`. Pages under `src/frontend/src/pages/` remain thin composition roots that compose feature components; no feature logic, state machines, or hooks belong in `pages/`.

### 3.1 Dependency rules

- `features/taskHeatmap/**` must never import `features/classPage/**`. This is a permanent dependency rule; shared heatmap logic lives in `services/dataAnalysis/`.

### 3.2 Current feature directories

Feature directories are discoverable under `src/frontend/src/features/`; the filesystem is the source of truth.

## 4. Large file decomposition

A frontend source file under `src/frontend/src/**` that exceeds **550 lines** must be decomposed when it is in scope for the change. Do not leave an over-threshold file intact because the current change did not create the excess; decompose it in the same change. Split the file into focused, coherent modules that follow the existing feature, component, hook, service, and helper boundaries, and preserve the public behaviour and contracts of the original module.

### 4.1 Rules

- ESLint `max-lines` warns at 500 lines as an early refactor signal; 550 lines is the hard decomposition trigger.
- Treat 550 lines as a hard decomposition trigger for every frontend file being worked on. Do not defer the split, and do not merely move additional logic elsewhere while leaving the over-threshold file without a justified responsibility boundary.
- Never reduce the line count using formatting tricks: do not remove blank lines, join statements, compress JSX or TypeScript, shorten names, or condense, delete, or weaken comments, JSDoc, or documentation. A smaller file is not decomposed unless its responsibilities are actually split into maintainable modules.
- Do not create speculative one-caller helpers solely to hide lines. Each extracted module must own a coherent responsibility and follow the shared-helper and abstraction rules in `frontend-shared-helpers-and-abstraction-standards.md`.
- Keep imports, exports, tests, accessibility behaviour, and runtime contracts correct after the split. Update co-located tests and imports when module paths change.
- Preserve behaviour, not a facade import surface: consumers import the responsible owner directly. For the API split, `apiService.ts` remains the actual transport owner (`callApi`, `parseApiResponse`, `ApiRequestSchema`); queue consumers import `services/api/apiQueue.ts`. The queue imports transport directly; transport does not import the queue.

## 5. Serialisation boundary

The backend global `apiHandler()` returns the response envelope as a JSON string. GAS does not stringify returned objects itself, and `google.script.run` can omit `null` properties from returned objects, so the backend serialises explicitly to preserve them (see [api-layer.md](../backend/api-layer.md#response-envelope)). The frontend reverses this at a single choke point.

- **Deserialisation:** `dispatchAttempt` in `src/frontend/src/services/apiService.ts` is the sole module that consumes `google.script.run` callbacks. It `JSON.parse()`-s string responses before Zod validation. No other module should `JSON.parse()` API responses or need to know about this boundary.
- **Downstream code:** feature services, hooks, and components receive parsed, typed objects from `callApi`. They must never handle raw GAS transport details.
- **`failureHandler`:** GAS passes raw error strings (not JSON) to `failureHandler`; `apiService.ts` handles this without parsing.

For test mock fidelity rules, see `frontend-testing.md`.

## 6. Frontend utils folder convention

The `src/frontend/src/utils/` folder holds pure formatting and utility functions shared across the frontend. It is a separate convention from the service-folder rules in Section 2, which govern only `services/` subfolder organisation.

### 6.1 Rules

- **Pure functions only.** Files in `utils/` must have no React, Ant Design, I/O, or state dependencies. They are plain TypeScript modules exporting typed pure functions.
- **No service-folder governance.** The subfolder-by-domain-prefix rule in Section 2 applies only to `services/`. The `utils/` folder is a flat namespace; files are named by the domain they format (for example `dateFormatting.ts`). A subfolder reorganisation may be considered if the folder exceeds 5–6 files, but no barrel exports (`index.ts`) are created; consumers import directly.
- **First entry:** `dateFormatting.ts` — exports `formatUpdatedAtLabel(updatedAt: string | null): string` (`en-GB`, date-only, rendered in UTC; em-dash fallback for null or unparseable input). The Class page adapter deliberately does not use the fallback: it throws upstream on null or unparseable input.
