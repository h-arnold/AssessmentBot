/**
 * Direct unit coverage for `buildRecoveryApprovalRequest`, the approval-save
 * request builder used by the in-modal stale-recovery flow.
 *
 * The request is asserted against the real `UpsertAssignmentDefinitionRequestSchema`
 * so the builder stays pinned to the transport contract rather than a loose stub.
 */

import { describe, expect, it } from 'vitest';
import { buildRecoveryApprovalRequest } from './assessTaskRecoveryData';
import {
  UpsertAssignmentDefinitionRequestSchema,
  type AssignmentDefinition,
} from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import type { TaskRow } from '../../assignmentWizard/assignmentWizardFormState';
import editableDefinitionsRaw from '../../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture instead of a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical `definition-0-slides` record exercised as the reviewed definition. */
const REVIEWED_DEFINITION: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/** Edited assignment weighting exercised through the review form values. */
const EDITED_ASSIGNMENT_WEIGHTING = 5;

/** Edited non-zero task weighting exercised through the review task rows. */
const EDITED_TASK_WEIGHTING = 4;

/** Reviewed form values carrying an edited assignment weighting. */
const REVIEW_VALUES: Record<string, unknown> = {
  title: 'Reviewed title',
  topic: 'topic-0',
  yearGroup: 'year-group-7',
  assignmentWeighting: EDITED_ASSIGNMENT_WEIGHTING,
};

/** Reviewed task rows carrying an edited weighting and a preserved zero. */
const REVIEW_TASK_ROWS: TaskRow[] = [
  { key: 'task-0-0', taskId: 'task-0-0', taskTitle: 'Synthetic Task 1.1', taskWeighting: 0 },
  {
    key: 'task-0-1',
    taskId: 'task-0-1',
    taskTitle: 'Synthetic Task 1.2',
    taskWeighting: EDITED_TASK_WEIGHTING,
  },
];

describe('buildRecoveryApprovalRequest', () => {
  it('resends the reviewed definition timestamp as the stale-protection baseline', () => {
    const request = buildRecoveryApprovalRequest(
      REVIEWED_DEFINITION,
      REVIEW_VALUES,
      REVIEW_TASK_ROWS
    );

    expect(request.definitionKey).toBe(REVIEWED_DEFINITION.definitionKey);
    expect(request.updatedAt).toBe(REVIEWED_DEFINITION.updatedAt);
  });

  it('preserves the reviewed assignment weighting and task-row weightings including zero', () => {
    const request = buildRecoveryApprovalRequest(
      REVIEWED_DEFINITION,
      REVIEW_VALUES,
      REVIEW_TASK_ROWS
    );

    expect(request.assignmentWeighting).toBe(EDITED_ASSIGNMENT_WEIGHTING);
    expect(request.taskWeightings).toEqual([
      { taskId: 'task-0-0', taskWeighting: 0 },
      { taskId: 'task-0-1', taskWeighting: EDITED_TASK_WEIGHTING },
    ]);
  });

  it('produces an approval payload accepted by the upsert request schema', () => {
    const request = buildRecoveryApprovalRequest(
      REVIEWED_DEFINITION,
      REVIEW_VALUES,
      REVIEW_TASK_ROWS
    );

    expect(UpsertAssignmentDefinitionRequestSchema.safeParse(request).success).toBe(true);
  });

  it('omits the timestamp baseline when the reviewed definition has no updatedAt', () => {
    const request = buildRecoveryApprovalRequest(
      { ...REVIEWED_DEFINITION, updatedAt: null },
      REVIEW_VALUES,
      REVIEW_TASK_ROWS
    );

    expect(request).not.toHaveProperty('updatedAt');
  });
});
