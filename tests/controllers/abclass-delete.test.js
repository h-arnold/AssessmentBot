import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

let ABClassController;
let mockDbManager;
let partialsCollection;
let dropCollectionSpy;

function createMissingCollectionError() {
  const error = new Error('Collection missing');
  error.code = 'COLLECTION_NOT_FOUND';
  return error;
}

function loadControllerModule() {
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController.js')];
  ABClassController = require('../../src/backend/y_controllers/ABClassController.js');
}

function createDeleteHarness({
  partialDoc = { classId: 'class-001' },
  dropCollectionImpl,
  deleteOneImpl,
  saveImpl,
} = {}) {
  partialsCollection = createMockCollection(vi, {
    overrides: {
      findOne: vi.fn().mockReturnValue(partialDoc),
      deleteOne: deleteOneImpl ? vi.fn(deleteOneImpl) : vi.fn(),
      save: saveImpl ? vi.fn(saveImpl) : vi.fn(),
    },
  });

  dropCollectionSpy = dropCollectionImpl ? vi.fn(dropCollectionImpl) : vi.fn();

  const dropCollection = vi.fn((classId) => dropCollectionSpy(classId));

  mockDbManager = {
    dropCollection,
    getDb: vi.fn(() => ({
      dropCollection,
    })),
    getCollection: vi.fn((name) => {
      if (name === 'abclass_partials') {
        return partialsCollection;
      }

      throw new Error(`Unexpected collection requested in delete harness: ${name}`);
    }),
  };

  globalThis.DbManager = { getInstance: () => mockDbManager };
}

beforeEach(() => {
  setupControllerTestMocks(vi);
  createDeleteHarness();
  loadControllerModule();
});

afterEach(() => {
  cleanupControllerTestMocks();
  delete require.cache[require.resolve('../../src/backend/y_controllers/ABClassController.js')];
  vi.restoreAllMocks();
});

describe('ABClassController delete orchestration (Section 4 RED)', () => {
  it('deletes the full class collection via dropCollection(classId)', () => {
    const controller = new ABClassController();

    controller.deleteABClass({ classId: 'class-001' });

    expect(dropCollectionSpy).toHaveBeenCalledTimes(1);
    expect(dropCollectionSpy).toHaveBeenCalledWith('class-001');
  });

  it('calls partialsCollection.deleteOne({ classId }) and partialsCollection.save()', () => {
    const controller = new ABClassController();

    controller.deleteABClass({ classId: 'class-001' });

    expect(mockDbManager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(partialsCollection.findOne).toHaveBeenCalledWith({ classId: 'class-001' });
    expect(partialsCollection.deleteOne).toHaveBeenCalledTimes(1);
    expect(partialsCollection.deleteOne).toHaveBeenCalledWith({ classId: 'class-001' });
    expect(partialsCollection.save).toHaveBeenCalledTimes(1);
  });

  it('returns both delete flags true when the full collection and partial both exist', () => {
    const controller = new ABClassController();

    expect(controller.deleteABClass({ classId: 'class-001' })).toEqual({
      classId: 'class-001',
      fullClassDeleted: true,
      partialDeleted: true,
    });
  });

  it('returns false flags for an idempotent repeat delete when both full collection and partial are already missing', () => {
    createDeleteHarness({
      partialDoc: null,
      dropCollectionImpl: () => {
        throw createMissingCollectionError();
      },
    });
    loadControllerModule();
    const controller = new ABClassController();

    expect(controller.deleteABClass({ classId: 'class-001' })).toEqual({
      classId: 'class-001',
      fullClassDeleted: false,
      partialDeleted: false,
    });
    expect(partialsCollection.deleteOne).not.toHaveBeenCalled();
    expect(partialsCollection.save).not.toHaveBeenCalled();
  });

  it('returns mixed flags when the full collection exists but the partial is already missing', () => {
    createDeleteHarness({ partialDoc: null });
    loadControllerModule();
    const controller = new ABClassController();

    expect(controller.deleteABClass({ classId: 'class-001' })).toEqual({
      classId: 'class-001',
      fullClassDeleted: true,
      partialDeleted: false,
    });
  });

  it('returns mixed flags when the partial exists but the full collection is already missing', () => {
    createDeleteHarness({
      partialDoc: { classId: 'class-001' },
      dropCollectionImpl: () => {
        throw createMissingCollectionError();
      },
    });
    loadControllerModule();
    const controller = new ABClassController();

    expect(controller.deleteABClass({ classId: 'class-001' })).toEqual({
      classId: 'class-001',
      fullClassDeleted: false,
      partialDeleted: true,
    });
    expect(partialsCollection.deleteOne).toHaveBeenCalledWith({ classId: 'class-001' });
    expect(partialsCollection.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing params', undefined],
    ['missing classId', {}],
    ['empty classId', { classId: '   ' }],
    ['unsafe classId', { classId: '../class-001' }],
  ])('rejects invalid delete input for %s', (_caseName, params) => {
    const controller = new ABClassController();

    expect(() => controller.deleteABClass(params)).toThrow(/classId|params|invalid|unsafe/i);
    expect(dropCollectionSpy).not.toHaveBeenCalled();
    expect(partialsCollection.deleteOne).not.toHaveBeenCalled();
    expect(partialsCollection.save).not.toHaveBeenCalled();
  });

  it('rethrows unexpected dropCollection failures loudly', () => {
    createDeleteHarness({
      dropCollectionImpl: () => {
        throw new Error('dropCollection exploded');
      },
    });
    loadControllerModule();
    const controller = new ABClassController();

    expect(() => controller.deleteABClass({ classId: 'class-001' })).toThrow(
      'dropCollection exploded'
    );
  });

  it('rethrows partial registry persistence failures loudly', () => {
    createDeleteHarness({
      saveImpl: () => {
        throw new Error('partials save exploded');
      },
    });
    loadControllerModule();
    const controller = new ABClassController();

    expect(() => controller.deleteABClass({ classId: 'class-001' })).toThrow(
      'partials save exploded'
    );
    expect(dropCollectionSpy).toHaveBeenCalledWith('class-001');
    expect(partialsCollection.deleteOne).toHaveBeenCalledWith({ classId: 'class-001' });
  });
});
