const { randomUUID } = require('node:crypto');

// Global shims for GAS-like environment in unit tests.

// Ensure canonical BaseSingleton is loaded first so tests use the real implementation
// (prevents singleton fallbacks in individual files from being used).
require('../src/backend/00_BaseSingleton.js');

// Load Assignment classes so they're available globally for polymorphic factory pattern
const g = globalThis;
const constants = require('../src/backend/00_Constants.js');
g.ALPHABET_LENGTH = constants.ALPHABET_LENGTH;
g.ITEM_NOT_FOUND_INDEX = constants.ITEM_NOT_FOUND_INDEX;
g.RuntimeConstants = require('../src/backend/00_RuntimeConstants.js').RuntimeConstants;
// Load Assignment sub-classes as globals BEFORE the facade (index.js) so that
// the facade's lazy getters can reference them at evaluation time. This mirrors
// GAS concatenation order where sub-class files load before the facade file.
g.AssignmentSerialisation = require('../src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js');
g.AssignmentFactory = require('../src/backend/AssignmentProcessor/Assignment/01_AssignmentFactory.js');
g.AssignmentRehydration = require('../src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');
g.AssignmentTimestamps = require('../src/backend/AssignmentProcessor/Assignment/03_AssignmentTimestamps.js');
g.AssignmentSubmissions = require('../src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js');
g.AssignmentAssessmentBase = require('../src/backend/AssignmentProcessor/Assignment/05_AssignmentAssessmentBase.js');
g.AssignmentLLMOrchestration = require('../src/backend/AssignmentProcessor/Assignment/06_AssignmentLLMOrchestration.js');
g.Assignment = require('../src/backend/AssignmentProcessor/Assignment/index.js');
g.SlidesAssignment = require('../src/backend/AssignmentProcessor/SlidesAssignment.js');
g.SheetsAssignment = require('../src/backend/AssignmentProcessor/SheetsAssignment.js');
const { StudentSubmission } = require('../src/backend/Models/StudentSubmission.js');
g.StudentSubmission = StudentSubmission;

g.Utils = {
  generateHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.trunc(Math.imul(31, h) + str.codePointAt(i));
    }
    return Math.abs(h).toString(16);
  },
};

g.Utilities = {
  getUuid: randomUUID,
  base64Encode(bytes) {
    if (Array.isArray(bytes)) return Buffer.from(Uint8Array.from(bytes)).toString('base64');
    if (typeof bytes === 'string') return Buffer.from(bytes, 'utf8').toString('base64');
    return '';
  },
};

g.Logger = {
  log: (...a) => console.log('[LOG]', ...a),
};

// In-memory backing store for the PropertiesService.getUserProperties() mock.
// Call PropertiesService._resetUserProperties() in beforeEach to isolate tests.
const _userPropertiesData = {};

g.PropertiesService = {
  _resetUserProperties() {
    for (const key of Object.keys(_userPropertiesData)) {
      delete _userPropertiesData[key];
    }
  },
  getUserProperties() {
    return {
      getProperty(key) {
        return Object.hasOwn(_userPropertiesData, key) ? _userPropertiesData[key] : null;
      },
      setProperty(key, value) {
        _userPropertiesData[key] = value;
      },
      deleteProperty(key) {
        delete _userPropertiesData[key];
      },
    };
  },
};
// Use the shared ProgressTracker mock for tests
g.ProgressTracker = require('./mocks/ProgressTracker.js');

