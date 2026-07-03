/**
 * Class page Playwright E2E tests.
 *
 * @remarks
 * Tests 1-14 cover the full Class page user journey (class list → class detail view),
 * including navigation, rendering, empty states, error states, and header actions.
 *
 * Test 12 ("clicks Retry on a retryable error state and re-fetches the class data")
 * is a **known expected failure**. The root cause is that React Query's default 3-retry
 * behaviour consumes mock queue entries before the manual Retry click can reach them.
 *
 * @see SPEC_CLASS_PAGE.md — "Workflow specification"
 * @see CLASS_PAGE_LAYOUT.md — "Workflow surfaces"
 */

import { expect, test, type Page } from '@playwright/test';
import {
  installRuntimeMock,
  type RuntimeScenario,
  type ResponseItem,
} from './shared/endToEndRuntimeMocks';
import { CLASSES_LABEL, createClassesScenario } from './helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Mock Data Fixtures
// ============================================================================

/**
 * ID for the English 10 class (first card in the default scenario).
 */
const ENGLISH_10_CLASS_ID = 'class-english-10';
const ENGLISH_10_CLASS_NAME = 'English 10';

/**
 * Creates a minimal valid ClassFull fixture.
 *
 * @param {object} [overrides] - Optional overrides for the fixture.
 * @returns {Record<string, unknown>} A plain object matching the ClassFull shape (JSON-safe).
 */
function createMockClassFull(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    classId: ENGLISH_10_CLASS_ID,
    className: ENGLISH_10_CLASS_NAME,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    students: [
      { id: 'student-1', name: 'Alice Smith', email: 'alice@example.com' },
      { id: 'student-2', name: 'Bob Jones', email: 'bob@example.com' },
      { id: 'student-3', name: 'Charlie Brown', email: 'charlie@example.com' },
      { id: 'student-4', name: 'Diana Prince', email: 'diana@example.com' },
    ],
    assignments: [
      {
        courseId: 'course-1',
        assignmentId: 'assign-1',
        assignmentName: 'Algebra Homework',
        dueDate: '2025-01-15T00:00:00.000Z',
        updatedAt: '2025-01-20T00:00:00.000Z',
        createdAt: '2025-01-10T00:00:00.000Z',
        documentType: 'SLIDES',
        submissions: [],
        assignmentDefinition: {
          definitionKey: 'def-key-1',
          primaryTitle: 'Algebra Homework',
          primaryTopicKey: 'topic-algebra',
          primaryTopic: 'Algebra',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          alternateTitles: [],
          alternateTopics: [],
          documentType: 'SLIDES',
          referenceDocumentId: null,
          templateDocumentId: null,
          assignmentWeighting: 5,
          tasks: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-10T00:00:00.000Z',
        },
      },
      {
        courseId: 'course-1',
        assignmentId: 'assign-2',
        assignmentName: 'Chapter 5 Review',
        dueDate: '2025-02-01T00:00:00.000Z',
        updatedAt: '2025-02-05T00:00:00.000Z',
        createdAt: '2025-01-25T00:00:00.000Z',
        documentType: 'SLIDES',
        submissions: [],
        assignmentDefinition: {
          definitionKey: 'def-key-2',
          primaryTitle: 'Chapter 5 Review',
          primaryTopicKey: 'topic-algebra',
          primaryTopic: 'Algebra',
          yearGroupKey: 'year-group-10',
          yearGroupLabel: 'Year 10',
          alternateTitles: [],
          alternateTopics: [],
          documentType: 'SLIDES',
          referenceDocumentId: null,
          templateDocumentId: null,
          assignmentWeighting: 5,
          tasks: [],
          createdAt: '2025-01-20T00:00:00.000Z',
          updatedAt: '2025-01-30T00:00:00.000Z',
        },
      },
    ],
    active: true,
    ...overrides,
  };
}

// ============================================================================
// Scenario Factory
// ============================================================================

