/**
 * Classes page grouped view model builder.
 *
 * Files read (Mandatory Reading):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
 * - src/frontend/src/services/classPartialsService.ts
 * - src/frontend/src/services/referenceDataService.ts
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/features/classes/ClassesTable.helpers.ts
 * - src/frontend/src/pages/classes/classesPageModel.spec.ts
 * - src/frontend/src/services/classPartials.zod.ts
 * - src/frontend/src/services/referenceData.zod.ts
 */

import type { ClassPartial } from '../../services/classPartials.zod';
import type { YearGroup } from '../../services/referenceData.zod';

/**
 * Card model for a single class in the Classes page.
 */
type ClassesPageCardModel = {
  classId: string;
  className: string;
  yearGroupKey: string;
  yearGroupLabel: string;
};

/**
 * Panel model for a year group containing its classes.
 */
type ClassesPagePanelModel = {
  yearGroupKey: string;
  yearGroupLabel: string;
  classes: ClassesPageCardModel[];
};

/**
 * Complete view model for the Classes page with panels and default expanded keys.
 */
export type ClassesPagePanelViewModel = {
  panels: ClassesPagePanelModel[];
  defaultExpandedPanelKeys: string[];
};

/**
 * Invalid data view model returned when trust validation fails.
 */
export type InvalidClassesPageDataViewModel = {
  type: 'invalidClassesPageData';
  classIds: string[];
};

/**
 * Comparator for locale-aware, case-insensitive string comparison.
 *
 * @param {string} a - First string to compare.
 * @param {string} b - Second string to compare.
 * @returns {number} Negative if a < b, positive if a > b, 0 if equal.
 */
