import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeatmapSelectionSummary } from './useHeatmapSelectionSummary';
import { DataAnalysisService } from '@/services/dataAnalysis/dataAnalysisService';
import { adaptMetricsToMergedHeatmap } from '@/services/dataAnalysis/heatmapAdapter.merged';
import * as frontendLogger from '@/logging/frontendLogger';
import * as summaryAdapter from '@/services/dataAnalysis/assignmentSummaryAdapter';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
} from '@/test/dataAnalysis/fixtures';

const FIRST_ACCURACY = 4;
const SECOND_ACCURACY = 1;
const THIRD_ACCURACY = 2;
const TWO_ASSIGNMENTS = 2;
const SECOND_CALL = 2;
const THIRD_CALL = 3;
const ASSIGNMENT_IDS = ['a_001', 'a_002', 'a_003'];
const ACCURACY_SCORES = [FIRST_ACCURACY, SECOND_ACCURACY, THIRD_ACCURACY];
const INPUT = buildInput([
  {
    classId: 'c_001',
    studentIds: ['s_001'],
    assignments: ASSIGNMENT_IDS.map((assignmentId, index) => {
      return createAssignmentPartial({
        assignmentId,
        definitionKey: 'dk_algebra',
        submissions: [
          createSubmission('s_001', 'One', assignmentId, {
            t_001: createSubmissionItem('t_001', {
              completeness: { score: FIRST_ACCURACY },
              accuracy: { score: ACCURACY_SCORES[index] },
            }),
          }),
        ],
      });
    }),
  },
]);

/**
 * Build a real selection-scoped heatmap from a minimal shared-definition boundary case.
 * @param {string[]} assignmentIds - Selected assignment instances.
 * @returns {ReturnType<typeof adaptMetricsToMergedHeatmap>} Real merged presentation model.
 */
