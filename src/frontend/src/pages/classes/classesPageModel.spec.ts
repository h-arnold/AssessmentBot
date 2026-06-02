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
 */
import { describe, it, expect } from 'vitest';
import type { ClassPartial } from '../../services/classPartials.zod';
import type { YearGroup } from '../../services/referenceData.zod';

// These types represent the expected model shapes from SPEC.md
// They will be used to type-check the return values once the implementation exists

type ClassesPageCardModel = {
  classId: string;
  className: string;
  yearGroupKey: string;
  yearGroupLabel: string;
};

type ClassesPagePanelModel = {
  yearGroupKey: string;
  yearGroupLabel: string;
  classes: ClassesPageCardModel[];
};

type ClassesPagePanelViewModel = {
  panels: ClassesPagePanelModel[];
  defaultExpandedPanelKeys: string[];
};

type InvalidClassesPageDataViewModel = {
  type: 'invalidClassesPageData';
  classIds: string[];
};

// This import will fail until the implementation is created in the GREEN phase
// The tests below are written to fail with "function not defined" errors
let buildClassesPageModel: (
  classPartials: ClassPartial[],
  yearGroups: YearGroup[]
) => ClassesPagePanelViewModel | InvalidClassesPageDataViewModel;

try {
  // Attempt to import the implementation - will throw until it exists
  // Dynamic import is acceptable here for lazy loading in tests
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const module = (await import('./classesPageModel')) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  buildClassesPageModel = module.buildClassesPageModel;
} catch {
  // Expected in RED phase - function does not exist yet
  // Tests will fail with appropriate errors
}

/**
 * Helper to create a YearGroup with optional overrides.
 *
 * @param {string} key - The year group key.
 * @param {string} name - The year group name.
 * @param {Partial<YearGroup>} [overrides={}] - Optional partial overrides for the year group properties.
 * @returns {YearGroup} A YearGroup instance with the specified properties.
 */
function createYearGroup(key: string, name: string, overrides: Partial<YearGroup> = {}): YearGroup {
  return {
    key,
    name,
    ...overrides,
  };
}

/**
 * Helper to create a ClassPartial with optional overrides.
 *
 * @param {string} classId - The class identifier.
 * @param {Partial<ClassPartial>} [overrides={}] - Optional partial overrides for the class partial properties.
 * @returns {ClassPartial} A ClassPartial instance with the specified properties.
 */
function createClassPartial(classId: string, overrides: Partial<ClassPartial> = {}): ClassPartial {
  return {
    classId,
    className: 'Test Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-1',
    classOwner: null,
    teachers: [],
    active: null,
    ...overrides,
  };
}

