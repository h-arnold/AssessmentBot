import { act, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { queryKeys } from '@/query/queryKeys';
import { ApiTransportError } from '@/errors/apiTransportError';
import { createFixtureClassPartial } from '@/test/classes/classesPageTestHelpers';
import {
  MOCK_CLASS_ID,
  START_ASSESSMENT_RUN_RESPONSE,
  renderWithMatchedCache,
  selectAssignment,
  clickStartAssessment,
  resetAssessTaskModalMocks,
} from '@/test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '@/test/classes/AssessTaskModal.link-flow-helpers';
import { createDefinitionPartial } from '@/test/classes/matchDefinitionForAssignment.test-utilities';

beforeEach(() => {
  resetAssessTaskModalMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Assessment Run Interaction
// ---------------------------------------------------------------------------

describe('Assessment run interaction', () => {
  // -----------------------------------------------------------------------
  // Cache miss cases
  // -----------------------------------------------------------------------

  it('shows error Alert when classPartials cache is empty', async () => {
    const { dialog } = renderWithMatchedCache({ classPartials: undefined });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('shows error Alert with specific message when classId is not found in cached classPartials', async () => {
    const { dialog } = renderWithMatchedCache({
      classPartials: [
        createFixtureClassPartial({ classId: 'other-class', yearGroupKey: 'year-10' }),
      ],
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Class not found in cached data');
  });

  it('shows error Alert when assignmentDefinitionPartials cache is empty', async () => {
    const { dialog } = renderWithMatchedCache({ definitionPartials: undefined });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Null topic / null year group
  // -----------------------------------------------------------------------

  it('shows no-match error Alert when assignment has null topicName', async () => {
    const { dialog } = renderWithMatchedCache({
      // The matcher must stay unconfigured: the component returns early before
      // findMatchingDefinition is called because topicName is null.
      findMatchResult: undefined,
      assignments: [
        {
          assignmentId: 'a1',
          title: 'Essay',
          creationTime: '2024-09-02T08:30:00.000Z',
          topicName: null,
          topicId: null,
        },
      ],
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert should indicate this assignment cannot be assessed because
    // it has no topic set in Google Classroom.
    expect(alert).toHaveTextContent(/no.*topic|topic.*null|no.*match/i);
  });

  it('shows error Alert with specific message when class has null yearGroupKey', async () => {
    const { dialog } = renderWithNoMatchCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: null })],
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Cannot determine year group for this class');
  });

  // -----------------------------------------------------------------------
  // Match results
  // -----------------------------------------------------------------------

  it('shows error Alert when findMatchingDefinition returns ambiguous match', async () => {
    const definitionOne = createDefinitionPartial({ definitionKey: 'def-1' });
    const definitionTwo = createDefinitionPartial({ definitionKey: 'def-2' });

    const { dialog } = renderWithMatchedCache({
      definitionPartials: [definitionOne, definitionTwo],
      findMatchResult: { kind: 'ambiguous', matches: [definitionOne, definitionTwo] },
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // API call results
  // -----------------------------------------------------------------------

  it('shows success Alert and single Close button when match + API succeeds', async () => {
    const { dialog } = renderWithMatchedCache({
      startRunResult: START_ASSESSMENT_RUN_RESPONSE,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Success alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();

    // Footer should have only Close button (no Cancel or Start Assessment)
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Start Assessment' })).toBeNull();
    });

    // Scope Close button query to footer to avoid clashing with the modal's
    // built-in X close button which also has accessible name "Close".
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows error Alert when startAssessmentRun rejects with generic API error', async () => {
    const genericError = new Error('Something went wrong');

    const { dialog } = renderWithMatchedCache({
      startRunResult: genericError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Matched-flow DEFINITION_STALE recovery
  // -----------------------------------------------------------------------

  it('matched-flow DEFINITION_STALE enters recovery routing instead of the create path', async () => {
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog, queryClient } = renderWithMatchedCache({
      startRunResult: staleError,
      startRunType: 'reject',
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Cache should be invalidated on stale recovery
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.assignmentDefinitionPartials(),
      });
    });

    // RED: DEFINITION_STALE must enter the assessment orchestration recovery
    // routing (assessmentRecoveryState 'stale-prompt'), never the genuine
    // create path, so the in-modal create content stays unmounted. The positive
    // 'stale-prompt' state is pinned by the orchestration contract spec.
    expect(within(dialog).queryByRole('textbox', { name: /reference document url/i })).toBeNull();
  });

  it('matched-flow non-DEFINITION_STALE errors still surface the existing error alert', async () => {
    const genericError = new Error('Something went wrong');

    const { dialog } = renderWithMatchedCache({
      startRunResult: genericError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Error alert should appear (existing behaviour)
    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();

    // In-modal create content should NOT appear (no stale recovery for generic errors)
    expect(within(dialog).queryByRole('textbox', { name: /reference document url/i })).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Loading state during API call
  // -----------------------------------------------------------------------

  it('shows loading on Start Assessment button during API call, reverts on completion', async () => {
    const { promise: pendingRun, resolve: resolveRun } =
      Promise.withResolvers<typeof START_ASSESSMENT_RUN_RESPONSE>();
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog } = renderWithMatchedCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // During API call, button should show loading state.
    // Ant Design appends "loading" to the accessible name when loading.
    const button = within(dialog).getByRole('button', { name: 'loading Start Assessment' });
    expect(button).toBeDisabled();

    // Resolve the API call
    await act(async () => {
      resolveRun(START_ASSESSMENT_RUN_RESPONSE);
    });

    // After completion, loading should be gone (success state shown)
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });
});
