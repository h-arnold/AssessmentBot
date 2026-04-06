import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Validate } from '../../src/backend/Utils/Validate.js';

const originalValidate = globalThis.Validate;

beforeAll(() => {
  globalThis.Validate = Validate;
});

afterAll(() => {
  if (originalValidate === undefined) {
    delete globalThis.Validate;
    return;
  }

  globalThis.Validate = originalValidate;
});

async function loadYearGroup() {
  const module = await import('../../src/backend/Models/YearGroup.js');
  return module.YearGroup ?? module.default?.YearGroup;
}

async function loadCohort() {
  const module = await import('../../src/backend/Models/Cohort.js');
  return module.Cohort ?? module.default?.Cohort;
}

// ─── YearGroup key contract ──────────────────────────────────────────────────

describe('YearGroup model – key contract', () => {
  it('constructs successfully with a valid key and name, getName() returns the trimmed value', async () => {
    const YearGroup = await loadYearGroup();

    const yearGroup = new YearGroup('yg-key-001', '  Year 10  ');

    expect(yearGroup.getName()).toBe('Year 10');
    expect(yearGroup.getKey()).toBe('yg-key-001');
  });

  it('key is required and throws when missing or empty', async () => {
    const YearGroup = await loadYearGroup();
    const invalidKeys = ['', '   ', null, undefined];

    for (const badKey of invalidKeys) {
      expect(() => new YearGroup(badKey, 'Year 10')).toThrow();
    }
  });

  it('setName() trims surrounding whitespace before storing the value', async () => {
    const YearGroup = await loadYearGroup();
    const yearGroup = new YearGroup('yg-key-002', 'Year 10');

    yearGroup.setName('  Year 11  ');

    expect(yearGroup.getName()).toBe('Year 11');
  });

  it('throws when name is empty, whitespace-only, null, undefined, or non-string', async () => {
    const YearGroup = await loadYearGroup();
    const invalidNames = ['', '   ', null, undefined, 10, true, {}, []];

    for (const invalidName of invalidNames) {
      expect(() => new YearGroup('yg-key-003', invalidName)).toThrow();
    }
  });

  it('toJSON() returns { key, name }', async () => {
    const YearGroup = await loadYearGroup();
    const yearGroup = new YearGroup('yg-key-004', 'Year 12');

    expect(yearGroup.toJSON()).toEqual({ key: 'yg-key-004', name: 'Year 12' });
  });

  it('toJSON() does not include extra fields', async () => {
    const YearGroup = await loadYearGroup();
    const yearGroup = new YearGroup('yg-key-005', 'Year 13');
    const json = yearGroup.toJSON();

    expect(Object.keys(json).sort()).toEqual(['key', 'name'].sort());
  });

  it('fromJSON() returns a valid instance, preserving key and name', async () => {
    const YearGroup = await loadYearGroup();

    const yearGroup = YearGroup.fromJSON({ key: 'yg-key-006', name: 'Year 13' });

    expect(yearGroup).toBeInstanceOf(YearGroup);
    expect(yearGroup.getKey()).toBe('yg-key-006');
    expect(yearGroup.getName()).toBe('Year 13');
  });

  it('fromJSON() → toJSON() round-trip preserves { key, name }', async () => {
    const YearGroup = await loadYearGroup();
    const input = { key: 'yg-round-001', name: 'Year 9' };

    expect(YearGroup.fromJSON(input).toJSON()).toEqual(input);
  });
});

// ─── Cohort key contract ─────────────────────────────────────────────────────

