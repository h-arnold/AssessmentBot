/**
 * Shared test helpers for ClassesPage component tests.
 * 
 * This module provides fixtures, rendering helpers, and assertion utilities
 * to reduce duplication in ClassesPage.spec.tsx.
 */

/* eslint-disable react-refresh/only-export-components -- This is a test helper file, not a component file */

import { screen } from '@testing-library/react';
import { type QueryClient } from '@tanstack/react-query';
import { renderWithFrontendProviders, type FrontendProvidersOptions } from '../renderWithFrontendProviders';
import { createAppQueryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';
import { buildClassesPageModel } from '../../pages/classes/classesPageModel';
import { ClassesPage } from '../../pages/ClassesPage';
import type { ClassPartial } from '../../services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '../../services/referenceData/referenceData.zod';
import type { ClassesPagePanelModel, InvalidClassesPageDataViewModel } from '../../pages/classes/classesPageModel';

// ============================================================================
// Fixture Factories
// ============================================================================

/**
 * Default field values shared by all ClassPartial fixtures.
 */
const CLASS_PARTIAL_DEFAULTS = {
  className: 'Test Class',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: 'default-yg',
  classOwner: null,
  teachers: [],
  active: null,
} as const;

/**
 * Creates a ClassPartial fixture with sensible defaults for all fields.
 *
 * Only `classId` is required. All other fields default to the project's
 * conventional fixture defaults (null for optional fields, empty arrays
 * for collections, 1 for course length).
 *
 * @param {Object} overrides - Field overrides. `classId` is required.
 * @returns {ClassPartial} A complete ClassPartial fixture object.
 */
export function createFixtureClassPartial(
  overrides: { classId: string } & Partial<ClassPartial>
): ClassPartial {
  return { ...CLASS_PARTIAL_DEFAULTS, ...overrides } as ClassPartial;
}

/**
 * Creates a YearGroup fixture with the given key and name.
 *
 * @param {string} key - The year group key.
 * @param {string} name - The year group name.
 * @returns {YearGroup} A YearGroup fixture object.
 */
export function createFixtureYearGroup(key: string, name: string): YearGroup {
  return { key, name };
}

// ============================================================================
// Fixture Constants
// ============================================================================

/**
 * Default mock year groups for ClassesPage tests.
 */
export const MOCK_YEAR_GROUPS: YearGroup[] = [
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
  createFixtureYearGroup('year-group-11', 'Year 11'),
];

/**
 * Default mock class partials for ClassesPage tests.
 */
export const MOCK_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-math-10b', className: 'Mathematics 10B', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-science-11', className: 'Science 11', yearGroupKey: 'year-group-11' }),
];

/**
 * Empty mock class partials.
 */
export const MOCK_EMPTY_CLASS_PARTIALS: ClassPartial[] = [];

/**
 * Empty mock year groups.
 */
export const MOCK_EMPTY_YEAR_GROUPS: YearGroup[] = [];

/**
 * Invalid class partials for trust failure testing.
 */
export const MOCK_INVALID_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-invalid-1', className: null, yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-invalid-2', className: 'Valid Class', yearGroupKey: null }),
  createFixtureClassPartial({ classId: 'class-invalid-3', className: 'Another Valid', yearGroupKey: 'year-group-invalid' }),
];

// ============================================================================
// Rendering Helpers
// ============================================================================

/**
 * Options for rendering ClassesPage with pre-populated query data.
 */
export interface RenderClassesPageOptions {
  classPartials?: ClassPartial[];
  yearGroups?: YearGroup[];
  warmupStateOverrides?: FrontendProvidersOptions;
}

/**
 * Renders ClassesPage with pre-populated query client data.
 * 
 * This is the primary rendering helper for ClassesPage tests.
 * It creates a query client, sets the query data, and renders the component
 * with frontend providers.
 * 
 * @param {RenderClassesPageOptions} options - Options for rendering.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderClassesPage(
  options: RenderClassesPageOptions = {}
): ReturnType<typeof renderWithFrontendProviders> {
  const {
    classPartials = MOCK_CLASS_PARTIALS,
    yearGroups = MOCK_YEAR_GROUPS,
    warmupStateOverrides = {},
  } = options;

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [...classPartials]);
  queryClient.setQueryData(queryKeys.yearGroups(), [...yearGroups]);

  return renderWithFrontendProviders(<ClassesPage />, {
    queryClient,
    ...warmupStateOverrides,
  });
}

/**
 * Renders ClassesPage with empty query data.
 * 
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderEmptyClassesPage(): ReturnType<typeof renderWithFrontendProviders> {
  return renderClassesPage({
    classPartials: MOCK_EMPTY_CLASS_PARTIALS,
    yearGroups: MOCK_EMPTY_YEAR_GROUPS,
  });
}

/**
 * Renders ClassesPage with invalid class partials (trust failure).
 * 
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result with query client.
 */
export function renderInvalidClassesPage(): ReturnType<typeof renderWithFrontendProviders> {
  return renderClassesPage({
    classPartials: MOCK_INVALID_CLASS_PARTIALS,
    yearGroups: MOCK_YEAR_GROUPS,
  });
}

