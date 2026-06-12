import { callApi } from './apiService';
import {
  AssignmentDefinitionPartialsResponseSchema,
  DeleteAssignmentDefinitionRequestSchema,
  DeleteAssignmentDefinitionResponseSchema,
  type AssignmentDefinitionPartialsResponse,
  type DeleteAssignmentDefinitionRequest,
  type DeleteAssignmentDefinitionResponse,
} from './assignmentDefinitionPartials.zod';

export type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
  DeleteAssignmentDefinitionRequest,
  DeleteAssignmentDefinitionResponse,
} from './assignmentDefinitionPartials.zod';

const GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD = 'getAssignmentDefinitionPartials';
const DELETE_ASSIGNMENT_DEFINITION_METHOD = 'deleteAssignmentDefinition';

/**
 * Retrieves assignment-definition partial rows from the backend transport.
 *
 * @returns {Promise<AssignmentDefinitionPartialsResponse>} Promise resolving to validated assignment-definition partials.
 */
export async function getAssignmentDefinitionPartials(): Promise<AssignmentDefinitionPartialsResponse> {
  return AssignmentDefinitionPartialsResponseSchema.parse(
    await callApi(GET_ASSIGNMENT_DEFINITION_PARTIALS_METHOD)
  );
}

/**
 * Deletes a single assignment definition by safe definition key.
 *
 * @param {DeleteAssignmentDefinitionRequest} input Delete request payload.
 * @returns {Promise<DeleteAssignmentDefinitionResponse>} Promise resolving when delete succeeds.
 */
export async function deleteAssignmentDefinition(
  input: DeleteAssignmentDefinitionRequest
): Promise<DeleteAssignmentDefinitionResponse> {
  const parsedInput = DeleteAssignmentDefinitionRequestSchema.parse(input);

  return DeleteAssignmentDefinitionResponseSchema.parse(
    await callApi(DELETE_ASSIGNMENT_DEFINITION_METHOD, parsedInput)
  );
}
