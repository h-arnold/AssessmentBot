/**
 * Registers shared auth-gate dependency mocks for auth-gate specs.
 * The shared-query mock spreads the real module so unrelated query keys and
 * helpers remain available while startup warm-up is replaced with a test double.
 */
import { vi } from 'vitest';

vi.mock('../../services/authService/authService', () => {
  return {
    hasScriptAuthorisation: vi.fn(),
    getApplicationAccess: vi.fn(),
  };
});

vi.mock('../../query/sharedQueries', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, warmStartupQueries: vi.fn() };
});
