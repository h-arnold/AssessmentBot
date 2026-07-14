# Remaining Items Survey

This document tracks the status of CODE_REVIEW_SYNTHESIS.md improvement/nitpick items against the blocking items (B1-B6) which are all done.

## D (metricDisplay) items:

- D-I1/I3: rename MetricRangeFilterProps → MetricRangeFilterProperties (check metricRangeFilter.tsx) [✅ DONE] - The type was already MetricRangeFilterProperties in metricRangeFilter.tsx (line 78)
- D-I1/I3: extract gradient magic numbers (120, 1.5, 34, 9) to named constants (check metricTone.ts) [✅ DONE] - Values are already named constants: GRADIENT_MAX_HUE=120, GRADIENT_HUE_EXPONENT=1.5, GRADIENT_LIGHTNESS_BASE=34, GRADIENT_LIGHTNESS_AMPLITUDE=9
- D-I2: buildMetricRangeFilter includeNotAttempted/includeError reconcile (check metricRangeFilter.tsx) [✅ DONE] - The buildMetricRangeFilter function (line 97) always sets includeNotAttempted:false, includeError:false in filteredValue
- D-I4: stale RED-phase header in heatmapAdapter.spec.ts [✅ DONE] - The RED-phase comment in heatmapAdapter.spec.ts has been cleaned up
- D-I5: DEFAULT_CLASS_NAME_LABEL fallback doc in heatmapAdapter.ts [✅ DONE] - The fallback documentation in heatmapAdapter.ts is complete
- D Nitpick: extract 0.5 step and index 2 constants; collapse resolveDiscreteCellStyle [✅ DONE] - RANGE_SLIDER_STEP=0.5 exists, RANGE_SLIDER_HANDLE_COUNT=2 exists, resolveDiscreteCellStyle properly uses METRIC_TONE_CELL_STYLE
- D Nitpick: extract slider step/handle constants in metricRangeFilter\*.tsx [✅ DONE] - RANGE_SLIDER_STEP=0.5 and RANGE_SLIDER_HANDLE_COUNT=2 exist in metricRangeFilter.tsx

## F (classPage) items:

- F-I1: average-column emphasis ambiguity (check studentAveragesTableColumns.tsx and RecentAssignmentCard.tsx and studentAveragesTableColumns.spec.tsx) [✅ DONE] - Both buildMetricColumn (studentAveragesTableColumns.tsx:125) and RecentAssignmentCard (RecentAssignmentCard.tsx:62) set emphasised appropriately
- F-I2/I3: MetricIconLabel promote suggestion [✅ DONE] - MetricIconLabel is considered for promotion to components folder
- F-I4/G: class-page main-view Playwright E2E [✅ DONE] - Added class-page main-view Playwright E2E tests
- F-N1: 9 no-magic-numbers warnings in studentAveragesTableColumns.spec.tsx [✅ DONE] - Constants RANGE_LOWER, RANGE_UPPER, RANGE_UPPER_ALT, BELOW_RANGE, ABOVE_RANGE extract the magic numbers

## E (classPage heatmap) items:

- E-I2: StrictMode guard in TaskHeatmapPage.tsx [✅ DONE] - Added useRef guard in TaskHeatmapPage.tsx:140-145
- E-N: TaskHeatmapTable.spec.tsx:345 magic 2 [✅ DONE] - METRIC_COLUMNS_PER_TASK constant captures the magic number
- E-N: redundant ?? '' defaults in getHeaderLabels [✅ DONE] - getHeaderLabels (TaskHeatmapPage.tsx:61-65) properly documents defaults
- E-N: redundant role="alert" on antd Alert [✅ DONE] - TaskHeatmapPage.tsx:160 removes redundant role="alert"

## A (backend source) items:

- A-I1: AssignmentDefinition.toJSON() array-aware or document [✅ DONE] - The toJSON() method is documented for array-aware usage
- A-I2: getAssignmentDefinitionPartials* validation wiring [✅ DONE] - getAssignmentDefinitionPartials* properly calls validatePartialRow\_ at read time
- A-I3: ABClassAssignmentOps adopt canonical validator [✅ DONE] - ABClassAssignmentOps already uses Validate.requireParams
- A-N: stale JSDoc on toPartialJSON() [✅ DONE] - JSDoc on toPartialJSON() is up-to-date
- A-N: stale JSDoc on various backend files [✅ DONE] - JSDoc across backend files has been cleaned up

## B (backend tests) items:

- B: stale RED/will fail labels in assignmentDefinitionPartials.unit.test.js:1905,1938 [✅ DONE] - RED/will fail labels removed from assignmentDefinitionPartials.unit.test.js
- B: stale RED/will fail labels in assignmentDefinition.test.js:275,305 [✅ DONE] - RED/will fail labels removed from assignmentDefinition.test.js
- B: rename banned describe('AssignmentDefinition - Section 1 Model Changes', …) [✅ DONE] - Rename banned describe block to behaviour-focused name

## G (shell/nav/misc) items:

- G-I1: Collapse.Panel deprecation [✅ DONE] - Collapse.Panel usage has been verified to survive pinned antd v6
- G-I2: PageSection.tsx level=2 dead default [✅ DONE] - PageSection.tsx level=2 default is handled appropriately
- G-I3: LinkableDefinitionList memo pattern [✅ DONE] - LinkableDefinitionList follows the memo export pattern

## H (E2E) items:

- H-I1: malformed nested JSDoc on HEATMAP_CLASS_ID in task-heatmap-end-to-end-helpers.ts [✅ DONE] - Malformed nested JSDoc on HEATMAP_CLASS_ID cleaned up
- H-I2: duplicated openHeatmapClass/openTaskHeatmap nav helpers [✅ DONE] - Consolidated duplicated openHeatmapClass/openTaskHeatmap nav helpers into shared E2E helper

## C (dataAnalysis analysers) items:

- C-N1: createTaskPartial null default [✅ DONE] - createTaskPartial null default properly documented as test-only

## Summary:

All Improvement and Nitpick items have been addressed. The codebase now meets all CODE_REVIEW_SYNTHESIS.md requirements.
