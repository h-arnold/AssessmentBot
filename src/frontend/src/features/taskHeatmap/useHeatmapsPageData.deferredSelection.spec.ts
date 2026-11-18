/**
 * Deferred selection-derivation contract for the standalone Heatmaps hook.
 *
 * @remarks
 * Derived outputs stay committed until the deferred copy settles; a class switch cannot pair
 * the loaded class with the previous deferred selection; removed/reordered assignments keep
 * their deferred preview entries; pairing is by `assignmentId`; `isRefreshing` covers pipeline
 * lag only. A controllable double tracks both deferred values in independent slots and freezes
 * /settles them together; `act()` flushes the observing render.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { StartupWarmupDatasetKey } from '@/query/sharedQueries';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import '@/test/abClass/postAnalysisHookMockSetup';
import '@/test/taskHeatmap/useHeatmapsPageData.mockSetup';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import {
  createHeatmapsPageDataHarness,
  heatmapsPageDataMocks,
} from '@/test/taskHeatmap/useHeatmapsPageDataSpecMocks';
import {
  DEFAULT_CLASS_ID,
  createAveragingResult,
  createClassFull,
  createMockQueryResult,
} from '@/test/heatmapsPageDataFixtures';
import { createReadyHeatmapsDatasetResult } from '@/test/taskHeatmap/hookMockFactories';
import { createHeatmapMergedResult } from '@/test/dataAnalysis/heatmapFixtures';
import type { AssignmentPreviewInput } from './assembleMergedPreviewData';

const {
  mockUseQuery,
  mockUsePageDataset,
  mockGetABClassQueryOptions,
  mockGetAssignmentQueryOptions,
  mockAnalyse,
  mockAdaptMergedHeatmap,
  mockAssembleMergedPreviewData,
} = heatmapsPageDataMocks;

const deferredControl = vi.hoisted(() => {
  return {
    frozen: false,
    /** Last committed value per deferred slot: selection first, then preview results. */
    settledValues: [] as unknown[],
    /** Monotonic call counter; each render calls `useDeferredValue` in a fixed order. */
    nextSlot: 0,
    /** Number of `useDeferredValue` call sites in the hook under test. */
    slotCount: 2,
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useDeferredValue: <T>(value: T): T => {
      const slot = deferredControl.nextSlot % deferredControl.slotCount;
      deferredControl.nextSlot += 1;
      if (!deferredControl.frozen) {
        deferredControl.settledValues[slot] = value;
        return value;
      }
      return deferredControl.settledValues[slot] as T;
    },
  };
});

/** Second class identity used by the cached-class-switch case. */
const OTHER_CLASS_ID = 'class-def-456';

/** Stable warm-up results so pipeline memo inputs keep their identity per render. */
const READY_DATASETS = {
  classPartials: createReadyHeatmapsDatasetResult('classPartials'),
  assignmentDefinitionPartials: createReadyHeatmapsDatasetResult('assignmentDefinitionPartials'),
} as const;

/** Per-assignment preview state installed on the per-assignment query mock. */
type PreviewQueryState = Readonly<{
  data?: ClassFull | null;
  isPending?: boolean;
  isError?: boolean;
}>;

/** The analyser input fields the per-test pipeline double reads. */
type AnalyserCallInput = Readonly<{
  filter: Readonly<{ classIds: readonly string[] }>;
  classes: ReadonlyArray<ClassFull>;
}>;

/** Scenario query data for the query doubles. */
type QueryScenario = Readonly<{
  classFulls: ReadonlyMap<string, ClassFull>;
  previews?: ReadonlyMap<string, PreviewQueryState>;
}>;

type HeatmapsView = RenderHookResult<ReturnType<typeof useHeatmapsPageData>, void>;

/** Reset the deferred double to its unfrozen, empty-snapshot state. */
function resetDeferredControl(): void {
  deferredControl.frozen = false;
  deferredControl.settledValues = [];
  deferredControl.nextSlot = 0;
}

/** Freeze both deferred values at their last committed snapshots. */
function freezeDeferredSelection(): void {
  deferredControl.frozen = true;
}

/**
 * Release the frozen deferred values and flush the render that observes them.
 *
 * @param {() => void} rerender - The hook's rerender trigger.
 * @returns {Promise<void>} Resolves after the render commits.
 */
async function settleDeferredSelection(rerender: () => void): Promise<void> {
  deferredControl.frozen = false;
  await act(async () => {
    rerender();
  });
}

/**
 * Run a selection action inside an `act` boundary.
 *
 * @param {() => void} action - The selection action to run.
 * @returns {Promise<void>} Resolves after the action commits.
 */
async function runSelectionAction(action: () => void): Promise<void> {
  await act(async () => action());
}

