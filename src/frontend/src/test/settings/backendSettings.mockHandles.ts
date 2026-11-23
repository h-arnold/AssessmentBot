/**
 * Typed doubles registered by `backendSettings.mockSetup`.
 *
 * This module has no registration side effects: the setup module imports these
 * handles and publishes them through the service, mapper and antd mocks before
 * the hook is dynamically imported. Specs import the setup module first, then
 * read the same handles here to seed implementations and reset them per test.
 */

import { vi } from 'vitest';
import type {
  mapBackendConfigToBackendSettingsFormValues,
  mapBackendSettingsFormValuesToBackendConfigWriteInput,
} from '@/features/settings/backend/backendSettingsFormMapper';
import type {
  getBackendConfig,
  setBackendConfig,
} from '@/services/backendConfiguration/backendConfigurationService';

/** Returns the backend config the mocked read resolves with. */
export const getBackendConfigMock = vi.fn<typeof getBackendConfig>();

/** Records and controls the mocked backend-config write. */
export const setBackendConfigMock = vi.fn<typeof setBackendConfig>();

/** Maps a loaded backend config into editable form values in the mocked mapper. */
export const mapBackendConfigToBackendSettingsFormValuesMock =
  vi.fn<typeof mapBackendConfigToBackendSettingsFormValues>();

/** Maps submitted form values into a write payload in the mocked mapper. */
export const mapBackendSettingsFormValuesToBackendConfigWriteInputMock =
  vi.fn<typeof mapBackendSettingsFormValuesToBackendConfigWriteInput>();

/** Receives successful-save announcements from the mocked antd App instance. */
export const messageSuccessMock = vi.fn<(content: string) => void>();
