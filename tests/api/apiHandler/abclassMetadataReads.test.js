import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  setupRealAbclassDispatcher,
  teardownRealAbclassDispatcher,
} from './abclassMetadataTestContext.js';

const canonical = loadBackendModelInputs('small');
const selectedClass = Object.values(canonical.classesById).find((row) => row.metadata !== null);
const selectedPartial = canonical.classPartials.find(
  (row) => row.classId === selectedClass.classId
);
const registryRows = [{ ...selectedPartial, _id: 'partial-row' }];

/**
 * Calls the global `apiHandler` and parses the transport string it returns.
 *
 * @remarks `google.script.run` receives a JSON string so `null` properties survive the
 * transport. Every direct consumer must therefore parse at this boundary.
 * @param {object} api - The loaded `z_apiHandler` module.
 * @param {object} request - The dispatcher request payload.
 * @returns {object} The parsed response envelope.
 */
function dispatch(api, request) {
  const raw = api.apiHandler(request);
  expect(typeof raw).toBe('string');
  return JSON.parse(raw);
}

describe('ABClass metadata dispatcher read contracts', () => {
  let context;
  afterEach(() => {
    if (context) teardownRealAbclassDispatcher(vi, context);
    context = undefined;
  });

  it('returns the envelope as a JSON string so null properties survive the transport', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    const raw = context.api.apiHandler({ method: 'getABClassPartials' });
    expect(typeof raw).toBe('string');
    expect(JSON.parse(raw).data[0]).toHaveProperty('metadata');
  });

  it('dispatches registry rows through the real controller and mapper with raw metadata', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    const response = dispatch(context.api, { method: 'getABClassPartials' });
    expect(response).toMatchObject({
      ok: true,
      data: [
        expect.objectContaining({ classId: context.classId, metadata: context.source.metadata }),
      ],
    });
    expect(response.data[0]).not.toHaveProperty('_id');
    expect(context.manager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(context.partial.find).toHaveBeenCalledTimes(1);
    expect(context.full.findOne).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(response.data))).toEqual(response.data);
  });

  it('dispatches the full read through real restoration and response mapping with JSON-safe metadata', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    const response = dispatch(context.api, {
      method: 'getABClass',
      params: { classId: context.classId },
    });
    expect(response).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        classId: context.classId,
        metadata: context.source.metadata,
      }),
    });
    expect(context.full.findOne).toHaveBeenCalledWith({ classId: context.classId });
    expect(response.data.metadata?.classAverages.updatedAt).toEqual(expect.any(String));
    expect(JSON.parse(JSON.stringify(response.data))).toEqual(response.data);
  });

  it('returns the established top-level null for a missing full class', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    context.full.findOne.mockReturnValue(null);
    const response = dispatch(context.api, {
      method: 'getABClass',
      params: { classId: context.classId },
    });
    expect(response).toMatchObject({ ok: true, data: null });
  });

  it('returns an empty list when the real registry contains no rows', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: [],
    });
    context.partial.find.mockReturnValue([]);
    expect(dispatch(context.api, { method: 'getABClassPartials' })).toMatchObject({
      ok: true,
      data: [],
    });
  });
});
