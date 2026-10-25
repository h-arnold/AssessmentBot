/** Real assignment read-route failures against mocked assignment storage. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPath = '#backend/z_Api/assignmentAssessment.js';
const controllerPath = '#backend/y_controllers/ABClassController/index.js';

describe('getAssignment read error boundary', () => {
  const originalController = globalThis.ABClassController;
  const originalDbManager = globalThis.DbManager;
  const originalLogger = globalThis.ABLogger;
  let findOne;
  let logger;

  beforeEach(() => {
    findOne = vi.fn();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    globalThis.DbManager = { getInstance: () => ({ getCollection: () => ({ findOne }) }) };
    globalThis.ABLogger = { getInstance: () => logger };
    globalThis.ABClassController = require(controllerPath);
    delete require.cache[require.resolve(apiPath)];
  });

  afterEach(() => {
    globalThis.ABClassController = originalController;
    globalThis.DbManager = originalDbManager;
    globalThis.ABLogger = originalLogger;
    delete require.cache[require.resolve(apiPath)];
    vi.restoreAllMocks();
  });

  it('propagates a stored assignment root failure through the real API route', () => {
    findOne.mockReturnValue({ courseId: 'course-001', assignmentId: 'assign-001' });
    const { getAssignment_ } = require(apiPath);

    expect(() => getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' })).toThrow(
      'Corrupt or invalid assignment data: missing required field assignmentDefinition'
    );
    expect(findOne).toHaveBeenCalledWith({ courseId: 'course-001', assignmentId: 'assign-001' });
    expect(logger.error).toHaveBeenCalledWith(
      'getAssignment failed',
      expect.objectContaining({ courseId: 'course-001', assignmentId: 'assign-001' })
    );
  });

  it('returns null when the real read route cannot find the stored assignment', () => {
    findOne.mockReturnValue(null);
    const { getAssignment_ } = require(apiPath);

    expect(getAssignment_({ courseId: 'course-001', assignmentId: 'assign-001' })).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('getAssignment: assignment not found', {
      courseId: 'course-001',
      assignmentId: 'assign-001',
    });
  });
});
