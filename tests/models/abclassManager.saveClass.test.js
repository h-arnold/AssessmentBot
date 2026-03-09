const ABClassController = require('../../src/backend/y_controllers/ABClassController');

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
    delete globalThis.DbManager;
  });

  test('calls replaceOne when a document exists', () => {
    const abClass = {
      classId: 'class-1',
      name: 'Test',
      toPartialJSON: vi.fn().mockReturnValue({ classId: 'class-1' }),
    };
    collectionMock.findOne.mockReturnValue({ classId: 'class-1' });

    const result = manager.saveClass(abClass);

    expect(collectionMock.findOne).toHaveBeenCalledWith({ classId: 'class-1' });
    expect(collectionMock.replaceOne).toHaveBeenCalledWith({ classId: 'class-1' }, abClass);
    expect(collectionMock.insertOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('calls insertOne when no document exists', () => {
    const abClass = {
      classId: 'class-2',
      name: 'Test 2',
      toPartialJSON: vi.fn().mockReturnValue({ classId: 'class-2' }),
    };
    collectionMock.findOne.mockReturnValue(null);

    const result = manager.saveClass(abClass);

    expect(collectionMock.findOne).toHaveBeenCalledWith({ classId: 'class-2' });
    expect(collectionMock.insertOne).toHaveBeenCalledWith(abClass);
    expect(collectionMock.replaceOne).not.toHaveBeenCalled();
    expect(collectionMock.save).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('throws when input is not an object', () => {
    expect(() => manager.saveClass(null)).toThrow(
      'saveClass: expected an ABClass instance or plain object with classId and toPartialJSON()'
    );
  });

  test('throws when classId is missing', () => {
    expect(() => manager.saveClass({ toPartialJSON: vi.fn() })).toThrow(
      'saveClass: missing required classId property on abClass argument'
    );
  });

  test('throws when classId is blank', () => {
    expect(() => manager.saveClass({ classId: '   ', toPartialJSON: vi.fn() })).toThrow(
      'saveClass: expected abClass.classId to be a non-empty string'
    );
  });

  test('throws when classId contains traversal segments', () => {
    expect(() => manager.saveClass({ classId: '../class-1', toPartialJSON: vi.fn() })).toThrow(
      'saveClass: invalid classId format'
    );
  });

  test('throws when toPartialJSON is missing', () => {
    expect(() => manager.saveClass({ classId: 'class-1' })).toThrow(
      'saveClass: expected abClass.toPartialJSON() to be a function for partial persistence'
    );
  });
});
