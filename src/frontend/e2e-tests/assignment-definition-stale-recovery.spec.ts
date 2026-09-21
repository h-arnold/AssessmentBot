import { expect, test } from '@playwright/test';
import {
  getMethodCalls,
  installRuntimeMock,
  releaseNextDeferredSuccess,
  type ResponseItem,
} from './shared/endToEndRuntimeMocks';
import {
  ACTION_CANCEL,
  ACTION_CREATE,
  ACTION_PARSE_AND_CONTINUE,
  ACTION_REPARSE_DOCUMENTS,
  ACTION_RETRY,
  ACTION_SAVE,
  ACTION_START_ASSESSMENT,
  ACTION_UPDATE,
  CANONICAL_REFERENCE_URL,
  CANONICAL_RECOVERY_DEFINITION,
  CANONICAL_TEMPLATE_URL,
  CREATE_ASSIGNMENT,
  MATCHED_ASSIGNMENT,
  PARSE_FAILED_COPY,
  REPARSE_DISABLED_EXPLANATION,
  REVIEW_CAVEAT_COPY,
  STALE_PROMPT_COPY,
  TASK_WEIGHTINGS_TABLE,
  createStaleRecoveryScenario,
  openCanonicalAssessTaskModal,
  openCanonicalUpdateModal,
  selectCanonicalAssignmentAndStart,
} from './helpers/stale-recovery-page-end-to-end-helpers';

// ============================================================================
// Stale assignment-definition recovery browser journeys
// ============================================================================
//
// These specs cover the recovery acceptance journeys in a real browser,
// seeded from the canonical `small` profile transport views via
// `createStaleRecoveryScenario` (see the helper module).
//
// React 19 StrictMode double-fires effects in development. The scenario factory
// provides StrictMode-safe queue sizes; only the user-triggered event queues
// (assessment-start and upsert) are sequenced explicitly here.

/** `DEFINITION_STALE` rejection used by the first assessment-start attempt. */
const STALE_ENTRY: ResponseItem = {
  kind: 'failureEnvelope',
  code: 'DEFINITION_STALE',
  message: 'Definition is stale',
};

/** `DEFINITION_PARSE_FAILED` rejection used by the first forced reparse. */
const PARSE_FAILED_ENTRY: ResponseItem = {
  kind: 'failureEnvelope',
  code: 'DEFINITION_PARSE_FAILED',
  message: 'The assignment documents could not be parsed.',
};

/** Successful void assessment-start result. */
const START_SUCCESS: ResponseItem = { kind: 'success', data: null };

/** Successful upsert result carrying the canonical definition. */
const DEFINITION_SUCCESS: ResponseItem = {
  kind: 'success',
  data: CANONICAL_RECOVERY_DEFINITION,
};

/** Stale start then resumed start. */
const EXPECTED_RECOVERY_ATTEMPTS = 2;

/** Failed reparse, retried reparse and approval save. */
const EXPECTED_RETRY_UPSERTS = 3;

