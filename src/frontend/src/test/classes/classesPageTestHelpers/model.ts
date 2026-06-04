/**
 * Model verification helpers for ClassesPage component tests.
 */

import { buildClassesPageModel } from '../../../pages/classes/classesPageModel';
import type {
  ClassesPagePanelModel,
  InvalidClassesPageDataViewModel,
} from '../../../pages/classes/classesPageModel';
import type { ClassPartial } from '../../../services/classPartials.zod';
import type { YearGroup } from '../../../services/referenceData.zod';

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
