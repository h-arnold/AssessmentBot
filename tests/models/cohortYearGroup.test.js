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

describe('YearGroup model', () => {
  it('constructs successfully with a valid name and getName() returns the stored trimmed value', async () => {
    const YearGroup = await loadYearGroup();

    const yearGroup = new YearGroup('  Year 10  ');

    expect(yearGroup.getName()).toBe('Year 10');
  });

  it('setName() trims surrounding whitespace before storing the value', async () => {
    const YearGroup = await loadYearGroup();
    const yearGroup = new YearGroup('Year 10');

    yearGroup.setName('  Year 11  ');

    expect(yearGroup.getName()).toBe('Year 11');
  });

  it('throws when name is empty, whitespace-only, null, undefined, or non-string', async () => {
    const YearGroup = await loadYearGroup();
    const invalidNames = ['', '   ', null, undefined, 10, true, {}, []];

    for (const invalidName of invalidNames) {
      expect(() => new YearGroup(invalidName)).toThrow();
    }
  });

  it('toJSON() returns { name }', async () => {
    const YearGroup = await loadYearGroup();
    const yearGroup = new YearGroup('Year 12');

    expect(yearGroup.toJSON()).toEqual({ name: 'Year 12' });
  });

  it('fromJSON() returns a valid instance and preserves the name value', async () => {
    const YearGroup = await loadYearGroup();

    const yearGroup = YearGroup.fromJSON({ name: 'Year 13' });

    expect(yearGroup).toBeInstanceOf(YearGroup);
    expect(yearGroup.getName()).toBe('Year 13');
  });
});

describe('Cohort model', () => {
  it('constructs successfully with a valid name and explicit active value', async () => {
    const Cohort = await loadCohort();

    const cohort = new Cohort('  2026  ', false);

    expect(cohort.getName()).toBe('2026');
    expect(cohort.getActive()).toBe(false);
  });

  it('defaults active to true when omitted', async () => {
    const Cohort = await loadCohort();

    const cohort = new Cohort('2027');

    expect(cohort.getActive()).toBe(true);
  });

  it('setName() trims surrounding whitespace before storing the value', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('2026');

    cohort.setName('  2028  ');

    expect(cohort.getName()).toBe('2028');
  });

  it('setActive() accepts true and false', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('2026');

    cohort.setActive(false);
    expect(cohort.getActive()).toBe(false);

    cohort.setActive(true);
    expect(cohort.getActive()).toBe(true);
  });

  it('throws when name is empty, whitespace-only, null, undefined, or non-string', async () => {
    const Cohort = await loadCohort();
    const invalidNames = ['', '   ', null, undefined, 10, true, {}, []];

    for (const invalidName of invalidNames) {
      expect(() => new Cohort(invalidName)).toThrow();
    }
  });

  it('throws when active is non-boolean', async () => {
    const Cohort = await loadCohort();
    const invalidActiveValues = [null, undefined, 'true', 'false', 1, 0, {}, []];

    for (const invalidActiveValue of invalidActiveValues) {
      expect(() => new Cohort('2026', invalidActiveValue)).toThrow();
    }
  });

  it('toJSON() returns { name, active }', async () => {
    const Cohort = await loadCohort();
    const cohort = new Cohort('2026', false);

    expect(cohort.toJSON()).toEqual({ name: '2026', active: false });
  });

  it('fromJSON() returns a valid instance and applies the default active: true when omitted', async () => {
    const Cohort = await loadCohort();

    const cohort = Cohort.fromJSON({ name: '2029' });

    expect(cohort).toBeInstanceOf(Cohort);
    expect(cohort.getName()).toBe('2029');
    expect(cohort.getActive()).toBe(true);
  });
});
