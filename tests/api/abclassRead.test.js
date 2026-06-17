/**
 * ABClass Read API Handler Tests
 *
 * Tests for the getABClass_ transport-boundary handler contract in
 * z_Api/abclass/abclassRead.js. Validates parameter shape, unsafe-character
 * rejection, controller delegation, not-found handling, logger integration,
 * and error paths.
 *
 * Transport-boundary validation:
 * - Validates parameters is a plain object (via validateParametersObject_)
 * - Validates required string field (classId) via validateSafeTrimmedIdentifier_
 * - Rejects unsafe characters in identifiers (path traversal + control chars)
 * - Delegates to ABClassController.readClass
 * - Returns null on ClassNotFoundError
 * - Propagates non-not-found errors
 * - Does not call DateUtils.normaliseDateFields (no Date fields in the response root)
 * - Logs info on success, warn on not-found, error on other failures
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../src/backend/z_Api/abclass/abclassRead.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
const ClassNotFoundError = require('../../src/backend/Utils/ErrorTypes/ClassNotFoundError.js');

/**
 * Attempts to load the abclassRead transport module.
 * In RED phase the module file does not exist yet, so require will throw
 * MODULE_NOT_FOUND and all dependent tests will fail — this is expected.
 *
 * @returns {Object} Module exports.
 */
function loadModule() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

/**
 * Installs the ABClassController global mock with a readClass spy for
 * controller delegation tests.
 *
 * @returns {{ readClass: import('vitest').Mock }}
 */
function installABClassControllerStub() {
  const readClass = vi.fn();
  const ABClassController = vi.fn(function StubABClassController() {
    this.readClass = readClass;
  });
  globalThis.ABClassController = ABClassController;
  return { readClass };
}

/**
 * Builds a representative controller response payload for test assertions.
 *
 * @param {Object} [overrides] - Optional field overrides.
 * @returns {Object} Representative payload.
 */
function buildControllerResult(overrides = {}) {
  return {
    classId: 'class-001',
    className: '10A Computer Science',
    cohortKey: 'coh-2026',
    courseLength: 2,
    yearGroupKey: 'yg-10',
    classOwner: {
      email: 'owner@example.com',
      userId: 'owner-001',
      teacherName: 'Owner One',
    },
    teachers: [
      {
        email: 'teacher.one@example.com',
        userId: 'teacher-001',
        teacherName: 'Teacher One',
      },
    ],
    active: true,
    ...overrides,
  };
}

