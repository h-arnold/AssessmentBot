import { DEFAULT_WEIGHTING_VALUE } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import type {
  AssignmentDefinition,
  UpsertAssignmentDefinitionRequest,
} from '../../../services/assignmentDefinition/assignmentDefinitionService';
import type { TaskRow } from '../../assignmentWizard/assignmentWizardFormState';

/**
 * Recovery phases rendered inside the single owning assessment modal.
 *
 * @remarks
 * `failed` covers both a definition-load failure and a reparse failure: both
 * are blocking owned-region states offering Retry and Cancel, and neither may
 * fall back to the create flow.
 */
export type RecoveryPhase = 'idle' | 'stale-prompt' | 'reparsing' | 'review' | 'failed';

/**
 * Builds the approval-save request from the reviewed definition and edits.
 *
 * @remarks
 * The reviewed definition's `updatedAt` is the stale-protection baseline: it is
 * resent as `expectedDefinitionUpdatedAt` so a concurrent document change is
 * rejected as `DEFINITION_STALE` before any write.
 *
 * @param {AssignmentDefinition} definition - The reviewed/reparsed definition.
 * @param {Record<string, unknown>} values - The current review form values.
 * @param {readonly TaskRow[]} taskRows - The current (possibly edited) task rows.
 * @returns {UpsertAssignmentDefinitionRequest} The approval-save request.
 */
export function buildRecoveryApprovalRequest(
  definition: AssignmentDefinition,
  values: Record<string, unknown>,
  taskRows: readonly TaskRow[]
): UpsertAssignmentDefinitionRequest {
  const assignmentWeighting =
    typeof values.assignmentWeighting === 'number'
      ? values.assignmentWeighting
      : DEFAULT_WEIGHTING_VALUE;

  const request: UpsertAssignmentDefinitionRequest = {
    definitionKey: definition.definitionKey,
    primaryTitle: values.title as string,
    primaryTopicKey: values.topic as string,
    yearGroupKey: values.yearGroup as string,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    documentType: definition.documentType,
    assignmentWeighting,
    taskWeightings: taskRows.map((row) => ({
      taskId: row.taskId,
      taskWeighting: row.taskWeighting,
    })),
  };
  if (definition.updatedAt) {
    request.expectedDefinitionUpdatedAt = definition.updatedAt;
  }
  return request;
}
