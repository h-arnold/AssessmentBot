import {
  type AssignmentDefinition,
  type UpsertAssignmentDefinitionRequest,
} from '../../services/assignmentDefinition/assignmentDefinitionService';

/**
 * Builds the ID-shaped request fields shared by explicit reparse requests.
 *
 * @param {AssignmentDefinition} definition - The loaded definition.
 * @returns {object} The ID-shape transport fields.
 */
function buildIdShapeFields(definition: AssignmentDefinition): {
  referenceDocumentId: string;
  templateDocumentId: string;
  documentType: 'SLIDES' | 'SHEETS';
} {
  return {
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    documentType: definition.documentType,
  };
}

/**
 * Builds the forced-reparse request for an existing definition.
 *
 * @remarks
 * Shared by both forced-reparse consumers: `useAssignmentDefinitionWizard`'s
 * Assignments-page Reparse documents action and `useAssessTaskRecoveryFlow`'s
 * stale-recovery reparse. Both force the backend to reparse the existing
 * definition's current documents, so the request stays ID-shaped with
 * `forceReparse: true` and omits any weighting patch; the backend reconciles
 * the stored task weightings itself.
 *
 * @param {AssignmentDefinition} definition - The loaded definition.
 * @returns {UpsertAssignmentDefinitionRequest} The forced-reparse request (no weighting patch).
 */
export function buildReparseRequest(
  definition: AssignmentDefinition
): UpsertAssignmentDefinitionRequest {
  return {
    definitionKey: definition.definitionKey,
    primaryTitle: definition.primaryTitle,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    ...buildIdShapeFields(definition),
    forceReparse: true,
  };
}
