/**
 * Tests that a known class-partial error stays readable behind the selected
 * assignment's full read (pending, terminally failed, or null).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import '@/test/abClass/postAnalysisHookMockSetup';
import '@/test/taskHeatmap/useHeatmapsPageData.mockSetup';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import {
  createHeatmapsPageDataHarness,
  heatmapsPageDataMocks,
  mockWarmupDatasetsReady,
} from '@/test/taskHeatmap/useHeatmapsPageDataSpecMocks';
import type { AssignmentPreviewInput } from './assembleMergedPreviewData';
import {
  DEFAULT_CLASS_ID,
  createAveragingResult,
  createClassFull,
  createMockQueryResult,
} from '@/test/heatmapsPageDataFixtures';
import { createHeatmapMergedResult as createMergedResult } from '@/test/dataAnalysis/heatmapFixtures';
import { createSubmission, createSubmissionItem } from '@/test/dataAnalysis/fixtures';

const {
  mockUseQuery,
  mockUseQueries,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
} = heatmapsPageDataMocks;

let wrapper: ReturnType<typeof createHeatmapsPageDataHarness>['wrapper'];

beforeEach(() => {
  ({ wrapper } = createHeatmapsPageDataHarness());
});

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Build a class whose embedded partial records a known `E` for one task.
 *
 * @remarks
 * The shared `createSubmissionItem` fixture types assessments as
 * `{ score: number | 'N' }`, so it cannot carry the known-`E` entry. The item is
 * built inline in the same shape with the completeness assessment widened to
 * the real contract (`score: 'E'`, `reasoning`, `error: { stage, code }`).
 *
 * @returns {ClassFull} The class carrying the class-partial error.
 */
function createClassWithPartialError(): ClassFull {
  const baseClass = createClassFull();
  const [firstAssignment, ...otherAssignments] = baseClass.assignments;
  const errorItem = {
    ...createSubmissionItem('tA'),
    assessments: {
      completeness: {
        score: 'E',
        reasoning: 'The assessment service rejected the request.',
        error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
      },
    } as unknown as Record<string, { score: number | 'N' }>,
  };
  const submission = createSubmission('s-1', 'Student One', 'a1', { tA: errorItem });
  return {
    ...baseClass,
    assignments: [
      { ...firstAssignment, submissions: [{ ...submission, documentId: 'doc-1' }] },
      ...otherAssignments,
    ],
  } as unknown as ClassFull;
}

/**
 * Install the class query, one selected assignment, and the merged adapter output.
 *
 * @param {ClassFull | null} classFull - Class payload the class query returns.
 * @param {Object} preview - Projected state of the selected assignment's full read.
 * @param {boolean} preview.isPending - Whether the full read is still pending.
 * @param {boolean} preview.isError - Whether the full read terminally failed.
 * @param {null} preview.data - The full-read payload; always null.
 * @param {boolean} [isPending] - Whether the class query itself is still pending.
 */
function installKnownErrorScenario(
  classFull: ClassFull | null,
  preview: { isPending: boolean; isError: boolean; data: null },
  isPending?: boolean
): void {
  mockWarmupDatasetsReady();
  mockGetABClassQueryOptions.mockReturnValue({ queryKey: ['abClass', DEFAULT_CLASS_ID] });
  mockGetAssignmentQueryOptions.mockReturnValue({ queryKey: ['assignment', 'a1'] });
  mockUseQuery.mockReturnValue(
    createMockQueryResult<ClassFull | null>({
      data: classFull,
      isPending: isPending,
    })
  );
  mockAnalyse.mockReturnValue([createAveragingResult()]);
  mockAdaptMergedHeatmap.mockReturnValue(createMergedResult());
  mockUseQueries.mockReturnValue({
    previewResults: [{ assignmentId: 'a1', ...preview }],
    rawResults: [],
  });
}

const PENDING_FULL_READ = { isPending: true, isError: false, data: null };
const NULL_FULL_READ = { isPending: false, isError: false, data: null };

describe('useHeatmapsPageData — known class-partial error behind the full read', () => {
  it.each([
    { label: 'pending', preview: PENDING_FULL_READ },
    { label: 'terminally failed', preview: { isPending: false, isError: true, data: null } },
    { label: 'null', preview: NULL_FULL_READ },
  ])('keeps the class-partial error readable after a $label full read', ({ preview }) => {
    installKnownErrorScenario(createClassWithPartialError(), preview);

    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1']));
    // A usable preview survives: the surface stays ready and the class-derived
    // lookup is assembled, reflecting a pending or terminal read as loading/error.
    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.mergedResult).not.toBeNull();
    expect(mockAssembleMergedPreviewData).toHaveBeenCalledTimes(1);
    const [inputs] = mockAssembleMergedPreviewData.mock.calls[0] as [
      ReadonlyArray<AssignmentPreviewInput>,
    ];
    expect(inputs[0]).toMatchObject({ isLoading: preview.isPending, hasError: preview.isError });
  });

  it('does not discard usable content when only a background refetch is eligible', () => {
    installKnownErrorScenario(createClassWithPartialError(), NULL_FULL_READ);
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1']));
    const mergedBefore = result.current.mergedResult;
    expect(mergedBefore).not.toBeNull();
    // Refetch eligibility alone must not replace the usable preview.
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.surfaceState.status).toBe('ready');
    expect(result.current.mergedResult).toBe(mergedBefore);
  });

  it('preserves the whole-preview loading treatment when no result is known', () => {
    installKnownErrorScenario(null, PENDING_FULL_READ, true);
    const { result } = renderHook(() => useHeatmapsPageData(), { wrapper });
    act(() => result.current.selectClass(DEFAULT_CLASS_ID));
    act(() => result.current.changeAssignments(['a1']));
    expect(result.current.surfaceState.status).toBe('loading');
    expect(result.current.mergedResult).toBeNull();
    expect(result.current.mergedPreview).toBeNull();
    expect(mockAssembleMergedPreviewData).not.toHaveBeenCalled();
  });
});
