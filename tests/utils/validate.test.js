import { describe, it, expect } from 'vitest';
import { Validate } from '../../src/backend/Utils/Validate.js';

describe('Validate utility', () => {
  describe('primitive helpers', () => {
    it('checks for strings', () => {
      expect(Validate.isString('hello')).toBe(true);
      expect(Validate.isString(123)).toBe(false);
      expect(Validate.isString(null)).toBe(false);
    });

    it('checks for non-empty strings', () => {
      expect(Validate.isNonEmptyString('hello')).toBe(true);
      expect(Validate.isNonEmptyString('   ')).toBe(false);
      expect(Validate.isNonEmptyString(undefined)).toBe(false);
    });

    it('checks for numbers', () => {
      expect(Validate.isNumber(42)).toBe(true);
      expect(Validate.isNumber(NaN)).toBe(false);
      expect(Validate.isNumber('42')).toBe(false);
    });

    it('checks for booleans', () => {
      expect(Validate.isBoolean(true)).toBe(true);
      expect(Validate.isBoolean(false)).toBe(true);
      expect(Validate.isBoolean('true')).toBe(false);
    });
  });

  describe('isEmail', () => {
    it('accepts valid emails', () => {
      expect(Validate.isEmail('teacher@example.com')).toBe(true);
      expect(Validate.isEmail('first.last+tag@sub.domain.co.uk')).toBe(true);
      expect(Validate.isEmail('a@b.co')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(Validate.isEmail('not-an-email')).toBe(false);
      expect(Validate.isEmail('missing-at-sign.com')).toBe(false);
      expect(Validate.isEmail('name@.com')).toBe(false);
      expect(Validate.isEmail('')).toBe(false);
      expect(Validate.isEmail(null)).toBe(false);
    });
  });

  describe('isGoogleUserId', () => {
    it('accepts numeric userIds', () => {
      expect(Validate.isGoogleUserId('12345678901234567890')).toBe(true);
      expect(Validate.isGoogleUserId(987654321)).toBe(true);
    });

    it('accepts alphanumeric ids of reasonable length', () => {
      expect(Validate.isGoogleUserId('abcDEF_123-xyz')).toBe(true);
      expect(Validate.isGoogleUserId('user.id-01')).toBe(true);
    });

    it('rejects too short or invalid ids', () => {
      expect(Validate.isGoogleUserId('123')).toBe(false);
      expect(Validate.isGoogleUserId('!@#$%')).toBe(false);
      expect(Validate.isGoogleUserId('')).toBe(false);
      expect(Validate.isGoogleUserId(null)).toBe(false);
    });
  });

  describe('validateIntegerInRange', () => {
    it('accepts valid integers within range', () => {
      expect(Validate.validateIntegerInRange('Test Value', 5, 1, 10)).toBe(5);
      expect(Validate.validateIntegerInRange('Test Value', '42', 1, 100)).toBe(42);
      expect(Validate.validateIntegerInRange('Test Value', 1, 1, 10)).toBe(1);
      expect(Validate.validateIntegerInRange('Test Value', 10, 1, 10)).toBe(10);
    });

    it('rejects values outside range', () => {
      expect(() => Validate.validateIntegerInRange('Test Value', 0, 1, 10)).toThrow(
        /Test Value must be an integer between 1 and 10/
      );
      expect(() => Validate.validateIntegerInRange('Test Value', 11, 1, 10)).toThrow(
        /Test Value must be an integer between 1 and 10/
      );
    });

    it('rejects non-integer values', () => {
      expect(() => Validate.validateIntegerInRange('Test Value', 'abc', 1, 10)).toThrow(
        /Test Value must be an integer between 1 and 10/
      );
      expect(() => Validate.validateIntegerInRange('Test Value', null, 1, 10)).toThrow(
        /Test Value must be an integer between 1 and 10/
      );
      expect(() => Validate.validateIntegerInRange('Test Value', undefined, 1, 10)).toThrow(
        /Test Value must be an integer between 1 and 10/
      );
    });
  });

  describe('validateNonEmptyString', () => {
    it('accepts non-empty strings', () => {
      expect(Validate.validateNonEmptyString('Field', 'hello')).toBe('hello');
      expect(Validate.validateNonEmptyString('Field', '  value  ')).toBe('  value  ');
    });

    it('rejects empty or whitespace strings', () => {
      expect(() => Validate.validateNonEmptyString('Field', '')).toThrow(
        /Field must be a non-empty string/
      );
      expect(() => Validate.validateNonEmptyString('Field', '   ')).toThrow(
        /Field must be a non-empty string/
      );
    });

    it('rejects non-string values', () => {
      expect(() => Validate.validateNonEmptyString('Field', null)).toThrow(
        /Field must be a non-empty string/
      );
      expect(() => Validate.validateNonEmptyString('Field', 123)).toThrow(
        /Field must be a non-empty string/
      );
      expect(() => Validate.validateNonEmptyString('Field', undefined)).toThrow(
        /Field must be a non-empty string/
      );
    });
  });

  describe('validateUrl', () => {
    it('accepts valid HTTPS URLs', () => {
      expect(Validate.validateUrl('URL', 'https://example.com')).toBe('https://example.com');
      expect(Validate.validateUrl('URL', 'https://sub.domain.example.com/path')).toBe(
        'https://sub.domain.example.com/path'
      );
    });

    it('rejects invalid URLs', () => {
      expect(() => Validate.validateUrl('URL', 'http://example.com')).toThrow(
        /URL must be a valid URL string/
      );
      expect(() => Validate.validateUrl('URL', 'not-a-url')).toThrow(
        /URL must be a valid URL string/
      );
      expect(() => Validate.validateUrl('URL', '')).toThrow(/URL must be a valid URL string/);
      expect(() => Validate.validateUrl('URL', null)).toThrow(/URL must be a valid URL string/);
    });
  });

  describe('validateBoolean', () => {
    it('accepts boolean values', () => {
      expect(Validate.validateBoolean('Flag', true)).toBe(true);
      expect(Validate.validateBoolean('Flag', false)).toBe(false);
    });

    it('accepts string representations of booleans', () => {
      expect(Validate.validateBoolean('Flag', 'true')).toBe(true);
      expect(Validate.validateBoolean('Flag', 'false')).toBe(false);
      expect(Validate.validateBoolean('Flag', 'TRUE')).toBe(true);
      expect(Validate.validateBoolean('Flag', 'FALSE')).toBe(false);
    });

    it('rejects non-boolean values', () => {
      expect(() => Validate.validateBoolean('Flag', 'yes')).toThrow(
        /Flag must be a boolean \(true\/false\)/
      );
      expect(() => Validate.validateBoolean('Flag', 1)).toThrow(
        /Flag must be a boolean \(true\/false\)/
      );
      expect(() => Validate.validateBoolean('Flag', null)).toThrow(
        /Flag must be a boolean \(true\/false\)/
      );
    });
  });

  describe('validateTrimmedNonEmptyString', () => {
    it('returns trimmed value for non-empty string', () => {
      expect(Validate.validateTrimmedNonEmptyString('Field', '  hello  ')).toBe('hello');
      expect(Validate.validateTrimmedNonEmptyString('Field', 'hello')).toBe('hello');
    });

    it('throws TypeError for empty or whitespace strings', () => {
      expect(() => Validate.validateTrimmedNonEmptyString('Field', '')).toThrow(TypeError);
      expect(() => Validate.validateTrimmedNonEmptyString('Field', '   ')).toThrow(TypeError);
    });

    it('throws TypeError for non-string values', () => {
      expect(() => Validate.validateTrimmedNonEmptyString('Field', null)).toThrow(TypeError);
      expect(() => Validate.validateTrimmedNonEmptyString('Field', 123)).toThrow(TypeError);
      expect(() => Validate.validateTrimmedNonEmptyString('Field', undefined)).toThrow(TypeError);
    });

    it('uses the label in the error message', () => {
      expect(() => Validate.validateTrimmedNonEmptyString('Name', '')).toThrow(
        /Name must be a non-empty string/
      );
    });
  });

  describe('validatePlainObject', () => {
    it('accepts plain objects', () => {
      const obj = { key: 'value' };
      expect(Validate.validatePlainObject('Param', obj)).toBe(obj);
      expect(Validate.validatePlainObject('Param', {})).toEqual({});
    });

    it('throws TypeError for null', () => {
      expect(() => Validate.validatePlainObject('Param', null)).toThrow(TypeError);
    });

    it('throws TypeError for arrays', () => {
      expect(() => Validate.validatePlainObject('Param', [1, 2, 3])).toThrow(TypeError);
    });

    it('throws TypeError for primitive values', () => {
      expect(() => Validate.validatePlainObject('Param', 'string')).toThrow(TypeError);
      expect(() => Validate.validatePlainObject('Param', 42)).toThrow(TypeError);
      expect(() => Validate.validatePlainObject('Param', true)).toThrow(TypeError);
    });

    it('uses the label in the error message', () => {
      expect(() => Validate.validatePlainObject('MyParam', null)).toThrow(
        /MyParam must be an object/
      );
    });
  });

  describe('_coerceBooleanString', () => {
    it('returns true for lowercase "true"', () => {
      expect(Validate._coerceBooleanString('true')).toBe(true);
    });

    it('returns false for lowercase "false"', () => {
      expect(Validate._coerceBooleanString('false')).toBe(false);
    });

    it('returns undefined for non-matching strings', () => {
      expect(Validate._coerceBooleanString('yes')).toBeUndefined();
      expect(Validate._coerceBooleanString('1')).toBeUndefined();
      expect(Validate._coerceBooleanString('')).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(Validate._coerceBooleanString(undefined)).toBeUndefined();
    });
  });

  describe('requireParams', () => {
    it('throws when params is not an object', () => {
      expect(() => Validate.requireParams(null)).toThrow('params must be an object');
      expect(() => Validate.requireParams('string')).toThrow('params must be an object');
      expect(() => Validate.requireParams(123)).toThrow('params must be an object');
      expect(() => Validate.requireParams([1, 2])).toThrow('params must be an object');
    });

    it('throws when a required parameter is null or undefined', () => {
      expect(() => Validate.requireParams({ name: null })).toThrow('name is required');
      expect(() => Validate.requireParams({ name: undefined })).toThrow('name is required');
    });

    it('passes valid parameters without context', () => {
      expect(() => Validate.requireParams({ name: 'John', age: 30 })).not.toThrow();
    });

    it('includes context string in error message', () => {
      expect(() => Validate.requireParams({ name: null }, 'setName')).toThrow(
        'name is required for setName'
      );
    });

    it('accepts falsy but valid values (0, false, empty string)', () => {
      expect(() => Validate.requireParams({ count: 0 })).not.toThrow();
      expect(() => Validate.requireParams({ flag: false })).not.toThrow();
      expect(() => Validate.requireParams({ text: '' })).not.toThrow();
    });
  });
});
