import { createElement } from 'react';
import { vi } from 'vitest';
import { renderWithFrontendProviders } from './renderWithFrontendProviders';
import { pageContent } from '../pages/pageContent';
import { HeatmapBuilderSurface } from '../features/taskHeatmap/HeatmapBuilderSurface';
import { useHeatmapsPageData } from '../features/taskHeatmap/useHeatmapsPageData';
import type { HeatmapsPageData } from '../features/taskHeatmap/useHeatmapsPageData';
import type { HeatmapsSurfaceState } from '../features/taskHeatmap/heatmapsSurfaceState';
import type { SelectionState } from '../features/taskHeatmap/selectionCascade';
import type { MergedHeatmapResult } from '../services/dataAnalysis/heatmapAdapter.merged';
import type { AssignmentDefinitionPartialsResponse } from '../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '../services/googleClassrooms/classDetail/classDetailService.zod';
import type { UseQueryResult } from '@tanstack/react-query';
import { createNotAttemptedMetricResult } from './dataAnalysis/fixtures';
import {
  createHeatmapClassFull,
  createHeatmapDefinitionPartial,
  createHeatmapMergedResult,
} from './dataAnalysis/heatmapFixtures';

export const PAGE_TITLE = pageContent.heatmaps.heading;
export const NO_CLASS_EMPTY_COPY = pageContent.heatmaps.noClassEmpty;
export const NO_ASSIGNMENTS_EMPTY_COPY = pageContent.heatmaps.noAssignmentsEmpty;
export const DISABLED_REASON = 'Select a class first';
export const SELECTOR_CONTROL_COUNT = 3;
export const CLASS_PLACEHOLDER = 'Select a class';
export const TOPICS_PLACEHOLDER = 'Select topics';
export const ASSIGNMENTS_PLACEHOLDER = 'Select assignments';

export const NOT_ATTEMPTED_CELL = {
  completeness: createNotAttemptedMetricResult(),
  accuracy: createNotAttemptedMetricResult(),
  spag: createNotAttemptedMetricResult(),
} as const;

/**
 * Build a minimal merged heatmap fixture for surface rendering.
 *
 * @returns {MergedHeatmapResult} A small merged heatmap view-model fixture.
 */
export function buildMergedResult(): MergedHeatmapResult {
  return createHeatmapMergedResult({
    classId: 'class-1',
    className: 'Test Class 7A',
    rows: [{ studentId: 's-1', studentName: 'Student One', cells: [NOT_ATTEMPTED_CELL] }],
  });
}

const MOCK_CLASS_QUERY = {
  data: null,
  isPending: false,
  isError: false,
  error: null,
  isFetching: false,
  isSuccess: false,
  refetch: vi.fn(),
} as unknown as UseQueryResult<ClassFull | null, Error>;

/** Query result indicating that the class-full data is ready. */
export const READY_CLASS_QUERY = {
  ...MOCK_CLASS_QUERY,
  isSuccess: true,
} as unknown as UseQueryResult<ClassFull | null, Error>;

/** Definition partials used to provide realistic assignment labels in selectors. */
export const ASSIGNMENT_DEFINITION_PARTIALS: AssignmentDefinitionPartialsResponse = [
  createHeatmapDefinitionPartial({
    definitionKey: 'def1',
    primaryTitle: 'Title def1',
    taskId: 'tA',
    taskTitle: 'Task A',
  }),
  createHeatmapDefinitionPartial({
    definitionKey: 'def2',
    primaryTitle: 'Title def2',
    taskId: 'tB',
    taskTitle: 'Task B',
  }),
];

/** Default class fixture used by the selected-class states. */
export const CLASS_FULL: ClassFull = createHeatmapClassFull({
  classId: 'class-1',
});

/**
 * Create a complete page-data fixture with the supplied field overrides.
 *
 * @param {Partial<HeatmapsPageData>} [overrides] Fields to override in the fixture.
 * @returns {HeatmapsPageData} A complete page-data fixture for the surface.
 */
function makePageData(overrides: Partial<HeatmapsPageData> = {}): HeatmapsPageData {
  const base: HeatmapsPageData = {
    selection: {
      classId: null,
      topicKeys: [],
      assignmentIds: [],
    } as SelectionState,
    classPartials: null,
    assignmentDefinitionPartials: null,
    classFull: null,
    classFullQuery: MOCK_CLASS_QUERY,
    analyserResult: null,
    mergedResult: null,
    mergedPreview: null,
    error: null,
    surfaceState: { status: 'ready' } as HeatmapsSurfaceState,
    selectClass: vi.fn(),
    changeTopics: vi.fn(),
    changeAssignments: vi.fn(),
    isRefreshing: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides };
}

const mockUseHeatmapsPageData = useHeatmapsPageData as unknown as ReturnType<typeof vi.fn>;

/**
 * Render the surface with the given mocked hook data overrides.
 *
 * @param {Partial<HeatmapsPageData>} [overrides] Mock hook values for the rendered state.
 */
export function renderSurface(overrides: Partial<HeatmapsPageData> = {}): void {
  mockUseHeatmapsPageData.mockReturnValue(makePageData(overrides));
  renderWithFrontendProviders(createElement(HeatmapBuilderSurface));
}
