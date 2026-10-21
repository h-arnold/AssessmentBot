/**
 * Shared test helpers for ClassesPage component tests.
 *
 * Compatibility facade. The original single module was split verbatim into
 * focused helper modules:
 *
 * - `classesPageTestFixtures.ts` — fixture factories and fixture constants.
 * - `classesPageRenderHelpers.tsx` — query-client preparation and rendering.
 * - `classesPageModelAssertions.ts` — view-model verification and type guards.
 * - `classesPageScreenAssertions.tsx` — DOM/screen-query assertion utilities.
 *
 * This facade re-exports the public symbols of those modules and keeps owning
 * the documented E2E serialisation helper (`toPlainClassPartials`), so existing
 * consumers (component specs, shared test helpers and E2E scenario helpers)
 * keep importing from `classesPageTestHelpers` unchanged. New call sites may
 * import from the owning module directly.
 */

import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';

export {
  createFixtureClassPartial,
  createFixtureYearGroup,
  MOCK_YEAR_GROUPS,
  MOCK_CLASS_PARTIALS,
  MOCK_EMPTY_CLASS_PARTIALS,
  MOCK_EMPTY_YEAR_GROUPS,
  MOCK_INVALID_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  MIXED_ORDER_CLASS_PARTIALS,
  YEAR_GROUPS_WITH_EMPTY,
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
  SINGLE_YEAR_GROUP,
} from './classesPageTestFixtures';

// Convenience aliases preserved verbatim from the original single module; these
// remain the same module bindings, not copied arrays.
export {
  MOCK_YEAR_GROUPS as DEFAULT_YEAR_GROUPS,
  MOCK_CLASS_PARTIALS as DEFAULT_CLASS_PARTIALS,
} from './classesPageTestFixtures';

export {
  type RenderClassesPageOptions,
  renderClassesPage,
  renderEmptyClassesPage,
  renderInvalidClassesPage,
  createQueryClientWithClassesData,
} from './classesPageRenderHelpers';

export {
  verifyClassesPageModel,
  isValidPanelViewModel,
  isInvalidDataViewModel,
  assertPanelHasClassCount,
} from './classesPageModelAssertions';

export {
  assertCollapseRegion,
  assertNoCollapseRegion,
  assertBlockingAlert,
  assertNoBlockingAlert,
  assertLoadingSkeleton,
  assertNoLoadingSkeleton,
  assertEmptyState,
  assertClassesPageHeading,
  getClassCardByName,
  assertClassCardExists,
  assertPanelHeader,
  assertPanelHeaderExpanded,
  assertPanelContainsClass,
  assertPanelEmpty,
} from './classesPageScreenAssertions';

// ============================================================================
// Plain-object conversion utilities (for E2E test serialisation)
// ============================================================================

/**
 * Converts typed ClassPartial fixtures to plain JavaScript objects
 * suitable for JSON serialisation in E2E test init scripts.
 *
 * The whole nullable `metadata` snapshot is carried verbatim because the class
 * read contract requires it on every successful read; it is never defaulted,
 * faked, or omitted. Callers provide fixtures whose `metadata` already
 * satisfies the read contract.
 *
 * @param {ClassPartial[]} classPartials - Typed class partials to convert.
 * @returns {Array<Record<string, unknown>>} Plain objects.
 */
export function toPlainClassPartials(
  classPartials: ClassPartial[]
): Array<Record<string, unknown>> {
  return classPartials.map((cp) => {
    return {
      classId: cp.classId,
      className: cp.className,
      cohortKey: cp.cohortKey,
      courseLength: cp.courseLength,
      yearGroupKey: cp.yearGroupKey,
      classOwner: cp.classOwner,
      teachers: cp.teachers,
      active: cp.active,
      metadata: cp.metadata,
    };
  });
}
