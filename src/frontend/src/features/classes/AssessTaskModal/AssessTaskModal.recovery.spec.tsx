/**
 * Stale-definition recovery specs for `AssessTaskModal`.
 *
 * The assertions pin the user-visible recovery contract: stale prompt (warning alert,
 * Cancel then Update), reparsing (accessible busy skeleton, Cancel only),
 * in-modal review (owning footer suppressed, wide-data width, caveat copy),
 * parse failure (error alert, Cancel then Retry) and the approval outcomes
 * (busy save, resumed assessment with captured identifiers, stale
 * return-to-prompt without an automatic loop, non-stale failure retaining
 * edits). Service mocking and canonical-fixture seeding live in the shared
 * recovery harness.
 */

import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { setTextboxValue } from '../../../test/assignmentDefinition/wizardTestHelpers';
import { MOCK_CLASS_ID } from '../../../test/classes/AssessTaskModal.test-utilities';
import type { AssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import {
  ASSIGNMENT_TITLE_PATTERN,
  CANCEL_BUTTON,
  CREATE_BUTTON,
  DEFINITION_PARSE_FAILED_MESSAGE,
  DEFINITION_STALE_MESSAGE,
  DISCARD_DIALOG_PATTERN,
  LINK_BUTTON,
  NON_STALE_FAILURE_MESSAGE,
  RECOVERY_DEFINITION,
  RECOVERY_DEFINITION_KEY,
  REFERENCE_URL_PATTERN,
  REPARSING_PATTERN,
  RETRY_BUTTON,
  SAVE_BUTTON,
  START_ASSESSMENT_BUTTON,
  TASK_TABLE_PATTERN,
  UPDATE_BUTTON,
  UNSAVED_CHANGES_PATTERN,
  WIDE_DATA_WIDTH,
  buildNonStaleError,
  buildParseFailedError,
  buildStaleError,
  clickAction,
  clickWithin,
  getVisibleActionNames,
  queueStartResults,
  queueUpsertResults,
  reachRecoveryReview,
  renderRecoveryModal,
  setDefinitionLoadFailure,
  triggerStalePrompt,
  waitForSelectionBody,
} from '../../../test/classes/AssessTaskModal.recovery-helpers';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: vi.fn(),
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: vi.fn(),
}));

vi.mock('../../../services/referenceData/referenceDataService', () => ({
  getCohorts: vi.fn(),
  getYearGroups: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

/**
 * Expected call count for a two-step recovery journey (reparse then retry, or
 * stale start then resumed start).
 */
const RECOVERY_ATTEMPT_COUNT = 2;

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Resolves a deferred upsert/save promise inside an `act` boundary.
 *
 * @param {(value: AssignmentDefinition) => void} resolver - Deferred resolver.
 * @param {AssignmentDefinition} value - Definition to resolve with.
 * @returns {Promise<void>} Resolves once React has settled.
 */
async function resolveDefinition(
  resolver: (value: AssignmentDefinition) => void,
  value: AssignmentDefinition
): Promise<void> {
  await act(async () => {
    resolver(value);
  });
}

/**
 * Reads the review-surface caveat alert (the alert explaining that reparsing
 * has already refreshed the stored definition).
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {HTMLElement | undefined} The caveat alert, if rendered.
 */
function findReviewCaveat(dialog: HTMLElement): HTMLElement | undefined {
  return within(dialog)
    .getAllByRole('alert')
    .find((alert) => /unsaved edits/i.test(alert.textContent ?? ''));
}

describe('AssessTaskModal stale-recovery prompt', () => {
  it('shows the stale warning alert with a Cancel-then-Update footer instead of the choice prompt', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);

    expect(within(dialog).getByRole('alert')).toHaveTextContent(DEFINITION_STALE_MESSAGE);

    const actionNames = getVisibleActionNames(dialog);
    expect(actionNames.indexOf(CANCEL_BUTTON)).toBeGreaterThanOrEqual(0);
    expect(actionNames.indexOf(UPDATE_BUTTON)).toBeGreaterThanOrEqual(0);
    expect(actionNames.indexOf(CANCEL_BUTTON)).toBeLessThan(actionNames.indexOf(UPDATE_BUTTON));

    expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: LINK_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: START_ASSESSMENT_BUTTON })).toBeNull();
  });

  it('opens the review surface inside the single owning dialog when Update is chosen', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    expect(screen.queryAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();
  });

  it('closes the owning modal on prompt Cancel without opening the choice prompt', async () => {
    const { dialog, onClose } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, CANCEL_BUTTON);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: UPDATE_BUTTON })).toBeNull();
  });
});

