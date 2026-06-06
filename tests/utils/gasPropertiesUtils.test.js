/**
 * RED-phase tests for GASPropertiesUtils utility class.
 *
 * These tests are expected to FAIL because the production source file
 * (src/backend/Utils/00_GASPropertiesUtils.js) does not yet exist.
 *
 * GASPropertiesUtils is a static-only utility class that provides a single
 * entry point for PropertiesService operations (ScriptProperties and
 * UserProperties), following the same pattern as ArrayUtils.
 *
 * Methods to be tested:
 *   - getScriptProperties() → PropertiesService.getScriptProperties()
 *   - getUserProperties()   → PropertiesService.getUserProperties()
 *   - applyProperties(properties, propertyMap)
 *   - clearProperties(properties, keys)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// This require will throw MODULE_NOT_FOUND at load time because the
// production file does not exist yet. That is the intended RED behaviour.
// The entire test file will fail to load, signalling a RED phase.
const GASPropertiesUtils = require('../../src/backend/Utils/00_GASPropertiesUtils.js');

describe('GASPropertiesUtils', () => {
  let mockScriptProperties;
  let mockUserProperties;
  let mockPropertiesService;

  beforeEach(() => {
    mockScriptProperties = {
      setProperty: vi.fn(),
      getProperty: vi.fn(),
      getKeys: vi.fn().mockReturnValue([]),
      deleteProperty: vi.fn(),
    };

    mockUserProperties = {
      setProperty: vi.fn(),
      getProperty: vi.fn(),
      getKeys: vi.fn().mockReturnValue([]),
      deleteProperty: vi.fn(),
    };

    mockPropertiesService = {
      getScriptProperties: vi.fn().mockReturnValue(mockScriptProperties),
      getUserProperties: vi.fn().mockReturnValue(mockUserProperties),
    };

    globalThis.PropertiesService = mockPropertiesService;
  });

  describe('getScriptProperties', () => {
    it('calls PropertiesService.getScriptProperties() and returns the result', () => {
      const result = GASPropertiesUtils.getScriptProperties();
      expect(mockPropertiesService.getScriptProperties).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockScriptProperties);
    });
  });

  describe('getUserProperties', () => {
    it('calls PropertiesService.getUserProperties() and returns the result', () => {
      const result = GASPropertiesUtils.getUserProperties();
      expect(mockPropertiesService.getUserProperties).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockUserProperties);
    });
  });

  describe('applyProperties', () => {
    it('sets each key-value pair from propertyMap on the given properties store', () => {
      const propertyMap = {
        keyOne: 'valueOne',
        keyTwo: 'valueTwo',
      };

      GASPropertiesUtils.applyProperties(mockScriptProperties, propertyMap);

      expect(mockScriptProperties.setProperty).toHaveBeenCalledTimes(2);
      expect(mockScriptProperties.setProperty).toHaveBeenCalledWith('keyOne', 'valueOne');
      expect(mockScriptProperties.setProperty).toHaveBeenCalledWith('keyTwo', 'valueTwo');
    });

    it('does not throw when propertyMap is empty', () => {
      expect(() => {
        GASPropertiesUtils.applyProperties(mockScriptProperties, {});
      }).not.toThrow();
      expect(mockScriptProperties.setProperty).not.toHaveBeenCalled();
    });
  });

  describe('clearProperties', () => {
    it('deletes each key in keys from the given properties store', () => {
      const keys = ['keyOne', 'keyTwo', 'keyThree'];

      GASPropertiesUtils.clearProperties(mockUserProperties, keys);

      expect(mockUserProperties.deleteProperty).toHaveBeenCalledTimes(3);
      expect(mockUserProperties.deleteProperty).toHaveBeenCalledWith('keyOne');
      expect(mockUserProperties.deleteProperty).toHaveBeenCalledWith('keyTwo');
      expect(mockUserProperties.deleteProperty).toHaveBeenCalledWith('keyThree');
    });

    it('does not throw when keys array is empty', () => {
      expect(() => {
        GASPropertiesUtils.clearProperties(mockUserProperties, []);
      }).not.toThrow();
      expect(mockUserProperties.deleteProperty).not.toHaveBeenCalled();
    });
  });
});
