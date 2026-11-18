/**
 * Pins the `isError` flag on the `createMockQueryResult` fixture.
 *
 * The builder computed an `isError` flag from its overrides but did not expose
 * it on the returned `UseQueryResult`, so consumers reading `result.isError`
 * saw `undefined` (the object is cast through `as unknown as UseQueryResult`,
 * which stopped TypeScript catching the omission). These pins keep the exposed
 * flag consistent with `status`, matching React Query's own derivation
 * (`isError = status === 'error'`).
 */

import { describe, expect, it } from 'vitest';
import { createMockQueryResult } from './heatmapsPageDataFixtures';

describe('createMockQueryResult isError', () => {
  it('exposes isError true when the override requests an error', () => {
    const result = createMockQueryResult<unknown>({ isError: true });

    expect(result.isError).toBe(true);
    expect(result.status).toBe('error');
  });

  it('exposes isError false by default and when the override requests success', () => {
    expect(createMockQueryResult<unknown>({}).isError).toBe(false);
    expect(createMockQueryResult<unknown>({ isError: false }).isError).toBe(false);
  });
});
