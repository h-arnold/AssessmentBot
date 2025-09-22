import { describe, it, expect } from 'vitest';
import { Validate } from '../../src/AdminSheet/Utils/Validate.js';

describe('Validate utility', () => {
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
