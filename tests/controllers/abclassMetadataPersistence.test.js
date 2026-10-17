import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { saveGlobals, restoreGlobals } from '#test-helpers/globalMockManager.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');

const clone = (value) => structuredClone(value);
const mutations = ['insertOne', 'replaceOne', 'updateOne', 'save'];
let savedGlobals;
let logger;

function collection(existing, name, order) {
  const result = { name, findOne: vi.fn(() => existing) };
  for (const method of mutations) {
    result[method] = vi.fn((...args) => order.push({ collection: name, method, args }));
  }
  return result;
}

function stores(existingFull, existingPartial) {
  const order = [];
  return {
    full: collection(existingFull, 'full', order),
    partial: collection(existingPartial, 'partial', order),
    order,
  };
}

function fixture(profile, predicate) {
  return clone(Object.values(loadBackendModelInputs(profile).classesById).find(predicate));
}

function captureThrown(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectMetadataDetached(left, right) {
  if (left === null || right === null) return;
  expect(left).not.toBe(right);
  expect(left.classAverages).not.toBe(right.classAverages);
  expect(left.recentAssignments).not.toBe(right.recentAssignments);
  for (let index = 0; index < left.recentAssignments.length; index += 1) {
    expect(left.recentAssignments[index]).not.toBe(right.recentAssignments[index]);
    expect(left.recentAssignments[index].averages).not.toBe(
      right.recentAssignments[index].averages
    );
  }
}

function persistence({ full, partial }) {
  const dbManager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
  };
  return {
    owner: new ABClassPersistence({ dbManager, validation: new ABClassValidation() }),
  };
}

function assertNoMutations(full, partial) {
  for (const method of mutations) {
    expect(full[method]).not.toHaveBeenCalled();
    expect(partial[method]).not.toHaveBeenCalled();
  }
}

