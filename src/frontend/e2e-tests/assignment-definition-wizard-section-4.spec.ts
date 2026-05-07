import { expect, test, type Page } from '@playwright/test';
import { googleScriptRunApiHandlerFactorySource } from '../src/test/googleScriptRunHarness';

type ResponseItem = Readonly<{
  kind: 'success';
  data: unknown;
}> | Readonly<{
  kind: 'failureEnvelope';
  data?: unknown;
  message?: string;
  code?: string;
}> | Readonly<{
  kind: 'transportFailure';
  data?: unknown;
  message?: string;
  code?: string;
}> | Readonly<{
  kind: 'deferredSuccess';
  data: unknown;
}>;

type WizardRuntimeScenario = Readonly<{
  getAuthorisationStatus: ReadonlyArray<ResponseItem>;
  getABClassPartials: ReadonlyArray<ResponseItem>;
  getCohorts: ReadonlyArray<ResponseItem>;
  getYearGroups: ReadonlyArray<ResponseItem>;
  getAssignmentTopics: ReadonlyArray<ResponseItem>;
  getAssignmentDefinitionPartials: ReadonlyArray<ResponseItem>;
  getAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
}>;

const mockAssignmentTopics = [
  { key: 'topic-algebra', name: 'Algebra' },
  { key: 'topic-geometry', name: 'Geometry' },
] as const;

const mockYearGroups = [
  { key: 'year-group-10', name: 'Year 10' },
  { key: 'year-group-11', name: 'Year 11' },
] as const;

