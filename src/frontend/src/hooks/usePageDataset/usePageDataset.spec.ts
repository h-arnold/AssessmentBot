import { describe, expect, it } from 'vitest';
import type { StartupWarmupDatasetKey } from '@/query/sharedQueries';
import {
  computePageDatasetState,
  shouldBlockPageSurface,
  type PageDatasetState,
} from './usePageDataset';

// ---------------------------------------------------------------------------
// Shared factory helpers for warmup-state test doubles
// ---------------------------------------------------------------------------

interface WarmupStateDouble {
  isDatasetReady: (key: StartupWarmupDatasetKey) => boolean;
  isDatasetFailed: (key: StartupWarmupDatasetKey) => boolean;
  snapshot: {
    datasets: Record<StartupWarmupDatasetKey, { isTrustworthy: boolean }>;
  };
}

/**
 * Creates a warmup-state test double with per-dataset readiness, failure, and
 * trustworthiness controls.
 *
 * @param {boolean} isReady - Whether `isDatasetReady` returns true for the key.
 * @param {boolean} hasFailed - Whether `isDatasetFailed` returns true for the key.
 * @param {boolean} isTrustworthy - Trustworthiness stored in the dataset snapshot.
 * @param {StartupWarmupDatasetKey} datasetKey - Dataset key the double answers for.
 * @returns {WarmupStateDouble} A warmup-state test double.
 */
function createWarmupStateDouble(
  isReady: boolean,
  hasFailed: boolean,
  isTrustworthy: boolean,
  datasetKey: StartupWarmupDatasetKey = 'classPartials'
): WarmupStateDouble {
  return {
    isDatasetReady: (key: StartupWarmupDatasetKey) => key === datasetKey && isReady,
    isDatasetFailed: (key: StartupWarmupDatasetKey) => key === datasetKey && hasFailed,
    snapshot: {
      datasets: {
        classPartials: { isTrustworthy: false },
        assignmentDefinitionPartials: { isTrustworthy: false },
        assignmentTopics: { isTrustworthy: false },
        cohorts: { isTrustworthy: false },
        yearGroups: { isTrustworthy: false },
        [datasetKey]: { isTrustworthy: isTrustworthy },
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
      isDatasetReady: (key: StartupWarmupDatasetKey) => key === datasetKey,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _key param required by WarmupStateDouble interface; unconditionally returning false in this defensive test
      isDatasetFailed: (_key: StartupWarmupDatasetKey) => false,
      snapshot: {
        datasets: {
          classPartials: { isTrustworthy: false },
          assignmentDefinitionPartials: { isTrustworthy: false },
          assignmentTopics: { isTrustworthy: false },
          cohorts: { isTrustworthy: false },
          yearGroups: { isTrustworthy: false },
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
// shouldBlockPageSurface
// ---------------------------------------------------------------------------

describe('shouldBlockPageSurface', () => {
  it('blocks when the dataset has failed and there is no query data', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: false,
      isQueryError: false,
      isDatasetFailed: true,
      isDatasetReady: false,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(shouldBlockPageSurface(datasetState)).toBe(true);
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

    expect(shouldBlockPageSurface(datasetState)).toBe(false);
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

    expect(shouldBlockPageSurface(datasetState)).toBe(true);
  });

  it('blocks when the dataset is ready but untrustworthy', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    };

    expect(shouldBlockPageSurface(datasetState)).toBe(true);
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

    expect(shouldBlockPageSurface(datasetState)).toBe(true);
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

    expect(shouldBlockPageSurface(datasetState)).toBe(true);
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

    expect(shouldBlockPageSurface(datasetState)).toBe(false);
  });
});
