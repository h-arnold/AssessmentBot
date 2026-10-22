/**
 * Shared ClassesPage test fixtures.
 *
 * Owns the ClassPartial/YearGroup fixture factories and the shared fixture
 * constants used by the ClassesPage component suites and the E2E scenario
 * helpers. Moved verbatim from `classesPageTestHelpers.tsx` as a green
 * responsibility-based refactor; import through the
 * `classesPageTestHelpers` compatibility facade or directly from this module.
 */

import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '@/services/referenceData/referenceData.zod';
import { createCanonicalMetadataFixture } from '../abClass/abClassMetadataSharedFixtures';

/** Owns defaults and fresh collections for shared ClassPartial fixtures. */
class ClassPartialFixtureDefaults {
  readonly fields: Omit<ClassPartial, 'classId'>;

  /** Creates an independent set of fixture defaults. */
  constructor() {
    this.fields = {
      className: 'Test Class',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: 'default-yg',
      classOwner: null,
      teachers: [],
      active: null,
      metadata: createCanonicalMetadataFixture(),
    };
  }
}

/**
 * Creates a ClassPartial fixture with sensible defaults for all fields.
 *
 * Only `classId` is required. All other fields default to the project's
 * conventional fixture defaults (null for optional fields, empty arrays
 * for collections, 1 for course length).
 *
 * @param {Object} overrides - Field overrides. `classId` is required.
 * @returns {ClassPartial} A complete ClassPartial fixture object.
 */
export function createFixtureClassPartial(
  overrides: { classId: string } & Partial<ClassPartial>
): ClassPartial {
  return { ...new ClassPartialFixtureDefaults().fields, ...overrides } as ClassPartial;
}

/**
 * Creates a YearGroup fixture with the given key and name.
 *
 * @param {string} key - The year group key.
 * @param {string} name - The year group name.
 * @returns {YearGroup} A YearGroup fixture object.
 */
export function createFixtureYearGroup(key: string, name: string): YearGroup {
  return { key, name };
}

/**
 * Default mock year groups for ClassesPage tests.
 */
export const MOCK_YEAR_GROUPS: YearGroup[] = [
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
  createFixtureYearGroup('year-group-11', 'Year 11'),
];

/**
 * Default mock class partials for ClassesPage tests.
 */
export const MOCK_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-math-10b',
    className: 'Mathematics 10B',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-science-11',
    className: 'Science 11',
    yearGroupKey: 'year-group-11',
  }),
];

/**
 * Empty mock class partials.
 */
export const MOCK_EMPTY_CLASS_PARTIALS: ClassPartial[] = [];

/**
 * Empty mock year groups.
 */
export const MOCK_EMPTY_YEAR_GROUPS: YearGroup[] = [];

/**
 * Invalid class partials for trust failure testing.
 */
export const MOCK_INVALID_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-invalid-1',
    className: null,
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-invalid-2',
    className: 'Valid Class',
    yearGroupKey: null,
  }),
  createFixtureClassPartial({
    classId: 'class-invalid-3',
    className: 'Another Valid',
    yearGroupKey: 'year-group-invalid',
  }),
];

// ============================================================================
// Year-group collapse behaviour fixtures
// ============================================================================

/**
 * Mixed input order used to verify natural year-group presentation ordering.
 */
export const MIXED_ORDER_YEAR_GROUPS: YearGroup[] = [
  createFixtureYearGroup('year-group-11', 'Year 11'),
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
];

/**
 * Mixed order class partials matching the mixed year groups.
 */
export const MIXED_ORDER_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-math-11a',
    className: 'Mathematics 11A',
    yearGroupKey: 'year-group-11',
  }),
  createFixtureClassPartial({
    classId: 'class-science-9',
    className: 'Science 9',
    yearGroupKey: 'year-group-9',
  }),
  createFixtureClassPartial({
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-english-10',
    className: 'English 10',
    yearGroupKey: 'year-group-10',
  }),
];

/**
 * Year groups with empty panel (Year 9 has no classes).
 */
export const YEAR_GROUPS_WITH_EMPTY: YearGroup[] = [
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
];

/**
 * Class partials for empty panel test (only Year 10 has classes).
 */
export const CLASS_PARTIALS_FOR_EMPTY_PANEL: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    yearGroupKey: 'year-group-10',
  }),
];

// ============================================================================
// Card sorting and rendering fixtures
// ============================================================================

/**
 * Class partials for alphabetical ordering tests.
 */
export const ALPHABETICAL_ORDER_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-math-10b',
    className: 'Mathematics 10B',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-english-10',
    className: 'English 10',
    yearGroupKey: 'year-group-10',
  }),
];

/**
 * Class partials for tie-break sorting tests (same className, different classId).
 */
export const TIE_BREAK_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({
    classId: 'class-b-z',
    className: 'Z Class',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-a-z',
    className: 'Z Class',
    yearGroupKey: 'year-group-10',
  }),
  createFixtureClassPartial({
    classId: 'class-b-a',
    className: 'A Class',
    yearGroupKey: 'year-group-10',
  }),
];

/**
 * Single year group for focused tests.
 */
export const SINGLE_YEAR_GROUP: YearGroup[] = [createFixtureYearGroup('year-group-10', 'Year 10')];