const mockFullDefinition = {
  definitionKey: 'algebra-baseline',
  primaryTitle: 'Algebra Baseline',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-doc-123',
  templateDocumentId: 'tpl-doc-456',
  assignmentWeighting: 5,
  tasks: [
    { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 2 },
    { taskId: 'task-2', taskTitle: 'Simplify expressions', taskWeighting: 1 },
    { taskId: 'task-3', taskTitle: 'Factor polynomials', taskWeighting: 3 },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
} as const;

const mockPartialRows = [
  {
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-123',
    templateDocumentId: 'tpl-doc-456',
    assignmentWeighting: 5,
    definitionKey: 'algebra-baseline',
    tasks: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
] as const;

const mockCreatedPartialRow = {
  primaryTitle: 'New Assessment',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'test-ref',
  templateDocumentId: 'test-tpl',
  assignmentWeighting: 5,
  definitionKey: 'new-assessment',
  tasks: null,
  createdAt: '2025-01-03T00:00:00.000Z',
  updatedAt: '2025-01-03T00:00:00.000Z',
} as const;

const mockCreatedFullDefinition = {
  definitionKey: 'new-assessment',
  primaryTitle: 'New Assessment',
  primaryTopicKey: 'topic-algebra',
  primaryTopic: 'Algebra',
  yearGroupKey: 'year-group-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'test-ref',
  templateDocumentId: 'test-tpl',
  assignmentWeighting: 5,
  tasks: [
    { taskId: 'task-1', taskTitle: 'Solve equations', taskWeighting: 1 },
    { taskId: 'task-2', taskTitle: 'Simplify expressions', taskWeighting: 1 },
  ],
  createdAt: '2025-01-03T00:00:00.000Z',
  updatedAt: '2025-01-03T00:00:00.000Z',
} as const;

/**
 * Installs a browser-side `google.script.run` mock for assignment-definition wizard journeys.
 *
 * @param {Page} page The Playwright page under test.
 * @param {WizardRuntimeScenario} scenario The per-method response queue scenario.
 * @returns {Promise<void>} Resolves once the init script is installed.
 */
async function mockWizardRuntime(page: Page, scenario: WizardRuntimeScenario) {
  await page.addInitScript(`
    (() => {
      const createGoogleScriptRunApiHandlerMock = ${googleScriptRunApiHandlerFactorySource};
      const scenario = ${JSON.stringify(scenario)};
      const responseQueues = {
        getAuthorisationStatus: scenario.getAuthorisationStatus ?? [{ kind: 'success', data: true }],
        getABClassPartials: scenario.getABClassPartials ?? [{ kind: 'success', data: [] }],
        getCohorts: scenario.getCohorts ?? [{ kind: 'success', data: [] }],
        getYearGroups: scenario.getYearGroups ?? [{ kind: 'success', data: [] }],
        getAssignmentTopics: scenario.getAssignmentTopics ?? [{ kind: 'success', data: [] }],
        getAssignmentDefinitionPartials: scenario.getAssignmentDefinitionPartials,
        getAssignmentDefinition: scenario.getAssignmentDefinition ?? [],
        upsertAssignmentDefinition: scenario.upsertAssignmentDefinition ?? [],
      };
      const callCounts = {
        getAuthorisationStatus: 0,
        getABClassPartials: 0,
        getCohorts: 0,
        getYearGroups: 0,
        getAssignmentTopics: 0,
        getAssignmentDefinitionPartials: 0,
        getAssignmentDefinition: 0,
        upsertAssignmentDefinition: 0,
      };
      globalThis.__wizardMethodCalls = [];

      function sendSuccess(callbacks, method, responseIndex, data) {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-' + method + '-' + responseIndex,
          data,
        });
      }

      function sendFailureEnvelope(callbacks, method, responseIndex, response) {
        callbacks.successHandler?.({
          ok: false,
          requestId: 'req-' + method + '-' + responseIndex,
          error: {
            code: response.code ?? 'INTERNAL_ERROR',
            message: response.message,
            retriable: false,
          },
        });
      }

      globalThis.google = {
        script: {
          run: createGoogleScriptRunApiHandlerMock((request, callbacks) => {
            const method = request?.method;
            globalThis.__wizardMethodCalls.push(String(method));

            if (!(method in responseQueues)) {
              callbacks.failureHandler?.(new Error('Unexpected call to method: ' + String(method)));
              return;
            }

            const responseIndex = callCounts[method];
            const response = responseQueues[method][responseIndex];
            callCounts[method] += 1;

            if (response === undefined) {
              callbacks.failureHandler?.(
                new Error('Unexpected call index for method ' + method + ': ' + String(responseIndex))
              );
              return;
            }

            if (response.kind === 'transportFailure') {
              callbacks.failureHandler?.(new Error(response.message));
              return;
            }

            if (response.kind === 'failureEnvelope') {
              sendFailureEnvelope(callbacks, method, responseIndex, response);
              return;
            }

            if (response.kind === 'deferredSuccess') {
              // For deferred success, we'll handle it synchronously for now
              sendSuccess(callbacks, method, responseIndex, response.data);
              return;
            }

            sendSuccess(callbacks, method, responseIndex, response.data);
          }),
        },
      };
    })();
  `);
}

/**
 * Selects one visible Ant Design select option from the active dropdown overlay.
 *
 * @param {Page} page The Playwright page under test.
 * @param {string} optionName The visible option label to choose.
 * @returns {Promise<void>} Resolves once the option is selected.
 */
async function selectVisibleOption(page: Page, optionName: string) {
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByText(optionName, { exact: true })
    .click();
}

/**
 * Creates a standard success scenario for the wizard runtime.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with all required datasets.
 */
function createStandardWizardScenario() {
  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: mockYearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: mockAssignmentTopics }],
    getAssignmentDefinitionPartials: [
      { kind: 'success', data: mockPartialRows },
      { kind: 'success', data: [...mockPartialRows, mockCreatedPartialRow] },
      { kind: 'success', data: [...mockPartialRows, mockCreatedPartialRow] },
      { kind: 'success', data: [...mockPartialRows, mockCreatedPartialRow] },
      { kind: 'success', data: [...mockPartialRows, mockCreatedPartialRow] },
    ],
    getAssignmentDefinition: [{ kind: 'success', data: mockFullDefinition }],
    upsertAssignmentDefinition: [
      { kind: 'success', data: mockCreatedFullDefinition },
      { kind: 'success', data: mockCreatedFullDefinition },
    ],
  } as const;
}

/**
 * Creates a scenario where reference data loading fails.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with failed reference data.
 */
