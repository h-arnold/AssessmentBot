/**
 * Shared test helpers for ClassesPage component tests.
 *
 * This module provides fixtures to reduce duplication in ClassesPage.spec.tsx.
 */

import type { ClassPartial } from '../../../services/classPartials.zod';
import type { YearGroup } from '../../../services/referenceData.zod';

/**
 * Default field values shared by all ClassPartial fixtures.
 */
const CLASS_PARTIAL_DEFAULTS = {
  className: 'Test Class',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: 'default-yg',
  classOwner: null,
  teachers: [],
  active: null,
} as const;

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
  return { ...CLASS_PARTIAL_DEFAULTS, ...overrides } as ClassPartial;
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

// ============================================================================
// Fixture Constants
// ============================================================================

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
 * Mixed order year groups for alphabetical sorting tests.
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

// ============================================================================
// Plain-object conversion utilities (for E2E test serialisation)
// ============================================================================

/**
 * Converts typed ClassPartial fixtures to plain JavaScript objects
 * suitable for JSON serialisation in E2E test init scripts.
 *
 * @param {ClassPartial[]} classPartials - Typed class partials to convert.
 * @returns {Array<Record<string, unknown>>} Plain objects.
 */
export function toPlainClassPartials(
  classPartials: ClassPartial[]
): Array<Record<string, unknown>> {
  return classPartials.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));
}
