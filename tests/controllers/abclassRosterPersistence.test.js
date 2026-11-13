import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import {
  canonicalClass,
  expectNoSkipLog,
  expectSkippedPersist,
  expectStoreWrites,
  makeMatchingRoster,
  makeRoster,
  reorderStoredKeys,
  writes,
} from '../helpers/abclassRosterPersistenceTestHelpers.js';

const { Teacher } = require('#backend/Models/Teacher.js');

const clone = (value) => structuredClone(value);

describe('ABClassRoster field-scoped partial persistence', () => {
  let logger;
  let restoreGlobals;

  beforeEach(() => {
    logger = { info: vi.fn(), error: vi.fn() };
    restoreGlobals = withGlobalMocks({ ABLogger: () => ({ getInstance: () => logger }) }).restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it.each(['different snapshot', 'null metadata', 'legacy absence', 'malformed metadata'])(
    'preserves existing registry state and its own %s without inspecting metadata',
    (caseName) => {
      const abClass = canonicalClass();
      abClass.className = 'Refreshed canonical class';
      const storedRow = { _id: 'stored-partial-id', classId: abClass.classId, sentinel: 'keep' };
      const metadataGetter = vi.fn(() => {
        if (caseName === 'malformed metadata') throw new Error('Stored metadata was inspected');
        if (caseName === 'null metadata') return null;
        if (caseName === 'different snapshot') {
          const differentSnapshot = clone(abClass.metadata);
          differentSnapshot.classAverages.accuracy = 2.25;
          return differentSnapshot;
        }
        return { invalid: true };
      });
      if (caseName !== 'legacy absence') {
        Object.defineProperty(storedRow, 'metadata', {
          get: metadataGetter,
          enumerable: true,
        });
      }
      const projectionSpy = vi.spyOn(abClass, 'toPartialJSON');
      const { roster, full, partial } = makeRoster({
        partialRow: storedRow,
        updateResult: { matchedCount: 1, modifiedCount: 0, acknowledged: true },
        failures: {},
      });

      expect(() => roster._persistRoster(full, { _id: 'full-id' }, abClass)).not.toThrow();

      expect(partial.findOne).toHaveBeenCalledWith({ classId: abClass.classId });
      expect(partial.updateOne).toHaveBeenCalledWith(
        { _id: 'stored-partial-id' },
        {
          $set: {
            className: abClass.className,
            classOwner: abClass.serialiseOwner(abClass.classOwner),
            teachers: globalThis.ArrayUtils.serialiseArray(abClass.teachers),
          },
        }
      );
      expect(partial.replaceOne).not.toHaveBeenCalled();
      expect(partial.insertOne).not.toHaveBeenCalled();
      expect(metadataGetter).not.toHaveBeenCalled();
      expect(projectionSpy).not.toHaveBeenCalled();
      expect(full.updateOne.mock.calls[0][1].$set).toEqual({
        className: abClass.className,
        classOwner: abClass.classOwner,
        teachers: abClass.teachers,
        students: abClass.students,
      });
    }
  );

  it('keeps legacy metadata absence untouched in both existing records', () => {
    const abClass = canonicalClass();
    const storedRow = { _id: 'legacy-partial', classId: abClass.classId };
    const { roster, full, partial } = makeRoster({
      partialRow: storedRow,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });
    const fullExisting = { _id: 'full-id', classId: abClass.classId };

    roster._persistRoster(full, fullExisting, abClass);

    expect(full.updateOne.mock.calls[0][1].$set).not.toHaveProperty('metadata');
    expect(partial.updateOne.mock.calls[0][1].$set).not.toHaveProperty('metadata');
    expect(storedRow).not.toHaveProperty('metadata');
  });

  it('writes refreshed nameless Teacher instances with explicit null names', () => {
    const abClass = canonicalClass();
    abClass.classOwner = new Teacher(abClass.classOwner.email, abClass.classOwner.userId);
    abClass.teachers = abClass.teachers.map(
      (teacher) => new Teacher(teacher.email, teacher.userId)
    );
    const { roster, full, partial } = makeRoster({
      partialRow: { _id: 'stored-partial-id', classId: abClass.classId },
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });

    roster._persistRoster(full, { _id: 'full-id' }, abClass);

    expect(full.updateOne.mock.calls[0][1].$set).toEqual({
      className: abClass.className,
      classOwner: abClass.classOwner,
      teachers: abClass.teachers,
      students: abClass.students,
    });
    expect(partial.updateOne.mock.calls[0][1].$set.teachers).toEqual(
      abClass.teachers.map((teacher) => ({
        email: teacher.email,
        userId: teacher.userId,
        teacherName: null,
      }))
    );
    expect(partial.updateOne.mock.calls[0][1].$set).toEqual({
      className: abClass.className,
      classOwner: {
        email: abClass.classOwner.email,
        userId: abClass.classOwner.userId,
        teacherName: null,
      },
      teachers: abClass.teachers.map((teacher) => ({
        email: teacher.email,
        userId: teacher.userId,
        teacherName: null,
      })),
    });
  });

  it('inserts a complete canonical partial when the registry row is missing', () => {
    const abClass = canonicalClass();
    const expectedPartial = abClass.toPartialJSON();
    const { roster, full, partial, order } = makeRoster({
      partialRow: null,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });

    roster._persistRoster(full, { _id: 'full-id' }, abClass);

    const inserted = partial.insertOne.mock.calls[0][0];
    expect(inserted).toEqual(expectedPartial);
    expect(inserted).toMatchObject({
      classId: abClass.classId,
      className: abClass.className,
      classOwner: abClass.serialiseOwner(abClass.classOwner),
      teachers: globalThis.ArrayUtils.serialiseArray(abClass.teachers),
      cohortKey: abClass.cohortKey,
      courseLength: abClass.courseLength,
      yearGroupKey: abClass.yearGroupKey,
      active: abClass.active,
      metadata: abClass.metadata,
    });
    expect(inserted).not.toHaveProperty('students');
    expect(inserted).not.toHaveProperty('assignments');
    expect(partial.findOne).toHaveBeenCalledWith({ classId: abClass.classId });
    expect(order.indexOf('partial.findOne')).toBeLessThan(order.indexOf('full.updateOne'));
    expect(order.filter((entry) => typeof entry === 'string')).toEqual([
      'partial.findOne',
      'full.updateOne',
      'full.save',
      'partial.insertOne',
      'partial.save',
    ]);
  });

  it('rejects invalid metadata for missing-row creation before either store is mutated', () => {
    const abClass = canonicalClass();
    abClass.metadata.classAverages.completeness = 9;
    const { roster, full, partial } = makeRoster({
      partialRow: null,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });

    let caught;
    try {
      roster._persistRoster(full, { _id: 'full-id' }, abClass);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(globalThis.ABClassMetadataValidationError);
    expect(caught.fieldPath).toMatch(/metadata\.classAverages\.completeness/);
    expect(caught.inputSource).not.toBe('request');
    for (const store of [full, partial]) {
      for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
    }
  });

  it('does not write the partial when the full roster save fails', () => {
    const abClass = canonicalClass();
    const error = new Error('full roster save failed');
    const { roster, full, partial } = makeRoster({
      partialRow: null,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: { fullSave: error },
    });

    let caught;
    try {
      roster._persistRoster(full, { _id: 'full-id' }, abClass);
    } catch (actual) {
      caught = actual;
    }

    expect(caught).toBe(error);
    expect(partial.findOne).toHaveBeenCalledWith({ classId: abClass.classId });
    expect(partial.insertOne).not.toHaveBeenCalled();
    expect(partial.updateOne).not.toHaveBeenCalled();
  });

  it('fails a zero-match existing-row patch without fallback insertion or replacement', () => {
    const abClass = canonicalClass();
    const { roster, full, partial } = makeRoster({
      partialRow: { _id: 'existing-id', classId: abClass.classId },
      updateResult: { matchedCount: 0, modifiedCount: 0, acknowledged: true },
      failures: {},
    });

    expect(() => roster._persistRoster(full, { _id: 'full-id' }, abClass)).toThrow(
      /partial.*match|matched.*partial|partial.*update/i
    );
    expect(partial.updateOne).toHaveBeenCalledWith(
      { _id: 'existing-id' },
      expect.objectContaining({ $set: expect.any(Object) })
    );
    expect(partial.insertOne).not.toHaveBeenCalled();
    expect(partial.replaceOne).not.toHaveBeenCalled();
  });

  it.each([
    ['null', { _id: null, classId: 'stored-class' }],
    ['absent', { classId: 'stored-class' }],
    ['own undefined', { _id: undefined, classId: 'stored-class' }],
  ])('rejects an existing partial with a %s stored _id during preparation', (_caseName, row) => {
    const abClass = canonicalClass();
    const { roster, full, partial } = makeRoster({
      partialRow: row,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });

    let caught;
    try {
      roster._persistRoster(full, { _id: 'full-id' }, abClass);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TypeError);
    expect(caught.message).toMatch(/existing partial row is missing stored _id/i);
    for (const store of [full, partial]) {
      for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
    }
    expect(partial.updateOne).not.toHaveBeenCalledWith({ _id: null }, expect.anything());
  });

  it('logs and rethrows the same lookup error before any roster mutation', () => {
    const abClass = canonicalClass();
    const error = new Error('partial lookup failed');
    const { roster, full, partial } = makeRoster({
      partialRow: null,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });
    partial.findOne.mockImplementation(() => {
      throw error;
    });

    let caught;
    try {
      roster._persistRoster(full, { _id: 'full-id' }, abClass);
    } catch (actual) {
      caught = actual;
    }

    expect(caught).toBe(error);
    expect(logger.error).toHaveBeenCalledWith('_persistRoster: write or partial upsert failed', {
      classId: abClass.classId,
      err: error,
    });
    for (const store of [full, partial]) {
      for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
    }
  });

  it('logs and rethrows the same missing-row preparation error before any roster mutation', () => {
    const abClass = canonicalClass();
    const error = new Error('partial projection failed');
    vi.spyOn(abClass, 'toPartialJSON').mockImplementation(() => {
      throw error;
    });
    const { roster, full, partial } = makeRoster({
      partialRow: null,
      updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
      failures: {},
    });

    let caught;
    try {
      roster._persistRoster(full, { _id: 'full-id' }, abClass);
    } catch (actual) {
      caught = actual;
    }

    expect(caught).toBe(error);
    expect(logger.error).toHaveBeenCalledWith('_persistRoster: write or partial upsert failed', {
      classId: abClass.classId,
      err: error,
    });
    expect(partial.findOne).toHaveBeenCalledWith({ classId: abClass.classId });
    for (const store of [full, partial]) {
      for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
    }
  });

  it.each(['patch', 'insert', 'partial save'])(
    'propagates the original %s exception after full save',
    (failure) => {
      const abClass = canonicalClass();
      const error = new Error(`${failure} exploded`);
      const { roster, full, partial, order } = makeRoster({
        partialRow: failure === 'insert' ? null : { _id: 'existing-id', classId: abClass.classId },
        updateResult: { matchedCount: 1, modifiedCount: 1, acknowledged: true },
        failures:
          failure === 'patch'
            ? { update: error }
            : failure === 'insert'
              ? { insert: error }
              : { partialSave: error },
      });
      if (failure === 'partial save')
        partial.save.mockImplementation(() => {
          order.push('partial.save');
          throw error;
        });

      let caught;
      try {
        roster._persistRoster(full, { _id: 'full-id' }, abClass);
      } catch (actual) {
        caught = actual;
      }

      expect(caught).toBe(error);
      expect(full.save).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        '_persistRoster: write or partial upsert failed',
        expect.objectContaining({ classId: abClass.classId, err: error })
      );
      const events = order.filter((entry) => typeof entry === 'string');
      expect(events.indexOf('full.updateOne')).toBeLessThan(events.indexOf('full.save'));
      expect(events.indexOf('full.save')).toBeLessThan(
        events.indexOf(failure === 'insert' ? 'partial.insertOne' : 'partial.updateOne')
      );
    }
  );

  it('skips persistence when both stored records already match the refreshed roster', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    expectSkippedPersist({ logger, abClass });
  });

  it('skips when stored values differ only in object key order', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { existingDocument, partialRow } = makeMatchingRoster(abClass);
    reorderStoredKeys(existingDocument, partialRow);
    expectSkippedPersist({ logger, abClass, existingDocument, partialRow });
  });

  it('writes both stores when the stored full document has a stale student', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { existingDocument, roster, full, partial } = makeMatchingRoster(abClass);
    existingDocument.students = clone(existingDocument.students);
    existingDocument.students[0].name = 'Stale Student';
    roster._persistRoster(full, existingDocument, abClass);
    expectStoreWrites(full, partial);
    expect(full.updateOne.mock.calls[0][1].$set.students).toEqual(abClass.students);
    expect(partial.updateOne.mock.calls[0][1].$set.teachers).toEqual(
      abClass.toPartialJSON().teachers
    );
    expectNoSkipLog(logger);
  });

  it('writes when the registry row matches but the stored full document is stale', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { existingDocument, roster, full, partial } = makeMatchingRoster(abClass);
    existingDocument.classOwner = clone(existingDocument.classOwner);
    existingDocument.classOwner.teacherName = 'Stale Owner Name';
    roster._persistRoster(full, existingDocument, abClass);
    expectStoreWrites(full, partial);
    expect(full.updateOne.mock.calls[0][1].$set.classOwner).toEqual(abClass.classOwner);
    expect(logger.info).toHaveBeenCalledWith(
      '_persistRoster: persisting roster',
      expect.anything()
    );
  });

  it('writes and repairs the registry row when it has a stale teacher name', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { partialRow, roster, full, partial } = makeMatchingRoster(abClass);
    partialRow.teachers = clone(partialRow.teachers);
    partialRow.teachers[0].teacherName = 'Stale Teacher Name';
    roster._persistRoster(full, abClass.toJSON(), abClass);
    expectStoreWrites(full, partial);
    expect(partial.updateOne).toHaveBeenCalledWith(
      { _id: 'matching-partial-id' },
      {
        $set: {
          className: abClass.className,
          classOwner: abClass.serialiseOwner(abClass.classOwner),
          teachers: globalThis.ArrayUtils.serialiseArray(abClass.teachers),
        },
      }
    );
  });

  it('writes and inserts a complete registry row when it is missing', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { roster, full, partial, order } = makeMatchingRoster(abClass, { partialRow: null });
    roster._persistRoster(full, abClass.toJSON(), abClass);
    expect(partial.insertOne).toHaveBeenCalledTimes(1);
    expect(partial.updateOne).not.toHaveBeenCalled();
    expect(order.filter((entry) => typeof entry === 'string')).toEqual([
      'partial.findOne',
      'full.updateOne',
      'full.save',
      'partial.insertOne',
      'partial.save',
    ]);
    expectNoSkipLog(logger);
  });

  it('does not skip a registry row that has no stored _id', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    const { partialRow, roster, full, partial } = makeMatchingRoster(abClass);
    delete partialRow._id;
    let caught;
    try {
      roster._persistRoster(full, abClass.toJSON(), abClass);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect(caught.message).toMatch(/existing partial row is missing stored _id/i);
    for (const store of [full, partial]) {
      for (const method of writes) expect(store[method]).not.toHaveBeenCalled();
    }
  });

  it('skips when a null class owner matches null and absent stored values', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    abClass.classOwner = null;
    const { existingDocument, partialRow } = makeMatchingRoster(abClass);
    existingDocument.classOwner = null;
    delete partialRow.classOwner;
    expectSkippedPersist({ logger, abClass, existingDocument, partialRow });
  });

  it('writes when the same roster entries are stored in a different order', () => {
    const abClass = canonicalClass();
    abClass.className = 'Refreshed Roster Class';
    abClass.teachers = [
      new Teacher('first@example.test', 'teacher-first', 'First Teacher'),
      new Teacher('second@example.test', 'teacher-second', 'Second Teacher'),
    ];
    const { existingDocument, roster, full, partial } = makeMatchingRoster(abClass);
    existingDocument.teachers = [...abClass.toJSON().teachers].reverse();
    existingDocument.students = [...abClass.toJSON().students].reverse();
    roster._persistRoster(full, existingDocument, abClass);
    expectStoreWrites(full, partial);
    expect(full.updateOne.mock.calls[0][1].$set.teachers).toEqual(abClass.teachers);
    expect(full.updateOne.mock.calls[0][1].$set.students).toEqual(abClass.students);
  });
});
