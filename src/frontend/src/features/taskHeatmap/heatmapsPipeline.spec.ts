/**
 * Tests for the Heatmaps analyser + merged-adapter pipeline (`heatmapsPipeline`).
 *
 * GREEN: the pipeline is fully implemented. These tests pin the review branches
 * (T-4, T-5, T-6) that were previously untested:
 *  - T-4: `runHeatmapsPipeline` short-circuits to `[null, null, null, null]`
 *    when classFull / classId / assignmentDefinitionPartials are null; the
 *    analyser step's catch path returns `[null, error]` and logs (asserted
 *    at-least-once — each case uses a distinct error message so the
 *    module-global dedupe Set in `heatmapsPipeline.ts` does not suppress the
 *    log across cases).
 *  - T-5: `runAdapterStep` is now non-null-signature (the guard branches were
 *    removed in Batch 2); a thrown `TaskTitlesUnavailableError` from the
 *    adapter is caught and returned as `[null, error]` with a logged error.
 *  - T-6: `shouldRunHeatmapsPipeline` guard branches (null class, empty
 *    selection, untrustworthy / failed dataset → false; valid → true).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { runHeatmapsPipeline, shouldRunHeatmapsPipeline } from './heatmapsPipeline';
import { TaskTitlesUnavailableError } from '../../services/dataAnalysis/heatmapAdapter';
import type { PageDatasetState } from '../../hooks/usePageDataset';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { MergedHeatmapResult } from '../../services/dataAnalysis/heatmapAdapter.merged';

const { mockAnalyse, mockAdaptMergedHeatmap, mockLogFrontendError } = vi.hoisted(() => ({
  mockAnalyse: vi.fn(),
  mockAdaptMergedHeatmap: vi.fn(),
  mockLogFrontendError: vi.fn(),
}));

vi.mock('../../services/dataAnalysis/dataAnalysisService', () => ({
  DataAnalysisService: vi.fn().mockImplementation(function () {
    return { analyse: mockAnalyse };
  }),
}));

vi.mock('../../services/dataAnalysis/heatmapAdapter.merged', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    adaptMetricsToMergedHeatmap: mockAdaptMergedHeatmap,
  };
});

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: mockLogFrontendError,
  logFrontendEvent: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Build a minimal `ClassFull` fixture with one assignment.
 *
 * @returns {ClassFull} A class-full fixture.
 */
