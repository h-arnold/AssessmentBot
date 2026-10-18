import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  setupRealAbclassDispatcher,
  teardownRealAbclassDispatcher,
} from './abclassMetadataTestContext.js';

const canonical = loadBackendModelInputs('small');
const selectedClass = Object.values(canonical.classesById).find(
  (row) => row.cohortKey && row.yearGroupKey
);
const registryRows = [
  {
    ...canonical.classPartials.find((row) => row.classId === selectedClass.classId),
    _id: 'partial-row',
  },
];
const replacement = Object.values(loadBackendModelInputs('medium').classesById).find(
  (row) => row.metadata
)?.metadata;
describe('ABClass metadata dispatcher success writes', () => {
  let context;
  afterEach(() => {
    if (context) teardownRealAbclassDispatcher(vi, context);
    context = undefined;
  });

  it('updates through the real mutation wrapper, controller, model, persistence and summary mapper', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    const request = { classId: context.classId, metadata: structuredClone(replacement) };
    const response = context.api.apiHandler({ method: 'updateABClass', params: request });
    expect(response).toMatchObject({
      ok: true,
      data: { classId: context.classId, metadata: replacement },
    });
    expect(context.full.updateOne).toHaveBeenCalledTimes(1);
    expect(context.partial.replaceOne).toHaveBeenCalledTimes(1);
    expect(context.full.rows()[0].metadata).toEqual(replacement);
    expect(context.partial.rows()[0].metadata).toEqual(replacement);
    expect(response.data.metadata.classAverages.updatedAt).toEqual(expect.any(String));
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it.each([
    ['omission', undefined, (context) => context.source.metadata],
    ['explicit null', null, () => null],
    ['complete replacement', replacement, () => replacement],
  ])(
    'upserts with metadata %s through real controller and dual-store persistence',
    (_label, metadata, expectedFor) => {
      context = setupRealAbclassDispatcher(vi, canonical, {
        classId: selectedClass.classId,
        partialRows: registryRows,
      });
      const request = {
        classId: context.classId,
        cohortKey: context.source.cohortKey,
        yearGroupKey: context.source.yearGroupKey,
        courseLength: context.source.courseLength,
        ...(metadata === undefined ? {} : { metadata: structuredClone(metadata) }),
      };
      const expected = expectedFor(context);
      const response = context.api.apiHandler({ method: 'upsertABClass', params: request });
      const thrown = context.seams.errorSpy.mock.calls[0]?.[2];
      expect(
        response.ok,
        JSON.stringify({
          response,
          thrown: { name: thrown?.name, message: thrown?.message, stack: thrown?.stack },
        })
      ).toBe(true);
      expect(response).toMatchObject({
        ok: true,
        data: { classId: context.classId, metadata: expected },
      });
      expect(context.full.replaceOne).toHaveBeenCalledTimes(1);
      expect(context.partial.replaceOne).toHaveBeenCalledTimes(1);
      expect(context.full.rows()[0].metadata).toEqual(expected);
      expect(context.partial.rows()[0].metadata).toEqual(expected);
      expect(JSON.parse(JSON.stringify(response))).toEqual(response);
    }
  );

  it('preserves omitted metadata on update and leaves deletion results metadata-free', () => {
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: selectedClass.classId,
      partialRows: registryRows,
    });
    const original = structuredClone(context.source.metadata);
    const updated = context.api.apiHandler({
      method: 'updateABClass',
      params: { classId: context.classId, active: false },
    });
    expect(updated.data.metadata).toEqual(original);
    expect(context.full.rows()[0].metadata).toEqual(original);
    const deleted = context.api.apiHandler({
      method: 'deleteABClass',
      params: { classId: context.classId },
    });
    expect(deleted.data).toEqual({
      classId: context.classId,
      hasDeletedFullClass: true,
      hasDeletedClassPartial: true,
    });
    expect(deleted.data).not.toHaveProperty('metadata');
  });
});
