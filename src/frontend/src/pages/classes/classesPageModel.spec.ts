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
import type { ClassPartial } from '../../services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '../../services/referenceData/referenceData.zod';
import type {
  InvalidClassesPageDataViewModel,
  ClassesPagePanelViewModel,
  ClassesPagePanelModel,
  ClassesPageCardModel,
} from './classesPageModel';
import { buildClassesPageModel } from './classesPageModel';

// ============================================================================
// Factory helpers
// ============================================================================

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

// ============================================================================
// Test data builders
// ============================================================================

/**
 * Builds a minimal valid dataset with one year group and specified classes.
 *
 * @param {ClassPartial[]} classPartials - The class partials to include.
 * @param {YearGroup[]} [yearGroups] - Optional year groups override.
 * @returns {{ yearGroups: YearGroup[]; classPartials: ClassPartial[] }} Test fixtures.
 */
function buildValidDataset(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[] = [createYearGroup('yg-1', 'Year 1')]
): { yearGroups: YearGroup[]; classPartials: ClassPartial[] } {
  return { yearGroups, classPartials };
}

/**
 * Test fixture builder for invalid data view model assertions.
 * Returns a valid ClassPartial and an invalid ClassPartial to test fail-closed behaviour.
 *
 * @param {string} validClassId - The classId for the valid class partial.
 * @param {string} invalidClassId - The classId for the invalid class partial.
 * @param {Partial<ClassPartial>} validOverrides - Overrides for the valid class partial.
 * @param {Partial<ClassPartial>} invalidOverrides - Overrides for the invalid class partial (must make it invalid).
 * @returns {{ yearGroups: YearGroup[]; classPartials: ClassPartial[]; validClassId: string; invalidClassId: string }} Test fixtures.
 */
function buildInvalidDataTestFixtures(
  validClassId: string,
  invalidClassId: string,
  validOverrides: Partial<ClassPartial> = {},
  invalidOverrides: Partial<ClassPartial> = {}
): {
  yearGroups: YearGroup[];
  classPartials: ClassPartial[];
  validClassId: string;
  invalidClassId: string;
} {
  return {
    yearGroups: [createYearGroup('yg-1', 'Year 1')],
    classPartials: [
      createClassPartial(validClassId, {
        className: 'Valid Class',
        yearGroupKey: 'yg-1',
        ...validOverrides,
      }),
      createClassPartial(invalidClassId, invalidOverrides),
    ],
    validClassId,
    invalidClassId,
  };
}

// ============================================================================
// Assertion helpers
// ============================================================================

/**
 * Asserts that the result is an InvalidClassesPageDataViewModel with expected classIds.
 *
 * @param {InvalidClassesPageDataViewModel | ClassesPagePanelViewModel} result - The result to assert.
 * @param {string[]} expectedInvalidIds - The classIds that should be in the invalid list.
 * @param {string[]} expectedValidIds - The classIds that should NOT be in the invalid list.
 */
function assertInvalidClassesPageDataViewModel(
  result: InvalidClassesPageDataViewModel | ClassesPagePanelViewModel,
  expectedInvalidIds: string[],
  expectedValidIds: string[]
): void {
  expect(result).toBeDefined();

  if (result && 'type' in result && result.type === 'invalidClassesPageData') {
    for (const id of expectedInvalidIds) {
      expect(result.classIds).toContain(id);
    }
    for (const id of expectedValidIds) {
      expect(result.classIds).not.toContain(id);
    }
  } else {
    expect(result).toHaveProperty('type', 'invalidClassesPageData');
  }
}

/**
 * Asserts that the result is a ClassesPagePanelViewModel with expected panel structure.
 *
 * @param {InvalidClassesPageDataViewModel | ClassesPagePanelViewModel} result - The result to assert.
 * @param {number} expectedPanelCount - Expected number of panels.
 * @param {((panel: ClassesPagePanelModel, index: number) => void) | null} [panelAssertions] - Optional per-panel assertions.
 */
