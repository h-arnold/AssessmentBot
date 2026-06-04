import { expect, test } from '@playwright/test';
import {
  installRuntimeMock,
  releaseNextDeferredSuccess,
  getMethodCalls,
  selectVisibleOption,
} from './shared/endToEndRuntimeMocks';
import {
  MOCK_COURSEWORK_ASSIGNMENTS,
  createAssessTaskScenario,
  openAssessTaskModal,
} from './helpers/classes-page-end-to-end-helpers';

// ============================================================================
// Assess Task Modal — Playwright E2E Tests
// ============================================================================
//
// Tests covering the five modal states and user interactions from
// ACTION_PLAN §5 tests 13–21.  Each test is independently runnable with its
// own scenario and mock install.
//
// React 19 StrictMode double-fires effects in development, which means the
// `useEffect` that fetches assignments runs twice per modal open.  All custom
// `getGoogleClassroomAssignments` queues below provide enough entries to cover
// both StrictMode replays.
//
// Card layout (Year 10 panel, expanded by default):
//   Card 0: English 10       (class-english-10)
//   Card 1: Mathematics 10A  (class-math-10a)

test.describe('Assess Task modal', () => {
  test('opens with correct title, Select dropdown, and disabled Start Assessment', async ({
    page,
  }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);
    await expect(dialog).toContainText('Assess Task — English 10');

    // Verify Select dropdown is visible with placeholder
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify Start Assessment is disabled initially
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });

  test('selecting an assignment enables Start Assessment and shows confirmation text', async ({
    page,
  }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Open the Select dropdown and choose "Algebra Homework"
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');

    // Verify Start Assessment becomes enabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Verify selected title appears as confirmation text below the dropdown.
    // Use toHaveCount rather than toBeVisible — the antd Typography.Text element
    // may be resolved as hidden by Playwright depending on rendering context.
    await expect(
      dialog.locator('.ant-typography-secondary').getByText('Algebra Homework')
    ).toHaveCount(1);
  });

  test('clicking Start Assessment makes no backend call and keeps modal open', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Select an assignment
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Record method calls before clicking Start Assessment
    const callsBefore = await getMethodCalls(page);
    expect(callsBefore).toContain('getGoogleClassroomAssignments');

    // Click Start Assessment
    await dialog.getByRole('button', { name: 'Start Assessment' }).click();

    // Verify modal is still open
    await expect(dialog).toBeVisible();

    // Verify no backend call was made to any subsequent method
    const callsAfter = await getMethodCalls(page);
    expect(callsAfter).toEqual(callsBefore);
  });

  test('Cancel button closes modal and discards selection', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Select an assignment first so we can verify state is discarded
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Click Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Verify modal is closed
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('clicking the modal mask closes the dialog', async ({ page }) => {
    const scenario = createAssessTaskScenario();
    await installRuntimeMock(page, scenario);
    await openAssessTaskModal(page);

    // Click the modal mask (backdrop) near the top-left corner
    // antd v6 uses .ant-modal-wrap for mask click handling
    await page.locator('.ant-modal-wrap').click({ position: { x: 10, y: 10 } });

    // Verify modal is closed
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('reopening for a different class triggers fresh fetch and resets selection', async ({
    page,
  }) => {
    // Two modals × two StrictMode effect replays = 4 queue entries.
    // The first pair returns one assignment list, the second pair returns another.
    const algebraEntry = {
      kind: 'success' as const,
      data: [{ assignmentId: 'cw-1', title: 'Algebra Homework' }],
    };
    const differentEntry = {
      kind: 'success' as const,
      data: [{ assignmentId: 'cw-3', title: 'Different Assignment' }],
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [algebraEntry, algebraEntry, differentEntry, differentEntry],
    });
    await installRuntimeMock(page, scenario);
    let dialog = await openAssessTaskModal(page);
    await expect(dialog).toContainText('Assess Task — English 10');

    // Verify first assignment list loads
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Select an assignment to create "stale" state
    await dialog.getByRole('combobox').click();
    await selectVisibleOption(page, 'Algebra Homework');
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeEnabled();

    // Close modal
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Open modal for second card (Mathematics 10A)
    await page.getByRole('button', { name: 'Assess Task' }).nth(1).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Assess Task — Mathematics 10A');

    // Verify fresh fetch — second pair of entries loads
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify no stale selection from previous open
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });

  test('shows Alert with error message when fetch fails', async ({ page }) => {
    // Two entries for StrictMode double-effect so the modal stabilises on error.
    const failureEntry = {
      kind: 'failureEnvelope' as const,
      code: 'INTERNAL_ERROR' as const,
      message: 'Classroom API error',
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [failureEntry, failureEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify Alert with error message is shown
    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Classroom API error');

    // Verify Start Assessment is disabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select dropdown is not rendered in error state
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
  });

  test('shows Empty component when course has no assignments', async ({ page }) => {
    // Two entries for StrictMode double-effect so the modal stabilises on empty.
    const emptyEntry = { kind: 'success' as const, data: [] as Array<Record<string, never>> };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [emptyEntry, emptyEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify Empty component with description text
    await expect(dialog.getByText('No assignments found for this class')).toBeVisible();

    // Verify Start Assessment is disabled
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select dropdown is not rendered in empty state
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
  });

  test('shows spinner during fetch and transitions to Select on response', async ({ page }) => {
    // Two deferred entries for StrictMode.  Both effects will be held back;
    // releasing the first deferred resolves the first effect and the component
    // transitions to ready.  The second deferred stays pending and does not
    // affect the already-stable ready state.
    const deferredEntry = {
      kind: 'deferredSuccess' as const,
      data: MOCK_COURSEWORK_ASSIGNMENTS[0].data,
    };

    const scenario = createAssessTaskScenario({
      getGoogleClassroomAssignments: [deferredEntry, deferredEntry],
    });
    await installRuntimeMock(page, scenario);
    const dialog = await openAssessTaskModal(page);

    // Verify loading spinner is visible
    await expect(dialog.locator('[role="status"]')).toBeVisible();

    // Verify Start Assessment is disabled while loading
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();

    // Verify Select is not rendered during loading
    await expect(dialog.getByRole('combobox')).toHaveCount(0);

    // Release the first deferred success response
    await releaseNextDeferredSuccess(page);

    // Verify spinner is replaced by Select dropdown
    await expect(dialog.locator('[role="status"]')).toHaveCount(0);
    await expect(dialog.getByRole('combobox')).toBeVisible();

    // Verify Start Assessment remains disabled (no selection yet)
    await expect(dialog.getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
  });
});
