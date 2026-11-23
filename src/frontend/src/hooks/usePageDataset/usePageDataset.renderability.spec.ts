import { describe, expect, it } from 'vitest';
import { isDatasetRenderable, isPageSurfaceBusy, type PageDatasetState } from './usePageDataset';

// ---------------------------------------------------------------------------
// isDatasetRenderable
// ---------------------------------------------------------------------------

describe('isDatasetRenderable', () => {
  it('marks a trustworthy dataset as renderable', () => {
    const datasetState: PageDatasetState = {
      hasQueryData: true,
      isQueryError: false,
      isDatasetFailed: false,
      isDatasetReady: true,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    };

    expect(isDatasetRenderable(datasetState)).toBe(true);
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

    expect(isDatasetRenderable(datasetState)).toBe(true);
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

    expect(isDatasetRenderable(datasetState)).toBe(false);
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

    expect(isDatasetRenderable(datasetState)).toBe(false);
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

    expect(isDatasetRenderable(datasetState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPageSurfaceBusy
// ---------------------------------------------------------------------------

describe('isPageSurfaceBusy', () => {
  it('returns busy when at least one fetch flag is true', () => {
    expect(isPageSurfaceBusy([true], [false])).toBe(true);
  });

  it('returns busy when at least one mutation flag is true', () => {
    expect(isPageSurfaceBusy([false], [true])).toBe(true);
  });

  it('returns not busy when all fetch and mutation flags are false', () => {
    expect(isPageSurfaceBusy([false, false], [false])).toBe(false);
  });

  it('returns not busy when both arrays are empty', () => {
    expect(isPageSurfaceBusy([], [])).toBe(false);
  });
});
