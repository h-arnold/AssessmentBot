/**
 * Matched-manual and link-definition paths settle on the shared success surface.
 * A committed link whose assessment fails retains its picker-replacing error state.
 */

import { waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '@/services/assignmentDefinition/assignmentDefinitionService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { createDefinitionPartial } from '@/test/classes/matchDefinitionForAssignment.test-utilities';
import {
  clickLink,
  clickLinkToExisting,
  clickStartAssessment,
  DEFAULT_UPSERT_RESULT,
  expectLinkButtonDisabled,
  expectAssessmentSuccessSurface,
  MOCK_CLASS_ID,
  pickLinkableDefinition,
  renderWithCache,
  selectAssignment,
} from '@/test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '@/test/classes/AssessTaskModal.link-flow-helpers';

const MATCHED_DEFINITION_KEY = 'matched-definition';

beforeEach(() => {
  vi.mocked(findMatchingDefinition).mockImplementation(() => {
    return {
      kind: 'matched',
      definition: createDefinitionPartial({ definitionKey: MATCHED_DEFINITION_KEY }),
    };
  });
  vi.mocked(startAssessmentRun).mockImplementation(() => Promise.resolve(null));
  vi.mocked(upsertAssignmentDefinition).mockImplementation(() =>
    Promise.resolve(DEFAULT_UPSERT_RESULT)
  );
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AssessTaskModal manual matched and link flows', () => {
  it('starts a matched definition and settles on the success surface', async () => {
    const { dialog } = renderWithCache({
      classPartials: [{ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10', className: 'My Class' }],
      definitionPartials: [createDefinitionPartial({ definitionKey: MATCHED_DEFINITION_KEY })],
    });
    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    expect(startAssessmentRun).toHaveBeenCalledWith({
      definitionKey: MATCHED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    expectAssessmentSuccessSurface(dialog, 'Essay');
  });

  it('links a selected definition, starts its assessment, and replaces the picker on success', async () => {
    const { dialog } = renderWithNoMatchCache();
    await selectAssignment(dialog);
    await clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    expectLinkButtonDisabled(dialog);
    await pickLinkableDefinition(dialog);
    await clickLink(dialog);

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    expect(upsertAssignmentDefinition).toHaveBeenCalledTimes(1);
    expectAssessmentSuccessSurface(dialog, 'Essay');
  });

  it('shows the committed-link failure state when starting its assessment fails', async () => {
    vi.mocked(startAssessmentRun).mockImplementation(() =>
      Promise.reject(new Error('assessment service unavailable'))
    );
    const { dialog } = renderWithNoMatchCache();
    await selectAssignment(dialog);
    await clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);
    await pickLinkableDefinition(dialog);
    await clickLink(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/Link was committed but assessment could not be started/i);
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Link' })).toBeNull();
    expect(within(dialog).getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
