/**
 * Classes Page Test Helpers
 *
 * Barrel file re-exporting all public helpers for use in test files.
 */

export { ClassesPageTestHelpersRenderDummy } from './render';

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
  toPlainClassPartials,
  // Aliases matching original re-exports
  MOCK_YEAR_GROUPS as DEFAULT_YEAR_GROUPS,
  MOCK_CLASS_PARTIALS as DEFAULT_CLASS_PARTIALS,
} from './fixtures';

export {
  renderClassesPage,
  renderEmptyClassesPage,
  renderInvalidClassesPage,
  createQueryClientWithClassesData,
  type RenderClassesPageOptions,
} from './render';

export { verifyClassesPageModel, isValidPanelViewModel, isInvalidDataViewModel } from './model';

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
  assertPanelHasClassCount,
  assertPanelHeader,
  assertPanelHeaderExpanded,
  assertPanelContainsClass,
  assertPanelEmpty,
} from './assertions';
