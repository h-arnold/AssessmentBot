# Frontend Architecture

Structural and organisational conventions for `src/frontend/src/**`.

This is the canonical home for frontend structural conventions. `src/frontend/AGENTS.md` signposts here rather than restating the rules. Add further conventions here as they are consolidated out of the agent instructions.

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
- Barrel (`index.ts`) exports are optional; prefer direct imports for clarity unless a service domain exports many unrelated symbols.

### 2.2 Current layout (illustrative)

The tree below is a snapshot for orientation only. The filesystem is the source of truth; refresh this snapshot only when the structure materially changes.

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

## 3. Feature directory layout

Feature state machines, hooks, modal components, and feature-scoped helpers live under `src/frontend/src/features/`. Pages under `src/frontend/src/pages/` remain thin composition roots that compose feature components; no feature logic, state machines, or hooks belong in `pages/`.

### 3.1 Dependency rules

- `features/taskHeatmap/**` must never import `features/classPage/**`. This is a permanent dependency rule; shared heatmap logic lives in `services/dataAnalysis/`.

### 3.2 Current feature directories (illustrative)

The list below is a snapshot for orientation only. The filesystem is the source of truth; refresh this snapshot only when the structure materially changes.

- `assignmentWizard/` — Assignment definition wizard (extracted from `pages/`)
- `auth/` — Authorisation gate and status
- `classPage/` — Class detail view (per-class overview surface); child of `ClassesPage`, not a top-level page
- `classes/` — Class management, assessment, bulk operations, and table
- `referenceData/` — Cross-cutting reference data management (cohorts, year groups, topics; extracted from `features/classes/management/` and `features/settings/`)
- `settings/` — Backend settings configuration
- `taskHeatmap/` — Task Heatmap analytics surface (extracted from `features/classPage/`) and the standalone Heatmaps builder surface (`HeatmapBuilderSurface`, `HeatmapSelectionBar`, `useHeatmapsPageData`, plus feature-local pipeline/surface-state helpers)

## 4. Large file decomposition

A frontend source file under `src/frontend/src/**` that exceeds **550 lines** must be decomposed when it is in scope for the change. Do not leave an over-threshold file intact because the current change did not create the excess; decompose it in the same change. Split the file into focused, coherent modules that follow the existing feature, component, hook, service, and helper boundaries, and preserve the public behaviour and contracts of the original module.

### 4.1 Rules

- ESLint `max-lines` warns at 500 lines as an early refactor signal; 550 lines is the hard decomposition trigger.
- Treat 550 lines as a hard decomposition trigger for every frontend file being worked on. Do not defer the split, and do not merely move additional logic elsewhere while leaving the over-threshold file without a justified responsibility boundary.
- Never reduce the line count using formatting tricks: do not remove blank lines, join statements, compress JSX or TypeScript, shorten names, or condense, delete, or weaken comments, JSDoc, or documentation. A smaller file is not decomposed unless its responsibilities are actually split into maintainable modules.
- Do not create speculative one-caller helpers solely to hide lines. Each extracted module must own a coherent responsibility and follow the shared-helper and abstraction rules in `frontend-shared-helpers-and-abstraction-standards.md`.
- Keep imports, exports, tests, accessibility behaviour, and runtime contracts correct after the split. Update co-located tests and imports when module paths change.

## 5. Serialization boundary

GAS `google.script.run` auto-JSON-stringifies backend return values before passing them to `withSuccessHandler`. The frontend reverses this at a single choke point.

- **Deserialization:** `dispatchAttempt` in `src/frontend/src/services/apiService.ts` is the sole module that consumes `google.script.run` callbacks. It `JSON.parse()`-s string responses before Zod validation. No other module should `JSON.parse()` API responses or need to know about this boundary.
- **Downstream code:** feature services, hooks, and components receive parsed, typed objects from `callApi`. They must never handle raw GAS transport details.
- **`failureHandler`:** GAS passes raw error strings (not JSON) to `failureHandler`; `apiService.ts` handles this without parsing.

For test mock fidelity rules, see `frontend-testing.md`.
