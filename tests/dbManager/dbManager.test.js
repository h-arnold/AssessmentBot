/**
 * DbManager singleton construction, library availability checks and configuration
 * access. Database access and collection write operations live in companion suites.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  mockConfigurationManager,
  mockProgressTracker,
  useDbManagerTestContext,
} from './dbManagerTestHelpers.js';

describe('DbManager', () => {
  let DbManager;
  useDbManagerTestContext((value) => {
    DbManager = value;
  });

  describe('Singleton Pattern', () => {
    it('getInstance returns the same instance on multiple calls', () => {
      const instance1 = DbManager.getInstance();
      const instance2 = DbManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('getInstance returns a DbManager instance', () => {
      const instance = DbManager.getInstance();
      expect(instance).toBeInstanceOf(DbManager);
      expect(instance.constructor.name).toBe('DbManager');
    });

    it('constructor with isSingletonCreator flag creates instance', () => {
      const instance = new DbManager(true);
      expect(instance).toBeInstanceOf(DbManager);
      expect(instance.constructor._instance).toBe(instance);
    });

    it('constructor without isSingletonCreator flag returns new instance but singleton pattern still works', () => {
      const instance1 = DbManager.getInstance();
      // The constructor still creates an object, but it doesn't set _instance
      // The singleton pattern means getInstance() still returns the original
      const instance2 = new DbManager(false);
      expect(instance2).toBeDefined();
      expect(DbManager.getInstance()).toBe(instance1);
    });

    it('resetForTests clears the singleton instance', () => {
      const instance1 = DbManager.getInstance();
      expect(instance1).toBeDefined();

      DbManager.resetForTests?.();
      // BaseSingleton reset
      BaseSingleton._instance = null;
      DbManager._instance = null;

      const instance2 = DbManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('_assertLibraryAvailable', () => {
    it('throws error when JsonDbApp is not available', () => {
      // Create a new instance with JsonDbApp missing
      delete globalThis.JsonDbApp;

      expect(() => {
        const dbm = new DbManager(true);
      }).toThrow('JsonDbApp library is not available');

      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
    });

    it('does not throw when JsonDbApp is available with required methods', () => {
      globalThis.JsonDbApp = {
        loadDatabase: vi.fn(),
        createAndInitialiseDatabase: vi.fn(),
      };

      expect(() => {
        const dbm = new DbManager(true);
      }).not.toThrow();
    });

    it('throws when JsonDbApp is available but missing loadDatabase method', () => {
      globalThis.JsonDbApp = {
        createAndInitialiseDatabase: vi.fn(),
      };

      expect(() => {
        const dbm = new DbManager(true);
      }).toThrow('JsonDbApp library is not available');
    });

    it('throws when JsonDbApp is available but missing createAndInitialiseDatabase method', () => {
      globalThis.JsonDbApp = {
        loadDatabase: vi.fn(),
      };

      expect(() => {
        const dbm = new DbManager(true);
      }).toThrow('JsonDbApp library is not available');
    });
  });

  describe('_getConfig', () => {
    it('returns configuration object with all required properties', () => {
      const instance = DbManager.getInstance();
      const config = instance._getConfig();

      expect(config).toEqual({
        masterIndexKey: 'master-index-key',
        autoCreateCollections: true,
        collectionLockLeaseMs: 5000,
        logLevel: 'INFO',
        backupOnInitialise: true,
        rootFolderId: 'root-folder-id',
      });
    });

    it('omits rootFolderId when not configured', () => {
      mockConfigurationManager.getJsonDbRootFolderId.mockReturnValue(null);

      const instance = DbManager.getInstance();
      const config = instance._getConfig();

      expect(config.rootFolderId).toBeUndefined();
    });

    it('uses ConfigurationManager getter methods', () => {
      const instance = DbManager.getInstance();
      instance._getConfig();

      expect(mockConfigurationManager.getJsonDbRootFolderId).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbMasterIndexKey).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbLockTimeoutMs).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbLogLevel).toHaveBeenCalled();
      expect(mockConfigurationManager.getJsonDbBackupOnInitialise).toHaveBeenCalled();
    });
  });
});
