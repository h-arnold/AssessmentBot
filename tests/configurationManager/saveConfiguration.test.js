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
// Ensure ConfigurationManager class is loaded and exposed globally (Apps Script style)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ConfigurationManagerClass = require('../../src/AdminSheet/ConfigurationManager/ConfigurationManagerClass.js');
// Some bundlers put class on default
// eslint-disable-next-line no-undef
global.ConfigurationManager = ConfigurationManagerClass.default || ConfigurationManagerClass;

describe('saveConfiguration global behaviour', () => {
  let cfg;

  beforeEach(() => {
    vi.clearAllMocks();

    // Obtain real singleton and spy on its prototype methods (lightweight; constructor has no heavy work)
    // Access via global class (Apps Script style)
    // eslint-disable-next-line no-undef
    cfg = ConfigurationManager.getInstance();
    vi.spyOn(cfg, 'setApiKey').mockImplementation(() => {});
    vi.spyOn(cfg, 'setBackendAssessorBatchSize').mockImplementation(() => {});
    vi.spyOn(cfg, 'setSlidesFetchBatchSize').mockImplementation(() => {});
    vi.spyOn(cfg, 'setBackendUrl').mockImplementation(() => {});
    vi.spyOn(cfg, 'setAssessmentRecordTemplateId').mockImplementation(() => {});
    vi.spyOn(cfg, 'setAssessmentRecordDestinationFolder').mockImplementation(() => {});
    vi.spyOn(cfg, 'setUpdateDetailsUrl').mockImplementation(() => {});
    vi.spyOn(cfg, 'setDaysUntilAuthRevoke').mockImplementation(() => {});
  });

  it('does not call setApiKey when apiKey is absent from payload', () => {
    const result = saveConfiguration({});
    expect(cfg.setApiKey).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('does not call setApiKey when apiKey is explicitly undefined', () => {
    const payload = { apiKey: undefined };
    const result = saveConfiguration(payload);
    expect(cfg.setApiKey).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('calls setApiKey with empty string when apiKey is explicitly empty string (explicit clear)', () => {
    const payload = { apiKey: '' };
    const result = saveConfiguration(payload);
    expect(cfg.setApiKey).toHaveBeenCalledWith('');
    expect(result.success).toBe(true);
  });

  it('calls setApiKey when apiKey is provided', () => {
    const payload = { apiKey: 'new-key-123' };
    const result = saveConfiguration(payload);
    expect(cfg.setApiKey).toHaveBeenCalledWith('new-key-123');
    expect(result.success).toBe(true);
  });
});
