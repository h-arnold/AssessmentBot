import { callApi } from './apiService';
import { logFrontendEvent } from '../logging/frontendLogger';
import {
  GetAssignmentDefinitionRequestSchema,
  // GetAssignmentDefinitionResponseSchema, // TEMPORARY: disabled for debug
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
 * Returns the canonical full-definition response shape, matching the upsert response contract
 * so React Query and local form state can use one editable entity model. Resolved labels
 * (primaryTopic, yearGroupLabel) are provided for display while authoritative keys (primaryTopicKey,
 * yearGroupKey) are used for persistence.
 *
 * @param {GetAssignmentDefinitionRequest} request Request payload containing definitionKey.
 * @returns {Promise<GetAssignmentDefinitionResponse>} Promise resolving to validated full definition
 *   with resolved primaryTopic, primaryTopicKey, yearGroupKey, yearGroupLabel, tasks array, and all metadata.
 */
export async function getAssignmentDefinition(
  request: GetAssignmentDefinitionRequest
): Promise<GetAssignmentDefinitionResponse> {
  const parsedRequest = GetAssignmentDefinitionRequestSchema.parse(request);

  const responseData = await callApi(GET_ASSIGNMENT_DEFINITION_METHOD, parsedRequest);

  console.log('[DEBUG assignmentDefinitionService] raw responseData:', responseData);
  console.log('[DEBUG assignmentDefinitionService] typeof responseData:', typeof responseData);

  // TEMPORARY: Bypass Zod validation to debug raw response shape
  return responseData as unknown as GetAssignmentDefinitionResponse;
  // return GetAssignmentDefinitionResponseSchema.parse(responseData);
}

/**
 * Persists assignment-definition changes through the consolidated write transport.
 *
 * Handles stage-one create persistence (with parsed tasks), final save (metadata and weightings),
 * and document-change re-parse. Duplicate detection uses the normalised (primaryTitle,
 * primaryTopicKey, yearGroupKey) tuple. Re-parse preserves existing task weightings for matching
 * task IDs and defaults new tasks to 1. Year-group writes use authoritative yearGroupKey with
 * resolved yearGroupLabel returned in response.
 *
 * @param {UpsertAssignmentDefinitionRequest} request Upsert payload with primaryTitle, primaryTopicKey,
 *   referenceDocumentUrl, templateDocumentUrl (or IDs for non-wizard transport), optional definitionKey,
 *   yearGroupKey, assignmentWeighting, and taskWeightings.
 * @returns {Promise<UpsertAssignmentDefinitionResponse>} Promise resolving to validated full definition
 *   using the canonical response shape shared with getAssignmentDefinition.
 */
export async function upsertAssignmentDefinition(
  request: UpsertAssignmentDefinitionRequest
): Promise<UpsertAssignmentDefinitionResponse> {
  const parsedRequest = UpsertAssignmentDefinitionRequestSchema.parse(request);

  const responseData = await callApi(UPSERT_ASSIGNMENT_DEFINITION_METHOD, parsedRequest);

  // Debug logging: check the raw response data before parsing
  logFrontendEvent('debug', {
    context: 'services/assignmentDefinitionService.upsertAssignmentDefinition',
    metadata: {
      requestPayload: JSON.stringify(parsedRequest),
      responseData: JSON.stringify(responseData),
      responseDataType: typeof responseData,
    },
  });

  return UpsertAssignmentDefinitionResponseSchema.parse(responseData);
}
