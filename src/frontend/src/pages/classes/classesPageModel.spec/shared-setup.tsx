/**
 * Shared test setup for classesPageModel spec.
 *
 * Contains all factory helpers, test data builders, assertion helpers,
 * scenario descriptors, and sorting assertion helpers used across
 * the classesPageModel test suite.
 *
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
import { expect } from 'vitest';
import type { ClassPartial } from '../../../services/classPartials.zod';
import type { YearGroup } from '../../../services/referenceData.zod';
import type {
  InvalidClassesPageDataViewModel,
  ClassesPagePanelViewModel,
  ClassesPagePanelModel,
  ClassesPageCardModel,
} from '../classesPageModel';
import { buildClassesPageModel } from '../classesPageModel';

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
export function createYearGroup(key: string, name: string, overrides: Partial<YearGroup> = {}): YearGroup {
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
export function createClassPartial(classId: string, overrides: Partial<ClassPartial> = {}): ClassPartial {
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
export function buildValidDataset(
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
export function buildInvalidDataTestFixtures(
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
export function assertInvalidClassesPageDataViewModel(
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
export function assertClassesPagePanelViewModel(
  result: InvalidClassesPageDataViewModel | ClassesPagePanelViewModel,
  expectedPanelCount: number,
  panelAssertions?: (panel: ClassesPagePanelModel, index: number) => void
): void {
  expect(result).toBeDefined();

  if (result && 'panels' in result) {
    expect(result.panels).toHaveLength(expectedPanelCount);
    if (panelAssertions) {
      for (let index = 0; index < result.panels.length; index++) {
        // eslint-disable-next-line security/detect-object-injection -- test helper iterating array indices
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
export interface FailClosedScenario {
  name: string;
  validClassId: string;
  invalidClassId: string;
  validOverrides: Partial<ClassPartial>;
  invalidOverrides: Partial<ClassPartial>;
}

/**
 * Predefined fail-closed scenarios for parameterized testing.
 */
export const failClosedScenarios: FailClosedScenario[] = [
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
export function assertPanelsSortedByNameThenKey(
  panels: ClassesPagePanelModel[],
  expectedYearGroupKeys: string[]
): void {
  expect(panels).toHaveLength(expectedYearGroupKeys.length);
  for (const [index, expectedYearGroupKey] of expectedYearGroupKeys.entries()) {
    // eslint-disable-next-line security/detect-object-injection -- test helper accessing array by index
    expect(panels[index].yearGroupKey).toBe(expectedYearGroupKey);
  }
}

/**
 * Asserts that cards within a panel are sorted by className ascending, then by classId ascending.
 *
 * @param {ClassesPageCardModel[]} classes - The classes to verify.
 * @param {string[]} expectedClassIds - Expected class IDs in order.
 */
export function assertCardsSortedByNameThenId(
  classes: ClassesPageCardModel[],
  expectedClassIds: string[]
): void {
  expect(classes).toHaveLength(expectedClassIds.length);
  for (const [index, expectedClassId] of expectedClassIds.entries()) {
    // eslint-disable-next-line security/detect-object-injection -- test helper accessing array by index
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
export function buildAndAssertValidModel(
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