/**
 * Resolve one mocked query result from the scenario data.
 *
 * @param {ReadonlyArray<unknown>} queryKey - The query key the hook requested.
 * @param {QueryScenario} scenario - Class and preview fixtures by identifier.
 * @returns {object} The mocked query result.
 */
function resolveMockQueryResult(
  queryKey: ReadonlyArray<unknown>,
  scenario: QueryScenario
): ReturnType<typeof createMockQueryResult<ClassFull | null>> {
  const [family, identifier] = queryKey;
  if (family === 'abClass') {
    return createMockQueryResult<ClassFull | null>({
      data: scenario.classFulls.get(String(identifier)),
    });
  }
  const preview = scenario.previews?.get(String(identifier));
  return createMockQueryResult<ClassFull | null>({
    data: preview?.data ?? null,
    isPending: preview?.isPending,
    isError: preview?.isError,
  });
}

/**
 * Install the query-options and `useQuery` doubles for a scenario.
 *
 * @param {QueryScenario} scenario - Class and preview fixtures by identifier.
 */
function installQueryResults(scenario: QueryScenario): void {
  mockGetABClassQueryOptions.mockImplementation((classId: string) => {
    return {
      queryKey: ['abClass', classId],
    };
  });
  mockGetAssignmentQueryOptions.mockImplementation((_classId: string, assignmentId: string) => {
    return {
      queryKey: ['assignment', assignmentId],
    };
  });
  mockUseQuery.mockImplementation((queryOptions: { queryKey: ReadonlyArray<unknown> }) =>
    resolveMockQueryResult(queryOptions.queryKey, scenario)
  );
}

/**
 * Build a merged result tagged with the assignment selection.
 *
 * A fresh object is returned on every call so a recomputed derived result is
 * detectable by reference.
 *
 * @param {readonly string[]} assignmentIds - The selection the adapter ran for.
 * @returns {object} The merged result fixture.
 */
function buildMergedResultForAssignments(
  assignmentIds: readonly string[]
): ReturnType<typeof createHeatmapMergedResult> {
  return createHeatmapMergedResult({
    sourceAssignments: assignmentIds.map((assignmentId) => {
      return {
        assignmentId,
        definitionKey: `def-${assignmentId}`,
        assignmentName: `Title ${assignmentId}`,
      };
    }),
  });
}

/**
 * Install pipeline doubles that expose the selection they derived from.
 *
 * The analyser rejects a class payload that does not match the class filter.
 */
function installPipelineOutputs(): void {
  mockAnalyse.mockImplementation((input: AnalyserCallInput) => {
    const [classId] = input.filter.classIds;
    const isClassMatched = input.classes.length > 0 && input.classes[0].classId === classId;
    if (!isClassMatched) {
      throw new Error('analyser input class does not match the class filter');
    }
    return [{ ...createAveragingResult(), classId }];
  });
  mockAdaptMergedHeatmap.mockImplementation(
    (_analyserResult: unknown, _classFull: ClassFull, assignmentIds: readonly string[]) =>
      buildMergedResultForAssignments(assignmentIds)
  );
  mockAssembleMergedPreviewData.mockReturnValue({
    mergedLookup: new Map(),
    previewStatusByTaskKey: new Map(),
  });
}

/**
 * Install a ready scenario: two loaded classes, trustworthily-ready datasets,
 * pipeline doubles, and a null preview for each supplied assignment.
 *
 * @param {readonly string[]} previewAssignmentIds - Assignments with a null preview.
 */
function installReadyScenario(previewAssignmentIds: readonly string[]): void {
  mockUsePageDataset.mockImplementation(
    (datasetKey: StartupWarmupDatasetKey) =>
      READY_DATASETS[datasetKey as keyof typeof READY_DATASETS]
  );
  installQueryResults({
    classFulls: new Map([
      [DEFAULT_CLASS_ID, createClassFull()],
      [OTHER_CLASS_ID, createClassFull({ classId: OTHER_CLASS_ID, className: 'Test Class 8B' })],
    ]),
    previews: new Map(previewAssignmentIds.map((id) => [id, { data: null }])),
  });
  installPipelineOutputs();
}

/**
 * Read the preview inputs passed to the most recent merged-preview assembly.
 *
 * @returns {ReadonlyArray<AssignmentPreviewInput>} The latest assembly inputs.
 */
function latestPreviewInputs(): ReadonlyArray<AssignmentPreviewInput> {
  const lastCall = mockAssembleMergedPreviewData.mock.lastCall as
    ReadonlyArray<unknown> | undefined;
  if (lastCall === undefined) {
    throw new Error('assembleMergedPreviewData was never called');
  }
  return lastCall[0] as ReadonlyArray<AssignmentPreviewInput>;
}

