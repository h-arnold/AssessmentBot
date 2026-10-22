/**
 * ClassesPage grouped view-model suites — panel/card sorting and grouping.
 *
 * Split verbatim from the original single `classesPageModel.spec.ts` as a
 * green responsibility-based refactor. The shared factories and assertion
 * helpers moved to `@/test/classes/classesPageModelTestSupport`; every
 * original assertion is preserved. The merge/base suite lives in
 * `classesPageModel.base.spec.ts` and the fail-closed validation suite in
 * `classesPageModel.validation.spec.ts`.
 */
import { describe, it, expect } from 'vitest';
import type { ClassPartial } from '../services/googleClassrooms/classPartials.zod';
import {
  assertCardsSortedByNameThenId,
  assertPanelsSortedByNameThenKey,
  buildAliceBobCharlieFixture,
  buildAndAssertValidModel,
  createClassPartial,
  createYearGroup,
} from '@/test/classes/classesPageModelTestSupport';

// ============================================================================
// Test suites
// ============================================================================

describe('Classes page grouped view model - buildClassesPageModel', () => {
  // --------------------------------------------------------------------------
  // Panel sorting
  // --------------------------------------------------------------------------

  describe('Panel sorting', () => {
    it('should naturally order numbered year-group names', () => {
      const yearGroups = [
        createYearGroup('yg-11', 'Year 11'),
        createYearGroup('yg-9', 'Year 9'),
        createYearGroup('yg-10', 'Year 10'),
      ];

      buildAndAssertValidModel([], yearGroups, (result) => {
        expect(result.panels.map((panel) => panel.yearGroupKey)).toEqual([
          'yg-9',
          'yg-10',
          'yg-11',
        ]);
      });
    });

    it('should sort panels by YearGroup.name ascending, using YearGroup.key as deterministic tie-break', () => {
      const { yearGroups, classPartials } = buildAliceBobCharlieFixture();
      // Same name, different keys - should use the strict key tie-break.
      yearGroups.push(createYearGroup('yg-z', 'Alice'), createYearGroup('yg-y', 'Alice'));
      classPartials.push(
        createClassPartial('c4', { className: 'Class 4', yearGroupKey: 'yg-y' }),
        createClassPartial('c5', { className: 'Class 5', yearGroupKey: 'yg-z' })
      );

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        // Sorted by name ascending, then by key ascending for ties
        // Alice panels: yg-a (key: a), yg-y (key: y), yg-z (key: z)
        assertPanelsSortedByNameThenKey(result.panels, ['yg-a', 'yg-y', 'yg-z', 'yg-b', 'yg-c']);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Card sorting
  // --------------------------------------------------------------------------

  describe('Card sorting', () => {
    it('should sort cards by className ascending, using classId as deterministic tie-break', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c-zebra', { className: 'Zebra', yearGroupKey: 'yg-1' }),
        createClassPartial('c-alpha', { className: 'Alpha', yearGroupKey: 'yg-1' }),
        createClassPartial('c-beta', { className: 'Beta', yearGroupKey: 'yg-1' }),
        // Same className, different classId - should use classId as tie-break
        createClassPartial('c-aaa', { className: 'Alpha', yearGroupKey: 'yg-1' }),
        createClassPartial('c-aab', { className: 'Alpha', yearGroupKey: 'yg-1' }),
      ];

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        expect(result.panels).toHaveLength(1);
        const panel = result.panels[0];

        // Sorted by className: Alpha, Alpha, Alpha, Beta, Zebra
        // Alpha with classId c-aaa comes before c-aab, which comes before c-alpha
        assertCardsSortedByNameThenId(panel.classes, [
          'c-aaa',
          'c-aab',
          'c-alpha',
          'c-beta',
          'c-zebra',
        ]);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Default expanded panel
  // --------------------------------------------------------------------------

  describe('Default-expanded first presented panel key', () => {
    it('should retain alphabetical fallback and key tie-breaking when selecting the first panel', () => {
      const { yearGroups, classPartials } = buildAliceBobCharlieFixture();

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        expect(result.defaultExpandedPanelKeys).toHaveLength(1);
        expect(result.defaultExpandedPanelKeys[0]).toBe('yg-a');
      });
    });
  });
});