function createFailedReferenceDataScenario() {
  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'failureEnvelope', code: 'LOAD_FAILED', message: 'Could not load year groups' }],
    getAssignmentTopics: [{ kind: 'failureEnvelope', code: 'LOAD_FAILED', message: 'Could not load topics' }],
    getAssignmentDefinitionPartials: [{ kind: 'success', data: mockPartialRows }],
  } as const;
}

/**
 * Creates a scenario where post-mutation refresh fails.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with failed refresh.
 */
function createFailedRefreshScenario() {
  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: mockYearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: mockAssignmentTopics }],
    getAssignmentDefinitionPartials: [
      { kind: 'success', data: mockPartialRows },
      { kind: 'failureEnvelope', code: 'REFRESH_FAILED', message: 'Could not refresh after mutation' },
      { kind: 'failureEnvelope', code: 'REFRESH_FAILED', message: 'Could not refresh after mutation' },
    ],
    upsertAssignmentDefinition: [
      { kind: 'success', data: mockCreatedFullDefinition },
    ],
  } as const;
}

/**
 * Creates a scenario for re-parse workflow.
 *
 * @returns {WizardRuntimeScenario} Runtime scenario with re-parse.
 */
function createReparseScenario() {
  const reParsedDefinition = {
    ...mockFullDefinition,
    referenceDocumentId: 'new-ref',
    templateDocumentId: 'new-tpl',
    tasks: [
      { taskId: 'task-1', taskTitle: 'Updated Task 1', taskWeighting: 2 },
      { taskId: 'task-2', taskTitle: 'Updated Task 2', taskWeighting: 1 },
      { taskId: 'task-3', taskTitle: 'New Task', taskWeighting: 1 },
    ],
  };

  return {
    getAuthorisationStatus: [{ kind: 'success', data: true }],
    getABClassPartials: [{ kind: 'success', data: [] }],
    getCohorts: [{ kind: 'success', data: [] }],
    getYearGroups: [{ kind: 'success', data: mockYearGroups }],
    getAssignmentTopics: [{ kind: 'success', data: mockAssignmentTopics }],
    getAssignmentDefinitionPartials: [
      { kind: 'success', data: mockPartialRows },
      { kind: 'success', data: mockPartialRows },
      { kind: 'success', data: mockPartialRows },
      { kind: 'success', data: mockPartialRows },
    ],
    getAssignmentDefinition: [
      { kind: 'success', data: mockFullDefinition },
      { kind: 'success', data: reParsedDefinition },
      { kind: 'success', data: reParsedDefinition },
    ],
    upsertAssignmentDefinition: [
      { kind: 'success', data: reParsedDefinition },
    ],
  } as const;
}