describe('Api/getABClass transport contract', () => {
  let originalABClassController;
  let originalABLogger;
  let originalDateUtils;

  beforeEach(() => {
    originalABClassController = globalThis.ABClassController;
    originalABLogger = globalThis.ABLogger;
    originalDateUtils = globalThis.DateUtils;
    globalThis.DateUtils = { normaliseDateFields: vi.fn() };
  });

  afterEach(() => {
    try {
      delete require.cache[require.resolve(MODULE_PATH)];
    } catch (_) {
      // Module may not exist yet in RED phase; safe to ignore.
    }

    if (originalABClassController === undefined) {
      delete globalThis.ABClassController;
    } else {
      globalThis.ABClassController = originalABClassController;
    }

    if (originalABLogger === undefined) {
      delete globalThis.ABLogger;
    } else {
      globalThis.ABLogger = originalABLogger;
    }

    if (originalDateUtils === undefined) {
      delete globalThis.DateUtils;
    } else {
      globalThis.DateUtils = originalDateUtils;
    }

    vi.restoreAllMocks();
  });

  // ── Tests 1-2: Module exports (RED fails, GREEN passes) ─────────────────

  it('exports getABClass_ in Node test runtime', () => {
    installABClassControllerStub();
    const module = loadModule();
    expect(module).toEqual(
      expect.objectContaining({
        getABClass_: expect.any(Function),
      })
    );
  });

  // ── Test 3: Parameter shape validation ──────────────────────────────────

  it('throws ApiValidationError when parameters is not a plain object', () => {
    installABClassControllerStub();
    const { getABClass_ } = loadModule();

    expect(() => getABClass_('not-an-object')).toThrow(ApiValidationError);
    expect(() => getABClass_(null)).toThrow(ApiValidationError);
    expect(() => getABClass_(undefined)).toThrow(ApiValidationError);
    expect(() => getABClass_([])).toThrow(ApiValidationError);
  });

  // ── Test 4: Missing classId ─────────────────────────────────────────────

  it('throws ApiValidationError when classId is missing or empty', () => {
    installABClassControllerStub();
    const { getABClass_ } = loadModule();

    // Missing classId key
    expect(() => getABClass_({})).toThrow(ApiValidationError);

    // Empty string classId (triggers non-empty check in validateSafeTrimmedIdentifier_)
    expect(() => getABClass_({ classId: '' })).toThrow(ApiValidationError);

    // undefined classId value
    expect(() => getABClass_({ classId: undefined })).toThrow(ApiValidationError);
  });

  // ── Test 5: Trimmed-string validation ───────────────────────────────────

  it('throws ApiValidationError when classId has leading or trailing whitespace', () => {
    installABClassControllerStub();
    const { getABClass_ } = loadModule();

    expect(() => getABClass_({ classId: ' class-001 ' })).toThrow(ApiValidationError);
  });

  // ── Tests 6-7: Unsafe character validation ──────────────────────────────

  it('throws ApiValidationError for unsafe characters in classId', () => {
    installABClassControllerStub();
    const { getABClass_ } = loadModule();

    // Path-traversal characters
    expect(() => getABClass_({ classId: '../' })).toThrow(ApiValidationError);
    expect(() => getABClass_({ classId: 'foo/bar' })).toThrow(ApiValidationError);
    expect(() => getABClass_({ classId: String.raw`foo\bar` })).toThrow(ApiValidationError);

    // Control characters: null byte (0x00) and unit separator (0x1F)
    expect(() => getABClass_({ classId: 'foo\x00bar' })).toThrow(ApiValidationError);
    expect(() => getABClass_({ classId: 'foo\x1Fbar' })).toThrow(ApiValidationError);

    // DELETE character (0x7F / 127)
    expect(() => getABClass_({ classId: 'foo\x7Fbar' })).toThrow(ApiValidationError);
  });

  // ── Test 8: Successful delegation ───────────────────────────────────────

  it('delegates to ABClassController.readClass on valid input and returns controller result', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    const controllerResult = buildControllerResult();
    readClass.mockReturnValue(controllerResult);

    const result = getABClass_({ classId: 'class-001' });

    // (a) readClass called with the correct classId
    expect(readClass).toHaveBeenCalledWith('class-001');

    // (b) returned data matches the controller result
    expect(result).toEqual(controllerResult);

    // (c) ABLogger.getInstance().info called
    expect(abLoggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('getABClass:'),
      expect.objectContaining({ classId: 'class-001' })
    );
  });

  // ── Test 9: Null on ClassNotFoundError ──────────────────────────────────

  it('returns null when readClass throws ClassNotFoundError', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    const notFoundError = new ClassNotFoundError('Class not found for classId=class-001.', {
      courseId: 'class-001',
    });
    readClass.mockImplementation(() => {
      throw notFoundError;
    });

    const result = getABClass_({ classId: 'class-001' });

    // Returns null, does not throw
    expect(result).toBeNull();

    // ABLogger.warn called with the not-found message
    expect(abLoggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining('getABClass: class not found'),
      expect.objectContaining({ classId: 'class-001' })
    );
  });

  // ── Test 10: Propagates non-not-found errors ────────────────────────────

  it('propagates non-not-found errors from readClass', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    readClass.mockImplementation(() => {
      throw new Error('Corrupt class data');
    });

    expect(() => {
      getABClass_({ classId: 'class-001' });
    }).toThrow('Corrupt class data');

    // ABLogger.error called with the failure message
    expect(abLoggerSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('getABClass failed'),
      expect.objectContaining({ classId: 'class-001' })
    );
  });

  // ── Test 11: DateUtils.normaliseDateFields NOT called ───────────────────

  it('does not call DateUtils.normaliseDateFields at the response root', () => {
    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    const controllerResult = buildControllerResult();
    readClass.mockReturnValue(controllerResult);

    const normaliseDateFieldsSpy = vi.spyOn(globalThis.DateUtils, 'normaliseDateFields');

    getABClass_({ classId: 'class-001' });

    expect(normaliseDateFieldsSpy).not.toHaveBeenCalled();
  });

  // ── Tests 12-14: Logger spy verification ────────────────────────────────

  it('ABLogger.getInstance().info is called on successful read', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    readClass.mockReturnValue(buildControllerResult());
    getABClass_({ classId: 'class-001' });

    expect(abLoggerSpies.info).toHaveBeenCalled();
  });

  it('ABLogger.getInstance().warn is called on not-found', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    readClass.mockImplementation(() => {
      throw new ClassNotFoundError('Not found', { courseId: 'class-001' });
    });

    getABClass_({ classId: 'class-001' });

    expect(abLoggerSpies.warn).toHaveBeenCalled();
  });

  it('ABLogger.getInstance().error is called on other failures', () => {
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readClass } = installABClassControllerStub();
    const { getABClass_ } = loadModule();

    readClass.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    expect(() => {
      getABClass_({ classId: 'class-001' });
    }).toThrow('Unexpected error');

    expect(abLoggerSpies.error).toHaveBeenCalled();
  });
});