// Provide a minimal ABLogger stub for tests so production code can call it directly
g.ABLogger = {
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
g.ScriptAppManager = class ScriptAppManager {
  authInfo = null;
  scriptId = 'test-script-id';

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

g.Validate = require('../src/backend/Utils/Validate.js').Validate;
g.ArrayUtils = require('../src/backend/Utils/00_ArrayUtils.js');

g.DateUtils = require('../src/backend/Utils/DateUtils.js');
g.GASPropertiesUtils = require('../src/backend/Utils/00_GASPropertiesUtils.js');

g.ApiValidationError = require('../src/backend/Utils/ErrorTypes/ApiValidationError.js');
g.DefinitionStaleError = require('../src/backend/Utils/ErrorTypes/DefinitionStaleError.js');
g.AssignmentNotFoundError = require('../src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js');
g.ClassNotFoundError = require('../src/backend/Utils/ErrorTypes/ClassNotFoundError.js');

// Expose ArtifactFactory globally before TaskDefinition usage (TaskDefinition references global ArtifactFactory)
const { ArtifactFactory } = require('../src/backend/Models/Artifacts/index.js');
g.ArtifactFactory = ArtifactFactory;

// Expose model classes expected as globals in production runtime
const { TaskDefinition } = require('../src/backend/Models/TaskDefinition.js');
g.TaskDefinition = TaskDefinition;
const { AssignmentDefinition } = require('../src/backend/Models/AssignmentDefinition.js');
g.AssignmentDefinition = AssignmentDefinition;
g.SpreadsheetFormulaEquivalence = require('../src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js');

// Load and expose ConfigurationManager validators as globals so modules that
// expect Apps Script-style globals won't redeclare them during runtime. This
// avoids duplicate declaration errors when the same functions are present in
// both tests and the GAS runtime. Tests should ensure these are present before
// requiring ConfigurationManager modules.
const validators = require('../src/backend/ConfigurationManager/03_validators.js');
// Attach individual functions/values to the global scope (globalThis) so
// source files can reference them without importing. Use the same names
// exported by the validators module.
g.API_KEY_PATTERN = validators.API_KEY_PATTERN;
g.DRIVE_ID_PATTERN = validators.DRIVE_ID_PATTERN;
g.JSON_DB_LOG_LEVELS = validators.JSON_DB_LOG_LEVELS;
g.validateLogLevel = validators.validateLogLevel;
g.validateApiKey = validators.validateApiKey;
g.validateClassInfo = validators.validateClassInfo;
g.toBoolean = validators.toBoolean;
g.toBooleanString = validators.toBooleanString;
g.toReadableKey = validators.toReadableKey;

// Default LockService mock — always acquires the lock successfully.
// Individual tests that need to control lock behaviour should override
// globalThis.LockService in their own beforeEach/afterEach.
g.LockService = {
  getUserLock() {
    return {
      tryLock: () => true,
      releaseLock: () => {},
    };
  },
};

// Default Session mock — supplies the active-user identity for auth checks.
// Follows the LockService convention: individual tests that need to control the
// active-user email should override globalThis.Session in their own
// beforeEach/afterEach, or switch the default email via Session._setActiveUserEmail().
const _activeUserEmail = { value: 'teacher@school.edu' };
g.Session = {
  _setActiveUserEmail(email) {
    _activeUserEmail.value = email;
  },
  _resetActiveUserEmail() {
    _activeUserEmail.value = 'teacher@school.edu';
  },
  getActiveUser() {
    return { getEmail: () => _activeUserEmail.value };
  },
};

// Default GroupsApp mock — resolves a configurable Google Group object exposing
// hasUser(email) and getRole(email). Members are keyed by role; the default set
// is benign (a member allowed with role MEMBER). Tests may (re)configure the
// membership map via GroupsApp._setMembers(groupEmail, members) or override
// globalThis.GroupsApp outright; GroupsApp._resetGroups() restores the default.
const _groupMemberRoles = {};
function _registerGroup(groupEmail, membersByRole) {
  _groupMemberRoles[groupEmail] = new Map(Object.entries(membersByRole));
}
_registerGroup('teachers@school.edu', {
  'teacher@school.edu': 'MEMBER',
  'admin@school.edu': 'OWNER',
  'manager@school.edu': 'MANAGER',
});
g.GroupsApp = {
  _resetGroups() {
    for (const key of Object.keys(_groupMemberRoles)) {
      delete _groupMemberRoles[key];
    }
    _registerGroup('teachers@school.edu', {
      'teacher@school.edu': 'MEMBER',
      'admin@school.edu': 'OWNER',
      'manager@school.edu': 'MANAGER',
    });
  },
  _setMembers(groupEmail, membersByRole) {
    _registerGroup(groupEmail, membersByRole);
  },
  getGroupByEmail(groupEmail) {
    const members = _groupMemberRoles[groupEmail];
    if (!members) {
      // A configured group that has not been registered surfaces as a lookup error,
      // mirroring the "group not found" denial path the AuthService handles.
      throw new Error(`Group not found: ${groupEmail}`);
    }
    return {
      hasUser(email) {
        return members.has(email);
      },
      getRole(email) {
        return members.get(email) ?? null;
      },
    };
  },
};

// In-memory CacheService mock backed by a real get/put/remove ScriptCache so
// CacheManager round-trips (and consequent AuthService cache reads/writes) can
// be exercised without a per-test mock. TTLs are accepted but are only recorded
// against the inner cache; individual tests may wrap the cache to assert TTLs.
// Tests should reset it via CacheService._resetScriptCache() in beforeEach.
const _scriptCacheStore = {};
const _scriptCache = {
  get(key) {
    return Object.hasOwn(_scriptCacheStore, key) ? _scriptCacheStore[key] : null;
  },
  put(key, value, ttlSeconds) {
    _scriptCacheStore[key] = value;
  },
  remove(key) {
    delete _scriptCacheStore[key];
  },
};
g.CacheService = {
  _resetScriptCache() {
    for (const key of Object.keys(_scriptCacheStore)) {
      delete _scriptCacheStore[key];
    }
  },
  getScriptCache() {
    return _scriptCache;
  },
};

// Register the real CacheManager class as a global so production code can call
// `new CacheManager()` in Node (mirroring the GAS concatenated environment,
// where CacheManager resolves as a global). Individual tests that need a dummy
// cache manager override globalThis.CacheManager in their own beforeEach.
g.CacheManager = require('../src/backend/RequestHandlers/CacheManager.js').CacheManager;

// Register the real AuthService singleton as a global (mirrors the GAS concatenated
// environment, where AuthService resolves as a global). The ApiDispatcher auth gate
// (`z_apiHandler.js`) calls AuthService.getInstance().checkAccess() before dispatch.
g.AuthService = require('../src/backend/Utils/AuthService.js');

// Default ConfigurationManager global used by the auth gate's fail-open bootstrap.
// Any test focused on auth overrides globalThis.ConfigurationManager with a
// getAuthGroupEmail mock (mirroring dispatcher-auth-gate.test.js). The default
// returns '' so the gate fails open and non-auth dispatcher tests proceed normally.
g.ConfigurationManager = {
  getInstance() {
    return { getAuthGroupEmail: () => '' };
  },
};

// Lightweight ClassroomManager shim used by some modules. Tests often mock
// Classroom.Courses.Students.list directly, so prefer that when available.
g.ClassroomManager = {
  fetchAllStudents(courseId) {
    // If the Classroom API is mocked in tests, convert returned student
    // profiles into the shape expected by the rest of the code/tests
    // (Student instances or plain objects with name/email/id).
    if (
      typeof Classroom !== 'undefined' &&
      typeof Classroom?.Courses?.Students?.list === 'function'
    ) {
      const resp = Classroom.Courses.Students.list(courseId) || {};
      const list = Array.isArray(resp.students) ? resp.students : [];

      // Try to use the Student model when available so consumers get instances
      const StudentExport = require('../src/backend/Models/Student.js');
      const StudentModel = StudentExport.Student || StudentExport;

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

// Expose abclass validation shared helpers for test access
// Load validation module first (same order as GAS concatenation)
Object.assign(g, require('../src/backend/z_Api/abclass/abclassValidation.js'));

// Expose assignment-definition modules for test access
// Load validation module first (same order as GAS concatenation), then transport module
Object.assign(g, require('../src/backend/z_Api/assignmentDefinitionValidation.js'));
Object.assign(g, require('../src/backend/z_Api/assignmentDefinitionTransport.js'));

// Load AssignmentDefinition sub-classes as globals (mirroring GAS concatenation order so
// index.js can reference them by name when require() calls are absent in production).
g.AssignmentDefinitionValidation = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js');
g.AssignmentDefinitionReferenceData = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionReferenceData.js');
g.AssignmentDefinitionTaskParser = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskParser.js');
g.AssignmentDefinitionTaskWeighting = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskWeighting.js');
g.AssignmentDefinitionPersistence = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js');
g.AssignmentDefinitionUpsertOrchestrator = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js');
g.AssignmentDefinitionResponseMapper = require('../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionResponseMapper.js');

// Load ABClassController sub-classes as globals (mirroring GAS concatenation order so
// index.js can reference them by name when require() calls are absent in production).
g.ABClassValidation = require('../src/backend/y_controllers/ABClassController/ABClassValidation.js');
g.ABClassPersistence = require('../src/backend/y_controllers/ABClassController/ABClassPersistence.js');
g.ABClassRoster = require('../src/backend/y_controllers/ABClassController/ABClassRoster.js');
g.ABClassAssignmentOps = require('../src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js');
g.ABClassResponseMapper = require('../src/backend/y_controllers/ABClassController/ABClassResponseMapper.js');
