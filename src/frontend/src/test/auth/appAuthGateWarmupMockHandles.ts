/**
 * Holds the hoisted doubles registered by `appAuthGateWarmup.mockSetup`.
 *
 * @remarks
 * The specs keep the original untyped `vi.fn()` signatures so loosely shaped
 * service responses remain valid fixtures. The setup module publishes every
 * hoisted factory here and each spec binds them through the read helper, so
 * this module has no registration side effects.
 */

import type { Mock } from 'vitest';

/** The hoisted doubles published by `appAuthGateWarmup.mockSetup`. */
export type AppAuthGateWarmupMockHandles = {
  getAuthorisationStatusMock: Mock;
  getApplicationAccessMock: Mock;
  warmStartupQueriesMock: Mock;
  getABClassPartialsMock: Mock;
  getAssignmentDefinitionPartialsMock: Mock;
  callApiMock: Mock;
  getCohortsMock: Mock;
  getAssignmentTopicsMock: Mock;
  getYearGroupsMock: Mock;
};

/** Registration-time slot filled by `appAuthGateWarmup.mockSetup`. */
export const appAuthGateWarmupMockHandles: { current: AppAuthGateWarmupMockHandles | undefined } = {
  current: undefined,
};

/**
 * Reads the hoisted doubles published by `appAuthGateWarmup.mockSetup`.
 *
 * @returns {AppAuthGateWarmupMockHandles} The registered doubles.
 */
export function getAppAuthGateWarmupMocks(): AppAuthGateWarmupMockHandles {
  const handles = appAuthGateWarmupMockHandles.current;
  if (handles == null) {
    throw new Error(
      'getAppAuthGateWarmupMocks: import appAuthGateWarmup.mockSetup before this module.'
    );
  }
  return handles;
}