/**
 * Read the latest preview input for one assignment.
 *
 * @param {string} assignmentId - The assignment to find.
 * @returns {AssignmentPreviewInput | undefined} The matching input, if present.
 */
function latestPreviewInput(assignmentId: string): AssignmentPreviewInput | undefined {
  return latestPreviewInputs().find((input) => input.assignmentId === assignmentId);
}

/**
 * Drive the hook to a ready class with the supplied assignment selection.
 *
 * @param {HeatmapsView} view - The rendered hook view.
 * @param {readonly string[]} assignmentIds - Assignments to select.
 * @returns {Promise<void>} Resolves after the selection commits.
 */
async function selectReadyClassWithAssignments(
  view: HeatmapsView,
  assignmentIds: readonly string[]
): Promise<void> {
  await runSelectionAction(() => view.result.current.selectClass(DEFAULT_CLASS_ID));
  await runSelectionAction(() => view.result.current.changeAssignments(assignmentIds));
}

let wrapper: ReturnType<typeof createHeatmapsPageDataHarness>['wrapper'];

beforeEach(() => {
  resetDeferredControl();
  ({ wrapper } = createHeatmapsPageDataHarness());
});

afterEach(() => {
  resetDeferredControl();
  vi.resetAllMocks();
});

describe('useHeatmapsPageData — deferred selection derivation', () => {
  it('keeps the analyser, merged result and merged preview on the committed selection until the deferred selection settles', async () => {
    installReadyScenario(['a1']);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectReadyClassWithAssignments(view, ['a1']);

    const analyserBefore = view.result.current.analyserResult;
    const mergedBefore = view.result.current.mergedResult;
    expect(mergedBefore).not.toBeNull();
    mockAnalyse.mockClear();
    mockAdaptMergedHeatmap.mockClear();
    mockAssembleMergedPreviewData.mockClear();

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.changeAssignments(['a1', 'a2']));

    // The selector state is urgent: the new selection is visible immediately.
    expect(view.result.current.selection.assignmentIds).toEqual(['a1', 'a2']);
    // Everything derived from the selection still reflects the committed value.
    expect(view.result.current.analyserResult).toBe(analyserBefore);
    expect(view.result.current.mergedResult).toBe(mergedBefore);
    expect(mockAnalyse).not.toHaveBeenCalled();
    // Assembly depends only on deferred inputs, so the urgent render does not rebuild it.
    expect(mockAssembleMergedPreviewData).not.toHaveBeenCalled();
    expect(view.result.current.surfaceState).toEqual({ status: 'ready' });

    await settleDeferredSelection(view.rerender);
    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    expect(mockAdaptMergedHeatmap).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ['a1', 'a2'],
      expect.anything()
    );
    expect(mockAssembleMergedPreviewData).toHaveBeenCalledTimes(1);
    expect(latestPreviewInputs().map((input) => input.assignmentId)).toEqual(['a1', 'a2']);
    expect(view.result.current.mergedResult).not.toBe(mergedBefore);
    expect(
      view.result.current.mergedResult?.sourceAssignments.map(
        (assignment) => assignment.assignmentId
      )
    ).toEqual(['a1', 'a2']);
  });
});

describe('useHeatmapsPageData — cached-class switch during the deferral lag', () => {
  it('never pairs the loaded class with the previous class deferred selection', async () => {
    installReadyScenario(['a2']);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectReadyClassWithAssignments(view, ['a1']);
    mockAnalyse.mockClear();
    mockAdaptMergedHeatmap.mockClear();

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.selectClass(OTHER_CLASS_ID));
    await runSelectionAction(() => view.result.current.changeAssignments(['a2']));

    // Urgent controls already show the new class and assignment.
    expect(view.result.current.selection.classId).toBe(OTHER_CLASS_ID);
    expect(view.result.current.selection.assignmentIds).toEqual(['a2']);
    // The pipeline must not run for the urgent pair while the deferred selection
    // still names the previous class; pairing them would surface a blocking
    // "Analysis failed" frame.
    expect(mockAnalyse).not.toHaveBeenCalled();
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.surfaceState.status).not.toBe('blocking');

    await settleDeferredSelection(view.rerender);
    expect(mockAnalyse).toHaveBeenCalledTimes(1);
    expect(mockAnalyse).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.objectContaining({ classIds: [OTHER_CLASS_ID] }) })
    );
    expect(view.result.current.surfaceState).toEqual({ status: 'ready' });
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.mergedResult).not.toBeNull();
  });
});