describe('Cohort model – key contract', () => {
  it('constructs with key, name, active, startYear, startMonth and exposes them via getters', async () => {
    const Cohort = await loadCohort();

    const cohort = new Cohort('coh-key-001', '  2026  ', false, 2025, 9);

    expect(cohort.getKey()).toBe('coh-key-001');
    expect(cohort.getName()).toBe('2026');
    expect(cohort.getActive()).toBe(false);
    expect(cohort.getStartYear()).toBe(2025);
    expect(cohort.getStartMonth()).toBe(9);
  });

  it('key is required and throws when missing or empty', async () => {
    const Cohort = await loadCohort();
    const invalidKeys = ['', '   ', null, undefined];

    for (const badKey of invalidKeys) {
      expect(() => new Cohort(badKey, '2026', true, 2025, 9)).toThrow();
    }
  });

  it('defaults active to true when omitted', async () => {
    const Cohort = await loadCohort();

    const cohort = new Cohort('coh-key-002', '2027', undefined, 2026, 9);

    expect(cohort.getActive()).toBe(true);
  });

  it('setName() trims surrounding whitespace before storing the value', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('coh-key-003', '2026', true, 2025, 9);

    cohort.setName('  2028  ');

    expect(cohort.getName()).toBe('2028');
  });

  it('setActive() accepts true and false', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('coh-key-004', '2026', true, 2025, 9);

    cohort.setActive(false);
    expect(cohort.getActive()).toBe(false);

    cohort.setActive(true);
    expect(cohort.getActive()).toBe(true);
  });

  it('throws when name is empty, whitespace-only, null, undefined, or non-string', async () => {
    const Cohort = await loadCohort();
    const invalidNames = ['', '   ', null, undefined, 10, true, {}, []];

    for (const invalidName of invalidNames) {
      expect(() => new Cohort('coh-key-005', invalidName, true, 2025, 9)).toThrow();
    }
  });

  it('throws when active is non-boolean', async () => {
    const Cohort = await loadCohort();
    const invalidActiveValues = ['true', 'false', 1, 0, {}, []];

    for (const invalidActiveValue of invalidActiveValues) {
      expect(() => new Cohort('coh-key-006', '2026', invalidActiveValue, 2025, 9)).toThrow();
    }
  });

  it('toJSON() returns { key, name, active, startYear, startMonth }', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('coh-key-007', '2026', false, 2025, 9);

    expect(cohort.toJSON()).toEqual({
      key: 'coh-key-007',
      name: '2026',
      active: false,
      startYear: 2025,
      startMonth: 9,
    });
  });

  it('toJSON() does not include extra legacy fields', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('coh-key-008', '2026', true, 2025, 9);
    const json = cohort.toJSON();

    expect(Object.keys(json).sort()).toEqual(
      ['active', 'key', 'name', 'startMonth', 'startYear'].sort()
    );
  });

  it('fromJSON() returns a valid instance preserving all key-contract fields', async () => {
    const Cohort = await loadCohort();
    const input = {
      key: 'coh-key-009',
      name: '2029',
      active: false,
      startYear: 2028,
      startMonth: 9,
    };

    const cohort = Cohort.fromJSON(input);

    expect(cohort).toBeInstanceOf(Cohort);
    expect(cohort.getKey()).toBe('coh-key-009');
    expect(cohort.getName()).toBe('2029');
    expect(cohort.getActive()).toBe(false);
    expect(cohort.getStartYear()).toBe(2028);
    expect(cohort.getStartMonth()).toBe(9);
  });

  it('fromJSON() → toJSON() round-trip preserves { key, name, active, startYear, startMonth }', async () => {
    const Cohort = await loadCohort();
    const input = {
      key: 'coh-round-001',
      name: '2030',
      active: true,
      startYear: 2029,
      startMonth: 9,
    };

    expect(Cohort.fromJSON(input).toJSON()).toEqual(input);
  });

  it('fromJSON() applies active: true when active is omitted', async () => {
    const Cohort = await loadCohort();

    const cohort = Cohort.fromJSON({
      key: 'coh-key-010',
      name: '2031',
      startYear: 2030,
      startMonth: 9,
    });

    expect(cohort).toBeInstanceOf(Cohort);
    expect(cohort.getActive()).toBe(true);
  });
});