/**
 * Creates a runtime scenario for Class page tests with ready-state data.
 *
 * Provides two getABClass entries for StrictMode double-effect coverage.
 *
 * @param {object} [overrides] - Optional overrides to customise the scenario.
 * @returns {RuntimeScenario} A RuntimeScenario with warm-up data and ClassFull detail data.
 */
function createClassPageScenario(
  overrides?: Partial<RuntimeScenario> & {
    getABClassOverrides?: ReadonlyArray<ResponseItem>;
  }
): RuntimeScenario {
  const classFullEntry: ResponseItem = {
    kind: 'success',
    data: createMockClassFull(),
  };

  // Merge warm-up data with class detail data
  return {
    ...createClassesScenario(),
    getABClass: overrides?.getABClassOverrides ?? [classFullEntry, classFullEntry],
    ...overrides,
  };
}

/**
 * Creates a scenario where getABClass returns null (class-not-found).
 *
 * @returns {RuntimeScenario} A RuntimeScenario with null class detail data.
 */
function createClassNotFoundScenario(): RuntimeScenario {
  return createClassPageScenario({
    getABClassOverrides: [
      { kind: 'success', data: null },
      { kind: 'success', data: null },
    ],
  });
}

/**
 * Creates a scenario where getABClass returns a query failure.
 *
 * @returns {RuntimeScenario} A RuntimeScenario with failure-envelope for getABClass.
 */
function createQueryErrorScenario(): RuntimeScenario {
  return createClassPageScenario({
    getABClassOverrides: [
      {
        kind: 'failureEnvelope' as const,
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to load class data',
      },
      {
        kind: 'failureEnvelope' as const,
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to load class data',
      },
    ],
  });
}

/**
 * Creates a scenario for empty-assignments tests.
 *
 * @returns {RuntimeScenario} A RuntimeScenario with a class that has no assignments.
 */
function createNoAssignmentsScenario(): RuntimeScenario {
  const noAssignmentsFixture = createMockClassFull({ assignments: [] });

  return {
    ...createClassesScenario(),
    getABClass: [
      { kind: 'success', data: noAssignmentsFixture },
      { kind: 'success', data: noAssignmentsFixture },
    ],
  };
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigates to the Classes page and clicks View on the first class card.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves when the class page is visible.
 */
async function navigateToClassPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  // Wait for the class list to render
  await expect(page.locator('#panel-content-year-group-10')).toBeVisible();

  // Click View on the first class card to navigate to class detail
  await page.getByRole('button', { name: 'View' }).first().click();
}

/**
 * Navigates to the Classes list page.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page under test.
 * @returns {Promise<void>} A promise that resolves when the class list is visible.
 */
