import { describe, it, expect } from 'vitest';
import { Validate } from '../../src/AdminSheet/Utils/Validate.js';

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
});