describe('AssessTaskModal recovery definition load failure', () => {
  it('shows a blocking error and never falls back to the create panel', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        setDefinitionLoadFailure();
      },
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, UPDATE_BUTTON);

    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('textbox', { name: REFERENCE_URL_PATTERN })).toBeNull();
    expect(vi.mocked(upsertAssignmentDefinition)).not.toHaveBeenCalled();
  });
});

describe('AssessTaskModal reparsing state', () => {
  it('shows the accessible busy skeleton with a Cancel-only footer', async () => {
    let resolveUpsert!: (value: AssignmentDefinition) => void;
    const pendingUpsert = new Promise<AssignmentDefinition>((resolve) => {
      resolveUpsert = resolve;
    });

    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        vi.mocked(upsertAssignmentDefinition)
          .mockReset()
          .mockReturnValue(pendingUpsert);
      },
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, UPDATE_BUTTON);

    expect(await within(dialog).findByLabelText(REPARSING_PATTERN)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: CANCEL_BUTTON })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: UPDATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: SAVE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: START_ASSESSMENT_BUTTON })).toBeNull();

    await resolveDefinition(resolveUpsert, RECOVERY_DEFINITION);
  });
});

describe('AssessTaskModal in-modal recovery review', () => {
  it('renders review content with the owning footer suppressed, the wide-data width and the caveat copy', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    const reparseRequest = vi.mocked(upsertAssignmentDefinition).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(reparseRequest).toMatchObject({
      definitionKey: RECOVERY_DEFINITION_KEY,
      forceReparse: true,
    });
    expect(reparseRequest).not.toHaveProperty('taskWeightings');

    expect(
      within(dialog).getByRole('textbox', { name: ASSIGNMENT_TITLE_PATTERN })
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: START_ASSESSMENT_BUTTON })).toBeNull();
    expect(within(dialog).getByRole('button', { name: SAVE_BUTTON })).toBeInTheDocument();
    expect(dialog.style.width).toBe(WIDE_DATA_WIDTH);

    const caveat = findReviewCaveat(dialog);
    expect(caveat).toBeDefined();
    expect(caveat?.textContent).toMatch(/repars|refresh/i);
  });

  it('gates dirty review cancel behind the discard confirmation and discards back to the selection body', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    setTextboxValue(
      within(dialog).getByRole('textbox', { name: ASSIGNMENT_TITLE_PATTERN }),
      'Edited title'
    );

    await clickAction(dialog, CANCEL_BUTTON);

    const discardDialog = await screen.findByRole('dialog', { name: DISCARD_DIALOG_PATTERN });
    expect(within(discardDialog).getByText(UNSAVED_CHANGES_PATTERN)).toBeInTheDocument();

    await clickWithin(discardDialog, /keep editing/i);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: DISCARD_DIALOG_PATTERN })).toBeNull();
    });
    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();

    await clickAction(dialog, CANCEL_BUTTON);
    const secondDiscardDialog = await screen.findByRole('dialog', {
      name: DISCARD_DIALOG_PATTERN,
    });
    await clickWithin(secondDiscardDialog, DISCARD_DIALOG_PATTERN);

    await waitForSelectionBody(dialog);
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();
  });
});

