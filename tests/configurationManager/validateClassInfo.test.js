import { describe, it, expect } from 'vitest';

const { validateClassInfo } = require('../../src/AdminSheet/ConfigurationManager/validators.js');

describe('validateClassInfo', () => {
  const label = 'Class Info';

  it('accepts a valid JSON payload', () => {
    const payload = JSON.stringify({
      ClassName: 'Physics 10A',
      CourseId: 'abc-123_DEF',
      YearGroup: 10,
    });

    expect(validateClassInfo(label, payload)).toBe(payload);
  });

  it('rejects non-string inputs', () => {
    expect(() => validateClassInfo(label, null)).toThrow(/Class Info must be a JSON string/);
  });

  it('rejects invalid JSON', () => {
    expect(() => validateClassInfo(label, '{bad json')).toThrow(/Class Info must be valid JSON/);
  });

  it('rejects non-object JSON payloads', () => {
    const arrayPayload = JSON.stringify(['not', 'an', 'object']);
    expect(() => validateClassInfo(label, arrayPayload)).toThrow(
      /Class Info must be a JSON object/
    );
  });

  it('rejects missing ClassName', () => {
    const payload = JSON.stringify({ CourseId: 'course-1' });
    expect(() => validateClassInfo(label, payload)).toThrow(
      /Class Info must have a ClassName property/
    );
  });

  it('rejects missing CourseId', () => {
    const payload = JSON.stringify({ ClassName: 'History' });
    expect(() => validateClassInfo(label, payload)).toThrow(
      /Class Info must have a CourseId property/
    );
  });

  it('rejects invalid CourseId formats', () => {
    const payload = JSON.stringify({
      ClassName: 'History',
      CourseId: 'invalid id',
      YearGroup: null,
    });
    expect(() => validateClassInfo(label, payload)).toThrow(/CourseId must be alphanumeric/);
  });

  it('rejects invalid YearGroup types', () => {
    const payload = JSON.stringify({
      ClassName: 'History',
      CourseId: 'valid-id',
      YearGroup: 'ten',
    });
    expect(() => validateClassInfo(label, payload)).toThrow(/YearGroup must be a number or null/);
  });

  it('accepts null YearGroup', () => {
    const payload = JSON.stringify({ ClassName: 'History', CourseId: 'valid-id', YearGroup: null });
    expect(validateClassInfo(label, payload)).toBe(payload);
  });
});