function assertClassesPagePanelViewModel(
  result: InvalidClassesPageDataViewModel | ClassesPagePanelViewModel,
  expectedPanelCount: number,
  panelAssertions?: (panel: ClassesPagePanelModel, index: number) => void
): void {
  expect(result).toBeDefined();

  if (result && 'panels' in result) {
    expect(result.panels).toHaveLength(expectedPanelCount);
    if (panelAssertions) {
      for (let index = 0; index < result.panels.length; index++) {
        panelAssertions(result.panels[index], index);
      }
    }
  } else {
    expect(result).toHaveProperty('panels');
  }
}

// ============================================================================
// Invalid scenario descriptors for parameterized fail-closed tests
// ============================================================================

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

// ============================================================================
// Sorting assertion helpers
// ============================================================================

/**
 * Asserts that panels are sorted by YearGroup.name ascending, then by YearGroup.key ascending.
 *
 * @param {ClassesPagePanelModel[]} panels - The panels to verify.
 * @param {string[]} expectedYearGroupKeys - Expected year group keys in order.
 */
function assertPanelsSortedByNameThenKey(
  panels: ClassesPagePanelModel[],
  expectedYearGroupKeys: string[]
): void {
  expect(panels).toHaveLength(expectedYearGroupKeys.length);
  for (const [index, expectedYearGroupKey] of expectedYearGroupKeys.entries()) {
    expect(panels[index].yearGroupKey).toBe(expectedYearGroupKey);
  }
}

/**
 * Asserts that cards within a panel are sorted by className ascending, then by classId ascending.
 *
 * @param {ClassesPageCardModel[]} classes - The classes to verify.
 * @param {string[]} expectedClassIds - Expected class IDs in order.
 */
function assertCardsSortedByNameThenId(
  classes: ClassesPageCardModel[],
  expectedClassIds: string[]
): void {
  expect(classes).toHaveLength(expectedClassIds.length);
  for (const [index, expectedClassId] of expectedClassIds.entries()) {
    expect(classes[index].classId).toBe(expectedClassId);
  }
}

/**
 * Builds the model from valid data, asserts it returns a ClassesPagePanelViewModel,
 * and passes the valid model to the provided assertions callback.
 *
 * This encapsulates the common pattern used across tests:
 *   buildClassesPageModel → expect(result).toBeDefined() → type-guard → assertions
 *
 * @param {ClassPartial[]} classPartials - Class partials to build model with.
 * @param {YearGroup[]} yearGroups - Year groups to build model with.
 * @param {(model: ClassesPagePanelViewModel) => void} assertions - Assertions to run on the valid model.
 */
function buildAndAssertValidModel(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[],
  assertions: (model: ClassesPagePanelViewModel) => void
): void {
  const result = buildClassesPageModel(classPartials, yearGroups);
  expect(result).toBeDefined();
  if (result && 'panels' in result) {
    assertions(result);
  } else {
    expect(result).toHaveProperty('panels');
  }
}

// ============================================================================
// Test suites
// ============================================================================

describe('Classes page grouped view model - buildClassesPageModel', () => {
  // --------------------------------------------------------------------------
  // Panel sorting
  // --------------------------------------------------------------------------

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
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        expect(result.panels).toHaveLength(2);
        // Year 1 panel has 1 class
        expect(result.panels[0].classes).toHaveLength(1);
        // Year 2 panel has 0 classes (empty panel)
        expect(result.panels[1].classes).toHaveLength(0);
        expect(result.panels[1].yearGroupKey).toBe('yg-2');
      });
    });
  });

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

  // --------------------------------------------------------------------------
  // Default expanded panel
  // --------------------------------------------------------------------------

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

      buildAndAssertValidModel(classPartials, yearGroups, (result) => {
        // Panels sorted alphabetically: Alice (yg-a), Bob (yg-b), Charlie (yg-c)
        // First alphabetical panel key should be yg-a
        expect(result.defaultExpandedPanelKeys).toHaveLength(1);
        expect(result.defaultExpandedPanelKeys[0]).toBe('yg-a');
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

      assertClassesPagePanelViewModel(result, 1, (panel) => {
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

      assertClassesPagePanelViewModel(result, 1, (panel) => {
        expect(panel).toHaveProperty('yearGroupKey', 'yg-1');
        expect(panel).toHaveProperty('yearGroupLabel', 'Year One');
        expect(panel).toHaveProperty('classes');
        expect(Array.isArray(panel.classes)).toBe(true);
      });
    });
  });
});
