# Review Scope — branch `opencode/crisp-meadow` vs `feat/ReactFrontend`

This branch is primarily a **frontend feature branch** (Class Page, Task Heatmap, Metric
Display, navigation/spacing, Lucide icons) plus **backend model/controller/API changes** and
associated tests.

## Diff command (authoritative)

To see the actual changes for any path:

```
git diff feat/ReactFrontend...HEAD -- <path>
```

`feat/ReactFrontend...HEAD` (three-dot) shows commits unique to this branch.

## Backend production source changed

- src/backend/Models/AssignmentDefinition.js
- src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js
- src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js
- src/backend/z_Api/assignmentDefinitionTransport.js
- src/backend/z_Api/assignmentDefinitionValidation.js

## Backend test files changed (supporting context; lower priority unless they reveal issues)

- tests/assignment/assignmentDefinitionValidation.test.js
- tests/assignment/assignmentFactory.test.js
- tests/assignment/assignmentLegacyAliases.test.js
- tests/assignment/assignmentSerialisation.test.js
- tests/backend-api/assignmentDefinitionPartials.unit.test.js
- tests/controllers/abclassController.readClass.test.js
- tests/controllers/abclassController.rehydrateAssignment.test.js
- tests/controllers/assignmentDefinitionController.fullStore.test.js
- tests/controllers/assignmentDefinitionController.test.js
- tests/controllers/assignmentDefinitionController.upsert.test.js
- tests/helpers/assignmentDefinitionPartialsTestHelpers.js
- tests/helpers/assignmentDefinitionTestHelpers.js
- tests/helpers/modelFactories.js
- tests/models/assignmentDefinition.test.js

## Frontend production source changed (NON-test)

- src/frontend/src/AppShell.tsx
- src/frontend/src/ClassSelectionContext.tsx
- src/frontend/src/components/MetricIconLabel.tsx
- src/frontend/src/components/PageHeader.tsx
- src/frontend/src/components/icons/LucideIcon.tsx
- src/frontend/src/features/auth/AuthStatusCard.tsx
- src/frontend/src/features/classPage/ClassPage.tsx
- src/frontend/src/features/classPage/ClassPageContent.tsx
- src/frontend/src/features/classPage/ClassPageHeaderActions.tsx
- src/frontend/src/features/classPage/RecentAssignmentCard.tsx
- src/frontend/src/features/classPage/RecentAssignmentsSection.tsx
- src/frontend/src/features/classPage/StudentAveragesTableCard.tsx
- src/frontend/src/features/classPage/TaskHeatmapPage.tsx
- src/frontend/src/features/classPage/TaskHeatmapTable.tsx
- src/frontend/src/features/classPage/classPageAdapter.ts
- src/frontend/src/features/classPage/classPageModel.ts
- src/frontend/src/features/classPage/studentAveragesTableColumns.tsx
- src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx
- src/frontend/src/features/classes/ClassesManagementPanel.tsx
- src/frontend/src/features/classes/components/ClassesManagementPanelLoadingState.tsx
- src/frontend/src/features/referenceData/ManageTopicsModal.tsx
- src/frontend/src/features/referenceData/ReferenceDataInitialLoadingState.tsx
- src/frontend/src/features/referenceData/ReferenceDataManagementModalScaffold.tsx
- src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx
- src/frontend/src/index.css
- src/frontend/src/navigation/appNavigation.tsx
- src/frontend/src/pages/AssignmentsPage.tsx
- src/frontend/src/pages/ClassesPage.tsx
- src/frontend/src/pages/PageSection.tsx
- src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts
- src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts
- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts
- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts
- src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts
- src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts
- src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts
- src/frontend/src/services/dataAnalysis/heatmapAdapter.ts
- src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx
- src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts
- src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx
- src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.tsx
- src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts
- src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts
- src/frontend/src/theme/spacing.ts

## Frontend test/spec files changed (supporting context)

- src/frontend/src/App.spec.tsx
- src/frontend/src/components/MetricIconLabel.spec.tsx
- src/frontend/src/components/PageHeader.spec.tsx
- src/frontend/src/features/classPage/ClassPage.spec.tsx
- src/frontend/src/features/classPage/ClassPageContent.spec.tsx
- src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx
- src/frontend/src/features/classPage/RecentAssignmentCard.spec.tsx
- src/frontend/src/features/classPage/RecentAssignmentsSection.spec.tsx
- src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx
- src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx
- src/frontend/src/features/classPage/classPageAdapter.spec.ts
- src/frontend/src/features/classPage/classPageModel.spec.ts
- src/frontend/src/features/classPage/studentAveragesTableColumns.spec.tsx
- src/frontend/src/pages/ClassesPage.spec.tsx
- src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.spec.ts
- src/frontend/src/services/assignmentDefinition/taskPartial.zod.spec.ts
- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts
- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts
- src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts
- src/frontend/src/services/dataAnalysis/analysers/perStudentTaskMetrics.spec.ts
- src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts
- src/frontend/src/services/dataAnalysis/dataAnalysis.integration.scenarios.spec.ts
- src/frontend/src/services/dataAnalysis/dataAnalysis.integration.spec.ts
- src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts
- src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts
- src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.spec.tsx
- src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilterDropdown.spec.tsx
- src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.spec.ts
- src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.spec.ts
- src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts
- src/frontend/src/test/dataAnalysis/fixtures.ts

## E2E tests changed (supporting context)

- src/frontend/e2e-tests/app.spec.ts
- src/frontend/e2e-tests/classes-crud-bulk-core.spec.ts
- src/frontend/e2e-tests/classes-crud-bulk-course-length.spec.ts
- src/frontend/e2e-tests/classes-crud-bulk-progress.spec.ts
- src/frontend/e2e-tests/classes-crud.shared.ts
- src/frontend/e2e-tests/classes-page.spec.ts
- src/frontend/e2e-tests/helpers/classes-page-end-to-end-helpers.ts
- src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts
- src/frontend/e2e-tests/navigation-screenshots.spec.ts
- src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts
- src/frontend/e2e-tests/task-heatmap.spec.ts

## Documentation files changed (for docs agents)

- docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
- docs/developer/frontend/frontend-spacing-and-padding-standards.md
- docs/developer/frontend/metric-display-precision.md
- docs/developer/frontend/metric-icon-display.md
- docs/developer/frontend/navigation-consistency-status.md
- docs/pedagogy/data-analysis-scoring.md
- src/frontend/AGENTS.md (agent instruction file, changed)

## Excluded from code review scope (not production code)

- .opencode/agents/_, .opencode/scratchpad/_, .ts-regression-checker/*, root *.md reports
- package.json / package-lock.json / opencode.jsonc / snapshots / png files
