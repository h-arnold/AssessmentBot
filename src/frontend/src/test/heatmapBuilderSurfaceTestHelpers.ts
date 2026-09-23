import { createElement } from 'react';
import { vi } from 'vitest';
import { renderWithFrontendProviders } from './renderWithFrontendProviders';
import { pageContent } from '../pages/pageContent';
import { HeatmapBuilderSurface } from '../features/taskHeatmap/HeatmapBuilderSurface';
import { useHeatmapsPageData } from '../features/taskHeatmap/useHeatmapsPageData';
import type { HeatmapsPageData } from '../features/taskHeatmap/useHeatmapsPageData';
import type { HeatmapsSurfaceState } from '../features/taskHeatmap/heatmapsSurfaceState';
import type { SelectionState } from '../features/taskHeatmap/selectionCascade';
import type {
  MergedHeatmapResult,
  MergedHeatmapTaskColumn,
} from '../services/dataAnalysis/heatmapAdapter.merged';
import type { AssignmentDefinitionPartialsResponse } from '../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '../services/googleClassrooms/classDetail/classDetailService.zod';
import type { UseQueryResult } from '@tanstack/react-query';

export const PAGE_TITLE = pageContent.heatmaps.heading;
export const NO_CLASS_EMPTY_COPY = pageContent.heatmaps.noClassEmpty;
export const NO_ASSIGNMENTS_EMPTY_COPY = pageContent.heatmaps.noAssignmentsEmpty;
export const DISABLED_REASON = 'Select a class first';
export const SELECTOR_CONTROL_COUNT = 3;
export const CLASS_PLACEHOLDER = 'Select a class';
export const TOPICS_PLACEHOLDER = 'Select topics';
export const ASSIGNMENTS_PLACEHOLDER = 'Select assignments';

export const NOT_ATTEMPTED_CELL = {
  completeness: {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 1,
  },
  accuracy: {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 1,
  },
  spag: {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 1,
  },
} as const;

/**
 * Build a minimal merged heatmap fixture for surface rendering.
 *
 * @returns {MergedHeatmapResult} A small merged heatmap view-model fixture.
 */
export function buildMergedResult(): MergedHeatmapResult {
  const taskColumns: ReadonlyArray<MergedHeatmapTaskColumn> = [
    {
      taskKey: 'def1::tA',
      taskId: 'tA',
      taskTitle: 'Task A',
      averageContribution: { effectiveWeight: 1, includedInAverage: true },
      assignmentId: 'a1',
      definitionKey: 'def1',
      assignmentName: 'Title def1',
    },
  ];
  return {
    classId: 'class-1',
    className: 'Test Class 7A',
    sourceAssignments: [
      { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
    ],
    taskColumns,
    rows: [{ studentId: 's-1', studentName: 'Student One', cells: [NOT_ATTEMPTED_CELL] }],
  } as MergedHeatmapResult;
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
  {
    primaryTitle: 'Title def1',
    primaryTopic: 'Topic One',
    primaryTopicKey: 'topic-1',
    yearGroupKey: 'yg-7',
    yearGroupLabel: 'Year 7',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'doc',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    definitionKey: 'def1',
    tasks: [{ taskId: 'tA', taskWeighting: 1, taskTitle: 'Task A' }],
    createdAt: null,
    updatedAt: null,
  },
  {
    primaryTitle: 'Title def2',
    primaryTopic: 'Topic Two',
    primaryTopicKey: 'topic-2',
    yearGroupKey: 'yg-7',
    yearGroupLabel: 'Year 7',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'doc',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    definitionKey: 'def2',
    tasks: [{ taskId: 'tB', taskWeighting: 1, taskTitle: 'Task B' }],
    createdAt: null,
    updatedAt: null,
  },
];

/** Default class fixture used by the selected-class states. */
export const CLASS_FULL: ClassFull = {
  classId: 'class-1',
  className: 'Test Class 7A',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: 'yg-7',
  classOwner: null,
  teachers: [],
  students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
  assignments: [
    {
      assignmentId: 'a1',
      assignmentDefinitionKey: 'def1',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      assignmentId: 'a2',
      assignmentDefinitionKey: 'def2',
      updatedAt: '2025-02-01T00:00:00.000Z',
    },
  ],
  active: true,
} as unknown as ClassFull;

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
