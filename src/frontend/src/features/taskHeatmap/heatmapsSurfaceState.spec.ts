/**
 * Tests for the Heatmaps surface-state / blocking-error derivation helpers
 * (`heatmapsSurfaceState`).
 *
 * GREEN: the derivation helpers are fully implemented. These tests pin the
 * agreed error-precedence contracts the review (T-1, T-2, T-3, T-N3) flagged
 * as untested:
 *  - T-1: `computeDatasetBlockingError` untrustworthy-precedence (ready +
 *    untrustworthy + query error → `assignmentDefinitionPartialsUntrustworthy`,
 *    not `…Failed`); a failed dataset with trustworthy data does NOT block.
 *  - T-2: `computeQueryBlockingError` `classQueryError` branch returns a
 *    `{ type: 'classQueryError', cause: <Error> }` with the cause normalised
 *    via `toError` (assert `cause instanceof Error`).
 *  - T-3: `computeServiceError` adapter-over-analyser precedence and both
 *    branches.
 *  - T-N3: `classFull === null && isSuccess` → `classNotFound` contract.
 */

import { describe, expect, it } from 'vitest';
import {
  computeDatasetBlockingError,
  computeQueryBlockingError,
  computeServiceError,
  computeHeatmapsSurfaceState,
} from './heatmapsSurfaceState';
import type { PageDatasetState } from '../../hooks/usePageDataset';

/**
 * Build a `PageDatasetState` from overrides, defaulting to a ready +
 * trustworthy state.
 *
 * @param {Partial<PageDatasetState>} [overrides] - Field overrides.
 * @returns {PageDatasetState} A dataset state fixture.
 */
function datasetState(overrides: Partial<PageDatasetState> = {}): PageDatasetState {
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

describe('heatmapsSurfaceState — computeDatasetBlockingError (T-1)', () => {
  it('resolves ready + untrustworthy + query error to assignmentDefinitionPartialsUntrustworthy (not …Failed)', () => {
    const state = datasetState({
      isQueryError: true,
      isDatasetTrustworthy: false,
      hasTrustworthyDataset: false,
    });
    const error = computeDatasetBlockingError(state);
    expect(error).toEqual({ type: 'assignmentDefinitionPartialsUntrustworthy' });
  });

  it('does NOT block for a failed dataset that still has trustworthy data (recovered after failure)', () => {
    const state = datasetState({
      isDatasetFailed: true,
      hasQueryData: true,
      isQueryError: false,
      isDatasetTrustworthy: true,
      hasTrustworthyDataset: true,
    });
    expect(computeDatasetBlockingError(state)).toBeNull();
  });
});

describe('heatmapsSurfaceState — computeQueryBlockingError (T-2, T-N3)', () => {
  it('returns classNotFound when classFull is null and the query is successful', () => {
    const error = computeQueryBlockingError(null, true, false, null);
    expect(error).toEqual({ type: 'classNotFound' });
  });

  it('returns classQueryError with a normalised Error cause when the query errored', () => {
    const originalError = new Error('transport down');
    const error = computeQueryBlockingError(null, false, true, originalError);
    expect(error).toEqual({ type: 'classQueryError', cause: originalError });
    expect(error?.type).toBe('classQueryError');
    // Narrow to the classQueryError variant before touching `cause`, since not
    // every member of the HeatmapsPageError union carries a `cause`.
    if (error?.type === 'classQueryError') {
      expect(error.cause).toBeInstanceOf(Error);
    }
  });

  it('normalises a non-Error cause to an Error via toError', () => {
    const error = computeQueryBlockingError(
      null,
      false,
      true,
      'string failure' as unknown as Error
    );
    expect(error).toEqual({ type: 'classQueryError', cause: new Error('string failure') });
    expect(error?.type).toBe('classQueryError');
    // Narrow to the classQueryError variant before touching `cause`, since not
    // every member of the HeatmapsPageError union carries a `cause`.
    if (error?.type === 'classQueryError') {
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause.message).toBe('string failure');
    }
  });
});

describe('heatmapsSurfaceState — computeServiceError (T-3)', () => {
  it('returns adapterError when only the adapter error is present', () => {
    const adapterError = new Error('adapter boom');
    const error = computeServiceError(adapterError, null);
    expect(error).toEqual({ type: 'adapterError', cause: adapterError });
  });

  it('returns analyserError when only the analyser error is present', () => {
    const analyserError = new Error('analyser boom');
    const error = computeServiceError(null, analyserError);
    expect(error).toEqual({ type: 'analyserError', cause: analyserError });
  });

  it('lets adapterError win over analyserError (precedence)', () => {
    const adapterError = new Error('adapter boom');
    const analyserError = new Error('analyser boom');
    const error = computeServiceError(adapterError, analyserError);
    expect(error).toEqual({ type: 'adapterError', cause: adapterError });
  });

  it('returns null when both service errors are absent', () => {
    expect(computeServiceError(null, null)).toBeNull();
  });
});

describe('heatmapsSurfaceState — computeHeatmapsSurfaceState (T-N3)', () => {
  it('derives a classNotFound blocking state when classFull is null and isSuccess is true', () => {
    const state = datasetState();
    const surface = computeHeatmapsSurfaceState(
      'class-1',
      null,
      true,
      false,
      null,
      false,
      state,
      null,
      null
    );
    expect(surface).toEqual({
      status: 'blocking',
      error: { type: 'classNotFound' },
    });
  });
});
