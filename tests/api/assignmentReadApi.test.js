/**
 * Assignment Read API Handler Tests
 *
 * Tests for the getAssignment_ transport-boundary handler contract in
 * z_Api/assignmentAssessment.js. Validates parameter shape, unsafe-character
 * rejection, controller delegation, date normalisation, progressTracker strip,
 * and error paths.
 *
 * Transport-boundary validation:
 * - Validates parameters is a plain object
 * - Validates required string fields (courseId, assignmentId)
 * - Rejects unsafe characters in identifiers (path traversal + control chars)
 * - Delegates to ABClassController.loadClass and rehydrateAssignment
 * - Returns null on AssignmentNotFoundError
 * - Propagates non-not-found errors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../src/backend/z_Api/assignmentAssessment.js';
const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

/**
 * Attempts to load the assignmentAssessment transport module.
 * In RED phase the getAssignment_ handler is not yet exported,
 * so the module will load but the required export will be absent.
 *
 * @returns {Object} Module exports.
 */
function loadModule() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

/**
 * Installs the ABClassController global mock with loadClass and
 * rehydrateAssignment spies for controller delegation tests.
 *
 * @returns {{ loadClass: import('vitest').Mock, rehydrateAssignment: import('vitest').Mock }}
 */
function installABClassControllerStub() {
  const loadClass = vi.fn();
  const rehydrateAssignment = vi.fn();
  const ABClassController = vi.fn(function StubABClassController() {
    this.loadClass = loadClass;
    this.rehydrateAssignment = rehydrateAssignment;
  });
  globalThis.ABClassController = ABClassController;
  return { loadClass, rehydrateAssignment };
}

/**
 * Builds a representative Assignment.toJSON() payload for test assertions.
 *
 * @param {Object} [overrides] - Optional field overrides.
 * @returns {Object} Representative payload.
 */
function buildRepresentativePayload(overrides = {}) {
  return {
    courseId: 'course-001',
    assignmentId: 'assign-001',
    assignmentName: 'Test Assignment',
    dueDate: '2026-06-15T00:00:00.000Z',
    lastUpdated: '2026-06-14T00:00:00.000Z',
    createdAt: '2026-06-15T10:00:00.000Z',
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    tasks: {},
    submissions: [],
    assignmentDefinition: {},
    ...overrides,
  };
}

