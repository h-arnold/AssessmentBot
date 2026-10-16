import { expect, test } from '@playwright/test';
import { expectAssessmentSuccessSurface } from './helpers/assessment-success-surface';
import { getMethodCalls, installRuntimeMock } from './shared/endToEndRuntimeMocks';
import {
  algebraHomeworkEntry,
  createLinkableScenario,
  openAssessTaskModal,
  pickLinkableDefinitionE2E,
  selectAssignmentAndStart,
} from './helpers/classes-page-end-to-end-helpers';

test('linking an existing definition shows the shared success surface exactly once', async ({
  page,
}) => {
  await installRuntimeMock(
    page,
    createLinkableScenario({
      getGoogleClassroomAssignments: [algebraHomeworkEntry(), algebraHomeworkEntry()],
    })
  );
  const dialog = await openAssessTaskModal(page);

  await selectAssignmentAndStart(dialog, page);
  await dialog.getByRole('button', { name: 'Link to Existing Definition' }).click();
  await pickLinkableDefinitionE2E(dialog, page, 'Algebra HW');
  await dialog.getByRole('button', { name: 'Link' }).click();

  await expectAssessmentSuccessSurface(dialog, 'Algebra Homework');
  const calls = await getMethodCalls(page);
  expect(calls.filter((method) => method === 'upsertAssignmentDefinition')).toHaveLength(1);
  expect(calls.filter((method) => method === 'startAssessmentRun')).toHaveLength(1);
});
