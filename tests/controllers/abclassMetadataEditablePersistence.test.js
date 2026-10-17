import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withGlobalMocks } from '#test-helpers/globalMockManager.js';

const { ABClass } = require('#backend/Models/ABClass.js');
const { ABClassMetadata } = require('#backend/Models/ABClassMetadata.js');
const ABClassMutationOps = require('#backend/y_controllers/ABClassController/ABClassMutationOps.js');
const ABClassValidation = require('#backend/y_controllers/ABClassController/ABClassValidation.js');
const ABClassPersistence = require('#backend/y_controllers/ABClassController/ABClassPersistence.js');

const clone = (value) => structuredClone(value);

function canonicalLegacyClass() {
  const input = Object.values(loadBackendModelInputs('small').classesById).find(
    (row) => row.metadata === null
  );
  const legacy = clone(input);
  delete legacy.metadata;
  return legacy;
}

function spyCollection(order, label, existing) {
  return {
    findOne: vi.fn(() => existing),
    updateOne: vi.fn((...args) => order.push(`${label}.updateOne:${JSON.stringify(args)}`)),
    insertOne: vi.fn((...args) => order.push(`${label}.insertOne:${JSON.stringify(args)}`)),
    replaceOne: vi.fn((...args) => order.push(`${label}.replaceOne:${JSON.stringify(args)}`)),
    save: vi.fn(() => order.push(`${label}.save`)),
  };
}

describe('ABClass selective editable persistence preparation', () => {
  let restoreGlobals;

  beforeEach(() => {
    restoreGlobals = withGlobalMocks({
      ABClass: () => ABClass,
      ABClassMetadata: () => ABClassMetadata,
      ABLogger: () => ({ getInstance: () => ({ info: vi.fn(), error: vi.fn() }) }),
    }).restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('prepares a complete partial before the selective full update and preserves legacy full absence', () => {
    const order = [];
    const document = canonicalLegacyClass();
    document.classId = 'canonical-editable-class';
    const full = spyCollection(order, 'full', document);
    const partial = spyCollection(order, 'partial', { classId: document.classId });
    const dbManager = {
      getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
    };
    const validation = new ABClassValidation();
    const persistence = new ABClassPersistence({ dbManager, validation });
    const ops = new ABClassMutationOps({
      dbManager,
      validation,
      persistence,
      roster: {},
      responseMapper: { _buildClassSummary: () => ({ classId: document.classId }) },
    });

    ops.updateABClass({ classId: document.classId, active: false, courseLength: 3 });

    expect(full.updateOne).toHaveBeenCalledWith(
      { classId: document.classId },
      { $set: { active: false, courseLength: 3 } }
    );
    expect(full.updateOne.mock.calls[0][1].$set).not.toHaveProperty('metadata');
    expect(partial.replaceOne).toHaveBeenCalledWith(
      { classId: document.classId },
      expect.objectContaining({ metadata: null, active: false, courseLength: 3 })
    );
    expect(order).toEqual([
      expect.stringMatching(/^full\.updateOne:/),
      'full.save',
      expect.stringMatching(/^partial\.replaceOne:/),
      'partial.save',
    ]);
  });

  it('does not mutate either store when complete partial preparation fails', () => {
    const order = [];
    const document = canonicalLegacyClass();
    document.classId = 'canonical-editable-failure';
    const full = spyCollection(order, 'full', document);
    const partial = spyCollection(order, 'partial', { classId: document.classId });
    const dbManager = {
      getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
    };
    const validation = new ABClassValidation();
    const persistence = new ABClassPersistence({ dbManager, validation });
    const fromJSON = vi.spyOn(ABClass, 'fromJSON').mockImplementation(() => ({
      classId: document.classId,
      metadata: null,
      toPartialJSON() {
        throw new Error('partial projection failed');
      },
    }));
    const ops = new ABClassMutationOps({
      dbManager,
      validation,
      persistence,
      roster: {},
      responseMapper: { _buildClassSummary: vi.fn() },
    });

    expect(() => ops.updateABClass({ classId: document.classId, active: false })).toThrow(
      'partial projection failed'
    );
    expect(fromJSON).toHaveBeenCalledWith(document);
    for (const store of [full, partial]) {
      for (const method of ['insertOne', 'replaceOne', 'updateOne', 'save']) {
        expect(store[method]).not.toHaveBeenCalled();
      }
    }
    expect(order).toEqual([]);
  });

  it('validates a malformed restored mutable snapshot before editable writes', () => {
    const document = canonicalLegacyClass();
    document.classId = 'canonical-editable-invalid-snapshot';
    const invalidSnapshot = { classAverages: {}, recentAssignments: [] };
    expect(() => ABClassMetadata.validateMetadata(invalidSnapshot, 'metadata')).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    document.metadata = invalidSnapshot;
    const order = [];
    const full = spyCollection(order, 'full', document);
    const partial = spyCollection(order, 'partial', { classId: document.classId });
    const dbManager = {
      getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
    };
    const validation = new ABClassValidation();
    const persistence = new ABClassPersistence({ dbManager, validation });
    const ops = new ABClassMutationOps({
      dbManager,
      validation,
      persistence,
      roster: {},
      responseMapper: { _buildClassSummary: vi.fn() },
    });

    expect(() => ops.updateABClass({ classId: document.classId, active: false })).toThrow(
      globalThis.ABClassMetadataValidationError
    );
    for (const store of [full, partial]) {
      for (const method of ['insertOne', 'replaceOne', 'updateOne', 'save']) {
        expect(store[method]).not.toHaveBeenCalled();
      }
    }
  });
});
