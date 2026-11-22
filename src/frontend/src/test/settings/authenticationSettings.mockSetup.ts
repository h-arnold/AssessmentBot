/**
 * Registers the shared dependency mocks for the Authentication settings tab specs.
 *
 * The tab reads and writes settings through the auth service and announces saves
 * through the antd App message API. Both registrations are identical across the
 * mode, staged-user, save and load-failure suites; keep them here so registration
 * precedes component instantiation in every spec.
 *
 * Specs import this module first, then recover the typed handles from
 * `authenticationSettings.mockHandles` to seed and reset their own doubles.
 */

import type * as Antd from 'antd';
import { vi } from 'vitest';
import {
  getAuthenticationSettingsMock,
  messageErrorMock,
  messageSuccessMock,
  setAuthenticationSettingsMock,
} from './authenticationSettings.mockHandles';

vi.mock('@/services/authService/authService', () => {
  return {
    getAuthenticationSettings: getAuthenticationSettingsMock,
    setAuthenticationSettings: setAuthenticationSettingsMock,
  };
});

vi.mock('antd', async () => {
  const actual = (await vi.importActual('antd')) as typeof Antd;

  return {
    ...actual,
    App: Object.assign(actual.App, {
      useApp: () => {
        return {
          message: {
            success: messageSuccessMock,
            error: messageErrorMock,
          },
          notification: {
            open: vi.fn(),
          },
        };
      },
    }),
  };
});
