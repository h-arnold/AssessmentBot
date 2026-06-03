import { describe, expect, it } from 'vitest';
import type { StartupWarmupDatasetKey } from '../query/sharedQueries';
import {
  computePageDatasetState,
  computePageSurfaceBlocking,
  computeDatasetRenderable,
  computePageSurfaceBusy,
} from './usePageDataset';

/**
 * PageDatasetState mirrors the contract defined in SPEC.md §Core view model or
 * behavioural model.  The six boolean fields are derived independently by
 * `computePageDatasetState`.
 */
type PageDatasetState = Readonly<{
  hasQueryData: boolean;
  isQueryError: boolean;
  isDatasetFailed: boolean;
  isDatasetReady: boolean;
  isDatasetTrustworthy: boolean;
  hasTrustworthyDataset: boolean;
}>;

// ---------------------------------------------------------------------------
// Shared factory helpers for warmup-state test doubles
// ---------------------------------------------------------------------------

interface WarmupStateDouble {
  isDatasetReady: (key: string) => boolean;
  isDatasetFailed: (key: string) => boolean;
  snapshot: {
    datasets: Record<string, { isTrustworthy: boolean }>;
  };
}

/**
 * Creates a warmup-state test double with per-dataset readiness, failure, and
 * trustworthiness controls.
 *
 * @param {boolean} ready - Whether `isDatasetReady` returns true for the key.
 * @param {boolean} failed - Whether `isDatasetFailed` returns true for the key.
 * @param {boolean} trustworthy - Trustworthiness stored in the dataset snapshot.
 * @param {StartupWarmupDatasetKey} datasetKey - Dataset key the double answers for.
 * @returns {WarmupStateDouble} A warmup-state test double.
 */
function createWarmupStateDouble(
  ready: boolean,
  failed: boolean,
  trustworthy: boolean,
  datasetKey: StartupWarmupDatasetKey = 'classPartials'
): WarmupStateDouble {
  return {
    isDatasetReady: (key: string) => key === datasetKey && ready,
    isDatasetFailed: (key: string) => key === datasetKey && failed,
    snapshot: {
      datasets: {
        [datasetKey]: { isTrustworthy: trustworthy },
      },
    },
  };
}

interface QueryResultDouble<TData> {
  data: TData | undefined;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// computePageDatasetState
// ---------------------------------------------------------------------------

describe('computePageDatasetState', () => {
  const datasetKey: StartupWarmupDatasetKey = 'classPartials';

  it('returns all positive flags when the dataset is ready, trustworthy, and query data is present', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset has failed with no query data and no query error', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset has failed but query data was recovered with no query error', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['cached'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset has failed, query data is present, and the query is errored', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['stale'], isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset is not ready and untrustworthy', () => {
    const warmupState = createWarmupStateDouble(false, false, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when the dataset is ready and trustworthy but the query has errored', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: ['stale'], isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset is ready and trustworthy but no query data has arrived yet', () => {
    const warmupState = createWarmupStateDouble(true, false, true, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(true);
    expect(state.hasTrustworthyDataset).toBe(true);
  });

  it('returns correct flags when the dataset has failed, no query data, and the query is errored', () => {
    const warmupState = createWarmupStateDouble(false, true, false, datasetKey);
    const queryResult: QueryResultDouble<string[]> = { data: undefined, isError: true };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(false);
    expect(state.isQueryError).toBe(true);
    expect(state.isDatasetFailed).toBe(true);
    expect(state.isDatasetReady).toBe(false);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });

  it('returns correct flags when isDatasetReady is true but isDatasetTrustworthy is false (defensive — impossible in practice)', () => {
    const datasetKey: StartupWarmupDatasetKey = 'classPartials';
    // This combination cannot be produced naturally by the startup warmup system,
    // but the derivation logic should handle it correctly regardless.
    const warmupState: WarmupStateDouble = {
      isDatasetReady: (key: string) => key === datasetKey,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      isDatasetFailed: (key: string) => false,
      snapshot: {
        datasets: {
          [datasetKey]: { isTrustworthy: false },
        },
      },
    };
    const queryResult: QueryResultDouble<string[]> = { data: ['item'], isError: false };

    const state: PageDatasetState = computePageDatasetState(datasetKey, queryResult, warmupState);

    expect(state.hasQueryData).toBe(true);
    expect(state.isQueryError).toBe(false);
    expect(state.isDatasetFailed).toBe(false);
    expect(state.isDatasetReady).toBe(true);
    expect(state.isDatasetTrustworthy).toBe(false);
    expect(state.hasTrustworthyDataset).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePageSurfaceBlocking
// ---------------------------------------------------------------------------

describe('computePageSurfaceBlocking', () => {
  it('blocks when the dataset has failed and there is no query data', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('does not block when the dataset has failed but data was recovered with no query error', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(false);
  });

  it('blocks when the dataset has failed, data is present, but the query is errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is untrustworthy', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready, trustworthy, but the query is errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready, trustworthy, the query is errored, and no query data is present', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: true,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(true);
  });

  it('does not block when the dataset is ready, trustworthy, and the query is not errored', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computePageSurfaceBlocking(datasetState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeDatasetRenderable
// ---------------------------------------------------------------------------

describe('computeDatasetRenderable', () => {
  it('marks a trustworthy dataset as renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(true);
  });

  it('marks a recovered dataset (failed with data and no error) as renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(true);
  });

  it('marks a failed dataset with no query data as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });

  it('marks a failed dataset with data and a query error as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: true,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });

  it('marks a not-ready, untrustworthy dataset as not renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(computeDatasetRenderable(datasetState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computePageSurfaceBusy
// ---------------------------------------------------------------------------

describe('computePageSurfaceBusy', () => {
  it('returns busy when at least one fetch flag is true', () => {
    expect(computePageSurfaceBusy([true], [false])).toBe(true);
  });

  it('returns busy when at least one mutation flag is true', () => {
    expect(computePageSurfaceBusy([false], [true])).toBe(true);
  });

  it('returns not busy when all fetch and mutation flags are false', () => {
    expect(computePageSurfaceBusy([false, false], [false])).toBe(false);
  });

  it('returns not busy when both arrays are empty', () => {
    expect(computePageSurfaceBusy([], [])).toBe(false);
  });
});
