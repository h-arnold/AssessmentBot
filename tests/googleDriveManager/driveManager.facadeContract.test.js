/**
 * DriveManager facade contract and load-order regression coverage.
 *
 * Verifies the file-ID format helper, the exact public API surface, method
 * delegation to the focused sub-classes, and the GAS concatenation load-order
 * contract (the facade must evaluate only after its sub-class globals exist).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import DriveManager from '../../src/backend/GoogleDriveManager/DriveManager/index.js';

const FACADE_PATH = new URL(
  '../../src/backend/GoogleDriveManager/DriveManager/index.js',
  import.meta.url
);
const FACADE_SOURCE = readFileSync(FACADE_PATH, 'utf8');

const EXPECTED_API_METHODS = [
  'moveFiles',
  'copyTemplateSheet',
  '_validateFolderExists',
  'shareFolder',
  'getParentFolderId',
  '_getParentViaDriveApp',
  '_getParentViaDriveApi',
  'createFolder',
  'isValidGoogleDriveFileId',
  'normaliseToFileId',
  'getFileModifiedTime',
  '_fetchModifiedTimeViaDriveApp',
  '_fetchModifiedTimeViaDriveApi',
];

const SUBCLASS_GLOBALS = [
  'DriveManagerFolderValidator',
  'DriveManagerFileOperations',
  'DriveManagerFolderOperations',
  'DriveManagerFileId',
  'DriveManagerModifiedTime',
];

/**
 * Evaluates the facade source in a fresh VM context, mirroring the GAS
 * concatenated script environment where the facade resolves sub-classes as globals.
 *
 * @param {Object} [globals] - Sub-class constructors to expose to the facade.
 * @returns {Object} The evaluated DriveManager facade.
 */
function evaluateFacade(globals = {}) {
  const context = { module: { exports: {} }, ...globals };
  context.globalThis = context;
  createContext(context);
  runInContext(FACADE_SOURCE, context);
  return context.module.exports;
}

const DELEGATION_CASES = [
  {
    collaborator: 'DriveManagerFileOperations',
    method: 'moveFiles',
    invoke: () => DriveManager.moveFiles('destination', ['file']),
    expectedArguments: ['destination', ['file'], ''],
  },
  {
    collaborator: 'DriveManagerFileOperations',
    method: 'copyTemplateSheet',
    invoke: () => DriveManager.copyTemplateSheet('template', 'destination', 'Name'),
    expectedArguments: ['template', 'destination', 'Name'],
  },
  {
    collaborator: 'DriveManagerFolderValidator',
    method: 'validateFolderExists',
    invoke: () => DriveManager._validateFolderExists('folder'),
    expectedArguments: ['folder'],
  },
  {
    collaborator: 'DriveManagerFolderOperations',
    method: 'shareFolder',
    invoke: () => DriveManager.shareFolder('folder', new Set()),
    expectedArguments: ['folder', expect.any(Set)],
  },
  {
    collaborator: 'DriveManagerFolderOperations',
    method: 'getParentFolderId',
    invoke: () => DriveManager.getParentFolderId('file'),
    expectedArguments: ['file'],
  },
  {
    collaborator: 'DriveManagerFolderOperations',
    method: '_getParentViaDriveApp',
    invoke: () => DriveManager._getParentViaDriveApp('file'),
    expectedArguments: ['file'],
  },
  {
    collaborator: 'DriveManagerFolderOperations',
    method: '_getParentViaDriveApi',
    invoke: () => DriveManager._getParentViaDriveApi('file'),
    expectedArguments: ['file'],
  },
  {
    collaborator: 'DriveManagerFolderOperations',
    method: 'createFolder',
    invoke: () => DriveManager.createFolder('parent', 'Name'),
    expectedArguments: ['parent', 'Name'],
  },
  {
    collaborator: 'DriveManagerFileId',
    method: 'isValidGoogleDriveFileId',
    invoke: () => DriveManager.isValidGoogleDriveFileId('file'),
    expectedArguments: ['file'],
  },
  {
    collaborator: 'DriveManagerFileId',
    method: 'normaliseToFileId',
    invoke: () => DriveManager.normaliseToFileId('input'),
    expectedArguments: ['input'],
  },
  {
    collaborator: 'DriveManagerModifiedTime',
    method: 'getFileModifiedTime',
    invoke: () => DriveManager.getFileModifiedTime('file'),
    expectedArguments: ['file'],
  },
  {
    collaborator: 'DriveManagerModifiedTime',
    method: '_fetchModifiedTimeViaDriveApp',
    invoke: () => DriveManager._fetchModifiedTimeViaDriveApp('file', 3, 500),
    expectedArguments: ['file', 3, 500],
  },
  {
    collaborator: 'DriveManagerModifiedTime',
    method: '_fetchModifiedTimeViaDriveApi',
    invoke: () => DriveManager._fetchModifiedTimeViaDriveApi('file', 3, 500),
    expectedArguments: ['file', 3, 500],
  },
];

