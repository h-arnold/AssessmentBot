/**
 * Registers the shared dependency mocks for the `useBackendSettings` hook specs.
 *
 * The hook reads and writes configuration through the backend configuration
 * service, maps payloads through the backend settings form mapper and announces
 * confirmed saves through the antd App message API. All three registrations are
 * identical across the load, save and failure-mapping suites.
 *
 * The mapper registration uses the `@/` alias so it resolves correctly from
 * this shared location. Specs import this module first, then recover the typed
 * handles from `backendSettings.mockHandles`.
 */

import type * as Antd from 'antd';
import { vi } from 'vitest';
import {
  getBackendConfigMock,
  mapBackendConfigToBackendSettingsFormValuesMock,
  mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
  messageSuccessMock,
  setBackendConfigMock,
} from './backendSettings.mockHandles';

vi.mock('@/services/backendConfiguration/backendConfigurationService', () => {
  return {
    getBackendConfig: getBackendConfigMock,
    setBackendConfig: setBackendConfigMock,
  };
});

vi.mock('@/features/settings/backend/backendSettingsFormMapper', () => {
  return {
    mapBackendConfigToBackendSettingsFormValues: mapBackendConfigToBackendSettingsFormValuesMock,
    mapBackendSettingsFormValuesToBackendConfigWriteInput:
      mapBackendSettingsFormValuesToBackendConfigWriteInputMock,
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
          },
          notification: {
            open: vi.fn(),
          },
        };
      },
    }),
  };
});