/**
 * Creates a query client with pre-populated ClassesPage data.
 * 
 * Use this when you need to set up query data before rendering but need
 * to perform additional setup on the query client.
 * 
 * @param {ClassPartial[]} classPartials - Class partials to set.
 * @param {YearGroup[]} yearGroups - Year groups to set.
 * @returns {QueryClient} Configured query client.
 */
export function createQueryClientWithClassesData(
  classPartials: ClassPartial[],
  yearGroups: YearGroup[]
): QueryClient {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [...classPartials]);
  queryClient.setQueryData(queryKeys.yearGroups(), [...yearGroups]);
  return queryClient;
}

// ============================================================================
// Model Verification Helpers
// ============================================================================

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
export function isValidPanelViewModel(
  modelResult: unknown
): modelResult is ClassesPagePanelModel {
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

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Asserts that a collapse region is present in the document.
 * 
 * @param {string} [namePattern] - Optional name pattern for the collapse region.
 * @returns {HTMLElement} The collapse region element.
 */
export function assertCollapseRegion(namePattern = /year.*group/i): HTMLElement {
  const collapseRegion = screen.getByRole('region', { name: namePattern });
  expect(collapseRegion).toBeInTheDocument();
  return collapseRegion;
}

/**
 * Asserts that a collapse region is NOT present in the document.
 * 
 * @param {string} [namePattern] - Optional name pattern for the collapse region.
 */
export function assertNoCollapseRegion(namePattern = /year.*group/i): void {
  expect(screen.queryByRole('region', { name: namePattern })).not.toBeInTheDocument();
}

/**
 * Asserts that a blocking alert is present.
 * 
 * @returns {HTMLElement} The alert element.
 */
export function assertBlockingAlert(): HTMLElement {
  const alert = screen.getByRole('alert');
  expect(alert).toBeInTheDocument();
  expect(alert).toHaveTextContent(/could not be trusted or loaded/i);
  return alert;
}

/**
 * Asserts that no blocking alert is present.
 */
export function assertNoBlockingAlert(): void {
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
}

/**
 * Asserts that a skeleton loading indicator is present.
 * 
 * @returns {HTMLElement} The skeleton element.
 */
export function assertLoadingSkeleton(): HTMLElement {
  const skeletonRegion = screen.getByRole('status');
  expect(skeletonRegion).toBeInTheDocument();
  expect(skeletonRegion).toHaveAttribute('aria-label', expect.stringContaining('loading'));
  return skeletonRegion;
}

/**
 * Asserts that no skeleton loading indicator is present.
 */
export function assertNoLoadingSkeleton(): void {
  expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
}

/**
 * Asserts that the empty state message is present.
 * 
 * @param {string} [messagePattern] - Pattern to match in the empty message.
 * @returns {HTMLElement} The empty state element.
 */
export function assertEmptyState(messagePattern = /no year groups configured/i): HTMLElement {
  const emptyElement = screen.getByText(messagePattern);
  expect(emptyElement).toBeInTheDocument();
  return emptyElement;
}

/**
 * Asserts that the Classes page heading is present.
 * 
 * @returns {HTMLElement} The heading element.
 */
export function assertClassesPageHeading(): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: /classes/i });
  expect(heading).toBeInTheDocument();
  return heading;
}

/**
 * Gets a class card by its name pattern.
 * 
 * @param {string | RegExp} namePattern - Name pattern to match.
 * @returns {HTMLElement} The class card element.
 */
export function getClassCardByName(namePattern: string | RegExp): HTMLElement {
  return screen.getByRole('article', { name: namePattern });
}

/**
 * Asserts that a class card exists with the given name.
 * 
 * @param {string | RegExp} namePattern - Name pattern to match.
 * @returns {HTMLElement} The class card element.
 */
export function assertClassCardExists(namePattern: string | RegExp): HTMLElement {
  const card = getClassCardByName(namePattern);
  expect(card).toBeInTheDocument();
  return card;
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
  
  const panel = modelResult.panels.find((p) => (p as { yearGroupKey: string }).yearGroupKey === yearGroupKey);
  expect(panel).toBeDefined();
  expect((panel as { classes: unknown[] }).classes).toHaveLength(expectedClassCount);
  // Cast to the expected type - we've already validated the model is not invalid
  return panel as ClassesPagePanelModel;
}

/**
 * Asserts that a panel header exists with the given year group label.
 * 
 * @param {string | RegExp} labelPattern - Label pattern to match.
 * @returns {HTMLElement} The panel header element.
 */
export function assertPanelHeader(labelPattern: string | RegExp): HTMLElement {
  const header = screen.getByRole('heading', { level: 3, name: labelPattern });
  expect(header).toBeInTheDocument();
  return header;
}

/**
 * Asserts that a panel header has the expected aria-expanded state.
 * 
 * @param {string | RegExp} labelPattern - Label pattern to match.
 * @param {boolean} expectedExpanded - Expected expanded state.
 */
