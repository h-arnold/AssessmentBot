import type { FormInstance } from 'antd';
import type {
  AssignmentDefinition,
  UpsertAssignmentDefinitionRequest,
} from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { mapErrorToUserMessage } from '../../../errors/map-error-to-ui';
import { logFrontendError } from '../../../logging/frontendLogger';
import type { AssessTaskAssignment, AssessmentAlertType } from './assessTaskFlowData';
import type { TaskRow } from '../../assignmentWizard/assignmentWizardFormState';
import { coerceAssignmentWeighting } from '../../assignmentWizard/assignmentWizardFormState';

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
  const assignmentWeighting = coerceAssignmentWeighting(values.assignmentWeighting);

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

/** Settled approval result shape consumed by the approval outcome helper. */
export type ApprovalUpsertResult = {
  errorMessage: string | null;
  errorCode: string | null;
};

/**
 * Reports whether a save generation is obsolete after an await boundary.
 *
 * @param {number} generation The generation captured before the await.
 * @param {number} current The current generation reference value.
 * @returns {boolean} True when the work must not settle.
 */
export function isGenerationObsolete(generation: number, current: number): boolean {
  return generation !== current;
}

/**
 * Logs the safe structured diagnostic for a missing captured assessment context.
 *
 * @param {string} key The approved definition key.
 * @returns {void}
 */
export function logMissingCaptureContext(key: string): void {
  logFrontendError(
    'AssessTaskRecoveryFlow.resumeAssessment',
    new Error('Missing captured assessment context.'),
    {
      definitionKey: key,
    }
  );
}

/**
 * Reports whether a resume failure is a stale rejection that returns to the prompt.
 *
 * @param {unknown} error The caught resume error.
 * @returns {boolean} True when the error is a stale transport rejection.
 */
export function isStaleResumeRejection(error: unknown): boolean {
  return error instanceof ApiTransportError && error.code === 'DEFINITION_STALE';
}

/**
 * Reads review form values, settling expected validation rejections deliberately.
 *
 * @param {FormInstance} form The review form instance.
 * @returns {Promise<Record<string, unknown> | undefined>} Values, or undefined when validation fails.
 */
export async function readReviewFormValues(
  form: FormInstance
): Promise<Record<string, unknown> | undefined> {
  try {
    return (await form.validateFields()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Settles a non-success approval result. Returns true when the result settled.
 *
 * @param {ApprovalUpsertResult} result The upsert result.
 * @param {(message: string | null) => void} setErrorMessage Clears the blocking error on stale.
 * @param {(phase: RecoveryPhase) => void} setPhase Moves to the stale prompt on stale.
 * @param {(message: string) => void} setSaveErrorMessage Surfaces non-stale failures.
 * @returns {boolean} True when the caller must not resume the assessment.
 */
export function settleApprovalFailure(
  result: ApprovalUpsertResult,
  setErrorMessage: (message: string | null) => void,
  setPhase: (phase: RecoveryPhase) => void,
  setSaveErrorMessage: (message: string) => void
): boolean {
  if (result.errorMessage === null) {
    return false;
  }
  if (result.errorCode === 'DEFINITION_STALE') {
    setErrorMessage(null);
    setPhase('stale-prompt');
    return true;
  }
  setSaveErrorMessage(result.errorMessage);
  return true;
}

/**
 * Reports whether an approval save must not start.
 *
 * @param {AssignmentDefinition | null} definition The reviewed definition.
 * @param {boolean} isMutationBusy Whether a mutation is already in flight.
 * @returns {boolean} True when the save must return early.
 */
export function isSaveBlocked(
  definition: AssignmentDefinition | null,
  isMutationBusy: boolean
): boolean {
  return definition === null || isMutationBusy;
}

/**
 * Finds the resumed assessment title for the captured assignment.
 *
 * @param {readonly AssessTaskAssignment[]} assignments The cached assignments.
 * @param {string} assignmentId The captured assignment identifier.
 * @returns {string} The assignment title, or an empty string.
 */
export function findResumeTitle(
  assignments: readonly AssessTaskAssignment[],
  assignmentId: string
): string {
  return assignments.find((a) => a.assignmentId === assignmentId)?.title ?? '';
}

/**
 * Settles the missing-context invariant: logs the diagnostic, then settles the
 * shared generic copy unless the generation is obsolete.
 *
 * @param {string} key The approved definition key.
 * @param {number} generation The save generation.
 * @param {number} current The current generation reference value.
 * @param {(alertType: AssessmentAlertType, message: string) => void} settleAssessment Settles the assessment.
 * @returns {void}
 */
export function settleMissingCapture(
  key: string,
  generation: number,
  current: number,
  settleAssessment: (alertType: AssessmentAlertType, message: string) => void
): void {
  logMissingCaptureContext(key);
  if (isGenerationObsolete(generation, current)) return;
  settleAssessment('error', mapErrorToUserMessage(null));
}

/**
 * Settles a resume failure unless the generation is obsolete.
 *
 * @param {unknown} error The caught resume error.
 * @param {number} generation The save generation.
 * @param {number} current The current generation reference value.
 * @param {(phase: RecoveryPhase) => void} setPhase Moves to the stale prompt on stale.
 * @param {(alertType: AssessmentAlertType, message: string) => void} settleAssessment Settles non-stale failures.
 * @returns {void}
 */
export function settleResumeFailure(
  error: unknown,
  generation: number,
  current: number,
  setPhase: (phase: RecoveryPhase) => void,
  settleAssessment: (alertType: AssessmentAlertType, message: string) => void
): void {
  if (isGenerationObsolete(generation, current)) return;
  if (isStaleResumeRejection(error)) {
    setPhase('stale-prompt');
    return;
  }
  settleAssessment('error', mapErrorToUserMessage(error));
}

/**
 * Reports whether the approval save must not proceed to the upsert.
 *
 * @param {Record<string, unknown> | undefined} values The validated form values.
 * @param {number} generation The save generation.
 * @param {number} current The current generation reference value.
 * @returns {boolean} True when the caller must return early.
 */
export function isApprovalNotReady(
  values: Record<string, unknown> | undefined,
  generation: number,
  current: number
): values is undefined {
  return values === undefined || isGenerationObsolete(generation, current);
}

/**
 * Settles an unexpected save throw unless the generation is obsolete.
 *
 * @param {unknown} error The caught save error.
 * @param {number} generation The save generation.
 * @param {number} current The current generation reference value.
 * @param {(message: string) => void} setSaveErrorMessage Surfaces the mapped message.
 * @returns {void}
 */
export function settleSaveThrow(
  error: unknown,
  generation: number,
  current: number,
  setSaveErrorMessage: (message: string) => void
): void {
  if (isGenerationObsolete(generation, current)) return;
  setSaveErrorMessage(mapErrorToUserMessage(error));
}
