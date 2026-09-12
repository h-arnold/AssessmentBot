import { vi } from 'vitest';

/**
 * Creates the shared mock scaffold for specs that stub the `apiService`
 * transport boundary (`callApi` and `parseApiResponse`).
 *
 * `parseApiResponse` delegates to the supplied schema so valid responses pass
 * through unchanged and malformed payloads surface as `ZodError`, matching the
 * real transport validation contract.
 *
 * Call this inside `vi.hoisted` so the returned mocks can be referenced by a
 * hoisted `vi.mock('../apiService', ...)` factory:
 *
 * @example
 * ```typescript
 * const { callApiMock, parseApiResponseMock } = await vi.hoisted(async () => {
 *   const { createApiServiceMockScaffold } = await import(
 *     '../../test/api/apiServiceTestMocks'
 *   );
 *   return createApiServiceMockScaffold();
 * });
 *
 * vi.mock('../apiService', () => ({
 *   callApi: callApiMock,
 *   parseApiResponse: parseApiResponseMock,
 * }));
 * ```
 *
 * @returns {{ callApiMock: ReturnType<typeof vi.fn>; parseApiResponseMock: ReturnType<typeof vi.fn> }} The transport mock pair.
 */
export function createApiServiceMockScaffold() {
  const callApiMock = vi.fn();
  const parseApiResponseMock = vi.fn(
    (schema: { parse: (data: unknown) => unknown }, _method: string, data: unknown) =>
      schema.parse(data)
  );

  return { callApiMock, parseApiResponseMock };
}