describe('DriveManager.isValidGoogleDriveFileId', () => {
  it('accepts 33-character identifiers', () => {
    expect(DriveManager.isValidGoogleDriveFileId('a'.repeat(33))).toBe(true);
  });

  it('accepts 44-character identifiers', () => {
    expect(DriveManager.isValidGoogleDriveFileId('a'.repeat(44))).toBe(true);
  });

  it('accepts identifiers containing hyphens and underscores', () => {
    const fileId = `${'-'.repeat(16)}_${'a'.repeat(16)}`;
    expect(DriveManager.isValidGoogleDriveFileId(fileId)).toBe(true);
  });

  it('rejects identifiers shorter than 33 characters', () => {
    expect(DriveManager.isValidGoogleDriveFileId('a'.repeat(32))).toBe(false);
  });

  it('rejects identifiers longer than 44 characters', () => {
    expect(DriveManager.isValidGoogleDriveFileId('a'.repeat(45))).toBe(false);
  });

  it('rejects identifiers containing invalid characters', () => {
    expect(DriveManager.isValidGoogleDriveFileId(`${'a'.repeat(32)}!`)).toBe(false);
  });

  it('rejects empty and non-string inputs without throwing', () => {
    expect(DriveManager.isValidGoogleDriveFileId('')).toBe(false);
    expect(DriveManager.isValidGoogleDriveFileId(null)).toBe(false);
    expect(DriveManager.isValidGoogleDriveFileId(undefined)).toBe(false);
  });
});

describe('DriveManager facade contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the complete file and folder operation API surface', () => {
    expect(Object.keys(DriveManager).sort()).toEqual([...EXPECTED_API_METHODS].sort());

    for (const methodName of EXPECTED_API_METHODS) {
      expect(typeof DriveManager[methodName]).toBe('function');
    }
  });

  it('delegates every public method to its focused collaborator', () => {
    for (const testCase of DELEGATION_CASES) {
      const spy = vi
        .spyOn(globalThis[testCase.collaborator].prototype, testCase.method)
        .mockReturnValue(undefined);

      testCase.invoke();

      expect(spy).toHaveBeenCalledWith(...testCase.expectedArguments);
      spy.mockRestore();
    }
  });

  it('relies on prior-loaded globals rather than Node module imports', () => {
    expect(FACADE_SOURCE).not.toMatch(/\brequire\s*\(/u);
    expect(FACADE_SOURCE).not.toMatch(/^\s*import\s/mu);
  });

  it('fails to evaluate when the sub-class globals have not been loaded first', () => {
    let thrownError;
    try {
      evaluateFacade();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeDefined();
    // The ReferenceError is created by the VM realm, so assert on name/message
    // rather than cross-realm instanceof.
    expect(thrownError.name).toBe('ReferenceError');
    expect(thrownError.message).toContain('DriveManagerFolderValidator is not defined');
  });

  it('evaluates once every sub-class global is available', () => {
    const globals = Object.fromEntries(SUBCLASS_GLOBALS.map((name) => [name, globalThis[name]]));

    const facade = evaluateFacade(globals);

    expect(Object.keys(facade).sort()).toEqual([...EXPECTED_API_METHODS].sort());
  });
});
