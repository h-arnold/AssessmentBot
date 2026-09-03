/**
 * Screenshot capture for README updates.
 *
 * Captures additional React frontend surfaces not covered by
 * navigation-screenshots.spec.ts. Run via:
 *
 *   npm run test:frontend:e2e -- readme-screenshots.spec.ts
 *
 * Output PNGs land in the untracked per-test output directory.
 */

import { expect, test, type Page } from '@playwright/test';
import { installRuntimeMock, selectVisibleOption } from './shared/endToEndRuntimeMocks';
import {
  openAssessTaskModal,
  selectAssignmentAndStart,
  toPlainClassPartials,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
} from './helpers/classes-page-end-to-end-helpers';
import {
  createHeatmapScenario,
  HEATMAP_ASSIGNMENT_DISPLAY_TITLE,
  HEATMAP_CLASS_NAME,
} from './helpers/task-heatmap-end-to-end-helpers';

const CLASSES_LABEL = 'Classes';
const ASSIGNMENTS_LABEL = 'Assignments';
const HEATMAP_TABLE_NAME = 'Task Heatmap';

const assignmentRows = [
  {
    primaryTitle: 'Newest algebra recap',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'year-group-11',
    yearGroupLabel: 'Year 11',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 20,
    definitionKey: 'newest-safe',
    tasks: [],
    createdAt: '2025-02-01T08:00:00.000Z',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
  {
    primaryTitle: 'Algebra foundations',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-2',
    templateDocumentId: 'tpl-2',
    assignmentWeighting: 30,
    definitionKey: 'alg-10-safe',
    tasks: [],
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    primaryTitle: 'Spreadsheet skills baseline',
    primaryTopic: 'Spreadsheets',
    primaryTopicKey: 'spreadsheets',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-3',
    templateDocumentId: 'tpl-3',
    assignmentWeighting: 25,
    definitionKey: 'sheets-10-safe',
    tasks: [],
    createdAt: '2025-01-20T08:00:00.000Z',
    updatedAt: '2025-01-20T08:00:00.000Z',
  },
  {
    primaryTitle: 'Database design introduction',
    primaryTopic: 'Databases',
    primaryTopicKey: 'databases',
    yearGroupKey: 'year-group-11',
    yearGroupLabel: 'Year 11',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-4',
    templateDocumentId: 'tpl-4',
    assignmentWeighting: 15,
    definitionKey: 'db-11-safe',
    tasks: [],
    createdAt: '2025-01-25T08:00:00.000Z',
    updatedAt: '2025-01-26T08:00:00.000Z',
  },
] as const;

const createAssignmentsScenarioLike = () => ({
  getAuthorisationStatus: [{ kind: 'success' as const, data: true }],
  getABClassPartials: [{ kind: 'success' as const, data: [] }],
  getCohorts: [{ kind: 'success' as const, data: [] }],
  getYearGroups: [{ kind: 'success' as const, data: [] }],
  getAssignmentTopics: [{ kind: 'success' as const, data: [] }],
  getAssignmentDefinitionPartials: [
    { kind: 'success' as const, data: [...assignmentRows] },
    { kind: 'success' as const, data: [...assignmentRows] },
  ],
});

/**
 * Navigate from the root shell to the open heatmap table.
 *
 * @param {Page} page - The Playwright page.
 * @returns {Promise<void>}
 */
async function openHeatmapTable(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

  const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
  await expect(classCard).toBeVisible();
  await classCard.getByRole('button', { name: 'View' }).click();

  await expect(page.getByText('Recent Assignments')).toBeVisible();

  await page.getByRole('button').filter({ hasText: HEATMAP_ASSIGNMENT_DISPLAY_TITLE }).click();

  const table = page.getByRole('table', { name: HEATMAP_TABLE_NAME });
  await expect(table).toBeVisible();
}

test.describe('README screenshot capture', () => {
  test('classes overview card grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        { kind: 'success', data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS) },
        { kind: 'success', data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS) },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [{ kind: 'success', data: [] }],
      getAssignmentDefinitionPartials: [{ kind: 'success', data: [] }],
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    await expect(page.locator('#panel-content-year-group-10')).toBeVisible();
    await page.getByRole('heading', { level: 3, name: 'Year 11' }).click();
    await page.getByRole('heading', { level: 3, name: 'Year 9' }).click();

    const articles = page.locator('[role="article"]');
    const expectedCardCount = 4;
    await expect(articles).toHaveCount(expectedCardCount);

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-classes-overview.png',
    });
  });

  test('assignments page table', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, createAssignmentsScenarioLike());

    await page.goto('/');
    await page.getByRole('menuitem', { name: ASSIGNMENTS_LABEL }).click();

    const table = page.getByRole('table', { name: 'Assignment definitions table' });
    await expect(table).toBeVisible();
    await expect(page.getByRole('row', { name: /newest algebra recap/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /database design introduction/i })).toBeVisible();

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-assignments-table.png',
    });
  });

  test('assignments delete confirmation modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, createAssignmentsScenarioLike());

    await page.goto('/');
    await page.getByRole('menuitem', { name: ASSIGNMENTS_LABEL }).click();

    const table = page.getByRole('table', { name: 'Assignment definitions table' });
    await expect(table).toBeVisible();

    const row = page.getByRole('row', { name: /algebra foundations/i });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /delete/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete assignment definition' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/this delete is permanent/i)).toBeVisible();

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-assignments-delete-modal.png',
    });
  });

  test('assess task modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [{ kind: 'success', data: [] }],
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      getGoogleClassroomAssignments: [
        {
          kind: 'success',
          data: [
            { assignmentId: 'cw-1', title: 'Algebra Homework' },
            { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
          ],
        },
        {
          kind: 'success',
          data: [
            { assignmentId: 'cw-1', title: 'Algebra Homework' },
            { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
          ],
        },
      ],
      startAssessmentRun: [
        { kind: 'success', data: null },
        { kind: 'success', data: null },
      ],
    });

    const dialog = await openAssessTaskModal(page);
    await selectAssignmentAndStart(dialog, page, 'Algebra Homework');

    await expect(dialog.getByRole('button', { name: 'Create New Definition' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Link to Existing Definition' })).toBeVisible();

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-assess-task-modal.png',
    });
  });

  test('task preview popover — image (completeness)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    const cell = page.locator(
      '[role="button"][aria-label="Student Two, task_001, Completeness: 5"]'
    );
    await expect(cell).toHaveCount(1);
    await cell.click();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await expect(popover.locator('img')).toHaveCount(1);

    await popover.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-task-preview-image.png',
    });
  });

  test('task preview popover — text (accuracy)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    const cell = page.locator('[role="button"][aria-label="Student Two, task_002, Accuracy: 4"]');
    await expect(cell).toHaveCount(1);
    await cell.click();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await expect(
      popover.getByText(/student explained the method clearly and showed all working\./i)
    ).toHaveCount(1);

    await popover.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-task-preview-text.png',
    });
  });

  test('task preview popover — table (SPaG)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const scenario = createHeatmapScenario();
    await installRuntimeMock(page, scenario);
    await openHeatmapTable(page);

    const cell = page.locator('[role="button"][aria-label="Student Two, task_003, SPaG: 5"]');
    await expect(cell).toHaveCount(1);
    await cell.click();

    const popover = page.locator('.ant-popover');
    await expect(popover).toBeVisible();
    await expect(popover.locator('table')).toHaveCount(1);

    await popover.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-task-preview-table.png',
    });
  });

  test('wizard flow — class page with Start New Assessment', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [{ kind: 'success', data: [] }],
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      ...createHeatmapScenario(),
    });

    await page.goto('/');
    await page.getByRole('menuitem', { name: CLASSES_LABEL }).click();

    const classCard = page.getByRole('article').filter({ hasText: HEATMAP_CLASS_NAME });
    await expect(classCard).toBeVisible();
    await classCard.getByRole('button', { name: 'View' }).click();

    await expect(page.getByRole('button', { name: 'Start New Assessment' })).toBeVisible();
    await expect(page.getByText('Recent Assignments')).toBeVisible();

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-wizard-1-class-page.png',
    });
  });

  test('wizard flow — assess task modal with assignment selector', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [{ kind: 'success', data: [] }],
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      getGoogleClassroomAssignments: [
        {
          kind: 'success',
          data: [
            { assignmentId: 'cw-1', title: 'Algebra Homework' },
            { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
          ],
        },
        {
          kind: 'success',
          data: [
            { assignmentId: 'cw-1', title: 'Algebra Homework' },
            { assignmentId: 'cw-2', title: 'Chapter 5 Review' },
          ],
        },
      ],
    });

    const dialog = await openAssessTaskModal(page);
    await expect(dialog.getByText(/Assess Task —/)).toBeVisible();
    await expect(dialog.getByTestId('assignment-select')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Wait for the modal mask and dialog to be fully painted.
    const modalPaintDelayMs = 500;
    await page.waitForTimeout(modalPaintDelayMs);

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-wizard-2-assess-modal.png',
    });
  });

  test('wizard flow — stage 1 form (title, topic, year group, document URLs)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const topicsData = [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['year-group-10'] },
    ];
    const parsedDefinition = {
      definitionKey: 'new-def-key',
      primaryTitle: 'Algebra Homework',
      primaryTopicKey: 'topic-algebra',
      primaryTopic: 'Algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES' as const,
      referenceDocumentId: 'ref-123',
      templateDocumentId: 'tpl-456',
      assignmentWeighting: 5,
      tasks: [
        { taskId: 'task-1', taskTitle: 'Solve equations', taskWeighting: 1 },
        { taskId: 'task-2', taskTitle: 'Show working', taskWeighting: 1 },
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [
        { kind: 'success', data: topicsData },
        { kind: 'success', data: topicsData },
      ],
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      getGoogleClassroomAssignments: [
        {
          kind: 'success',
          data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
        },
        {
          kind: 'success',
          data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
        },
      ],
      startAssessmentRun: [
        { kind: 'success', data: null },
        { kind: 'success', data: null },
      ],
      getAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
      upsertAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
    });

    const dialog = await openAssessTaskModal(page);
    await selectAssignmentAndStart(dialog, page, 'Algebra Homework');
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();
    await expect(wizardDialog.getByRole('textbox', { name: 'Assignment Title' })).toHaveValue(
      'Algebra Homework'
    );
    await wizardDialog
      .getByRole('textbox', { name: 'Reference Document URL' })
      .fill('https://docs.google.com/presentation/d/1abc_RefSlides/edit');
    await wizardDialog
      .getByRole('textbox', { name: 'Template Document URL' })
      .fill('https://docs.google.com/presentation/d/1abc_TplSlides/edit');
    await wizardDialog.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await wizardDialog.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-wizard-3-stage1-form.png',
    });
  });

  test('wizard flow — stage 2 tasks (parsed, ready to save)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const topicsData = [
      { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: ['year-group-10'] },
    ];
    const parsedDefinition = {
      definitionKey: 'new-def-key',
      primaryTitle: 'Algebra Homework',
      primaryTopicKey: 'topic-algebra',
      primaryTopic: 'Algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES' as const,
      referenceDocumentId: 'ref-123',
      templateDocumentId: 'tpl-456',
      assignmentWeighting: 5,
      tasks: [
        { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 2 },
        { taskId: 'task-2', taskTitle: 'Simplify expressions', taskWeighting: 1 },
        { taskId: 'task-3', taskTitle: 'Factor polynomials', taskWeighting: 3 },
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    await installRuntimeMock(page, {
      getAuthorisationStatus: [{ kind: 'success', data: true }],
      getABClassPartials: [
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
        {
          kind: 'success',
          data: toPlainClassPartials(MIXED_ORDER_CLASS_PARTIALS),
        },
      ],
      getCohorts: [{ kind: 'success', data: [] }],
      getYearGroups: [
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
        { kind: 'success', data: MIXED_ORDER_YEAR_GROUPS },
      ],
      getAssignmentTopics: [
        { kind: 'success', data: topicsData },
        { kind: 'success', data: topicsData },
      ],
      getAssignmentDefinitionPartials: [
        { kind: 'success', data: [] },
        { kind: 'success', data: [] },
      ],
      getGoogleClassroomAssignments: [
        {
          kind: 'success',
          data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
        },
        {
          kind: 'success',
          data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
        },
      ],
      startAssessmentRun: [
        { kind: 'success', data: null },
        { kind: 'success', data: null },
      ],
      getAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
      upsertAssignmentDefinition: [
        { kind: 'success', data: parsedDefinition },
        { kind: 'success', data: parsedDefinition },
      ],
    });

    const dialog = await openAssessTaskModal(page);
    await selectAssignmentAndStart(dialog, page, 'Algebra Homework');
    await dialog.getByRole('button', { name: 'Create New Definition' }).click();

    const wizardDialog = page.getByRole('dialog', { name: /create assignment/i });
    await expect(wizardDialog).toBeVisible();

    await wizardDialog
      .getByRole('textbox', { name: 'Reference Document URL' })
      .fill('https://docs.google.com/presentation/d/1abc_RefSlides/edit');
    await wizardDialog
      .getByRole('textbox', { name: 'Template Document URL' })
      .fill('https://docs.google.com/presentation/d/1abc_TplSlides/edit');
    await wizardDialog.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await wizardDialog.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await wizardDialog.getByRole('button', { name: 'Parse and continue' }).click();
    await expect(wizardDialog.getByText('Solve quadratic equations')).toBeVisible();
    await expect(wizardDialog.getByText('Simplify expressions')).toBeVisible();
    await expect(wizardDialog.getByText('Factor polynomials')).toBeVisible();
    await expect(wizardDialog.getByRole('button', { name: 'Save' })).toBeEnabled();

    await page.screenshot({
      path: '/home/developer/AssessmentBot/docs/images/react-wizard-4-stage2-tasks.png',
    });
  });
});