test.describe('Stale assignment-definition recovery journeys', () => {
  test('matched stale recovery: prompt, in-modal review, approval and resumed assessment', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([MATCHED_ASSIGNMENT], {
        startAssessmentRun: [STALE_ENTRY, START_SUCCESS, START_SUCCESS],
        upsertAssignmentDefinition: [DEFINITION_SUCCESS, DEFINITION_SUCCESS, DEFINITION_SUCCESS],
      })
    );

    const dialog = await openCanonicalAssessTaskModal(page);
    await selectCanonicalAssignmentAndStart(dialog, page, MATCHED_ASSIGNMENT.title);

    // Stale prompt: warning alert with the exact registry copy and an action
    // row that is exactly Cancel then Update. Asserting the full text-button
    // row also proves the choice prompt (Create) and the owning footer (Start
    // Assessment) are absent, since neither would be part of that row.
    await expect(dialog.getByRole('alert')).toContainText(STALE_PROMPT_COPY);
    await expect(dialog.getByRole('button', { name: ACTION_UPDATE })).toBeVisible();
    const actionNames = await dialog
      .locator('button')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.textContent?.trim() ?? '').filter((name) => name !== '')
      );
    expect(actionNames).toEqual([ACTION_CANCEL, ACTION_UPDATE]);
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await dialog.getByRole('button', { name: ACTION_UPDATE }).click();

    // In-modal review: server weightings rendered, owning footer suppressed.
    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toBeVisible();
    await expect(dialog.getByText(REVIEW_CAVEAT_COPY, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      CANONICAL_RECOVERY_DEFINITION.primaryTitle
    );
    await expect(dialog.getByRole('spinbutton', { name: /assignment weighting/i })).toHaveValue(
      `${CANONICAL_RECOVERY_DEFINITION.assignmentWeighting}`
    );
    await expect(dialog.getByRole('button', { name: ACTION_START_ASSESSMENT })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: ACTION_SAVE })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await dialog.getByRole('button', { name: ACTION_SAVE }).click();

    await expect(dialog.getByText(/assessment started for/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'startAssessmentRun')).toHaveLength(
      EXPECTED_RECOVERY_ATTEMPTS
    );
    expect(calls.filter((name) => name === 'upsertAssignmentDefinition')).toHaveLength(
      EXPECTED_RECOVERY_ATTEMPTS
    );
  });

  test('forced reparse failure: blocking error and Retry reaches review', async ({ page }) => {
    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([MATCHED_ASSIGNMENT], {
        startAssessmentRun: [STALE_ENTRY, START_SUCCESS, START_SUCCESS],
        upsertAssignmentDefinition: [
          PARSE_FAILED_ENTRY,
          DEFINITION_SUCCESS,
          DEFINITION_SUCCESS,
          DEFINITION_SUCCESS,
        ],
      })
    );

    const dialog = await openCanonicalAssessTaskModal(page);
    await selectCanonicalAssignmentAndStart(dialog, page, MATCHED_ASSIGNMENT.title);
    await dialog.getByRole('button', { name: ACTION_UPDATE }).click();

    // Parse failure: blocking error, no review panel, Cancel-then-Retry.
    await expect(dialog.getByRole('alert')).toContainText(PARSE_FAILED_COPY);
    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: ACTION_RETRY })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await dialog.getByRole('button', { name: ACTION_RETRY }).click();

    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toBeVisible();
    await dialog.getByRole('button', { name: ACTION_SAVE }).click();
    await expect(dialog.getByText(/assessment started for/i)).toBeVisible();

    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'upsertAssignmentDefinition')).toHaveLength(
      EXPECTED_RETRY_UPSERTS
    );
    expect(calls.filter((name) => name === 'startAssessmentRun')).toHaveLength(
      EXPECTED_RECOVERY_ATTEMPTS
    );
  });

  test('forced reparse failure Cancel closes the modal without starting an assessment', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([MATCHED_ASSIGNMENT], {
        startAssessmentRun: [STALE_ENTRY, START_SUCCESS, START_SUCCESS],
        upsertAssignmentDefinition: [PARSE_FAILED_ENTRY, DEFINITION_SUCCESS],
      })
    );

    const dialog = await openCanonicalAssessTaskModal(page);
    await selectCanonicalAssignmentAndStart(dialog, page, MATCHED_ASSIGNMENT.title);
    await dialog.getByRole('button', { name: ACTION_UPDATE }).click();
    await expect(dialog.getByRole('alert')).toContainText(PARSE_FAILED_COPY);

    await dialog.getByRole('button', { name: ACTION_CANCEL }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'startAssessmentRun')).toHaveLength(1);
    expect(calls.filter((name) => name === 'upsertAssignmentDefinition')).toHaveLength(1);
  });

  test('converted in-modal create path: choice, parse, review and auto-assessment', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([CREATE_ASSIGNMENT], {
        upsertAssignmentDefinition: [DEFINITION_SUCCESS, DEFINITION_SUCCESS, DEFINITION_SUCCESS],
        startAssessmentRun: [START_SUCCESS, START_SUCCESS],
      })
    );

    const dialog = await openCanonicalAssessTaskModal(page);
    await selectCanonicalAssignmentAndStart(dialog, page, CREATE_ASSIGNMENT.title);

    await expect(dialog.getByRole('button', { name: ACTION_CREATE })).toBeVisible();
    await dialog.getByRole('button', { name: ACTION_CREATE }).click();

    // Stage one renders inside the single owning dialog, with the wide-data
    // width and the owning footer suppressed.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: /create assignment/i })).toHaveCount(0);
    await expect(dialog).toHaveAttribute('style', /--app-modal-width-wide-data/);
    await expect(dialog.getByRole('button', { name: ACTION_START_ASSESSMENT })).toHaveCount(0);

    await dialog
      .getByRole('textbox', { name: /reference document url/i })
      .fill(CANONICAL_REFERENCE_URL);
    await dialog
      .getByRole('textbox', { name: /template document url/i })
      .fill(CANONICAL_TEMPLATE_URL);
    await dialog.getByRole('button', { name: ACTION_PARSE_AND_CONTINUE }).click();

    // Stage two renders in-modal, then save triggers the auto-assessment.
    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toBeVisible();
    await dialog.getByRole('button', { name: ACTION_SAVE }).click();

    await expect(dialog.getByText(/assessment started for/i)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'startAssessmentRun')).toHaveLength(1);
  });

  test('update wizard Reparse documents: dirty gating, busy state and in-place refresh', async ({
    page,
  }) => {
    const deferredReparse: ResponseItem = {
      kind: 'deferredSuccess',
      data: CANONICAL_RECOVERY_DEFINITION,
    };

    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([MATCHED_ASSIGNMENT], {
        upsertAssignmentDefinition: [deferredReparse, DEFINITION_SUCCESS, DEFINITION_SUCCESS],
      })
    );

    const dialog = await openCanonicalUpdateModal(page);
    const reparseButton = dialog.getByRole('button', { name: ACTION_REPARSE_DOCUMENTS });
    await expect(reparseButton).toBeEnabled();

    // Unsaved edits disable the action and surface the visible explanation.
    const titleInput = dialog.getByRole('textbox', { name: /assignment title/i });
    await titleInput.fill('Dirty recovery title');
    await expect(reparseButton).toBeDisabled();
    await expect(dialog.getByText(REPARSE_DISABLED_EXPLANATION)).toHaveCount(1);

    await titleInput.fill(CANONICAL_RECOVERY_DEFINITION.primaryTitle);
    await expect(reparseButton).toBeEnabled();

    // Busy state while the forced reparse is held open, then an in-place refresh.
    await reparseButton.click();
    await expect(reparseButton).toBeDisabled();
    await releaseNextDeferredSuccess(page);
    await expect(reparseButton).toBeEnabled();

    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /reference document url/i })).toHaveValue(
      CANONICAL_REFERENCE_URL
    );
    await expect(page.getByRole('dialog')).toHaveCount(1);

    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'upsertAssignmentDefinition')).toHaveLength(1);
    expect(calls).not.toContain('startAssessmentRun');
  });

  test('update wizard Reparse documents failure shows blocking error without starting an assessment', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createStaleRecoveryScenario([MATCHED_ASSIGNMENT], {
        upsertAssignmentDefinition: [PARSE_FAILED_ENTRY, DEFINITION_SUCCESS],
      })
    );

    const dialog = await openCanonicalUpdateModal(page);
    await dialog.getByRole('button', { name: ACTION_REPARSE_DOCUMENTS }).click();

    await expect(dialog.getByRole('alert')).toContainText(PARSE_FAILED_COPY);
    await expect(dialog.getByRole('table', { name: TASK_WEIGHTINGS_TABLE })).toHaveCount(0);

    const calls = await getMethodCalls(page);
    expect(calls.filter((name) => name === 'upsertAssignmentDefinition')).toHaveLength(1);
    expect(calls).not.toContain('startAssessmentRun');
  });
});
