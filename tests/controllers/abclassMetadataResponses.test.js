import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { restoreGlobals, saveGlobals } from '#test-helpers/globalMockManager.js';
const ABClass = require('#backend/Models/ABClass.js').ABClass;
const ABClassController = require('#backend/y_controllers/ABClassController/index.js');
const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');
const ClassNotFoundError = require('#backend/Utils/ErrorTypes/ClassNotFoundError.js');
const { getABClass_ } = require('#backend/z_Api/abclass/abclassRead.js');
const {
  createMockCollection,
  setupControllerTestMocks,
  cleanupControllerTestMocks,
} = require('../helpers/mockFactories.js');

const inputs = loadBackendModelInputs('small');
const sourceClass = Object.values(inputs.classesById).find((value) => value.metadata !== null);
const metadata = sourceClass.metadata;

function clone(value) {
  return structuredClone(value);
}

let collection;
let partials;
let savedGlobals;
let ensureDefinition;
let classroomApi;

beforeEach(() => {
  savedGlobals = saveGlobals([
    'ABClass',
    'Teacher',
    'Assignment',
    'ABClassController',
    'DateUtils',
  ]);
  setupControllerTestMocks(vi);
  collection = createMockCollection(vi);
  partials = createMockCollection(vi);
  const dbManager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partials : collection)),
  };
  globalThis.DbManager = { getInstance: () => dbManager };
  globalThis.ABClass = ABClass;
  globalThis.Teacher = require('#backend/Models/Teacher.js').Teacher;
  globalThis.Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
  ensureDefinition = vi.fn();
  globalThis.AssignmentDefinitionController = class {
    ensureDefinition(...args) {
      return ensureDefinition(...args);
    }
  };
  classroomApi = {
    fetchCourse: vi.fn(),
    fetchTeachers: vi.fn(),
    fetchAllStudents: vi.fn(),
  };
  globalThis.ClassroomApiClient = classroomApi;
});

afterEach(() => {
  cleanupControllerTestMocks();
  restoreGlobals(savedGlobals);
  vi.restoreAllMocks();
});

describe('ABClass metadata response projections', () => {
  it('includes equal, detached metadata in registry, full-read, and summary responses', () => {
    const mapper = new ABClassResponseMapper();
    const partialInput = {
      ...clone(inputs.classPartials[0]),
      metadata: clone(metadata),
      _id: 'stored',
    };
    const partial = mapper._normaliseClassPartial(partialInput);
    const model = ABClass.fromJSON({ ...clone(sourceClass), metadata: clone(metadata) });
    const full = mapper._toReadView(model);
    const summary = mapper._buildClassSummary(model);

    expect.soft(partial.metadata).toEqual(metadata);
    expect.soft(full.metadata).toEqual(metadata);
    expect.soft(summary.metadata).toEqual(metadata);
    expect(partial).not.toHaveProperty('_id');
    expect(new Set([partial.metadata, full.metadata, summary.metadata]).size).toBe(3);
    if (partial.metadata) partial.metadata.classAverages.completeness = 0;
    if (full.metadata?.recentAssignments[0]) {
      full.metadata.recentAssignments[0].averages.accuracy = 0;
    }
    expect(summary.metadata).toEqual(metadata);
    expect(model.metadata).toEqual(metadata);
    expect(partialInput.metadata).toEqual(metadata);
    expect(() => JSON.stringify(full)).not.toThrow();
    collection.findOne.mockReturnValue(clone(sourceClass));
    expect(new ABClassController().readClass(sourceClass.classId).metadata).toEqual(metadata);
  });

  it('emits null for legacy partial/full absence and for an existing null-metadata class', () => {
    const mapper = new ABClassResponseMapper();
    const legacyPartial = mapper._normaliseClassPartial({
      classId: 'legacy',
      teachers: [],
    });
    const legacyModel = ABClass.fromJSON({ classId: 'legacy', assignments: [] });
    const explicitNull = ABClass.fromJSON({ classId: 'null', metadata: null, assignments: [] });

    expect.soft(legacyPartial.metadata).toBeNull();
    expect.soft(mapper._toReadView(legacyModel)).toHaveProperty('metadata', null);
    expect(mapper._toReadView(explicitNull)).toHaveProperty('metadata', null);
  });

  it('rejects invalid stored partial/full metadata without writing or substituting data', () => {
    const invalid = clone(metadata);
    invalid.classAverages.completeness = 9;
    const mapper = new ABClassResponseMapper();
    expect
      .soft(() =>
        mapper._normaliseClassPartial({ classId: 'bad', teachers: [], metadata: invalid })
      )
      .toThrow(/metadata\.classAverages\.completeness/);
    expect(() => ABClass.fromJSON({ ...clone(sourceClass), metadata: invalid })).toThrow(
      /metadata\.classAverages\.completeness/
    );

    collection.findOne.mockReturnValue({ ...clone(sourceClass), metadata: invalid });
    expect(() => new ABClassController().readClass(sourceClass.classId)).toThrow(
      /metadata\.classAverages\.completeness/
    );
    expect(collection.insertOne).not.toHaveBeenCalled();
    expect(collection.save).not.toHaveBeenCalled();
    expect(collection.updateOne).not.toHaveBeenCalled();
    expect(collection.replaceOne).not.toHaveBeenCalled();
  });

  it('maps a missing full class to top-level null and preserves existing null metadata', () => {
    globalThis.ABClassController = class {
      readClass() {
        throw new ClassNotFoundError('missing', { courseId: 'absent' });
      }
    };
    const dateUtils = globalThis.DateUtils;
    globalThis.DateUtils = { ...dateUtils, deepConvertDates: vi.fn((value) => value) };
    expect(getABClass_({ classId: 'absent' })).toBeNull();

    collection.findOne.mockReturnValue({ classId: 'present', metadata: null, assignments: [] });
    globalThis.ABClassController = ABClassController;
    expect.soft(new ABClassController().readClass('present')).toMatchObject({
      classId: 'present',
      metadata: null,
    });
    expect(JSON.stringify(new ABClassController().readClass('present'))).toBeTruthy();
  });

  it('keeps partial-list reads registry-only and leaves an empty registry empty', () => {
    const manager = globalThis.DbManager.getInstance();
    const controller = new ABClassController();
    partials.find.mockReturnValue([{ classId: 'listed', teachers: [], metadata: clone(metadata) }]);

    expect.soft(controller.getAllClassPartials()[0].metadata).toEqual(metadata);
    expect(manager.getCollection).toHaveBeenCalledTimes(1);
    expect(manager.getCollection).toHaveBeenCalledWith('abclass_partials');
    expect(partials.find).toHaveBeenCalledWith({});
    expect(collection.findOne).not.toHaveBeenCalled();
    expect(collection.find).not.toHaveBeenCalled();
    expect(ensureDefinition).not.toHaveBeenCalled();
    expect(classroomApi.fetchCourse).not.toHaveBeenCalled();
    expect(classroomApi.fetchTeachers).not.toHaveBeenCalled();
    expect(classroomApi.fetchAllStudents).not.toHaveBeenCalled();
    expect(partials.insertOne).not.toHaveBeenCalled();
    partials.find.mockReturnValue([]);
    expect(controller.getAllClassPartials()).toEqual([]);
  });
});
