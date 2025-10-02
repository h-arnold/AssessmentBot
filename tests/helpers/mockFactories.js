/**
 * Factory functions for creating GAS (Google Apps Script) mock objects
 * Reduces duplication of mock setup code across tests
 */

/**
 * Create a mock PropertiesService with vitest spies
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock PropertiesService with script and document properties
 */
function createMockPropertiesService(vi) {
  const mockScriptProperties = {
    setProperty: vi.fn(),
    getProperty: vi.fn(),
    getProperties: vi.fn().mockReturnValue({}),
    getKeys: vi.fn().mockReturnValue([]),
    setProperties: vi.fn(),
    deleteProperty: vi.fn(),
  };

  const mockDocumentProperties = {
    setProperty: vi.fn(),
    getProperty: vi.fn(),
    getKeys: vi.fn().mockReturnValue([]),
    getProperties: vi.fn().mockReturnValue({}),
    deleteProperty: vi.fn(),
  };

  return {
    getScriptProperties: vi.fn().mockReturnValue(mockScriptProperties),
    getDocumentProperties: vi.fn().mockReturnValue(mockDocumentProperties),
    scriptProperties: mockScriptProperties,
    documentProperties: mockDocumentProperties,
  };
}

/**
 * Create a mock Utils object
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock Utils
 */
function createMockUtils(vi) {
  return {
    isValidUrl: vi.fn(),
    validateIsAdminSheet: vi.fn(),
    generateHash: vi.fn((str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      }
      return Math.abs(h).toString(16);
    }),
    normaliseKeysToLowerCase: vi.fn((obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      Object.keys(obj).forEach((k) => {
        out[k.toLowerCase()] = obj[k];
      });
      return out;
    }),
    toastMessage: vi.fn(),
  };
}

/**
 * Create a mock DriveApp
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock DriveApp
 */
function createMockDriveApp(vi) {
  return {
    getFileById: vi.fn(),
    getFolderById: vi.fn(),
    createFolder: vi.fn(),
    getRootFolder: vi.fn(),
  };
}

/**
 * Create a mock SpreadsheetApp
 * @param {Object} vi - Vitest vi object for creating mocks
 * @param {Object} options - Configuration options
 * @returns {Object} Mock SpreadsheetApp
 */
function createMockSpreadsheetApp(vi, options = {}) {
  const { spreadsheetId = 'test-spreadsheet-id' } = options;

  return {
    getActiveSpreadsheet: vi.fn().mockReturnValue({
      getId: vi.fn().mockReturnValue(spreadsheetId),
      getSheets: vi.fn().mockReturnValue([]),
      getSheetByName: vi.fn(),
    }),
    getUi: vi.fn().mockReturnValue({
      createMenu: vi.fn().mockReturnThis(),
      addItem: vi.fn().mockReturnThis(),
      addToUi: vi.fn(),
      alert: vi.fn(),
      showSidebar: vi.fn(),
    }),
  };
}

/**
 * Create a mock MimeType object
 * @returns {Object} Mock MimeType constants
 */
function createMockMimeType() {
  return {
    GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
    GOOGLE_SLIDES: 'application/vnd.google-apps.slides',
    GOOGLE_DOCS: 'application/vnd.google-apps.document',
    GOOGLE_FORMS: 'application/vnd.google-apps.form',
  };
}

/**
 * Create a mock DriveManager
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock DriveManager
 */
function createMockDriveManager(vi) {
  return {
    getParentFolderId: vi.fn(),
    createFolder: vi.fn(),
    moveFile: vi.fn(),
  };
}

/**
 * Create a mock PropertiesCloner
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Function} Mock PropertiesCloner constructor
 */
function createMockPropertiesCloner(vi) {
  return vi.fn().mockImplementation(() => ({
    sheet: null,
    deserialiseProperties: vi.fn(),
    serialiseProperties: vi.fn(),
  }));
}

/**
 * Setup all common GAS mocks on the global object
 * @param {Object} vi - Vitest vi object for creating mocks
 * @param {Object} options - Configuration options
 * @returns {Object} All created mocks for reference
 */
function setupGlobalGASMocks(vi, options = {}) {
  const mocks = {
    PropertiesService: createMockPropertiesService(vi),
    Utils: createMockUtils(vi),
    DriveApp: createMockDriveApp(vi),
    SpreadsheetApp: createMockSpreadsheetApp(vi, options),
    MimeType: createMockMimeType(),
    DriveManager: createMockDriveManager(vi),
    PropertiesCloner: createMockPropertiesCloner(vi),
    console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };

  // Set on global
  global.PropertiesService = mocks.PropertiesService;
  global.Utils = mocks.Utils;
  global.DriveApp = mocks.DriveApp;
  global.SpreadsheetApp = mocks.SpreadsheetApp;
  global.MimeType = mocks.MimeType;
  global.DriveManager = mocks.DriveManager;
  global.PropertiesCloner = mocks.PropertiesCloner;
  if (options.mockConsole) {
    global.console = mocks.console;
  }

  return mocks;
}

module.exports = {
  createMockPropertiesService,
  createMockUtils,
  createMockDriveApp,
  createMockSpreadsheetApp,
  createMockMimeType,
  createMockDriveManager,
  createMockPropertiesCloner,
  setupGlobalGASMocks,
};