function makeClassFull(): ClassFull {
  return {
    classId: 'c1',
    className: 'Class 1',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg',
    classOwner: null,
    teachers: [],
    students: [{ id: 's1', name: 'S1', email: 's1@test.com' }],
    assignments: [
      {
        assignmentId: 'a1',
        assignmentDefinitionKey: 'def1',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    active: true,
  } as unknown as ClassFull;
}

/**
 * Build a minimal `AssignmentDefinitionPartialsResponse` registry.
 *
 * @returns {AssignmentDefinitionPartialsResponse} A partials registry fixture.
 */
function makePartials(): AssignmentDefinitionPartialsResponse {
  const partial: AssignmentDefinitionPartial = {
    definitionKey: 'def1',
    primaryTitle: 'Title def1',
    primaryTopic: 'Topic One',
    primaryTopicKey: 'topic-1',
    yearGroupKey: 'yg',
    yearGroupLabel: 'Year 7',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'doc',
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: 1,
    tasks: [{ taskId: 'tA', taskWeighting: 1, taskTitle: 'Task A' }],
    createdAt: null,
    updatedAt: null,
  } as unknown as AssignmentDefinitionPartial;
  return [partial] as unknown as AssignmentDefinitionPartialsResponse;
}

/**
 * Build a minimal `AveragingResult` fixture.
 *
 * @returns {AveragingResult} An averaging-result fixture.
 */
function makeAveragingResult(): AveragingResult {
  return {
    classId: 'c1',
    className: 'Class 1',
    perStudent: [],
    perStudentTaskMetrics: [],
    perClass: {
      completeness: { state: 'computed', value: 4 } as never,
      accuracy: { state: 'computed', value: 3 } as never,
      spag: { state: 'computed', value: 2 } as never,
      overall: { state: 'computed', value: 3 } as never,
    },
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  } as unknown as AveragingResult;
}

/**
 * Build a minimal `MergedHeatmapResult` fixture.
 *
 * @returns {MergedHeatmapResult} A merged-heatmap-result fixture.
 */
function makeMergedResult(): MergedHeatmapResult {
  return {
    classId: 'c1',
    className: 'Class 1',
    sourceAssignments: [
      { assignmentId: 'a1', definitionKey: 'def1', assignmentName: 'Title def1' },
    ],
    taskColumns: [
      {
        taskKey: 'def1::tA',
        taskId: 'tA',
        taskTitle: 'Task A',
        assignmentId: 'a1',
        definitionKey: 'def1',
        assignmentName: 'Title def1',
      },
    ],
    rows: [],
  } as unknown as MergedHeatmapResult;
}

/**
 * Build a `PageDatasetState` fixture for `shouldRunHeatmapsPipeline` assertions.
 *
 * @param {Partial<PageDatasetState>} [overrides] - Field overrides.
 * @returns {PageDatasetState} A dataset state.
 */
function pipelineDatasetState(
  overrides: Partial<{
    hasQueryData: boolean;
    isQueryError: boolean;
    isDatasetFailed: boolean;
    isDatasetReady: boolean;
    isDatasetTrustworthy: boolean;
    hasTrustworthyDataset: boolean;
  }> = {}
): PageDatasetState {
  return {
    hasQueryData: true,
    isQueryError: false,
    isDatasetFailed: false,
    isDatasetReady: true,
    isDatasetTrustworthy: true,
    hasTrustworthyDataset: true,
    ...overrides,
  };
}

describe('heatmapsPipeline — runHeatmapsPipeline null short-circuit (T-4)', () => {
  it('returns [null, null, null, null] when classFull is null', () => {
    const result = runHeatmapsPipeline(null, makePartials(), 'c1', ['a1']);
    expect(result).toEqual([null, null, null, null]);
    expect(mockAnalyse).not.toHaveBeenCalled();
  });

  it('returns [null, null, null, null] when classId is null', () => {
    const result = runHeatmapsPipeline(makeClassFull(), makePartials(), null, ['a1']);
    expect(result).toEqual([null, null, null, null]);
  });

  it('returns [null, null, null, null] when assignmentDefinitionPartials is null', () => {
    const result = runHeatmapsPipeline(makeClassFull(), null, 'c1', ['a1']);
    expect(result).toEqual([null, null, null, null]);
  });
});

describe('heatmapsPipeline — runAnalyserStep catch path (T-4)', () => {
  it('returns [null, error] and logs when analyse throws', () => {
    mockAnalyse.mockImplementation(() => {
      throw new Error('analyser-boom-T4-catch');
    });
    const result = runHeatmapsPipeline(makeClassFull(), makePartials(), 'c1', ['a1']);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeInstanceOf(Error);
    expect(result[1]?.message).toBe('analyser-boom-T4-catch');
    expect(result[2]).toBeNull();
    expect(result[3]).toBeNull();
    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
  });
});

describe('heatmapsPipeline — runAdapterStep catch path (T-5)', () => {
  it('returns [null, null, null, error] with a logged TaskTitlesUnavailableError when the adapter throws', () => {
    // The pipeline discards the analyser result once the adapter step fails
    // (fail-fast parity with useClassPageData): the tuple is [null, null, null, adapterError].
    mockAnalyse.mockReturnValue([makeAveragingResult()]);
    mockAdaptMergedHeatmap.mockImplementation(() => {
      throw new TaskTitlesUnavailableError('def-missing-T5');
    });
    const result = runHeatmapsPipeline(makeClassFull(), makePartials(), 'c1', ['a1']);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
    expect(result[3]).toBeInstanceOf(TaskTitlesUnavailableError);
    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
  });
});

describe('heatmapsPipeline — non-null adapter signature happy path (T-5)', () => {
  it('runs the analyser then adapter and returns the merged result without guarding', () => {
    const classFull = makeClassFull();
    const partials = makePartials();
    const analyserResult = makeAveragingResult();
    mockAnalyse.mockReturnValue([analyserResult]);
    mockAdaptMergedHeatmap.mockReturnValue(makeMergedResult());
    const result = runHeatmapsPipeline(classFull, partials, 'c1', ['a1']);
    expect(result[0]).not.toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).not.toBeNull();
    expect(result[3]).toBeNull();
    expect(mockAdaptMergedHeatmap).toHaveBeenCalledWith(
      analyserResult,
      classFull,
      ['a1'],
      partials
    );
  });
});

describe('heatmapsPipeline — shouldRunHeatmapsPipeline guard branches (T-6)', () => {
  const classFull = makeClassFull();
  const selected = ['a1'];
  const ready = pipelineDatasetState({
    isDatasetReady: true,
    isDatasetTrustworthy: true,
    hasTrustworthyDataset: true,
  });
  const failed = pipelineDatasetState({
    isDatasetFailed: true,
    isDatasetReady: false,
    isDatasetTrustworthy: false,
    hasTrustworthyDataset: false,
    hasQueryData: false,
  });
  const untrustworthy = pipelineDatasetState({
    isDatasetReady: true,
    isDatasetTrustworthy: false,
    hasTrustworthyDataset: false,
  });

  it('returns false when classFull is null', () => {
    expect(shouldRunHeatmapsPipeline(null, selected, ready)).toBe(false);
  });

  it('returns false when the selection is empty', () => {
    expect(shouldRunHeatmapsPipeline(classFull, [], ready)).toBe(false);
  });

  it('returns false when the dataset is failed', () => {
    expect(shouldRunHeatmapsPipeline(classFull, selected, failed)).toBe(false);
  });

  it('returns false when the dataset is untrustworthy', () => {
    expect(shouldRunHeatmapsPipeline(classFull, selected, untrustworthy)).toBe(false);
  });

  it('returns true for a valid class + non-empty selection + trustworthy dataset', () => {
    expect(shouldRunHeatmapsPipeline(classFull, selected, ready)).toBe(true);
  });
});
