/**
 * Mandatory Reading (Files read):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-testing.md
 * - docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
 * - src/frontend/src/services/classPartialsService.ts
 * - src/frontend/src/services/referenceDataService.ts
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/features/classes/ClassesTable.helpers.ts
 *
 * ClassesPage grouped view-model suites — merge/base behaviour.
 *
 * This suite was split verbatim from the original single
 * `classesPageModel.spec.ts` as a green responsibility-based refactor. The
 * shared factories and assertion helpers moved to
 * `@/test/classes/classesPageModelTestSupport`; every original assertion is
 * preserved. The sorting/grouping suite lives in `classesPageModel.sorting.spec.ts`
 * and the fail-closed validation suite in `classesPageModel.validation.spec.ts`.
 */
import { describe, it, expect } from 'vitest';
import type { ClassPartial } from '../services/googleClassrooms/classPartials.zod';
import { buildClassesPageModel } from './classesPageModel';
import {
  assertClassesPagePanelViewModel,
  buildAndAssertValidModel,
  buildValidDataset,
  createClassPartial,
  createYearGroup,
} from '@/test/classes/classesPageModelTestSupport';

// ============================================================================
// Named scenario-count constants (replace the former inline magic-number
// suppressions with self-documenting fixtures of the same values)
// ============================================================================

/** Panels expected in the empty-panel scenario (one populated, one empty). */
const EMPTY_PANEL_SCENARIO_YEAR_GROUP_COUNT = 2;
/** Panels expected in the complete integration scenario. */
const INTEGRATION_SCENARIO_PANEL_COUNT = 3;
/** Classes expected in the integration scenario's Year 10 panel. */
const INTEGRATION_SCENARIO_YEAR_10_CLASS_COUNT = 2;
/** Classes expected in the integration scenario's Year 11 panel. */
const INTEGRATION_SCENARIO_YEAR_11_CLASS_COUNT = 3;

// ============================================================================
// Test suites
// ============================================================================

describe('Classes page grouped view model - buildClassesPageModel', () => {
  // --------------------------------------------------------------------------
  // Empty panel
  // --------------------------------------------------------------------------

  describe('Empty panel', () => {
    it('should return an empty panel for a year group with no matching classes', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1'), createYearGroup('yg-2', 'Year 2')];

      const classPartials: ClassPartial[] = [
        // Only classes for year group 1
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-1' }),
      ];

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        expect(result.panels).toHaveLength(EMPTY_PANEL_SCENARIO_YEAR_GROUP_COUNT);
        // Year 1 panel has 1 class
        expect(result.panels[0].classes).toHaveLength(1);
        // Year 2 panel has 0 classes (empty panel)
        expect(result.panels[1].classes).toHaveLength(0);
        expect(result.panels[1].yearGroupKey).toBe('yg-2');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Empty states
  // --------------------------------------------------------------------------

  describe('Both-empty page-level empty state', () => {
    it('should return page-level empty state when yearGroups = [] and classPartials = []', () => {
      buildAndAssertValidModel([], [], (result) => {
        expect(result.panels).toHaveLength(0);
        expect(result.defaultExpandedPanelKeys).toHaveLength(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Integration scenario
  // --------------------------------------------------------------------------

  describe('Complete integration scenario', () => {
    it('should handle a complete valid scenario with multiple year groups and classes', () => {
      const yearGroups = [
        createYearGroup('yg-11', 'Year 11'),
        createYearGroup('yg-10', 'Year 10'),
        createYearGroup('yg-12', 'Year 12'),
      ];

      const classPartials: ClassPartial[] = [
        // Year 10 classes
        createClassPartial('c-10b', { className: 'Biology', yearGroupKey: 'yg-10' }),
        createClassPartial('c-10a', { className: 'Art', yearGroupKey: 'yg-10' }),
        // Year 11 classes
        createClassPartial('c-11a', { className: 'Maths', yearGroupKey: 'yg-11' }),
        createClassPartial('c-11b', { className: 'Physics', yearGroupKey: 'yg-11' }),
        createClassPartial('c-11c', { className: 'Chemistry', yearGroupKey: 'yg-11' }),
        // Year 12 classes
        createClassPartial('c-12a', { className: 'Further Maths', yearGroupKey: 'yg-12' }),
      ];

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        // Should have 3 panels (one per year group)
        expect(result.panels).toHaveLength(INTEGRATION_SCENARIO_PANEL_COUNT);

        // Panels sorted by name: Year 10, Year 11, Year 12
        expect(result.panels[0].yearGroupKey).toBe('yg-10');
        expect(result.panels[0].yearGroupLabel).toBe('Year 10');

        expect(result.panels[0].classes).toHaveLength(INTEGRATION_SCENARIO_YEAR_10_CLASS_COUNT);
        // Cards sorted by className: Art, Biology
        expect(result.panels[0].classes[0].className).toBe('Art');
        expect(result.panels[0].classes[1].className).toBe('Biology');

        expect(result.panels[1].yearGroupKey).toBe('yg-11');
        expect(result.panels[1].yearGroupLabel).toBe('Year 11');

        expect(result.panels[1].classes).toHaveLength(INTEGRATION_SCENARIO_YEAR_11_CLASS_COUNT);
        // Cards sorted by className: Chemistry, Maths, Physics
        expect(result.panels[1].classes[0].className).toBe('Chemistry');
        expect(result.panels[1].classes[1].className).toBe('Maths');
        expect(result.panels[1].classes[2].className).toBe('Physics');

        expect(result.panels[2].yearGroupKey).toBe('yg-12');
        expect(result.panels[2].yearGroupLabel).toBe('Year 12');

        expect(result.panels[2].classes).toHaveLength(1);

        // Default expanded should be the first naturally ordered panel (Year 10 / yg-10)
        expect(result.defaultExpandedPanelKeys).toEqual(['yg-10']);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Model field verification
  // --------------------------------------------------------------------------

  describe('Model field verification', () => {
    it('should produce card model with classId, className, yearGroupKey, and yearGroupLabel', () => {
      const { yearGroups, classPartials } = buildValidDataset([
        createClassPartial('c1', { className: 'Test Class', yearGroupKey: 'yg-1' }),
      ]);

      const result = buildClassesPageModel(classPartials, yearGroups);

      assertClassesPagePanelViewModel(result, (panel) => {
        const card = panel.classes[0];
        expect(card).toHaveProperty('classId', 'c1');
        expect(card).toHaveProperty('className', 'Test Class');
        expect(card).toHaveProperty('yearGroupKey', 'yg-1');
        expect(card).toHaveProperty('yearGroupLabel', 'Year 1');
      });
    });

    it('should produce panel model with yearGroupKey, yearGroupLabel, and classes array', () => {
      const { yearGroups, classPartials } = buildValidDataset(
        [createClassPartial('c1', { className: 'Class A', yearGroupKey: 'yg-1' })],
        [createYearGroup('yg-1', 'Year One')]
      );

      const result = buildClassesPageModel(classPartials, yearGroups);

      assertClassesPagePanelViewModel(result, (panel) => {
        expect(panel).toHaveProperty('yearGroupKey', 'yg-1');
        expect(panel).toHaveProperty('yearGroupLabel', 'Year One');
        expect(panel).toHaveProperty('classes');
        expect(Array.isArray(panel.classes)).toBe(true);
      });
    });
  });
});
