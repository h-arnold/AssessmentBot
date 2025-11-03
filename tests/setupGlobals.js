// Global shims for GAS-like environment in unit tests.

// Ensure canonical BaseSingleton is loaded first so tests use the real implementation
// (prevents singleton fallbacks in individual files from being used).
require('../src/AdminSheet/00_BaseSingleton.js');

// Load Assignment classes so they're available globally for polymorphic factory pattern
global.Assignment = require('../src/AdminSheet/AssignmentProcessor/Assignment.js');
global.SlidesAssignment = require('../src/AdminSheet/AssignmentProcessor/SlidesAssignment.js');
global.SheetsAssignment = require('../src/AdminSheet/AssignmentProcessor/SheetsAssignment.js');

global.Utils = {
  generateHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16);
  },
};

global.Utilities = {
  base64Encode(bytes) {
    if (Array.isArray(bytes)) return Buffer.from(Uint8Array.from(bytes)).toString('base64');
    if (typeof bytes === 'string') return Buffer.from(bytes, 'utf8').toString('base64');
    return '';
  },
};

global.Logger = {
  log: (...a) => console.log('[LOG]', ...a),
};
// Use the shared ProgressTracker mock for tests
global.ProgressTracker = require('./mocks/ProgressTracker.js');

// Provide a minimal ABLogger stub for tests so production code can call it directly
global.ABLogger = {
  getInstance: () => ({
    debug: () => {},
    debugUi: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    log: () => {},
  }),
};

// Mock ScriptAppManager for tests
global.ScriptAppManager = class ScriptAppManager {
  constructor() {
    this.authInfo = null;
    this.scriptId = 'test-script-id';
  }
  getScriptId() {
    return this.scriptId;
  }
  checkAuthMode() {
    return 'NOT_REQUIRED';
  }
  getAuthorisationUrl() {
    return 'https://example.com/auth';
  }
  handleAuthFlow() {
    return { needsAuth: false, authUrl: null };
  }
  revokeAuthorisation() {
    return { success: true, message: 'Authorization successfully revoked' };
  }
  isAuthorised() {
    return true;
  }
};

global.Validate = require('../src/AdminSheet/Utils/Validate.js').Validate;

// Expose ArtifactFactory globally before TaskDefinition usage (TaskDefinition references global ArtifactFactory)
const { ArtifactFactory } = require('../src/AdminSheet/Models/Artifacts/index.js');
global.ArtifactFactory = ArtifactFactory;

// Load and expose ConfigurationManager validators as globals so modules that
// expect Apps Script-style globals won't redeclare them during runtime. This
// avoids duplicate declaration errors when the same functions are present in
// both tests and the GAS runtime. Tests should ensure these are present before
// requiring ConfigurationManager modules.
try {
  const validators = require('../src/AdminSheet/ConfigurationManager/validators.js');
  // Attach individual functions/values to the global scope (globalThis) so
  // source files can reference them without importing. Use the same names
  // exported by the validators module.
  globalThis.API_KEY_PATTERN = validators.API_KEY_PATTERN;
  globalThis.DRIVE_ID_PATTERN = validators.DRIVE_ID_PATTERN;
  globalThis.JSON_DB_LOG_LEVELS = validators.JSON_DB_LOG_LEVELS;
  globalThis.validateIntegerInRange = validators.validateIntegerInRange;
  globalThis.validateNonEmptyString = validators.validateNonEmptyString;
  globalThis.validateUrl = validators.validateUrl;
  globalThis.validateBoolean = validators.validateBoolean;
  globalThis.validateLogLevel = validators.validateLogLevel;
  globalThis.validateApiKey = validators.validateApiKey;
  globalThis.toBoolean = validators.toBoolean;
  globalThis.toBooleanString = validators.toBooleanString;
  globalThis.toReadableKey = validators.toReadableKey;
} catch (e) {
  // If validators can't be loaded for some reason, let tests fail later
  // with clearer messages. Do not swallow the error silently in logs.
  throw e;
}

// Lightweight ClassroomManager shim used by some modules. Tests often mock
// Classroom.Courses.Students.list directly, so prefer that when available.
global.ClassroomManager = {
  fetchAllStudents(courseId) {
    // If the Classroom API is mocked in tests, convert returned student
    // profiles into the shape expected by the rest of the code/tests
    // (Student instances or plain objects with name/email/id).
    if (
      typeof Classroom !== 'undefined' &&
      Classroom.Courses &&
      Classroom.Courses.Students &&
      typeof Classroom.Courses.Students.list === 'function'
    ) {
      const resp = Classroom.Courses.Students.list(courseId) || {};
      const list = Array.isArray(resp.students) ? resp.students : [];

      // Try to use the Student model when available so consumers get instances
      let StudentModel = null;
      try {
        const StudentExport = require('../src/AdminSheet/Models/Student.js');
        StudentModel = StudentExport.Student || StudentExport;
      } catch (e) {
        StudentModel = null;
      }

      return list.map((s) => {
        const profile = s?.profile ? s.profile : {};
        const name = profile?.name.fullName ? profile.name.fullName : null;
        const email = profile.emailAddress || null;
        const id = profile.id || null;

        if (StudentModel && typeof StudentModel === 'function')
          return new StudentModel(name, email, id);
        return { name, email, id };
      });
    }

    return [];
  },
};
