const ABClassController = require('../../src/AdminSheet/y_controllers/ABClassController');

describe('ABClassController.saveClass', () => {
  let manager;
  let dbManagerMock;
  let collectionMock;

  beforeEach(() => {
    collectionMock = {
      findOne: vi.fn(),
      replaceOne: vi.fn(),
      insertOne: vi.fn(),
      save: vi.fn(),
    };

    dbManagerMock = {
      getCollection: vi.fn().mockReturnValue(collectionMock),
    };

    // Inject mock DbManager instance
    globalThis.DbManager = { getInstance: () => dbManagerMock };
    // Now construct manager which will call DbManager.getInstance()
    manager = new ABClassController();
  });

  afterEach(() => {
    // Clean up global to avoid cross-test pollution
    try {
      delete globalThis.DbManager;
    } catch (e) {
      globalThis.DbManager = undefined;
    }
  });

  test('calls replaceOne when a document exists', () => {
    const abClass = { classId: 'class-1', name: 'Test' };
    collectionMock.findOne.mockReturnValue({ classId: 'class-1' });

    const result = manager.saveClass(abClass);

    expect(collectionMock.findOne).toHaveBeenCalledWith({ classId: 'class-1' });
    expect(collectionMock.replaceOne).toHaveBeenCalledWith({ classId: 'class-1' }, abClass);
    expect(collectionMock.insertOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('calls insertOne when no document exists', () => {
    const abClass = { classId: 'class-2', name: 'Test 2' };
    collectionMock.findOne.mockReturnValue(null);

    const result = manager.saveClass(abClass);

    expect(collectionMock.findOne).toHaveBeenCalledWith({ classId: 'class-2' });
    expect(collectionMock.insertOne).toHaveBeenCalledWith(abClass);
    expect(collectionMock.replaceOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