describe('AssessTaskModal recovery parse failure', () => {
  it('shows the parse-failure error alert with a Cancel-then-Retry footer and no review panel', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        queueUpsertResults({ kind: 'reject', error: buildParseFailedError() });
      },
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, UPDATE_BUTTON);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      DEFINITION_PARSE_FAILED_MESSAGE
    );
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();

    const actionNames = getVisibleActionNames(dialog);
    expect(actionNames.indexOf(CANCEL_BUTTON)).toBeGreaterThanOrEqual(0);
    expect(actionNames.indexOf(RETRY_BUTTON)).toBeGreaterThanOrEqual(0);
    expect(actionNames.indexOf(CANCEL_BUTTON)).toBeLessThan(actionNames.indexOf(RETRY_BUTTON));
  });

  it('re-triggers the reparse mutation on Retry and reaches the review surface', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        queueUpsertResults(
          { kind: 'reject', error: buildParseFailedError() },
          { kind: 'success' }
        );
      },
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, UPDATE_BUTTON);
    await within(dialog).findByRole('button', { name: RETRY_BUTTON });

    await clickAction(dialog, RETRY_BUTTON);

    await within(dialog).findByRole('table', { name: TASK_TABLE_PATTERN });
    const upsertMock = vi.mocked(upsertAssignmentDefinition);
    expect(upsertMock).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_COUNT);
    expect(upsertMock.mock.calls[1]?.[0]).toMatchObject({
      definitionKey: RECOVERY_DEFINITION_KEY,
      forceReparse: true,
    });
  });

  it('closes the owning modal on parse-failure Cancel', async () => {
    const { dialog, onClose } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        queueUpsertResults({ kind: 'reject', error: buildParseFailedError() });
      },
    });

    await triggerStalePrompt(dialog);
    await clickAction(dialog, UPDATE_BUTTON);
    await within(dialog).findByRole('button', { name: RETRY_BUTTON });

    await clickAction(dialog, CANCEL_BUTTON);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AssessTaskModal recovery approval outcomes', () => {
  it('shows the save busy treatment and resumes assessment with the captured identifiers on success', async () => {
    let resolveSave!: (value: AssignmentDefinition) => void;
    const pendingSave = new Promise<AssignmentDefinition>((resolve) => {
      resolveSave = resolve;
    });

    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' }, { kind: 'success' });
        vi.mocked(upsertAssignmentDefinition)
          .mockReset()
          .mockResolvedValueOnce(RECOVERY_DEFINITION)
          .mockImplementationOnce(() => pendingSave)
          .mockResolvedValue(RECOVERY_DEFINITION);
      },
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    await clickAction(dialog, SAVE_BUTTON);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /save/i })).toBeDisabled();
    });

    await resolveDefinition(resolveSave, RECOVERY_DEFINITION);

    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_COUNT);
    });
    expect(vi.mocked(startAssessmentRun).mock.calls[1]?.[0]).toEqual({
      definitionKey: RECOVERY_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/assessment started/i);
  });

  it('returns to the stale prompt when the approval save is rejected as stale', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        queueUpsertResults(
          { kind: 'success' },
          { kind: 'reject', error: buildStaleError() }
        );
      },
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    await clickAction(dialog, SAVE_BUTTON);

    await within(dialog).findByRole('button', { name: UPDATE_BUTTON });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(DEFINITION_STALE_MESSAGE);
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();
  });

  it('repeats the stale prompt after a second consecutive DEFINITION_STALE without an automatic recovery loop', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' }, { kind: 'stale' });
        queueUpsertResults({ kind: 'success' }, { kind: 'success' });
      },
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);
    await clickAction(dialog, SAVE_BUTTON);

    await within(dialog).findByRole('button', { name: UPDATE_BUTTON });
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();
    expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_COUNT);
    expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(RECOVERY_ATTEMPT_COUNT);
  });

  it('retains review edits and shows an error alert when the approval save fails non-stale', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () => {
        queueStartResults({ kind: 'stale' });
        queueUpsertResults(
          { kind: 'success' },
          { kind: 'reject', error: buildNonStaleError() }
        );
      },
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    setTextboxValue(
      within(dialog).getByRole('textbox', { name: ASSIGNMENT_TITLE_PATTERN }),
      'Edited title'
    );

    await clickAction(dialog, SAVE_BUTTON);

    await waitFor(() => {
      expect(
        within(dialog).getByRole('textbox', { name: ASSIGNMENT_TITLE_PATTERN })
      ).toHaveValue('Edited title');
    });
    const errorAlert = within(dialog)
      .getAllByRole('alert')
      .find((alert) => alert.textContent?.includes(NON_STALE_FAILURE_MESSAGE));
    expect(errorAlert).toBeDefined();
    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /save|retry/i })).toBeInTheDocument();
  });
});

describe('AssessTaskModal recovery review cancellation', () => {
  it('ends recovery on the selection body in idle state without closing the owning modal', async () => {
    const { dialog, onClose } = renderRecoveryModal({
      setupMocks: () => queueStartResults({ kind: 'stale' }),
    });

    await triggerStalePrompt(dialog);
    await reachRecoveryReview(dialog);

    await clickAction(dialog, CANCEL_BUTTON);

    await waitForSelectionBody(dialog);
    expect(within(dialog).queryByRole('button', { name: UPDATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1);
    expect(dialog.style.width).not.toBe(WIDE_DATA_WIDTH);
  });
});