test.describe('Assignment Definition Wizard - Shared edit surface, re-parse gating, and task weighting workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardRuntime(page, createStandardWizardScenario());
    await page.goto('/');
  });

  test('create flow: parse and continue, then save', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');

    // Select topic
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');

    // Select year group
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    // Click Parse and continue
    await page.click('button:has-text("Parse and continue")');

    // Should show tasks after parse
    await page.waitForSelector('[aria-label="Task weightings"]');
    await expect(page.locator('text="Solve equations"')).toBeVisible();

    // Click Save
    await page.click('button:has-text("Save")');

    // Modal should close and table should refresh
    await expect(page.locator('role=dialog[name="Create assignment"]')).not.toBeVisible();
    await expect(page.locator('text="New Assessment"')).toBeVisible();
  });

  test('update flow: document change + cancel restores URLs and fields', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Update on the Algebra Baseline row
    const row = page.locator('role=row[name*="Algebra Baseline" i]');
    await row.locator('button:has-text("Update")').click();

    // Modal should open with pre-populated data
    await page.waitForSelector('role=dialog[name="Update assignment"]');
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toHaveValue('Algebra Baseline');

    // Change document URL
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill(
      'https://docs.google.com/presentation/d/new-ref'
    );

    // Should show re-parse prompt
    await expect(page.getByText('Document changed. Re-parse to continue editing.')).toBeVisible();
    await expect(page.locator('button:has-text("Re-parse")')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cancel$/ }).last()).toBeVisible();

    // Metadata should be disabled
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toBeDisabled();

    // Click Cancel
    await page.getByRole('button', { name: /^Cancel$/ }).first().click();

    // URLs should be restored and fields re-enabled
    await expect(page.getByRole('textbox', { name: 'Reference Document URL' })).toHaveValue(
      'https://docs.google.com/presentation/d/ref-doc-123/edit'
    );
    await expect(page.getByRole('textbox', { name: 'Assignment Title' })).toBeEnabled();
  });

  test('update flow: document change + successful re-parse refreshes task rows', async ({ page }) => {
    await mockWizardRuntime(page, createReparseScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Update on the Algebra Baseline row
    const row = page.locator('role=row[name*="Algebra Baseline" i]');
    await row.locator('button:has-text("Update")').click();

    // Modal should open
    await page.waitForSelector('role=dialog[name="Update assignment"]');

    // Change document URL
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill(
      'https://docs.google.com/presentation/d/new-ref'
    );

    // Click Re-parse
    await page.click('button:has-text("Re-parse")');

    // Tasks should be refreshed
    await page.waitForSelector('text="Updated Task 1"');
    await expect(page.locator('text="New Task"')).toBeVisible();
  });

  test('modal close with unsaved stage-two edits requires discard confirmation', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form and parse
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await page.click('button:has-text("Parse and continue")');

    // Wait for tasks to appear
    await page.waitForSelector('[aria-label="Task weightings"]');

    // Edit assignment weighting to trigger dirty state
    await page.getByRole('spinbutton', { name: 'Assignment Weighting' }).fill('7');
    await expect(page.getByRole('spinbutton', { name: 'Assignment Weighting' })).toHaveValue('7');

    // Try to close modal - use the modal close button
    const createModal = page.getByRole('dialog', { name: 'Create assignment' });
    await createModal.getByRole('button', { name: /close/i }).click();

    // Should show discard confirmation
    await expect(page.getByRole('dialog', { name: /Discard changes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep editing' })).toBeVisible();
  });

  test('save blocked until valid year-group selection present', async ({ page }) => {
    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form without year group
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');

    // Save button should be disabled
    const saveButton = page.locator('button:has-text("Parse and continue")');
    await expect(saveButton).toBeDisabled();
  });

  test('create mode fails closed locally when required topic or year-group reference data cannot be trusted or loaded', async ({ page }) => {
    await mockWizardRuntime(page, createFailedReferenceDataScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Create button should be enabled
    await expect(page.locator('button:has-text("Create assignment")')).toBeEnabled();

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open but show blocking error
    await page.waitForSelector('role=dialog[name="Create assignment"]');
    await expect(page.locator('role=alert')).toBeVisible();
    await expect(page.getByText('Required reference data could not be trusted or loaded.')).toBeVisible();
  });

  test('failed post-mutation refresh fails closed on affected surface', async ({ page }) => {
    await mockWizardRuntime(page, createFailedRefreshScenario());
    await page.goto('/');

    // Navigate to Assignments page
    await page.click('text=Assignments');
    await page.waitForSelector('text=Assignment definitions');

    // Click Create assignment
    await page.click('button:has-text("Create assignment")');

    // Modal should open
    await page.waitForSelector('role=dialog[name="Create assignment"]');

    // Fill in form and parse
    await page.getByRole('textbox', { name: 'Assignment Title' }).fill('New Assessment');
    await page.getByRole('textbox', { name: 'Reference Document URL' }).fill('https://docs.google.com/presentation/d/test-ref');
    await page.getByRole('textbox', { name: 'Template Document URL' }).fill('https://docs.google.com/presentation/d/test-tpl');
    await page.getByRole('combobox', { name: 'Assignment Topic' }).click();
    await selectVisibleOption(page, 'Algebra');
    await page.getByRole('combobox', { name: 'Assignment Year Group' }).click();
    await selectVisibleOption(page, 'Year 10');

    await page.click('button:has-text("Parse and continue")');

    // Wait for the parse to complete - the table should appear briefly before the error
    await page.waitForSelector('[aria-label="Task weightings"]', { state: 'attached' }).catch(() => {});
    await expect(page.getByText('Assignment definitions could not be trusted or loaded.')).toBeVisible();
  });
});