export function assertPanelHeaderExpanded(
  labelPattern: string | RegExp,
  expectedExpanded: boolean
): void {
  const headerButton = screen.getByRole('button', { name: labelPattern });
  expect(headerButton).toHaveAttribute('aria-expanded', expectedExpanded ? 'true' : 'false');
}

/**
 * Asserts that a year group panel contains a specific class card.
 * 
 * @param {string | RegExp} panelLabelPattern - Pattern to match the panel label.
 * @param {string | RegExp} cardNamePattern - Pattern to match the card name.
 */
export function assertPanelContainsClass(
  panelLabelPattern: string | RegExp,
  cardNamePattern: string | RegExp
): void {
  const panelRegion = screen.getByRole('region', { name: panelLabelPattern });
  expect(panelRegion).toBeInTheDocument();
  
  const card = getClassCardByName(cardNamePattern);
  expect(panelRegion).toContainElement(card);
}

/**
 * Asserts that a panel shows an empty state message.
 * 
 * @param {string | RegExp} panelLabelPattern - Pattern to match the panel label.
 */
export function assertPanelEmpty(panelLabelPattern: string | RegExp): void {
  const panelRegion = screen.getByRole('region', { name: panelLabelPattern });
  expect(panelRegion).toBeInTheDocument();
  expect(panelRegion).toHaveTextContent(/no classes/i);
}

// ============================================================================
// Year-group collapse behaviour fixtures
// ============================================================================

/**
 * Mixed order year groups for alphabetical sorting tests.
 */
export const MIXED_ORDER_YEAR_GROUPS: YearGroup[] = [
  createFixtureYearGroup('year-group-11', 'Year 11'),
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
];

/**
 * Mixed order class partials matching the mixed year groups.
 */
export const MIXED_ORDER_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-math-11a', className: 'Mathematics 11A', yearGroupKey: 'year-group-11' }),
  createFixtureClassPartial({ classId: 'class-science-9', className: 'Science 9', yearGroupKey: 'year-group-9' }),
  createFixtureClassPartial({ classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-english-10', className: 'English 10', yearGroupKey: 'year-group-10' }),
];

/**
 * Year groups with empty panel (Year 9 has no classes).
 */
export const YEAR_GROUPS_WITH_EMPTY: YearGroup[] = [
  createFixtureYearGroup('year-group-9', 'Year 9'),
  createFixtureYearGroup('year-group-10', 'Year 10'),
];

/**
 * Class partials for empty panel test (only Year 10 has classes).
 */
export const CLASS_PARTIALS_FOR_EMPTY_PANEL: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10' }),
];

// ============================================================================
// Card sorting and rendering fixtures
// ============================================================================

/**
 * Class partials for alphabetical ordering tests.
 */
export const ALPHABETICAL_ORDER_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-math-10b', className: 'Mathematics 10B', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-english-10', className: 'English 10', yearGroupKey: 'year-group-10' }),
];

/**
 * Class partials for tie-break sorting tests (same className, different classId).
 */
export const TIE_BREAK_CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: 'class-b-z', className: 'Z Class', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-a-z', className: 'Z Class', yearGroupKey: 'year-group-10' }),
  createFixtureClassPartial({ classId: 'class-b-a', className: 'A Class', yearGroupKey: 'year-group-10' }),
];

/**
 * Single year group for focused tests.
 */
export const SINGLE_YEAR_GROUP: YearGroup[] = [
  createFixtureYearGroup('year-group-10', 'Year 10'),
];

// ============================================================================
// Dummy component export to satisfy react-refresh plugin
// This file is in .tsx to support JSX in helper functions
// ============================================================================

/**
 * Dummy component to satisfy react-refresh plugin requirement for .tsx files.
 * This component is never actually used in tests.
 * 
 * @returns {null} Always returns null.
 */
function ClassesPageTestHelpersDummy(): null {
  return null;
}

// ============================================================================
// Re-export commonly used items for convenience
// ============================================================================

export {
  MOCK_YEAR_GROUPS as DEFAULT_YEAR_GROUPS,
  MOCK_CLASS_PARTIALS as DEFAULT_CLASS_PARTIALS,
};

// Export the dummy component to satisfy react-refresh
export { ClassesPageTestHelpersDummy };

// ============================================================================
// Plain-object conversion utilities (for E2E test serialisation)
// ============================================================================

/**
 * Converts typed ClassPartial fixtures to plain JavaScript objects
 * suitable for JSON serialisation in E2E test init scripts.
 *
 * @param {ClassPartial[]} classPartials - Typed class partials to convert.
 * @returns {Array<Record<string, unknown>>} Plain objects.
 */
export function toPlainClassPartials(
  classPartials: ClassPartial[]
): Array<Record<string, unknown>> {
  return classPartials.map((cp) => ({
    classId: cp.classId,
    className: cp.className,
    cohortKey: cp.cohortKey,
    courseLength: cp.courseLength,
    yearGroupKey: cp.yearGroupKey,
    classOwner: cp.classOwner,
    teachers: cp.teachers,
    active: cp.active,
  }));
}
