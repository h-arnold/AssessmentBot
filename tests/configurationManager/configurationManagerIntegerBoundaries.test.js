import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createConfiguredConfigurationManager,
  installStoredConfig,
} from '../helpers/backendConfigTestHelpers.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager integer boundaries', () => {
  let mocks;
  let configManager;

  beforeEach(() => {
    ({ mocks, configManager } = createConfiguredConfigurationManager(vi, ConfigurationManager));
  });

  it('preserves prefix parsing and uses defaults for unsafe or out-of-range stored values', () => {
    const key = ConfigurationManager.CONFIG_KEYS.BACKEND_ASSESSOR_BATCH_SIZE;
    const readStoredValue = (value, read) => {
      installStoredConfig(mocks.PropertiesService.scriptProperties, ConfigurationManager, {
        [key]: value,
      });
      configManager.configCache = null;
      return read();
    };

    expect(readStoredValue('1e21', () => configManager.getBackendAssessorBatchSize())).toBe(1);
    expect(
      readStoredValue(String(Number.MAX_SAFE_INTEGER + 1), () =>
        configManager.getBackendAssessorBatchSize()
      )
    ).toBe(ConfigurationManager.DEFAULTS.BACKEND_ASSESSOR_BATCH_SIZE);
    expect(
      readStoredValue('500', () => configManager.getIntConfig(key, 17, { min: 1, max: 500 }))
    ).toBe(500);
    expect(
      readStoredValue('501', () => configManager.getIntConfig(key, 17, { min: 1, max: 500 }))
    ).toBe(17);
  });
});
