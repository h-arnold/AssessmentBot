/**
 * Registers the shared post-analysis hook mock for consumer hook specs.
 *
 * @remarks
 * Consumer hook specs isolate feature binding by spying on the real shared
 * extension point through `vi.mocked(usePostAnalysisTasks)`. The mock returns a
 * valid empty state so consumer hooks that ignore the hook result keep working
 * after `vi.resetAllMocks()` clears the spy's implementation.
 *
 * This registration-only module is imported before the production consumer so
 * the future production `usePostAnalysisTasks` effect cannot add real hook APIs
 * (query invalidation, notifications) to older suites. It does not hide the
 * consumer binding: the spy records every call and the integration suites
 * assert the exact context and task registry passed through.
 */
import { vi } from 'vitest';

vi.mock('@/hooks/usePostAnalysisTasks', () => {
  return {
    usePostAnalysisTasks: vi.fn(() => ({ outcomes: [] })),
  };
});