function compareStringsLocally(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Validates a single class partial for trust.
 *
 * @param {ClassPartial} classPartial - The class partial to validate.
 * @param {Set<string>} yearGroupKeySet - Set of valid year group keys.
 * @returns {string | null} The classId if invalid, null if valid.
 */
function validateClassTrust(
  classPartial: ClassPartial,
  yearGroupKeySet: Set<string>
): string | null {
  if (classPartial.className == null) {
    return classPartial.classId;
  }
  if (classPartial.yearGroupKey == null) {
    return classPartial.classId;
  }
  if (!yearGroupKeySet.has(classPartial.yearGroupKey)) {
    return classPartial.classId;
  }
  return null;
}

/**
 * Sorts year groups by name ascending, then by key ascending for deterministic tie-break.
 *
 * @param {YearGroup[]} yearGroups - Year groups to sort.
 * @returns {YearGroup[]} Sorted year groups.
 */
function sortYearGroups(yearGroups: YearGroup[]): YearGroup[] {
  return yearGroups.toSorted((a, b) => {
    const nameComparison = compareStringsLocally(a.name, b.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    return compareStringsLocally(a.key, b.key);
  });
}

/**
 * Sorts class partials by className ascending, then by classId ascending for deterministic tie-break.
 *
 * @remarks Caller must ensure all class partials have non-null className and yearGroupKey.
 *   Trust validation via validateClassTrust must be performed before calling this function.
 * @param {ClassPartial[]} classPartials - Class partials to sort (already validated as trustworthy).
 * @returns {ClassPartial[]} Sorted class partials.
 */
function sortClassPartials(classPartials: ClassPartial[]): ClassPartial[] {
  return classPartials.toSorted((a, b) => {
    const nameComparison = compareStringsLocally(a.className!, b.className!);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    return compareStringsLocally(a.classId, b.classId);
  });
}

/**
 * Converts a trust-validated class partial to a card model.
 *
 * @remarks classPartial MUST have non-null className and yearGroupKey. Caller is responsible
 *   for validating via validateClassTrust before invoking this function.
 * @param {ClassPartial} classPartial - The class partial (already validated as trustworthy).
 * @param {string} yearGroupLabel - The year group label.
 * @returns {ClassesPageCardModel} The card model.
 */
function toCardModel(classPartial: ClassPartial, yearGroupLabel: string): ClassesPageCardModel {
  return {
    classId: classPartial.classId,
    className: classPartial.className!,
    yearGroupKey: classPartial.yearGroupKey!,
    yearGroupLabel,
  };
}

/**
 * Groups trust-validated class partials by their year group key.
 *
 * @remarks All class partials MUST have non-null yearGroupKey. Caller is responsible
 *   for validating via validateClassTrust before invoking this function.
 * @param {ClassPartial[]} classPartials - Class partials (already validated as trustworthy).
 * @returns {Map<string, ClassPartial[]>} Map of year group key to class partials.
 */
function groupClassesByYearGroupKey(classPartials: ClassPartial[]): Map<string, ClassPartial[]> {
  const classesByYearGroupKey = new Map<string, ClassPartial[]>();
  for (const classPartial of classPartials) {
    const key = classPartial.yearGroupKey!;
    if (!classesByYearGroupKey.has(key)) {
      classesByYearGroupKey.set(key, []);
    }
    classesByYearGroupKey.get(key)!.push(classPartial);
  }
  return classesByYearGroupKey;
}

/**
 * Builds panels from sorted year groups and grouped classes.
 *
 * @param {YearGroup[]} sortedYearGroups - Sorted year groups.
 * @param {Map<string, ClassPartial[]>} classesByYearGroupKey - Classes grouped by year group key.
 * @returns {ClassesPagePanelModel[]} Array of panel models.
 */
function buildPanels(
  sortedYearGroups: YearGroup[],
  classesByYearGroupKey: Map<string, ClassPartial[]>
): ClassesPagePanelModel[] {
  const panels: ClassesPagePanelModel[] = [];

  for (const yg of sortedYearGroups) {
    const matchingClasses = classesByYearGroupKey.get(yg.key) ?? [];
    const sortedClasses = sortClassPartials(matchingClasses);
    const classes = sortedClasses.map((c) => toCardModel(c, yg.name));

    panels.push({
      yearGroupKey: yg.key,
      yearGroupLabel: yg.name,
      classes,
    });
  }

  return panels;
}

/**
 * Builds the Classes page grouped view model from class partials and year groups.
 *
 * This is a PURE function with no side effects. It validates trust, sorts data
 * deterministically, and produces the panel/card model required by the page.
 *
 * Trust validation (FAIL CLOSED):
 * - Rejects any ClassPartial with `className === null`
 * - Rejects any ClassPartial with `yearGroupKey === null`
 * - Rejects any ClassPartial where `yearGroupKey` does not exist in the `yearGroups` array
 * - If ANY class is rejected, returns `InvalidClassesPageDataViewModel` with the `classIds`
 *   of all invalid classes
 *
 * Empty states:
 * - If `yearGroups = []` AND `classPartials = []`: Returns `{ panels: [], defaultExpandedPanelKeys: [] }`
 * - If `yearGroups = []` BUT `classPartials` has items: Returns `InvalidClassesPageDataViewModel`
 *   (can't group classes without year groups)
 *
 * Panel generation:
 * - Every `yearGroup` in the input produces ONE panel, even if no classes match it
 * - Panels are sorted by `YearGroup.name` ascending, then `YearGroup.key` ascending
 * - Classes within each panel are sorted by `className` ascending, then `classId` ascending
 * - Only includes classes that have a matching `yearGroupKey` in the yearGroups array AND pass trust validation
 *
 * Default expanded panel:
 * - `defaultExpandedPanelKeys`: Array with the `yearGroupKey` of the first alphabetical panel
 * - If panels array is empty, returns empty array
 * - Only one panel is in the defaultExpandedPanelKeys array
 *
 * @param {ClassPartial[]} classPartials - Array of class partial objects.
 * @param {YearGroup[]} yearGroups - Array of year group objects.
 * @returns {ClassesPagePanelViewModel | InvalidClassesPageDataViewModel} The view model or invalid data model.
 */
export function buildClassesPageModel(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[]
): ClassesPagePanelViewModel | InvalidClassesPageDataViewModel {
  // Handle empty yearGroups
  if (yearGroups.length === 0) {
    if (classPartials.length === 0) {
      return {
        panels: [],
        defaultExpandedPanelKeys: [],
      };
    }
    // yearGroups is empty but classes exist - can't group, invalid
    return {
      type: 'invalidClassesPageData',
      classIds: classPartials.map((c) => c.classId),
    };
  }

  // Build a set of valid year group keys for O(1) lookup
  const yearGroupKeySet = new Set(yearGroups.map((yg) => yg.key));

  // Collect invalid class IDs
  const invalidClassIds: string[] = [];
  for (const classPartial of classPartials) {
    const invalidId = validateClassTrust(classPartial, yearGroupKeySet);
    if (invalidId !== null) {
      invalidClassIds.push(invalidId);
    }
  }

  // If any invalid classes found, return invalid view model
  if (invalidClassIds.length > 0) {
    return {
      type: 'invalidClassesPageData',
      classIds: invalidClassIds,
    };
  }

  // Sort year groups
  const sortedYearGroups = sortYearGroups(yearGroups);

  // Group classes by year group key
  const classesByYearGroupKey = groupClassesByYearGroupKey(classPartials);

  // Build panels
  const panels = buildPanels(sortedYearGroups, classesByYearGroupKey);

  // Determine default expanded panel keys - first alphabetical panel (already sorted)
  const defaultExpandedPanelKeys: string[] = panels.length > 0 ? [panels[0].yearGroupKey] : [];

  return {
    panels,
    defaultExpandedPanelKeys,
  };
}