describe('Api/getAssignment transport contract', () => {
  let originalABClassController;
  let originalABLogger;

  beforeEach(() => {
    originalABClassController = globalThis.ABClassController;
    originalABLogger = globalThis.ABLogger;
  });

  afterEach(() => {
    delete require.cache[require.resolve(MODULE_PATH)];

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

    vi.restoreAllMocks();
  });

  // ── Test 1: Module exports ────────────────────────────────────────────────

  it('exports getAssignment_ in Node test runtime', () => {
    installABClassControllerStub();
    const module = loadModule();
    expect(module).toEqual(
      expect.objectContaining({
        getAssignment_: expect.any(Function),
      })
    );
  });

  // ── Tests 2-4: Parameter shape validation ─────────────────────────────────

  it('throws ApiValidationError when parameters is not a plain object', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    expect(() => getAssignment_('not-an-object')).toThrow(ApiValidationError);
    expect(() => getAssignment_(null)).toThrow(ApiValidationError);
    expect(() => getAssignment_(undefined)).toThrow(ApiValidationError);
    expect(() => getAssignment_([])).toThrow(ApiValidationError);
  });

  it('throws for missing courseId', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    expect(() => getAssignment_({ assignmentId: 'a1' })).toThrow(ApiValidationError);
  });

  it('throws for missing assignmentId', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    expect(() => getAssignment_({ courseId: 'c1' })).toThrow(ApiValidationError);
  });

  // ── Tests: Trimmed-string validation ──────────────────────────────────────

  it('throws ApiValidationError when courseId has leading/trailing whitespace', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    expect(() => getAssignment_({ courseId: ' c1 ', assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );
  });

  it('throws ApiValidationError when assignmentId has leading/trailing whitespace', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    expect(() => getAssignment_({ courseId: 'c1', assignmentId: ' a1 ' })).toThrow(
      ApiValidationError
    );
  });

  // ── Tests 5-6: Unsafe character validation ────────────────────────────────

  it('throws ApiValidationError for unsafe characters in courseId', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    // Path-traversal characters
    expect(() => getAssignment_({ courseId: '../', assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: 'foo/bar', assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: String.raw`foo\bar`, assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );

    // Control characters: null byte (0x00) and unit separator (0x1F)
    expect(() => getAssignment_({ courseId: 'foo\x00bar', assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: 'foo\x1Fbar', assignmentId: 'a1' })).toThrow(
      ApiValidationError
    );
  });

  it('throws ApiValidationError for unsafe characters in assignmentId', () => {
    installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    // Path-traversal characters
    expect(() => getAssignment_({ courseId: 'c1', assignmentId: '../' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: 'c1', assignmentId: 'foo/bar' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: 'c1', assignmentId: String.raw`foo\bar` })).toThrow(
      ApiValidationError
    );

    // Control characters: null byte (0x00) and unit separator (0x1F)
    expect(() => getAssignment_({ courseId: 'c1', assignmentId: 'foo\x00bar' })).toThrow(
      ApiValidationError
    );
    expect(() => getAssignment_({ courseId: 'c1', assignmentId: 'foo\x1Fbar' })).toThrow(
      ApiValidationError
    );
  });

  // ── Test 7: Successful delegation ─────────────────────────────────────────

  it('delegates to ABClassController.rehydrateAssignment on valid input and returns Assignment shape', () => {
    // Install ABLogger spy for this test (test harness note: tests 7d, 10, 11, 12)
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { loadClass, rehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const expectedPayload = buildRepresentativePayload({});
    const mockAssignment = {
      toJSON: vi.fn(() => ({ ...expectedPayload })),
    };

    const mockABClass = { classId: 'course-001' };
    loadClass.mockReturnValue(mockABClass);
    rehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // (a) loadClass called with the correct courseId
    expect(loadClass).toHaveBeenCalledWith('course-001');

    // (b) rehydrateAssignment called with the captured ABClass reference (identity)
    //     and the correct assignmentId
    expect(rehydrateAssignment).toHaveBeenCalledWith(mockABClass, 'assign-001');

    // (c) returned data matches the toJSON() output
    expect(result).toEqual(expectedPayload);

    // (d) ABLogger.getInstance().info called for both log points
    expect(abLoggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('getAssignment: loading full assignment'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
    expect(abLoggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('getAssignment: rehydrated assignment'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });

  // ── Test 8: Date normalisation defence-in-depth ───────────────────────────

  it('normalises live Date objects via DateUtils.normaliseDateFields at the boundary', () => {
    const { loadClass, rehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const dueDate = new Date('2026-06-15T00:00:00.000Z');
    const lastUpdated = new Date('2026-06-14T00:00:00.000Z');
    const createdAt = new Date('2026-06-15T10:00:00.000Z');

    const mockAssignment = {
      toJSON: vi.fn(() => ({
        courseId: 'course-001',
        assignmentId: 'assign-001',
        assignmentName: 'Test Assignment',
        dueDate,
        lastUpdated,
        createdAt,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        tasks: {},
        submissions: [],
        assignmentDefinition: {},
      })),
    };

    const mockABClass = { classId: 'course-001' };
    loadClass.mockReturnValue(mockABClass);
    rehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // Both fields should be ISO strings after normaliseDateFields
    expect(typeof result.dueDate).toBe('string');
    expect(result.dueDate).toBe('2026-06-15T00:00:00.000Z');
    expect(typeof result.lastUpdated).toBe('string');
    expect(result.lastUpdated).toBe('2026-06-14T00:00:00.000Z');
    expect(typeof result.createdAt).toBe('string');
    expect(result.createdAt).toBe('2026-06-15T10:00:00.000Z');
  });

  // ── Test 9: progressTracker strip defence-in-depth ────────────────────────

  it('strips progressTracker from the response', () => {
    const { loadClass, rehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const mockAssignment = {
      toJSON: vi.fn(() => ({
        courseId: 'course-001',
        assignmentId: 'assign-001',
        assignmentName: 'Test Assignment',
        dueDate: '2026-06-15T00:00:00.000Z',
        lastUpdated: '2026-06-14T00:00:00.000Z',
        createdAt: '2026-06-15T10:00:00.000Z',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        tasks: {},
        submissions: [],
        assignmentDefinition: {},
        progressTracker: { someTrackerInstance: true },
      })),
    };

    const mockABClass = { classId: 'course-001' };
    loadClass.mockReturnValue(mockABClass);
    rehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    expect(result).not.toHaveProperty('progressTracker');
  });

  // ── Test 10: Null on AssignmentNotFoundError ──────────────────────────────

  it('returns null when rehydrateAssignment throws AssignmentNotFoundError', () => {
    // Install ABLogger spy for warn verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const AssignmentNotFoundError = require('../../src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js');
    const { loadClass, rehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const mockABClass = { classId: 'course-001' };
    loadClass.mockReturnValue(mockABClass);

    const notFoundError = new AssignmentNotFoundError(
      'No document found in collection assign_full_course-001_assign-001 for courseId=course-001, assignmentId=assign-001.',
      {
        courseId: 'course-001',
        assignmentId: 'assign-001',
        collectionName: 'assign_full_course-001_assign-001',
      }
    );
    rehydrateAssignment.mockImplementation(() => {
      throw notFoundError;
    });

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // Returns null, does not throw
    expect(result).toBeNull();

    // ABLogger.warn called with the not-found message
    expect(abLoggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining('assignment not found'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });

  // ── Test 11: Propagates non-typed errors from rehydrateAssignment ─────────

  it('propagates non-not-found errors from rehydrateAssignment', () => {
    // Install ABLogger spy for error verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { loadClass, rehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const mockABClass = { classId: 'course-001' };
    loadClass.mockReturnValue(mockABClass);
    rehydrateAssignment.mockImplementation(() => {
      throw new Error('Corrupt assignment data');
    });

    expect(() => {
      getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });
    }).toThrow('Corrupt assignment data');

    // ABLogger.error called with the failure message
    expect(abLoggerSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('getAssignment failed'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });

  // ── Test 12: Propagates errors from loadClass ─────────────────────────────

  it('propagates errors from loadClass', () => {
    // Install ABLogger spy for error verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { loadClass } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    loadClass.mockImplementation(() => {
      throw new Error('loadClass failed');
    });

    expect(() => {
      getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });
    }).toThrow('loadClass failed');

    // ABLogger.error called with the failure message
    expect(abLoggerSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('getAssignment failed'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });
});