async function navigateToClassesList(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();
  await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Class page flow', () => {
  // ========================================================================
  // Flow tests (existing classes page + class detail)
  // ========================================================================

  test('navigates from class list to class page when View is clicked', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);
    await navigateToClassesList(page);

    // Click View on the first class card
    await page.getByRole('button', { name: 'View' }).first().click();

    // Verify we are on the class detail page — the class name heading
    // should be visible (heading level 2 with the class name)
    await expect(
      page.getByRole('heading', { level: 2, name: ENGLISH_10_CLASS_NAME })
    ).toBeVisible();
  });

  test('renders the class name as the page heading', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // The page heading should show the class name
    await expect(
      page.getByRole('heading', { level: 2, name: ENGLISH_10_CLASS_NAME })
    ).toBeVisible();
  });

  test('renders up to 3 Recent Assignment cards with metric pills', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Recent Assignments section should render — the Card title is not a
    // heading role in antd v6, use getByText
    await expect(page.getByText('Recent Assignments')).toBeVisible();

    // Assignment cards should be visible with their names
    await expect(page.getByText('Algebra Homework')).toBeVisible();
    await expect(page.getByText('Chapter 5 Review')).toBeVisible();

    // Metric pills should render (Completeness, Accuracy, SpAG, Average labels)
    await expect(page.getByText('Completeness').first()).toBeVisible();
    await expect(page.getByText('Accuracy').first()).toBeVisible();
    await expect(page.getByText('SpAG').first()).toBeVisible();
    await expect(page.getByText('Average').first()).toBeVisible();

    // Last Assessed labels should be visible
    await expect(page.getByText(/Last Assessed:/).first()).toBeVisible();
  });

  test('renders the Student Averages table with search and sort', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Student Averages card should be visible — the Card title is not a
    // heading role in antd v6, use getByText
    await expect(page.getByText('Student Averages')).toBeVisible();

    // Search input should be present
    await expect(page.getByPlaceholder('Search by name')).toBeVisible();

    // Table column headers should be visible (Student Name, Completeness, etc.)
    await expect(page.getByRole('columnheader', { name: 'Student Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Completeness' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Accuracy' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'SpAG' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Average' })).toBeVisible();

    // Student rows should render
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bob Jones' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Charlie Brown' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Diana Prince' })).toBeVisible();

    // All students have empty submissions/tasks so all metric values should
    // render as "N" (notAttempted) in the table cells
    const metricCell = page.getByText('N').first();
    await expect(metricCell).toBeVisible();
  });

  test('searches for a student by name and filters the table', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Get the search input
    const searchInput = page.getByPlaceholder('Search by name');

    // Type a search term that matches only Alice
    await searchInput.fill('Alice');

    // Alice should be visible
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeVisible();

    // Bob, Charlie, Diana should be filtered out — the table shows
    // either filtered rows or the empty-text "No students match your search"
    const bobCell = page.getByRole('cell', { name: 'Bob Jones' });
    const charlieCell = page.getByRole('cell', { name: 'Charlie Brown' });
    const dianaCell = page.getByRole('cell', { name: 'Diana Prince' });

    await expect(bobCell).toHaveCount(0);
    await expect(charlieCell).toHaveCount(0);
    await expect(dianaCell).toHaveCount(0);
  });

  test('sorts the Student Name column and verifies the sort order', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // The Student Name column sort toggles through: ascend → descend → none.
    // Default is ascending, so Alice should be the first row initially.
    const rows = page.getByRole('rowgroup').last().getByRole('row');
    await expect(rows.first()).toContainText('Alice Smith');

    // Click the Student Name column header to toggle to descending
    const studentNameHeader = page.getByRole('columnheader', { name: 'Student Name' });
    await studentNameHeader.click();

    // In descending alphabetical order, Diana Prince should be first
    await expect(rows.first()).toContainText('Diana Prince');

    // Click again to toggle back to ascending
    await studentNameHeader.click();
    await expect(rows.first()).toContainText('Alice Smith');
  });

  test('renders the empty state when the class has no assignments', async ({ page }) => {
    const scenario = createNoAssignmentsScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // The "No recent assessments yet" empty text should be visible
    await expect(page.getByText('No recent assessments yet')).toBeVisible();

    // There are two "Start New Assessment" buttons: one in the header and
    // one in the empty-state CTA. Use .first() to match either.
    await expect(page.getByRole('button', { name: 'Start New Assessment' }).first()).toBeVisible();
  });

  test('clicks the empty-state CTA and opens the AssessTaskModal', async ({ page }) => {
    const scenario = createNoAssignmentsScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // There are two "Start New Assessment" buttons: one in the header and
    // one in the empty-state CTA. Either one opens the modal, so click the first.
    await page.getByRole('button', { name: 'Start New Assessment' }).first().click();

    // The AssessTaskModal should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  // ========================================================================
  // Error state tests
  // ========================================================================

  test('renders the blocking error state with Result status="error" and only Back to Classes button when class not found', async ({
    page,
  }) => {
    const scenario = createClassNotFoundScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // The "Class not found" error should be displayed
    await expect(page.getByText('Class not found')).toBeVisible();

    // Back to Classes button should be present
    await expect(page.getByRole('button', { name: /back to classes/i })).toBeVisible();

    // Retry button should NOT be present (classNotFound is not retryable)
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  });

  test('renders the blocking error state with Result status="warning" and Retry + Back to Classes buttons when class query fails', async ({
    page,
  }) => {
    const scenario = createQueryErrorScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // The "Couldn't load class" error should be displayed
    await expect(page.getByText("Couldn't load class")).toBeVisible();

    // Both Retry and Back to Classes buttons should be present
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('button', { name: /back to classes/i })).toBeVisible();
  });

  test('clicks Back to Classes on the blocking error state and returns to the class list', async ({
    page,
  }) => {
    const scenario = createClassNotFoundScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Verify error state is shown
    await expect(page.getByText('Class not found')).toBeVisible();

    // Click Back to Classes
    await page.getByRole('button', { name: /back to classes/i }).click();

    // Should return to the class list — the year 10 panel should be visible
    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
    await expect(page.getByText('English 10')).toBeVisible();
  });

  test.fixme('clicks Retry on a retryable error state and re-fetches the class data', async ({
    page,
  }) => {
    // React Query auto-retries failed queries (default 3 retries).  We provide
    // 20 failure entries to absorb StrictMode double-mounts and auto-retries,
    // followed by 10 success entries so the manual Retry click succeeds.
    const failureEntry: ResponseItem = {
      kind: 'failureEnvelope' as const,
      code: 'INTERNAL_ERROR' as const,
      message: 'Failed to load class data',
    };
    const successEntry: ResponseItem = { kind: 'success', data: createMockClassFull() };
    const retryScenario: RuntimeScenario = {
      ...createClassesScenario(),
      getABClass: [
        ...Array.from({ length: 20 }, () => failureEntry),
        ...Array.from({ length: 10 }, () => successEntry),
      ],
    };
    await installRuntimeMock(page, retryScenario);

    await navigateToClassPage(page);

    // Verify error state is shown initially
    await expect(page.getByText("Couldn't load class")).toBeVisible();

    // Click Retry — the mock will use the next success entries
    await page.getByRole('button', { name: 'Retry' }).click();

    // After retry succeeds, the class page should render with data heading
    await expect(
      page.getByRole('heading', { level: 2, name: ENGLISH_10_CLASS_NAME })
    ).toBeVisible();
  });

  // ========================================================================
  // Header actions and modal tests
  // ========================================================================

  test('clicks Start New Assessment in the header and opens the AssessTaskModal', async ({
    page,
  }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Click the Start New Assessment button in the header
    await page.getByRole('button', { name: 'Start New Assessment' }).first().click();

    // The AssessTaskModal should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The modal should contain the class name in its title
    await expect(dialog).toContainText('Assess Task');
  });

  test('closes the AssessTaskModal and returns to the class page', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // Open the modal first
    await page.getByRole('button', { name: 'Start New Assessment' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Close the modal by clicking the mask (antd v6 pattern)
    await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The class page content should still be visible
    await expect(
      page.getByRole('heading', { level: 2, name: ENGLISH_10_CLASS_NAME })
    ).toBeVisible();
  });

  test('clicks the breadcrumb Classes segment and returns to the class list', async ({ page }) => {
    const scenario = createClassPageScenario();
    await installRuntimeMock(page, scenario);

    await navigateToClassPage(page);

    // There are two breadcrumbs: the shell breadcrumb (rendered by the layout)
    // and the in-page ClassPage breadcrumb.  In antd v6, breadcrumb items with
    // an onClick handler render as `<span class="ant-breadcrumb-link">`.
    // The in-page "Classes" breadcrumb item is clickable and calls
    // onNavigateToClasses.  Target the LAST `.ant-breadcrumb-link` with text
    // "Classes" to find the correct one.
    //
    // `.last()` targets the in-page breadcrumb because it is rendered AFTER
    // the shell breadcrumb in DOM order (the shell renders first in AppShell,
    // then ClassPage renders its own below it).
    await page.locator('.ant-breadcrumb-link').filter({ hasText: 'Classes' }).last().click();

    // Should return to the class list — the year 10 panel should be visible
    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
  });
});
