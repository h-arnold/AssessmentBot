/**
 * Shared builders and assertion helpers for the ClassesPage grouped view-model
 * suites (`classesPageModel.*.spec.ts`).
 *
 * These helpers are the characterised factories and assertion utilities from
 * the original single `classesPageModel.spec.ts` file, moved verbatim so the
 * split merge-base, sorting/grouping and fail-closed validation suites build
 * and assert identical fixtures.
 */

import { expect } from 'vitest';
import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '@/services/referenceData/referenceData.zod';
import type {
  InvalidClassesPageDataViewModel,
  ClassesPagePanelViewModel,
  ClassesPagePanelModel,
  ClassesPageCardModel,
} from '@/pages/classesPageModel';
import { buildClassesPageModel } from '@/pages/classesPageModel';
import { createCanonicalMetadataFixture } from '@/test/abClass/abClassMetadataFixtures';

// ============================================================================
// Factory helpers
// ============================================================================

/**
 * Helper to create a YearGroup with its key and name.
 *
 * @param {string} key - The year group key.
 * @param {string} name - The year group name.
 * @returns {YearGroup} A YearGroup instance with the specified properties.
 */
export function createYearGroup(key: string, name: string): YearGroup {
  return {
    key,
    name,
  };
}

/**
 * Helper to create a ClassPartial with optional overrides.
 *
 * @param {string} classId - The class identifier.
 * @param {Partial<ClassPartial>} [overrides={}] - Optional partial overrides for the class partial properties.
 * @returns {ClassPartial} A ClassPartial instance with the specified properties.
 */
export function createClassPartial(
  classId: string,
  overrides: Partial<ClassPartial> = {}
): ClassPartial {
  return {
    classId,
    className: 'Test Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-1',
    classOwner: null,
    teachers: [],
    active: null,
    metadata: createCanonicalMetadataFixture(),
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
 * Builds the shared Alice/Bob/Charlie year-group and class-partial fixture used by the
 * panel-sorting and default-expanded-panel tests.
 *
 * The fixture is deliberately unsorted: `yg-c` (Charlie) precedes `yg-a` (Alice) and
 * `yg-b` (Bob) so the tests can assert that presentation order is derived, not input
 * order. The default-expanded-panel test uses this fixture as-is; the panel-sorting
 * test appends two same-named year groups (`yg-y`, `yg-z`) and their classes so the
 * key tie-break can be exercised.
 *
 * @returns {{ yearGroups: YearGroup[]; classPartials: ClassPartial[] }} The Alice/Bob/Charlie fixture.
 */
export function buildAliceBobCharlieFixture(): {
  yearGroups: YearGroup[];
  classPartials: ClassPartial[];
} {
  return {
    yearGroups: [
      createYearGroup('yg-c', 'Charlie'),
      createYearGroup('yg-a', 'Alice'),
      createYearGroup('yg-b', 'Bob'),
    ],
    classPartials: [
      createClassPartial('c1', { className: 'Class 1', yearGroupKey: 'yg-a' }),
      createClassPartial('c2', { className: 'Class 2', yearGroupKey: 'yg-b' }),
      createClassPartial('c3', { className: 'Class 3', yearGroupKey: 'yg-c' }),
    ],
  };
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
 * @param {((panel: ClassesPagePanelModel, index: number) => void) | null} [panelAssertions] - Optional per-panel assertions.
 */
export function assertClassesPagePanelViewModel(
  result: InvalidClassesPageDataViewModel | ClassesPagePanelViewModel,
  panelAssertions?: (panel: ClassesPagePanelModel, index: number) => void
): void {
  expect(result).toBeDefined();

  if (result && 'panels' in result) {
    expect(result.panels).toHaveLength(1);
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
