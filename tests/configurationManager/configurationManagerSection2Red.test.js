import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

describe('ConfigurationManager Section 2 red contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGlobalGASMocks(vi, { mockConsole: true });
    ConfigurationManager.resetForTests();
  });

  it('does not expose legacy isAdminSheet accessors on the public API surface', () => {
    expect(ConfigurationManager.prototype.getIsAdminSheet).toBeUndefined();
    expect(ConfigurationManager.prototype.setIsAdminSheet).toBeUndefined();

    const configManager = new ConfigurationManager(true);

    expect(configManager.getIsAdminSheet).toBeUndefined();
    expect(configManager.setIsAdminSheet).toBeUndefined();
  });
});
