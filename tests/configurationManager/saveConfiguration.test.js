import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reuse existing setup pattern for GAS shims
const mockScriptProperties = {
  setProperty: vi.fn(),
  getProperty: vi.fn(),
  getProperties: vi.fn().mockReturnValue({}),
  getKeys: vi.fn().mockReturnValue([]),
};

const mockDocumentProperties = {
  setProperty: vi.fn(),
  getProperty: vi.fn(),
  getKeys: vi.fn().mockReturnValue([]),
};

const mockPropertiesService = {
  getScriptProperties: vi.fn().mockReturnValue(mockScriptProperties),
  getDocumentProperties: vi.fn().mockReturnValue(mockDocumentProperties),
};

const mockUtils = {
  isValidUrl: vi.fn(),
  validateIsAdminSheet: vi.fn(),
};

// minimal globals used by globals.js
global.PropertiesService = mockPropertiesService;
global.Utils = mockUtils;

global.console = { log: vi.fn(), error: vi.fn() };

// Import the globals module under test
// Import the globals module under test (exports exist only in Node test env)
import { saveConfiguration } from '../../src/AdminSheet/ConfigurationManager/globals.js';

describe('saveConfiguration global behaviour', () => {
  let configurationManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a fake configurationManager and attach it to the global scope used by globals.js
    configurationManager = {
      setApiKey: vi.fn(),
      setBackendAssessorBatchSize: vi.fn(),
      setSlidesFetchBatchSize: vi.fn(),
      setBackendUrl: vi.fn(),
      setAssessmentRecordTemplateId: vi.fn(),
      setAssessmentRecordDestinationFolder: vi.fn(),
      setUpdateDetailsUrl: vi.fn(),
      setDaysUntilAuthRevoke: vi.fn(),
    };

    global.configurationManager = configurationManager;
  });

  it('does not call setApiKey when apiKey is absent from payload', () => {
    const result = saveConfiguration({});
    expect(configurationManager.setApiKey).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('does not call setApiKey when apiKey is explicitly undefined', () => {
    const payload = { apiKey: undefined };
    const result = saveConfiguration(payload);
    expect(configurationManager.setApiKey).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('calls setApiKey with empty string when apiKey is explicitly empty string (explicit clear)', () => {
    const payload = { apiKey: '' };
    const result = saveConfiguration(payload);
    expect(configurationManager.setApiKey).toHaveBeenCalledWith('');
    expect(result.success).toBe(true);
  });

  it('calls setApiKey when apiKey is provided', () => {
    const payload = { apiKey: 'new-key-123' };
    const result = saveConfiguration(payload);
    expect(configurationManager.setApiKey).toHaveBeenCalledWith('new-key-123');
    expect(result.success).toBe(true);
  });
});
