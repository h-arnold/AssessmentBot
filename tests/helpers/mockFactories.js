/**
 * Factory functions for creating GAS (Google Apps Script) mock objects
 * Reduces duplication of mock setup code across tests
 */

const { simpleHash } = require('./testUtils.js');

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
    generateHash: vi.fn(simpleHash),
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
 * Create a mock ClassroomApiClient for testing
 * This mock wraps the global.Classroom API and converts responses to model instances.
 * Requires Teacher and Student constructors to be available globally.
 * @returns {Object} Mock ClassroomApiClient class with static methods
 */
function createMockClassroomApiClient() {
  return class MockClassroomApiClient {
    static fetchCourse(courseId) {
      if (!global.Classroom) return null;
      return global.Classroom.Courses.get(courseId);
    }

    static fetchTeachers(courseId) {
      if (!global.Classroom?.Courses?.Teachers) return [];
      const resp = global.Classroom.Courses.Teachers.list(courseId) || {};
      const raw = resp.teachers || [];
      return raw.map((t) => {
        const name = t?.profile?.name?.fullName || null;
        const email = t?.profile?.emailAddress || null;
        const userId = t?.profile?.id || null;
        return new global.Teacher(email, userId, name);
      });
    }

    static fetchAllStudents(courseId) {
      if (!global.Classroom?.Courses?.Students) return [];
      const resp = global.Classroom.Courses.Students.list(courseId) || {};
      const raw = resp.students || [];
      return raw.map((s) => {
        const name = s?.profile?.name?.fullName || null;
        const email = s?.profile?.emailAddress || null;
        const id = s?.profile?.id || null;
        return new global.Student(name, email, id);
      });
    }
  };
}

/**
 * Create a mock ABLogger for testing
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock ABLogger instance with spies for all methods
 */
function createMockABLogger(vi) {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debugUi: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Create a mock DbManager for controller tests
 * @param {Object} vi - Vitest vi object for creating mocks
 * @param {Object} mockCollection - Mock collection to return
 * @returns {Object} Mock DbManager instance
 */
function createMockDbManager(vi, mockCollection) {
  return {
    getInstance: vi.fn().mockReturnThis(),
    getCollection: vi.fn().mockReturnValue(mockCollection),
  };
}

/**
 * Create a mock collection for database operations
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} Mock collection with common database methods
 */
function createMockCollection(vi) {
  return {
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue([]),
    insertOne: vi.fn(),
    replaceOne: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    save: vi.fn(),
    getMetadata: vi.fn().mockReturnValue({}),
  };
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

/**
 * Setup mocks for controller tests (ABClassController, AssignmentController, etc.)
 * @param {Object} vi - Vitest vi object for creating mocks
 * @returns {Object} { mockDbManager, mockCollection, mockABLogger }
 */
function setupControllerTestMocks(vi) {
  const mockCollection = createMockCollection(vi);
  const mockDbManager = createMockDbManager(vi, mockCollection);
  const mockABLogger = createMockABLogger(vi);

  // Mock DbManager singleton
  const DbManagerClass = function () {};
  DbManagerClass.getInstance = vi.fn().mockReturnValue(mockDbManager);
  global.DbManager = DbManagerClass;

  // Mock ABLogger singleton
  const ABLoggerClass = function () {};
  ABLoggerClass.getInstance = vi.fn().mockReturnValue(mockABLogger);
  global.ABLogger = ABLoggerClass;

  // Mock ProgressTracker for Assignment base class
  const mockProgressTracker = {
    getInstance: vi.fn().mockReturnThis(),
    updateProgress: vi.fn(),
    logError: vi.fn(),
    logAndThrowError: vi.fn((msg, context) => {
      throw new Error(msg);
    }),
  };
  const ProgressTrackerClass = function () {};
  ProgressTrackerClass.getInstance = vi.fn().mockReturnValue(mockProgressTracker);
  global.ProgressTracker = ProgressTrackerClass;

  // Mock ConfigurationManager for ABClass constructor
  const mockConfigManager = {
    getInstance: vi.fn().mockReturnThis(),
    getAssessmentRecordCourseId: vi.fn().mockReturnValue('test-course-123'),
  };
  const ConfigManagerClass = function () {};
  ConfigManagerClass.getInstance = vi.fn().mockReturnValue(mockConfigManager);
  global.ConfigurationManager = ConfigManagerClass;

  return {
    mockDbManager,
    mockCollection,
    mockABLogger,
    mockProgressTracker,
    mockConfigManager,
  };
}

/**
 * Cleanup controller test mocks from global scope
 */
function cleanupControllerTestMocks() {
  delete global.DbManager;
  delete global.ABLogger;
  delete global.ProgressTracker;
  delete global.ConfigurationManager;
}

module.exports = {
  createMockPropertiesService,
  createMockUtils,
  createMockDriveApp,
  createMockSpreadsheetApp,
  createMockMimeType,
  createMockDriveManager,
  createMockPropertiesCloner,
  createMockClassroomApiClient,
  createMockABLogger,
  createMockDbManager,
  createMockCollection,
  setupGlobalGASMocks,
  setupControllerTestMocks,
  cleanupControllerTestMocks,
};