describe('Classes page grouped view model - buildClassesPageModel', () => {
  describe('Panel sorting', () => {
    it('should sort panels by YearGroup.name ascending, using YearGroup.key as deterministic tie-break', () => {
      const yearGroups = [
        createYearGroup('yg-c', 'Charlie'),
        createYearGroup('yg-a', 'Alice'),
        createYearGroup('yg-b', 'Bob'),
        // Same name, different keys - should use key as tie-break
        createYearGroup('yg-z', 'Alice'),
        createYearGroup('yg-y', 'Alice'),
      ];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-a' }),
        createClassPartial('c2', { className: 'Class 2', yearGroupKey: 'yg-b' }),
        createClassPartial('c3', { className: 'Class 3', yearGroupKey: 'yg-c' }),
        createClassPartial('c4', { className: 'Class 4', yearGroupKey: 'yg-y' }),
        createClassPartial('c5', { className: 'Class 5', yearGroupKey: 'yg-z' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      // Expect the function to be defined and return the correct type
      expect(result).toBeDefined();

      // When implementation exists, we'll check the panel order
      if (result && 'panels' in result) {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels).toHaveLength(5);
        // Sorted by name ascending, then by key ascending for ties
        // Alice panels: yg-a (key: a), yg-y (key: y), yg-z (key: z)
        expect(result.panels[0].yearGroupKey).toBe('yg-a');
        expect(result.panels[1].yearGroupKey).toBe('yg-y');
        expect(result.panels[2].yearGroupKey).toBe('yg-z');
        // Then Bob
        expect(result.panels[3].yearGroupKey).toBe('yg-b');
        // Then Charlie
        expect(result.panels[4].yearGroupKey).toBe('yg-c');
      }
    });
  });

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

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        expect(result.panels).toHaveLength(1);
        const panel = result.panels[0];

        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(panel.classes).toHaveLength(5);
        // Sorted by className: Alpha, Alpha, Alpha, Beta, Zebra
        // Alpha with classId c-aaa comes before c-aab, which comes before c-alpha

        expect(panel.classes[0].classId).toBe('c-aaa');

        expect(panel.classes[1].classId).toBe('c-aab');

        expect(panel.classes[2].classId).toBe('c-alpha');

        expect(panel.classes[3].classId).toBe('c-beta');

        expect(panel.classes[4].classId).toBe('c-zebra');
      }
    });
  });

  describe('Empty panel', () => {
    it('should return an empty panel for a year group with no matching classes', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1'), createYearGroup('yg-2', 'Year 2')];

      const classPartials: ClassPartial[] = [
        // Only classes for year group 1
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-1' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels).toHaveLength(2);
        // Year 1 panel has 1 class
        expect(result.panels[0].classes).toHaveLength(1);
        // Year 2 panel has 0 classes (empty panel)
        expect(result.panels[1].classes).toHaveLength(0);

        expect(result.panels[1].yearGroupKey).toBe('yg-2');
      }
    });
  });

  describe('Fail-closed on null className', () => {
    it('should reject records with className === null and return invalid data view model', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Valid Class', yearGroupKey: 'yg-1' }),
        createClassPartial('c2', { className: null, yearGroupKey: 'yg-1' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      // Should return invalid data view model
      if (result && 'type' in result && result.type === 'invalidClassesPageData') {
        expect(result.classIds).toContain('c2');
        expect(result.classIds).not.toContain('c1');
      } else {
        // If not invalid, this test should fail
        expect(result).toHaveProperty('type', 'invalidClassesPageData');
      }
    });
  });

  describe('Fail-closed on null yearGroupKey', () => {
    it('should reject records with yearGroupKey === null and return invalid data view model', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Valid Class', yearGroupKey: 'yg-1' }),
        createClassPartial('c2', { className: 'Orphan Class', yearGroupKey: null }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'type' in result && result.type === 'invalidClassesPageData') {
        expect(result.classIds).toContain('c2');
        expect(result.classIds).not.toContain('c1');
      } else {
        expect(result).toHaveProperty('type', 'invalidClassesPageData');
      }
    });
  });

  describe('Fail-closed on unresolved yearGroupKey', () => {
    it('should reject records where yearGroupKey does not resolve in yearGroups dataset and return invalid data view model', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year 1'), createYearGroup('yg-2', 'Year 2')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Valid Class', yearGroupKey: 'yg-1' }),
        createClassPartial('c2', { className: 'Unresolved Class', yearGroupKey: 'yg-nonexistent' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'type' in result && result.type === 'invalidClassesPageData') {
        expect(result.classIds).toContain('c2');
        expect(result.classIds).not.toContain('c1');
      } else {
        expect(result).toHaveProperty('type', 'invalidClassesPageData');
      }
    });
  });

  describe('Both-empty page-level empty state', () => {
    it('should return page-level empty state when yearGroups = [] and classPartials = []', () => {
      const yearGroups: YearGroup[] = [];
      const classPartials: ClassPartial[] = [];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      // Should return an empty panels array representing page-level empty state
      if (result && 'panels' in result) {
        expect(result.panels).toHaveLength(0);
        expect(result.defaultExpandedPanelKeys).toHaveLength(0);
      } else {
        // Force failure if not the expected type
        expect(result).toHaveProperty('panels');
      }
    });
  });

  describe('YearGroups empty with existing classes', () => {
    it('should return blocking invalid-data state when yearGroups = [] but classes exist', () => {
      const yearGroups: YearGroup[] = [];
      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-1' }),
        createClassPartial('c2', { className: 'Class 2', yearGroupKey: 'yg-2' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      // Should return invalid data view model since classes cannot be grouped
      if (result && 'type' in result && result.type === 'invalidClassesPageData') {
        expect(result.classIds).toContain('c1');
        expect(result.classIds).toContain('c2');
      } else {
        expect(result).toHaveProperty('type', 'invalidClassesPageData');
      }
    });
  });

  describe('Default-expanded first alphabetical panel key', () => {
    it('should return the first alphabetical panel key as default-expanded when panels exist', () => {
      const yearGroups = [
        createYearGroup('yg-c', 'Charlie'),
        createYearGroup('yg-a', 'Alice'),
        createYearGroup('yg-b', 'Bob'),
      ];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-a' }),
        createClassPartial('c2', { className: 'Class 2', yearGroupKey: 'yg-b' }),
        createClassPartial('c3', { className: 'Class 3', yearGroupKey: 'yg-c' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        // Panels sorted alphabetically: Alice (yg-a), Bob (yg-b), Charlie (yg-c)
        // First alphabetical panel key should be yg-a
        expect(result.defaultExpandedPanelKeys).toHaveLength(1);
        expect(result.defaultExpandedPanelKeys[0]).toBe('yg-a');
      }
    });
  });

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
        // Year 11 with no classes (should still produce empty panel)
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        // Should have 3 panels (one per year group)
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels).toHaveLength(3);

        // Panels sorted by name: Year 10, Year 11, Year 12
        expect(result.panels[0].yearGroupKey).toBe('yg-10');
        expect(result.panels[0].yearGroupLabel).toBe('Year 10');

        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels[0].classes).toHaveLength(2);
        // Cards sorted by className: Art, Biology
        expect(result.panels[0].classes[0].className).toBe('Art');

        expect(result.panels[0].classes[1].className).toBe('Biology');

        expect(result.panels[1].yearGroupKey).toBe('yg-11');
        expect(result.panels[1].yearGroupLabel).toBe('Year 11');

        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels[1].classes).toHaveLength(3);
        // Cards sorted by className: Chemistry, Maths, Physics
        expect(result.panels[1].classes[0].className).toBe('Chemistry');

        expect(result.panels[1].classes[1].className).toBe('Maths');

        expect(result.panels[1].classes[2].className).toBe('Physics');

        expect(result.panels[2].yearGroupKey).toBe('yg-12');
        expect(result.panels[2].yearGroupLabel).toBe('Year 12');
        expect(result.panels[2].classes).toHaveLength(1);

        // Default expanded should be first alphabetical panel (Year 10 / yg-10)
        expect(result.defaultExpandedPanelKeys).toEqual(['yg-10']);
      }
    });
  });

  describe('Card model fields', () => {
    it('should produce card model with classId, className, yearGroupKey, and yearGroupLabel', () => {
      const yearGroups = [createYearGroup('yg-1', 'First Year')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Test Class', yearGroupKey: 'yg-1' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        expect(result.panels).toHaveLength(1);
        const card = result.panels[0].classes[0];
        expect(card).toHaveProperty('classId', 'c1');
        expect(card).toHaveProperty('className', 'Test Class');
        expect(card).toHaveProperty('yearGroupKey', 'yg-1');
        expect(card).toHaveProperty('yearGroupLabel', 'First Year');
      }
    });
  });

  describe('Panel model fields', () => {
    it('should produce panel model with yearGroupKey, yearGroupLabel, and classes array', () => {
      const yearGroups = [createYearGroup('yg-1', 'Year One')];

      const classPartials: ClassPartial[] = [
        createClassPartial('c1', { className: 'Class A', yearGroupKey: 'yg-1' }),
      ];

      const result = buildClassesPageModel(classPartials, yearGroups);

      expect(result).toBeDefined();

      if (result && 'panels' in result) {
        expect(result.panels).toHaveLength(1);
        const panel = result.panels[0];
        expect(panel).toHaveProperty('yearGroupKey', 'yg-1');
        expect(panel).toHaveProperty('yearGroupLabel', 'Year One');
        expect(panel).toHaveProperty('classes');

        expect(Array.isArray(panel.classes)).toBe(true);
      }
    });
  });
});
