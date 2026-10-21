/**
 * ClassesPage model assertion helpers.
 *
 * Owns the view-model verification and type-guard helpers that assert on
 * `buildClassesPageModel` results. Moved verbatim from
 * `classesPageTestHelpers.tsx` as a green responsibility-based refactor;
 * import through the `classesPageTestHelpers` compatibility facade or
 * directly from this module.
 */

import { buildClassesPageModel } from '@/pages/classesPageModel';
import type {
  ClassesPagePanelModel,
  InvalidClassesPageDataViewModel,
} from '@/pages/classesPageModel';
import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '@/services/referenceData/referenceData.zod';

/**
 * Builds and verifies the ClassesPage model result.
 *
 * This helper builds the view model and provides type-safe access to the result.
 *
 * @param {ClassPartial[]} classPartials - Class partials to build model with.
 * @param {YearGroup[]} yearGroups - Year groups to build model with.
 * @returns {{ modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel; isInvalid: boolean; isEmpty: boolean }} Model result with validation flags.
 */
export function verifyClassesPageModel(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[]
): {
  modelResult: ReturnType<typeof buildClassesPageModel>;
  isInvalid: boolean;
  isEmpty: boolean;
} {
  const modelResult = buildClassesPageModel(classPartials, yearGroups);
  const isInvalid = 'type' in modelResult && modelResult.type === 'invalidClassesPageData';
  const isEmpty = !isInvalid && 'panels' in modelResult && modelResult.panels.length === 0;

  return { modelResult, isInvalid, isEmpty };
}

/**
 * Type guard for ClassesPagePanelViewModel.
 *
 * @param {unknown} modelResult - The model result to check.
 * @returns {boolean} True if valid panel view model.
 */
export function isValidPanelViewModel(modelResult: unknown): modelResult is ClassesPagePanelModel {
  return (
    typeof modelResult === 'object' &&
    modelResult !== null &&
    !('type' in modelResult) &&
    'panels' in modelResult &&
    'defaultExpandedPanelKeys' in modelResult
  );
}

/**
 * Type guard for InvalidClassesPageDataViewModel.
 *
 * @param {unknown} modelResult - The model result to check.
 * @returns {boolean} True if invalid data view model.
 */
export function isInvalidDataViewModel(
  modelResult: unknown
): modelResult is InvalidClassesPageDataViewModel {
  return (
    typeof modelResult === 'object' &&
    modelResult !== null &&
    'type' in modelResult &&
    (modelResult as { type: string }).type === 'invalidClassesPageData'
  );
}

/**
 * Asserts that a panel with the given year group key exists and has the expected number of classes.
 *
 * @param {ReturnType<typeof buildClassesPageModel>} modelResult - The model result.
 * @param {string} yearGroupKey - The year group key to find.
 * @param {number} expectedClassCount - Expected number of classes in the panel.
 * @returns {ClassesPagePanelModel} The panel model.
 */
export function assertPanelHasClassCount(
  modelResult: ReturnType<typeof buildClassesPageModel>,
  yearGroupKey: string,
  expectedClassCount: number
): ClassesPagePanelModel {
  if (isInvalidDataViewModel(modelResult)) {
    throw new Error('Cannot check panel class count: model result is invalid');
  }

  const panel = modelResult.panels.find(
    (p) => (p as { yearGroupKey: string }).yearGroupKey === yearGroupKey
  );
  expect(panel).toBeDefined();
  expect((panel as { classes: unknown[] }).classes).toHaveLength(expectedClassCount);
  // Cast to the expected type - we've already validated the model is not invalid
  return panel as ClassesPagePanelModel;
}
