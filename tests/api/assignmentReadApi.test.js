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
 * - Delegates to ABClassController.readRehydrateAssignment
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
 * Installs the ABClassController global mock with a readRehydrateAssignment
 * spy for controller delegation tests.
 *
 * @returns {{ readRehydrateAssignment: import('vitest').Mock }}
 */
function installABClassControllerStub() {
  const readRehydrateAssignment = vi.fn();
  const ABClassController = vi.fn(function StubABClassController() {
    this.readRehydrateAssignment = readRehydrateAssignment;
  });
  globalThis.ABClassController = ABClassController;
  return { readRehydrateAssignment };
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
    updatedAt: '2026-06-14T00:00:00.000Z',
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

  it('delegates to ABClassController.readRehydrateAssignment on valid input and returns Assignment shape', () => {
    // Install ABLogger spy for this test (test harness note: tests 7, 10, 11, 12)
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const expectedPayload = buildRepresentativePayload({});
    const mockAssignment = {
      toJSON: vi.fn(() => ({ ...expectedPayload })),
    };

    readRehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // (a) readRehydrateAssignment called with the correct (courseId, assignmentId)
    expect(readRehydrateAssignment).toHaveBeenCalledWith('course-001', 'assign-001');

    // (b) returned data matches the toJSON() output
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

  it('converts live Date objects via DateUtils.deepConvertDates at the boundary', () => {
    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const dueDate = new Date('2026-06-15T00:00:00.000Z');
    const updatedAt = new Date('2026-06-14T00:00:00.000Z');
    const createdAt = new Date('2026-06-15T10:00:00.000Z');

    const mockAssignment = {
      toJSON: vi.fn(() => ({
        courseId: 'course-001',
        assignmentId: 'assign-001',
        assignmentName: 'Test Assignment',
        dueDate,
        updatedAt,
        createdAt,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-001',
        templateDocumentId: 'tpl-001',
        tasks: {},
        submissions: [],
        assignmentDefinition: {},
      })),
    };

    readRehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // Both fields should be ISO strings after deepConvertDates
    expect(typeof result.dueDate).toBe('string');
    expect(result.dueDate).toBe('2026-06-15T00:00:00.000Z');
    expect(typeof result.updatedAt).toBe('string');
    expect(result.updatedAt).toBe('2026-06-14T00:00:00.000Z');
    expect(typeof result.createdAt).toBe('string');
    expect(result.createdAt).toBe('2026-06-15T10:00:00.000Z');
  });

  // ── Test 8b: Nested date conversion (deepConvertDates regression) ─────────

  it('converts nested Date objects in submissions via deepConvertDates at the boundary', () => {
    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const submissionCreatedAt = new Date('2026-07-07T07:49:23.014Z');
    const submissionUpdatedAt = new Date('2026-07-07T07:49:29.872Z');

    const mockAssignment = {
      toJSON: vi.fn(() => ({
        courseId: 'course-001',
        assignmentId: 'assign-001',
        assignmentName: 'Test Assignment',
        dueDate: new Date('2026-06-15T00:00:00.000Z'),
        documentType: 'SLIDES',
        tasks: {},
        submissions: [
          {
            studentId: 'student-001',
            createdAt: submissionCreatedAt,
            updatedAt: submissionUpdatedAt,
            items: {},
          },
        ],
        assignmentDefinition: {},
      })),
    };

    readRehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    // Root-level dates still converted
    expect(typeof result.dueDate).toBe('string');
    expect(result.dueDate).toBe('2026-06-15T00:00:00.000Z');

    // Nested submission dates converted to ISO strings
    expect(Array.isArray(result.submissions)).toBe(true);
    expect(result.submissions).toHaveLength(1);
    expect(typeof result.submissions[0].createdAt).toBe('string');
    expect(result.submissions[0].createdAt).toBe('2026-07-07T07:49:23.014Z');
    expect(typeof result.submissions[0].updatedAt).toBe('string');
    expect(result.submissions[0].updatedAt).toBe('2026-07-07T07:49:29.872Z');
  });

  // ── Test 9: progressTracker strip defence-in-depth ────────────────────────

  it('strips progressTracker from the response', () => {
    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const mockAssignment = {
      toJSON: vi.fn(() => ({
        courseId: 'course-001',
        assignmentId: 'assign-001',
        assignmentName: 'Test Assignment',
        dueDate: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-06-14T00:00:00.000Z',
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

    readRehydrateAssignment.mockReturnValue(mockAssignment);

    const result = getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });

    expect(result).not.toHaveProperty('progressTracker');
  });

  // ── Test 10: Null on AssignmentNotFoundError ──────────────────────────────

  it('returns null when readRehydrateAssignment throws AssignmentNotFoundError', () => {
    // Install ABLogger spy for warn verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const AssignmentNotFoundError = require('../../src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js');
    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    const notFoundError = new AssignmentNotFoundError(
      'No document found in collection assign_full_course-001_assign-001 for courseId=course-001, assignmentId=assign-001.',
      {
        courseId: 'course-001',
        assignmentId: 'assign-001',
        collectionName: 'assign_full_course-001_assign-001',
      }
    );
    readRehydrateAssignment.mockImplementation(() => {
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

  // ── Test 11: Propagates non-typed errors from readRehydrateAssignment ─────────

  it('propagates non-not-found errors from readRehydrateAssignment', () => {
    // Install ABLogger spy for error verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    readRehydrateAssignment.mockImplementation(() => {
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

  // ── Test 12: Propagates TypeError thrown by readRehydrateAssignment verbatim ─────────

  it('propagates TypeError thrown by readRehydrateAssignment verbatim', () => {
    // Install ABLogger spy for error verification
    const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => abLoggerSpies };

    const { readRehydrateAssignment } = installABClassControllerStub();
    const { getAssignment_ } = loadModule();

    readRehydrateAssignment.mockImplementation(() => {
      throw new TypeError('readRehydrateAssignment: expected courseId to be a non-empty string');
    });

    expect(() => {
      getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' });
    }).toThrow(TypeError);

    // ABLogger.error called with the failure message
    expect(abLoggerSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('getAssignment failed'),
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });
});
