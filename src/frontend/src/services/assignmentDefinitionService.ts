import { callApi } from './apiService';
import {
  GetAssignmentDefinitionRequestSchema,
  GetAssignmentDefinitionResponseSchema,
  UpsertAssignmentDefinitionRequestSchema,
  UpsertAssignmentDefinitionResponseSchema,
  type GetAssignmentDefinitionRequest,
  type GetAssignmentDefinitionResponse,
  type UpsertAssignmentDefinitionRequest,
  type UpsertAssignmentDefinitionResponse,
} from './assignmentDefinition.zod';

const GET_ASSIGNMENT_DEFINITION_METHOD = 'getAssignmentDefinition';
const UPSERT_ASSIGNMENT_DEFINITION_METHOD = 'upsertAssignmentDefinition';

export type {
  AssignmentDefinition,
  GetAssignmentDefinitionRequest,
  GetAssignmentDefinitionResponse,
  UpsertAssignmentDefinitionRequest,
  UpsertAssignmentDefinitionResponse,
} from './assignmentDefinition.zod';

/**
 * Reads one full assignment definition by key.
 *
 * @param {GetAssignmentDefinitionRequest} request Request payload.
 * @returns {Promise<GetAssignmentDefinitionResponse>} Promise resolving to validated full definition.
 */
export async function getAssignmentDefinition(
  request: GetAssignmentDefinitionRequest
): Promise<GetAssignmentDefinitionResponse> {
  const parsedRequest = GetAssignmentDefinitionRequestSchema.parse(request);

  return GetAssignmentDefinitionResponseSchema.parse(
    await callApi(GET_ASSIGNMENT_DEFINITION_METHOD, parsedRequest)
  );
}

/**
 * Persists assignment-definition changes for create, save, and re-parse flows.
 *
 * @param {UpsertAssignmentDefinitionRequest} request Upsert payload.
 * @returns {Promise<UpsertAssignmentDefinitionResponse>} Promise resolving to validated full definition.
 */
export async function upsertAssignmentDefinition(
  request: UpsertAssignmentDefinitionRequest
): Promise<UpsertAssignmentDefinitionResponse> {
  const parsedRequest = UpsertAssignmentDefinitionRequestSchema.parse(request);

  return UpsertAssignmentDefinitionResponseSchema.parse(
    await callApi(UPSERT_ASSIGNMENT_DEFINITION_METHOD, parsedRequest)
  );
}