function selectedHeatmap(assignmentIds: string[]) {
  const classFull = INPUT.classes[0];
  const scopedInput = {
    ...INPUT,
    classes: [
      {
        ...classFull,
        assignments: classFull.assignments.filter((assignment) =>
          assignmentIds.includes(assignment.assignmentId)
        ),
      },
    ],
  };
  const analysis = new DataAnalysisService().analyse(scopedInput, 'averaging')[0];
  return adaptMetricsToMergedHeatmap(
    analysis,
    classFull,
    assignmentIds,
    INPUT.assignmentDefinitionPartials
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Heatmaps selection summaries', () => {
  it('uses only the selected assignment and recomputes when selection changes', () => {
    const first = selectedHeatmap([ASSIGNMENT_IDS[0]]);
    const second = selectedHeatmap([ASSIGNMENT_IDS[1]]);
    const { result, rerender } = renderHook(
      ({ heatmap }) => {
        return useHeatmapSelectionSummary(
          INPUT.classes[0],
          INPUT.assignmentDefinitionPartials,
          heatmap,
          true
        );
      },
      { initialProps: { heatmap: first } }
    );
    expect(result.current.error).toBeNull();
    expect(result.current.view?.summary?.accuracy.rows[0].primaryValue).toBe('4.00/5');
    rerender({ heatmap: second });
    expect(result.current.view?.summary?.accuracy.rows[0].primaryValue).toBe('1.00/5');
  });

  it('does not run summary analysis for two or more instances sharing one task definition', () => {
    const heatmaps = [
      selectedHeatmap(ASSIGNMENT_IDS.slice(0, TWO_ASSIGNMENTS)),
      selectedHeatmap(ASSIGNMENT_IDS),
    ];
    const analyseSummary = vi.spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary');
    for (const heatmap of heatmaps) {
      expect(heatmap.taskColumns).toHaveLength(1);
      const { result, unmount } = renderHook(() => {
        return useHeatmapSelectionSummary(
          INPUT.classes[0],
          INPUT.assignmentDefinitionPartials,
          heatmap,
          true
        );
      });
      expect(result.current.view?.message).toContain('Multiple assignments are selected.');
      expect(result.current.view?.summary).toBeUndefined();
      expect(result.current.error).toBeNull();
      unmount();
    }
    expect(analyseSummary).not.toHaveBeenCalled();
  });

  it('does not expose summaries when required data or a selected heatmap is absent', () => {
    const heatmap = selectedHeatmap([ASSIGNMENT_IDS[0]]);
    const analyseSummary = vi.spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary');
    const missingClass = renderHook(() =>
      useHeatmapSelectionSummary(null, INPUT.assignmentDefinitionPartials, heatmap, true)
    );
    const missingDefinitions = renderHook(() =>
      useHeatmapSelectionSummary(INPUT.classes[0], null, heatmap, true)
    );
    const missingHeatmap = renderHook(() =>
      useHeatmapSelectionSummary(INPUT.classes[0], INPUT.assignmentDefinitionPartials, null, true)
    );
    const loading = renderHook(() => {
      return useHeatmapSelectionSummary(
        INPUT.classes[0],
        INPUT.assignmentDefinitionPartials,
        heatmap,
        false
      );
    });
    for (const hook of [missingClass, missingDefinitions, missingHeatmap, loading]) {
      expect(hook.result.current).toEqual({ view: null, error: null });
    }
    expect(analyseSummary).not.toHaveBeenCalled();
  });

  it.each(['analysis', 'adaptor'] as const)(
    'clears stale evidence on %s failure and recovers after recomputation',
    (stage) => {
      const heatmap = selectedHeatmap([ASSIGNMENT_IDS[0]]);
      const error = new Error(`Selection summary ${stage} recovery failure`);
      const logError = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(vi.fn());
      const { result, rerender } = renderHook(
        ({ heatmap }) => {
          return useHeatmapSelectionSummary(
            INPUT.classes[0],
            INPUT.assignmentDefinitionPartials,
            heatmap,
            true
          );
        },
        { initialProps: { heatmap } }
      );
      expect(result.current.error).toBeNull();
      expect(result.current.view?.summary?.accuracy.rows[0].primaryValue).toBe('4.00/5');

      const failure =
        stage === 'analysis'
          ? vi.spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary')
          : vi.spyOn(summaryAdapter, 'adaptAssignmentSummary');
      failure.mockImplementation(() => {
        throw error;
      });
      rerender({ heatmap: { ...heatmap } });
      expect(result.current).toEqual({ view: null, error });
      expect(logError).toHaveBeenCalledExactlyOnceWith('useHeatmapSelectionSummary', error, {
        classId: INPUT.classes[0].classId,
        assignmentId: ASSIGNMENT_IDS[0],
      });

      failure.mockRestore();
      rerender({ heatmap: selectedHeatmap([ASSIGNMENT_IDS[1]]) });
      expect(result.current.error).toBeNull();
      expect(result.current.view?.summary?.accuracy.rows[0].primaryValue).toBe('1.00/5');
      expect(logError).toHaveBeenCalledTimes(1);
    }
  );

  it('suppresses identical diagnostics across recomputations and remounts', () => {
    const heatmap = selectedHeatmap([ASSIGNMENT_IDS[0]]);
    const message = 'Selection summary repeated diagnostic';
    const analyseSummary = vi
      .spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary')
      .mockImplementation(() => {
        throw new Error(message);
      });
    const logError = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(vi.fn());
    const { result, rerender, unmount } = renderHook(
      ({ heatmap }) => {
        return useHeatmapSelectionSummary(
          INPUT.classes[0],
          INPUT.assignmentDefinitionPartials,
          heatmap,
          true
        );
      },
      { initialProps: { heatmap } }
    );
    expect(result.current.view).toBeNull();
    expect(result.current.error?.message).toBe(message);
    rerender({ heatmap: { ...heatmap } });
    expect(analyseSummary).toHaveBeenCalledTimes(SECOND_CALL);
    expect(logError).toHaveBeenCalledTimes(1);
    unmount();

    const remounted = renderHook(() => {
      return useHeatmapSelectionSummary(
        INPUT.classes[0],
        INPUT.assignmentDefinitionPartials,
        heatmap,
        true
      );
    });
    expect(remounted.result.current.view).toBeNull();
    expect(remounted.result.current.error?.message).toBe(message);
    expect(analyseSummary).toHaveBeenCalledTimes(THIRD_CALL);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('logs distinct failures on the same mounted selection', () => {
    const heatmap = selectedHeatmap([ASSIGNMENT_IDS[0]]);
    const firstError = new Error('Selection summary first distinct diagnostic');
    const secondError = new Error('Selection summary second distinct diagnostic');
    const analyseSummary = vi
      .spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary')
      .mockImplementation(() => {
        throw firstError;
      });
    const logError = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ heatmap }) => {
        return useHeatmapSelectionSummary(
          INPUT.classes[0],
          INPUT.assignmentDefinitionPartials,
          heatmap,
          true
        );
      },
      { initialProps: { heatmap } }
    );
    expect(result.current).toEqual({ view: null, error: firstError });
    analyseSummary.mockImplementation(() => {
      throw secondError;
    });
    rerender({ heatmap: { ...heatmap } });
    expect(result.current).toEqual({ view: null, error: secondError });
    const metadata = { classId: INPUT.classes[0].classId, assignmentId: ASSIGNMENT_IDS[0] };
    expect(logError).toHaveBeenNthCalledWith(1, 'useHeatmapSelectionSummary', firstError, metadata);
    expect(logError).toHaveBeenNthCalledWith(
      SECOND_CALL,
      'useHeatmapSelectionSummary',
      secondError,
      metadata
    );
    expect(logError).toHaveBeenCalledTimes(SECOND_CALL);
  });

  it('logs the same message separately for different assignments', () => {
    const first = selectedHeatmap([ASSIGNMENT_IDS[0]]);
    const second = selectedHeatmap([ASSIGNMENT_IDS[1]]);
    const error = new Error('Selection summary assignment-specific diagnostic');
    vi.spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary').mockImplementation(() => {
      throw error;
    });
    const logError = vi.spyOn(frontendLogger, 'logFrontendError').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ heatmap }) => {
        return useHeatmapSelectionSummary(
          INPUT.classes[0],
          INPUT.assignmentDefinitionPartials,
          heatmap,
          true
        );
      },
      { initialProps: { heatmap: first } }
    );
    expect(result.current).toEqual({ view: null, error });
    rerender({ heatmap: second });
    expect(result.current).toEqual({ view: null, error });
    expect(logError).toHaveBeenNthCalledWith(1, 'useHeatmapSelectionSummary', error, {
      classId: INPUT.classes[0].classId,
      assignmentId: ASSIGNMENT_IDS[0],
    });
    expect(logError).toHaveBeenNthCalledWith(SECOND_CALL, 'useHeatmapSelectionSummary', error, {
      classId: INPUT.classes[0].classId,
      assignmentId: ASSIGNMENT_IDS[1],
    });
    expect(logError).toHaveBeenCalledTimes(SECOND_CALL);
  });
});
