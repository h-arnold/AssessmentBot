import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import {
  setupRealAbclassDispatcher,
  teardownRealAbclassDispatcher,
} from './abclassMetadataTestContext.js';
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');

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

  it.each(['upsertABClass', 'updateABClass'])(
    '%s preserves caller order for equal timestamps and reusable definition keys',
    (method) => {
      const medium = loadBackendModelInputs('medium');
      const orderedSource = Object.values(medium.classesById).find(
        (row) => row.metadata?.recentAssignments.length >= 2 && row.cohortKey && row.yearGroupKey
      );
      const metadata = structuredClone(orderedSource.metadata);
      metadata.recentAssignments[0].updatedAt = metadata.recentAssignments[1].updatedAt;
      metadata.recentAssignments[1].assignmentDefinitionKey =
        metadata.recentAssignments[0].assignmentDefinitionKey;
      ABClassMetadata.validateMetadata(metadata, 'metadata');
      const partialRows = [
        {
          ...medium.classPartials.find((row) => row.classId === orderedSource.classId),
          _id: 'ordered-partial-row',
          metadata: structuredClone(metadata),
        },
      ];
      context = setupRealAbclassDispatcher(vi, medium, {
        classId: orderedSource.classId,
        partialRows,
      });
      const request =
        method === 'upsertABClass'
          ? {
              classId: context.classId,
              cohortKey: orderedSource.cohortKey,
              yearGroupKey: orderedSource.yearGroupKey,
              courseLength: orderedSource.courseLength,
              metadata: structuredClone(metadata),
            }
          : { classId: context.classId, metadata: structuredClone(metadata) };

      const response = context.api.apiHandler({ method, params: request });

      expect(response.ok).toBe(true);
      expect(response.data.metadata.recentAssignments.map((entry) => entry.assignmentId)).toEqual(
        metadata.recentAssignments.map((entry) => entry.assignmentId)
      );
      expect(context.full.rows()[0].metadata).toStrictEqual(metadata);
      expect(context.partial.rows()[0].metadata).toStrictEqual(metadata);
    }
  );

  it('runs a supplied snapshot through upsert, update, roster refresh, assignment persistence, reads, replacement, clear and delete', () => {
    const source = Object.values(canonical.classesById).find(
      (row) => row.cohortKey && row.yearGroupKey && row.metadata !== null
    );
    const sourcePartial = canonical.classPartials.find((row) => row.classId === source.classId);
    context = setupRealAbclassDispatcher(vi, canonical, {
      classId: source.classId,
      partialRows: [{ ...sourcePartial, _id: 'lifecycle-partial-row' }],
    });
    const supplied = structuredClone(source.metadata);
    const untouched = structuredClone(supplied);
    const request = {
      classId: context.classId,
      cohortKey: source.cohortKey,
      yearGroupKey: source.yearGroupKey,
      courseLength: source.courseLength,
      metadata: structuredClone(supplied),
    };

    const upsert = context.api.apiHandler({ method: 'upsertABClass', params: request });
    expect(upsert.data.metadata).toStrictEqual(untouched);
    context.api.apiHandler({
      method: 'updateABClass',
      params: { classId: context.classId, active: false },
    });
    const controller = new globalThis.ABClassController();
    const rosterOrder = [];
    for (const [store, name, methods] of [
      [context.partial, 'partial', ['findOne', 'updateOne', 'save']],
      [context.full, 'full', ['updateOne', 'save']],
    ]) {
      for (const method of methods) {
        const original = store[method].getMockImplementation();
        vi.spyOn(store, method).mockImplementation((...args) => {
          rosterOrder.push(`${name}.${method}`);
          return original?.(...args);
        });
      }
    }
    const rosterLoaded = controller.loadClass(context.classId);
    expect(rosterOrder).toEqual([
      'partial.findOne',
      'full.updateOne',
      'full.save',
      'partial.updateOne',
      'partial.save',
    ]);
    expect(context.full.updateOne.mock.calls[0][1].$set).not.toHaveProperty('metadata');
    expect(context.partial.updateOne.mock.calls[0][1].$set).not.toHaveProperty('metadata');
    const fullAssignmentInput = Object.values(canonical.assignmentsByKey).find(
      (assignment) => assignment.courseId === context.classId
    );
    const assignment = globalThis.Assignment.fromJSON(structuredClone(fullAssignmentInput));
    controller.persistAssignmentRun(rosterLoaded, assignment);

    const list = context.api.apiHandler({ method: 'getABClassPartials' });
    const fullRead = context.api.apiHandler({
      method: 'getABClass',
      params: { classId: context.classId },
    });
    expect(list.data.find((row) => row.classId === context.classId).metadata).toStrictEqual(
      untouched
    );
    expect(fullRead.data.metadata).toStrictEqual(untouched);
    expect(context.full.rows()[0].metadata).toStrictEqual(untouched);
    expect(context.partial.rows()[0].metadata).toStrictEqual(untouched);
    expect(context.full.rows()[0].assignments.map((row) => row.assignmentId)).toEqual(
      source.assignments.map((row) => row.assignmentId)
    );
    expect(
      context.assignmentCollections
        .get(`assign_full_${context.classId}_${assignment.assignmentId}`)
        .rows()
    ).toHaveLength(1);

    const replacement = structuredClone(
      Object.values(loadBackendModelInputs('medium').classesById).find((row) => row.metadata)
        ?.metadata
    );
    const replaced = context.api.apiHandler({
      method: 'updateABClass',
      params: { classId: context.classId, metadata: replacement },
    });
    expect(replaced.data.metadata).toStrictEqual(replacement);
    expect(context.full.rows()[0].metadata).toStrictEqual(replacement);
    expect(context.partial.rows()[0].metadata).toStrictEqual(replacement);
    const cleared = context.api.apiHandler({
      method: 'updateABClass',
      params: { classId: context.classId, metadata: null },
    });
    expect(cleared.data.metadata).toBeNull();
    expect(context.full.rows()[0].metadata).toBeNull();
    expect(context.partial.rows()[0].metadata).toBeNull();
    const deleted = context.api.apiHandler({
      method: 'deleteABClass',
      params: { classId: context.classId },
    });
    expect(deleted.data).toEqual({
      classId: context.classId,
      hasDeletedFullClass: true,
      hasDeletedClassPartial: true,
    });
  });
});