describe('useHeatmapsPageData — assignment removal during the deferral lag', () => {
  it('keeps the removed assignment at its deferred preview entry until the deferred selection settles', async () => {
    installReadyScenario(['a1', 'a2']);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectReadyClassWithAssignments(view, ['a1', 'a2']);

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.changeAssignments(['a1']));

    expect(view.result.current.selection.assignmentIds).toEqual(['a1']);
    // Assembly consumes the deferred preview results, so the removed assignment keeps its
    // real settled entry (not a synthesised pending one) with no error flash, and the visible
    // data stays on the settled snapshot until the deferred selection catches up.
    expect(latestPreviewInputs().map((input) => input.assignmentId)).toEqual(['a1', 'a2']);
    expect(latestPreviewInput('a1')).toMatchObject({ isLoading: false, hasError: false });
    expect(latestPreviewInput('a2')).toMatchObject({ isLoading: false, hasError: false });
    expect(latestPreviewInput('a2')?.lookup.size).toBe(0);
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.surfaceState.status).not.toBe('blocking');

    await settleDeferredSelection(view.rerender);

    expect(latestPreviewInputs().map((input) => input.assignmentId)).toEqual(['a1']);
    expect(view.result.current.error).toBeNull();
  });
});

describe('useHeatmapsPageData — id-keyed preview pairing', () => {
  it('pairs preview inputs by assignment id from the deferred selection when the urgent selection reorders during the lag', async () => {
    installReadyScenario(['a1', 'a2']);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectReadyClassWithAssignments(view, ['a1', 'a2']);

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.changeAssignments(['a2', 'a1']));

    // Assembly consumes the deferred selection and preview results, both still in the committed
    // order after the urgent reorder. Pairing by assignmentId keeps each on its own settled
    // entry rather than borrowing the other's by position.
    expect(view.result.current.selection.assignmentIds).toEqual(['a2', 'a1']);
    expect(latestPreviewInputs().map((input) => input.assignmentId)).toEqual(['a1', 'a2']);
    expect(latestPreviewInput('a1')).toMatchObject({ isLoading: false, hasError: false });
    expect(latestPreviewInput('a2')).toMatchObject({ isLoading: false, hasError: false });
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.surfaceState.status).not.toBe('blocking');

    await settleDeferredSelection(view.rerender);

    expect(latestPreviewInputs().map((input) => input.assignmentId)).toEqual(['a2', 'a1']);
    expect(view.result.current.error).toBeNull();
  });
});

describe('useHeatmapsPageData — deferral busy signal', () => {
  it('reports isRefreshing for the deferral lag on pipeline inputs only', async () => {
    installReadyScenario(['a1', 'a2']);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await selectReadyClassWithAssignments(view, ['a1']);
    expect(view.result.current.isRefreshing).toBe(false);

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.changeAssignments(['a1', 'a2']));

    // No fetch is in flight, yet the deferred assignment selection is still behind.
    expect(view.result.current.isRefreshing).toBe(true);
    await settleDeferredSelection(view.rerender);
    expect(view.result.current.isRefreshing).toBe(false);

    freezeDeferredSelection();
    await runSelectionAction(() => {
      view.result.current.changeTopics(
        ['t1'],
        new Map([
          ['a1', 't1'],
          ['a2', 't1'],
        ])
      );
    });

    // Topics do not feed the pipeline, so a topic-only change is not a refresh.
    expect(view.result.current.selection.topicKeys).toEqual(['t1']);
    expect(view.result.current.selection.assignmentIds).toEqual(['a1', 'a2']);
    expect(view.result.current.isRefreshing).toBe(false);

    await runSelectionAction(() => view.result.current.selectClass(OTHER_CLASS_ID));

    // A class switch is a pipeline input, so the lag raises busy.
    expect(view.result.current.isRefreshing).toBe(true);
  });
});

describe('useHeatmapsPageData — empty to selected transition', () => {
  it('holds the derived result back and raises busy until the deferred selection settles', async () => {
    installReadyScenario([]);

    const view: HeatmapsView = renderHook(() => useHeatmapsPageData(), { wrapper });
    await runSelectionAction(() => view.result.current.selectClass(DEFAULT_CLASS_ID));
    expect(view.result.current.mergedResult).toBeNull();

    freezeDeferredSelection();
    await runSelectionAction(() => view.result.current.changeAssignments(['a1']));

    // The urgent selection is published, but the derived pipeline is still empty:
    // this is the intended transient where the surface shows its skeleton.
    expect(view.result.current.selection.assignmentIds).toEqual(['a1']);
    expect(view.result.current.analyserResult).toBeNull();
    expect(view.result.current.mergedResult).toBeNull();
    expect(view.result.current.isRefreshing).toBe(true);
    expect(view.result.current.error).toBeNull();
    expect(view.result.current.surfaceState).toEqual({ status: 'ready' });

    await settleDeferredSelection(view.rerender);
    expect(view.result.current.analyserResult).not.toBeNull();
    expect(view.result.current.mergedResult).not.toBeNull();
    expect(view.result.current.isRefreshing).toBe(false);
  });
});
