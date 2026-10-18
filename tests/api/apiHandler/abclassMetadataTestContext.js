const { restoreGlobals, saveGlobals } = require('#test-helpers/globalMockManager.js');
const {
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  loadApiHandlerModule,
} = require('#test-helpers/apiHandlerTestUtils.js');
function createCollection(vi, rows) {
  let records = structuredClone(rows);
  const collection = {
    findOne: vi.fn((query) =>
      structuredClone(
        records.find((row) => Object.entries(query).every(([key, value]) => row[key] === value)) ??
          null
      )
    ),
    find: vi.fn(() => structuredClone(records)),
    insertOne: vi.fn((row) => {
      records.push(structuredClone(row));
      return { insertedId: 'db-id', acknowledged: true };
    }),
    replaceOne: vi.fn((query, row) => {
      const index = records.findIndex((entry) =>
        Object.entries(query).every(([key, value]) => entry[key] === value)
      );
      if (index >= 0) records[index] = structuredClone(row);
      return {
        matchedCount: index >= 0 ? 1 : 0,
        modifiedCount: index >= 0 ? 1 : 0,
        acknowledged: true,
      };
    }),
    updateOne: vi.fn((query, update) => {
      const row = records.find((entry) =>
        Object.entries(query).every(([key, value]) => entry[key] === value)
      );
      if (row) Object.assign(row, structuredClone(update.$set));
      return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0, acknowledged: true };
    }),
    deleteOne: vi.fn(() => ({ deletedCount: 0, acknowledged: true })),
    save: vi.fn(() => ({ acknowledged: true })),
    rows: () => structuredClone(records),
  };
  return collection;
}

function setupRealAbclassDispatcher(vi, canonical, { classId, partialRows }) {
  const seams = setupApiHandlerTestContext(vi, { installLogger: true, installLock: true });
  const globals = saveGlobals([
    'ABClassController',
    'ABClass',
    'Teacher',
    'DbManager',
    'ClassroomApiClient',
    'getABClass_',
    'upsertABClass_',
    'updateABClass_',
    'deleteABClass_',
  ]);
  const source = canonical.classesById[classId];
  const selectedId = source.classId;
  const full = createCollection(vi, [{ ...structuredClone(source), _id: 'full-row' }]);
  const partial = createCollection(vi, partialRows);
  const manager = {
    getCollection: vi.fn((name) => (name === 'abclass_partials' ? partial : full)),
    getDb: vi.fn(() => ({ dropCollection: vi.fn(() => true) })),
  };
  globalThis.DbManager = { getInstance: () => manager };
  globalThis.ClassroomApiClient = {
    fetchCourse: vi.fn(() => ({ id: selectedId, name: source.className, ownerId: null })),
    fetchTeachers: vi.fn(() => []),
    fetchAllStudents: vi.fn(() => []),
  };
  globalThis.ABClass = require('#backend/Models/ABClass.js').ABClass;
  globalThis.Teacher = require('#backend/Models/Teacher.js').Teacher;
  globalThis.ABClassController = require('#backend/y_controllers/ABClassController/index.js');
  Object.assign(globalThis, require('#backend/z_Api/abclass/abclassMutations.js'));
  Object.assign(globalThis, require('#backend/z_Api/abclass/abclassRead.js'));
  const api = loadApiHandlerModule();
  return {
    api,
    classId: selectedId,
    source,
    full,
    partial,
    manager,
    classroom: globalThis.ClassroomApiClient,
    globals,
    seams,
  };
}

function teardownRealAbclassDispatcher(vi, context) {
  restoreGlobals(context.globals);
  teardownApiHandlerTestContext(vi, context.seams);
}

module.exports = { setupRealAbclassDispatcher, teardownRealAbclassDispatcher };
