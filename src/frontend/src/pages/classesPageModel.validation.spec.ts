/**
 * ClassesPage grouped view-model suites — fail-closed validation.
 *
 * Split verbatim from the original single `classesPageModel.spec.ts` as a
 * green responsibility-based refactor. The shared factories and assertion
 * helpers moved to `@/test/classes/classesPageModelTestSupport`; every
 * original assertion is preserved. The merge/base suite lives in
 * `classesPageModel.base.spec.ts` and the sorting/grouping suite in
 * `classesPageModel.sorting.spec.ts`.
 */
import { describe, it } from 'vitest';
import type { ClassPartial } from '../services/googleClassrooms/classPartials.zod';
import { buildClassesPageModel } from './classesPageModel';
import {
  assertInvalidClassesPageDataViewModel,
  buildInvalidDataTestFixtures,
  createClassPartial,
  createYearGroup,
} from '@/test/classes/classesPageModelTestSupport';

// ============================================================================
// Test suites
// ============================================================================

describe('Classes page grouped view model - buildClassesPageModel', () => {
  // --------------------------------------------------------------------------
  // Invalid scenario descriptors for parameterized fail-closed tests
  // --------------------------------------------------------------------------

  /**
   * Descriptor for a fail-closed test scenario.
   */
  interface FailClosedScenario {
    name: string;
    validClassId: string;
    invalidClassId: string;
    validOverrides: Partial<ClassPartial>;
    invalidOverrides: Partial<ClassPartial>;
  }

  /**
   * Predefined fail-closed scenarios for parameterized testing.
   */
  const failClosedScenarios: FailClosedScenario[] = [
    {
      name: 'null className',
      validClassId: 'c1',
      invalidClassId: 'c2',
      validOverrides: {},
      invalidOverrides: { className: null, yearGroupKey: 'yg-1' },
    },
    {
      name: 'null yearGroupKey',
      validClassId: 'c1',
      invalidClassId: 'c2',
      validOverrides: {},
      invalidOverrides: { className: 'Orphan Class', yearGroupKey: null },
    },
    {
      name: 'unresolved yearGroupKey',
      validClassId: 'c1',
      invalidClassId: 'c2',
      validOverrides: { className: 'Valid Class', yearGroupKey: 'yg-1' },
      invalidOverrides: { className: 'Unresolved Class', yearGroupKey: 'yg-nonexistent' },
    },
  ];

  // --------------------------------------------------------------------------
  // Fail-closed tests (parameterized)
  // --------------------------------------------------------------------------

  describe('Fail-closed behaviour', () => {
    for (const scenario of failClosedScenarios) {
      it(`should reject records with ${scenario.name} and return invalid data view model`, () => {
        const yearGroupsForUnresolved =
          scenario.name === 'unresolved yearGroupKey'
            ? [createYearGroup('yg-1', 'Year 1'), createYearGroup('yg-2', 'Year 2')]
            : undefined;

        const fixtures = yearGroupsForUnresolved
          ? {
              yearGroups: yearGroupsForUnresolved,
              classPartials: [
                createClassPartial(scenario.validClassId, scenario.validOverrides),
                createClassPartial(scenario.invalidClassId, scenario.invalidOverrides),
              ],
              validClassId: scenario.validClassId,
              invalidClassId: scenario.invalidClassId,
            }
          : buildInvalidDataTestFixtures(
              scenario.validClassId,
              scenario.invalidClassId,
              scenario.validOverrides,
              scenario.invalidOverrides
            );

        const result = buildClassesPageModel(fixtures.classPartials, fixtures.yearGroups);

        assertInvalidClassesPageDataViewModel(
          result,
          [fixtures.invalidClassId],
          [fixtures.validClassId]
        );
      });
    }
  });

  // --------------------------------------------------------------------------
  // Empty states — classes present without year groups
  // --------------------------------------------------------------------------

  describe('YearGroups empty with existing classes', () => {
    it('should return blocking invalid-data state when yearGroups = [] but classes exist', () => {
      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-1' }),
        createClassPartial('c2', { className: 'Class 2', yearGroupKey: 'yg-2' }),
      ];

      const result = buildClassesPageModel(classPartials, []);

      assertInvalidClassesPageDataViewModel(result, ['c1', 'c2'], []);
    });
  });
});