describe('ABClass whole-write preparation', () => {
  beforeEach(() => {
    savedGlobals = saveGlobals(['ABLogger']);
    logger = { info: vi.fn(), error: vi.fn() };
    globalThis.ABLogger = { getInstance: () => logger };
  });

  afterEach(() => restoreGlobals(savedGlobals));

  it.each(['null', 'numeric', 'N', 'E', 'excluded', 'mixed'])(
    'prepares detached equal metadata copies for canonical %s snapshots before writes',
    (variant) => {
      const inputs = loadBackendModelInputs(
        ['mixed', 'excluded', 'E'].includes(variant) ? 'medium' : 'small'
      );
      const source = Object.values(inputs.classesById).find((row) => {
        if (variant === 'null') return row.metadata === null;
        if (!row.metadata) return false;
        const value = row.metadata.classAverages.completeness;
        if (variant === 'numeric') return typeof value === 'number';
        if (variant === 'mixed')
          return row.metadata.classAverages.spag === 'N' && typeof value === 'number';
        return value === variant;
      });
      expect(source).toBeDefined();
      // Class-embedded assignment definitions are partial summaries; isolate this metadata-only full serialization.
      const model = ABClass.fromJSON({ ...clone(source), assignments: [] });
      const { full, partial, order } = stores(null, null);
      const { owner } = persistence({ full, partial });
      const sourceMetadata = clone(model.metadata);

      owner.persistClassAndPartial(model);

      const fullPayload = full.insertOne.mock.calls[0]?.[0];
      const partialPayload = partial.insertOne.mock.calls[0]?.[0];
      expect(fullPayload.metadata).toStrictEqual(sourceMetadata);
      expect(partialPayload.metadata).toStrictEqual(sourceMetadata);
      if (sourceMetadata) {
        expectMetadataDetached(fullPayload.metadata, partialPayload.metadata);
        expectMetadataDetached(fullPayload.metadata, model.metadata);
        expectMetadataDetached(partialPayload.metadata, model.metadata);
      }
      expect(order.map(({ collection: name, method }) => `${name}.${method}`)).toEqual([
        'full.insertOne',
        'full.save',
        'partial.insertOne',
        'partial.save',
      ]);
    }
  );

  it.each(['full', 'partial', 'model'])(
    'isolates fresh model, full and partial metadata when the %s value is mutated',
    (target) => {
      const model = ABClass.fromJSON({
        ...fixture('medium', (row) => row.metadata !== null),
        assignments: [],
      });
      const expected = clone(model.metadata);
      const { full, partial } = stores(null, null);
      persistence({ full, partial }).owner.persistClassAndPartial(model);
      const fullPayload = full.insertOne.mock.calls[0][0];
      const partialPayload = partial.insertOne.mock.calls[0][0];
      const selected =
        target === 'full'
          ? fullPayload.metadata
          : target === 'partial'
            ? partialPayload.metadata
            : model.metadata;
      selected.recentAssignments[0].averages.accuracy = 0;
      for (const [name, value] of Object.entries({
        full: fullPayload.metadata,
        partial: partialPayload.metadata,
        model: model.metadata,
      })) {
        expect(value).toStrictEqual(
          name === target
            ? {
                ...expected,
                recentAssignments: expected.recentAssignments.map((entry, index) =>
                  index === 0 ? { ...entry, averages: { ...entry.averages, accuracy: 0 } } : entry
                ),
              }
            : expected
        );
      }
    }
  );

  it('prepares supported plain-object inputs without adding metadata to caller or projection', () => {
    const canonical = fixture('small', (row) => row.metadata === null);
    const metadata = clone(fixture('medium', (row) => row.metadata !== null).metadata);
    const expected = clone(metadata);
    const caller = {
      classId: canonical.classId,
      className: canonical.className,
      metadata,
      toPartialJSON: vi.fn(() => ({ classId: canonical.classId, className: canonical.className })),
    };
    const { full, partial } = stores(null, null);
    const { owner } = persistence({ full, partial });

    owner.persistClassAndPartial(caller);

    const fullPayload = full.insertOne.mock.calls[0][0];
    const partialPayload = partial.insertOne.mock.calls[0][0];
    expect(fullPayload).not.toBe(caller);
    expect(partialPayload).not.toBe(caller);
    expect(fullPayload.metadata).toStrictEqual(expected);
    expect(partialPayload.metadata).toStrictEqual(expected);
    expect(fullPayload.metadata).not.toBe(partialPayload.metadata);
    expect(caller).toHaveProperty('metadata', expected);
    expect(fullPayload.metadata.classAverages).not.toBe(caller.metadata.classAverages);
    expect(partialPayload.metadata.recentAssignments).not.toBe(caller.metadata.recentAssignments);
    expect(fullPayload.metadata.recentAssignments[0]).not.toBe(
      caller.metadata.recentAssignments[0]
    );
    expect(partialPayload.metadata.recentAssignments[0].averages).not.toBe(
      caller.metadata.recentAssignments[0].averages
    );
    expect(caller.toPartialJSON.mock.results[0].value).not.toHaveProperty('metadata');
    fullPayload.metadata.recentAssignments[0].averages.overall = 0;
    expect(partialPayload.metadata).toStrictEqual(expected);
    expect(caller.metadata).toStrictEqual(expected);
  });

  it('normalises plain-object own absence to null only on prepared copies', () => {
    const caller = { classId: 'legacy-plain', toPartialJSON: () => ({ classId: 'legacy-plain' }) };
    const { full, partial } = stores(null, null);
    const { owner } = persistence({ full, partial });
    owner.persistClassAndPartial(caller);
    expect(full.insertOne.mock.calls[0][0]).toHaveProperty('metadata', null);
    expect(partial.insertOne.mock.calls[0][0]).toHaveProperty('metadata', null);
    expect(caller).not.toHaveProperty('metadata');
  });

  it('accepts explicit plain-object null metadata', () => {
    const caller = {
      classId: 'plain-null',
      metadata: null,
      toPartialJSON: () => ({ classId: 'plain-null', metadata: null }),
    };
    const { full, partial } = stores(null, null);
    persistence({ full, partial }).owner.persistClassAndPartial(caller);
    expect(full.insertOne.mock.calls[0][0]).toHaveProperty('metadata', null);
    expect(partial.insertOne.mock.calls[0][0]).toHaveProperty('metadata', null);
    expect(caller).toHaveProperty('metadata', null);
  });

  it('detaches supplied plain-object projection metadata from caller and full output', () => {
    const canonical = fixture('medium', (row) => row.metadata !== null);
    const metadata = clone(canonical.metadata);
    const caller = {
      ...canonical,
      assignments: [],
      metadata,
      toPartialJSON: vi.fn(() => projectionOutput),
    };
    const projectionOutput = { classId: canonical.classId, metadata: clone(metadata) };
    const expected = clone(metadata);
    const { full, partial } = stores(null, null);
    persistence({ full, partial }).owner.persistClassAndPartial(caller);
    const fullMetadata = full.insertOne.mock.calls[0][0].metadata;
    const partialMetadata = partial.insertOne.mock.calls[0][0].metadata;
    expect(fullMetadata).toStrictEqual(expected);
    expect(partialMetadata).toStrictEqual(expected);
    expectMetadataDetached(fullMetadata, partialMetadata);
    expectMetadataDetached(fullMetadata, caller.metadata);
    expectMetadataDetached(partialMetadata, caller.metadata);
    expectMetadataDetached(fullMetadata, projectionOutput.metadata);
    expectMetadataDetached(partialMetadata, projectionOutput.metadata);
    fullMetadata.classAverages.accuracy = 0;
    expect(partialMetadata).toStrictEqual(expected);
    expect(caller.metadata).toStrictEqual(expected);
  });

  it.each([
    ['own undefined', { metadata: undefined }],
    ['invalid metadata', { metadata: { classAverages: {}, recentAssignments: [] } }],
  ])('rejects %s before either store mutates', (_label, overrides) => {
    const caller = {
      classId: 'invalid-plain',
      toPartialJSON: () => ({ classId: 'invalid-plain' }),
      ...overrides,
    };
    const { full, partial } = stores(null, null);
    const { owner } = persistence({ full, partial });
    expect(captureThrown(() => owner.persistClassAndPartial(caller))).toBeInstanceOf(
      globalThis.ABClassMetadataValidationError
    );
    assertNoMutations(full, partial);
  });

  it('rejects invalid mutable model metadata before either store mutates', () => {
    const model = ABClass.fromJSON({
      ...fixture('medium', (row) => row.metadata !== null),
      assignments: [],
    });
    model.metadata.classAverages.accuracy = 6;
    const { full, partial } = stores(null, null);
    const { owner } = persistence({ full, partial });
    expect(captureThrown(() => owner.persistClassAndPartial(model))).toBeInstanceOf(
      globalThis.ABClassMetadataValidationError
    );
    assertNoMutations(full, partial);
  });

  it('rejects throwing or differing partial projections before any mutation', () => {
    const source = fixture('medium', (row) => row.metadata !== null);
    const differing = clone(source.metadata);
    differing.classAverages.completeness = 4.25;
    for (const projection of [
      () => {
        throw new Error('partial projection failed');
      },
      () => ({ ...clone(source), metadata: differing }),
      () => ({ ...clone(source), metadata: { classAverages: {}, recentAssignments: [] } }),
    ]) {
      const caller = { ...clone(source), assignments: [], toPartialJSON: projection };
      const { full, partial } = stores(null, null);
      const { owner } = persistence({ full, partial });
      expect(captureThrown(() => owner.persistClassAndPartial(caller))).toBeDefined();
      assertNoMutations(full, partial);
    }
  });

  it('keeps full-save and partial-save failures ordered and propagates the original exception', () => {
    const model = ABClass.fromJSON({
      ...fixture('medium', (row) => row.metadata !== null),
      assignments: [],
    });
    const fullError = new Error('full save failed');
    const { full, partial } = stores(null, null);
    full.save.mockImplementation(() => {
      throw fullError;
    });
    let owner = persistence({ full, partial }).owner;
    expect(captureThrown(() => owner.persistClassAndPartial(model))).toBe(fullError);
    expect(full.insertOne).toHaveBeenCalledTimes(1);
    expect(full.save).toHaveBeenCalledTimes(1);
    expect(partial.insertOne).not.toHaveBeenCalled();
    expect(partial.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '_persistClassAndPartial: class collection write failed',
      expect.objectContaining({ err: fullError })
    );

    const partialError = new Error('partial save failed');
    const { full: fullNext, partial: partialNext } = stores(null, null);
    partialNext.save.mockImplementation(() => {
      throw partialError;
    });
    owner = persistence({ full: fullNext, partial: partialNext }).owner;
    expect(captureThrown(() => owner.persistClassAndPartial(model))).toBe(partialError);
    expect(fullNext.insertOne).toHaveBeenCalledTimes(1);
    expect(fullNext.save).toHaveBeenCalledTimes(1);
    expect(partialNext.insertOne).toHaveBeenCalledTimes(1);
    expect(partialNext.save).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      '_upsertClassPartial: partials collection write failed',
      expect.objectContaining({ err: partialError })
    );

    const insertError = new Error('partial insert failed');
    const { full: fullInsert, partial: partialInsert } = stores(null, null);
    partialInsert.insertOne.mockImplementation(() => {
      throw insertError;
    });
    owner = persistence({ full: fullInsert, partial: partialInsert }).owner;
    expect(captureThrown(() => owner.persistClassAndPartial(model))).toBe(insertError);
    expect(fullInsert.save).toHaveBeenCalledTimes(1);
    expect(partialInsert.insertOne).toHaveBeenCalledTimes(1);
    expect(partialInsert.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '_upsertClassPartial: partials collection write failed',
      expect.objectContaining({ err: insertError })
    );
  });

  it('replaces existing full and partial records with equal detached metadata', () => {
    const existingFull = { classId: 'stored-full' };
    const existingPartial = { classId: 'stored-partial' };
    const model = ABClass.fromJSON({
      ...fixture('medium', (row) => row.metadata !== null),
      assignments: [],
    });
    const { full, partial, order } = stores(existingFull, existingPartial);
    persistence({ full, partial }).owner.persistClassAndPartial(model);
    const fullPayload = full.replaceOne.mock.calls[0][1];
    const partialPayload = partial.replaceOne.mock.calls[0][1];
    expect(full.replaceOne).toHaveBeenCalledWith({ classId: model.classId }, expect.any(Object));
    expect(partial.replaceOne).toHaveBeenCalledWith({ classId: model.classId }, expect.any(Object));
    expect(fullPayload.metadata).toStrictEqual(model.metadata);
    expect(partialPayload.metadata).toStrictEqual(model.metadata);
    expect(fullPayload.metadata).not.toBe(partialPayload.metadata);
    expect(fullPayload.metadata.classAverages).not.toBe(partialPayload.metadata.classAverages);
    expect(order.map(({ collection: name, method }) => `${name}.${method}`)).toEqual([
      'full.replaceOne',
      'full.save',
      'partial.replaceOne',
      'partial.save',
    ]);
  });

  it('stops after full replacement failure and propagates partial replacement failure unchanged', () => {
    const model = ABClass.fromJSON({
      ...fixture('medium', (row) => row.metadata !== null),
      assignments: [],
    });
    const fullError = new Error('full replacement failed');
    const fullStores = stores({ classId: model.classId }, { classId: model.classId });
    fullStores.full.replaceOne.mockImplementation(() => {
      throw fullError;
    });
    const fullOwner = persistence(fullStores).owner;
    expect(captureThrown(() => fullOwner.persistClassAndPartial(model))).toBe(fullError);
    expect(fullStores.full.replaceOne).toHaveBeenCalledTimes(1);
    expect(fullStores.full.save).not.toHaveBeenCalled();
    expect(fullStores.partial.replaceOne).not.toHaveBeenCalled();
    expect(fullStores.partial.save).not.toHaveBeenCalled();

    const fullSaveError = new Error('existing full save failed');
    const fullSaveStores = stores({ classId: model.classId }, { classId: model.classId });
    fullSaveStores.full.save.mockImplementation(() => {
      throw fullSaveError;
    });
    const fullSaveOwner = persistence(fullSaveStores).owner;
    expect(captureThrown(() => fullSaveOwner.persistClassAndPartial(model))).toBe(fullSaveError);
    expect(fullSaveStores.full.replaceOne).toHaveBeenCalledTimes(1);
    expect(fullSaveStores.full.save).toHaveBeenCalledTimes(1);
    expect(fullSaveStores.partial.replaceOne).not.toHaveBeenCalled();
    expect(fullSaveStores.partial.save).not.toHaveBeenCalled();

    const partialError = new Error('partial replacement failed');
    const partialStores = stores({ classId: model.classId }, { classId: model.classId });
    partialStores.partial.replaceOne.mockImplementation(() => {
      throw partialError;
    });
    const partialOwner = persistence(partialStores).owner;
    expect(captureThrown(() => partialOwner.persistClassAndPartial(model))).toBe(partialError);
    expect(partialStores.full.replaceOne).toHaveBeenCalledTimes(1);
    expect(partialStores.full.save).toHaveBeenCalledTimes(1);
    expect(partialStores.partial.replaceOne).toHaveBeenCalledTimes(1);
    expect(partialStores.partial.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '_upsertClassPartial: partials collection write failed',
      expect.objectContaining({ err: partialError })
    );
  });
});
