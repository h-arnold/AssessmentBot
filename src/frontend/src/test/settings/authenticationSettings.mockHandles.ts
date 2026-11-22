/**
 * Typed doubles registered by `authenticationSettings.mockSetup`.
 *
 * This module has no registration side effects: the setup module imports these
 * handles and publishes them through the service and antd mocks before any
 * mocked module is instantiated. Specs import the setup module first, then read
 * the same handles from here to seed implementations and reset them per test.
 */

import { vi } from 'vitest';
import type {
  getAuthenticationSettings,
  setAuthenticationSettings,
} from '@/services/authService/authService';

/** Returns the settings the mocked authentication-settings read resolves with. */
export const getAuthenticationSettingsMock = vi.fn<typeof getAuthenticationSettings>();

/** Records and controls the mocked authentication-settings write. */
export const setAuthenticationSettingsMock = vi.fn<typeof setAuthenticationSettings>();

/** Receives successful-save announcements from the mocked antd App instance. */
export const messageSuccessMock = vi.fn<(content: string) => void>();

/** Receives failure announcements from the mocked antd App instance. */
export const messageErrorMock = vi.fn<(content: string) => void>();
