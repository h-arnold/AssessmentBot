import { callApi, parseApiResponse } from '../apiService';
import type {
  AssignmentTopicListResponse,
  CohortListResponse,
  CreateAssignmentTopicInput,
  CreateAssignmentTopicResponse,
  CreateCohortInput,
  CreateCohortResponse,
  CreateYearGroupInput,
  CreateYearGroupResponse,
  DeleteAssignmentTopicInput,
  DeleteAssignmentTopicResponse,
  DeleteCohortInput,
  DeleteCohortResponse,
  DeleteYearGroupInput,
  DeleteYearGroupResponse,
  UpdateAssignmentTopicInput,
  UpdateAssignmentTopicResponse,
  UpdateCohortInput,
  UpdateCohortResponse,
  UpdateYearGroupInput,
  UpdateYearGroupResponse,
  YearGroupListResponse,
} from './referenceData.zod';
import {
  AssignmentTopicListResponseSchema,
  CohortListResponseSchema,
  CreateAssignmentTopicInputSchema,
  CreateAssignmentTopicResponseSchema,
  CreateCohortInputSchema,
  CreateCohortResponseSchema,
  CreateYearGroupInputSchema,
  CreateYearGroupResponseSchema,
  DeleteAssignmentTopicInputSchema,
  DeleteAssignmentTopicResponseSchema,
  DeleteCohortInputSchema,
  DeleteCohortResponseSchema,
  DeleteYearGroupInputSchema,
  DeleteYearGroupResponseSchema,
  UpdateAssignmentTopicInputSchema,
  UpdateAssignmentTopicResponseSchema,
  UpdateCohortInputSchema,
  UpdateCohortResponseSchema,
  UpdateYearGroupInputSchema,
  UpdateYearGroupResponseSchema,
  YearGroupListResponseSchema,
} from './referenceData.zod';

/**
 * Retrieves cohort reference-data records from the backend transport.
 *
 * @returns {Promise<CohortListResponse>} The cohort list response.
 */
export async function getCohorts(): Promise<CohortListResponse> {
  return parseApiResponse(CohortListResponseSchema, 'getCohorts', await callApi('getCohorts'));
}

/**
 * Sends a cohort-create request to the backend transport.
 *
 * @param {CreateCohortInput} input Cohort create input.
 * @returns {Promise<CreateCohortResponse>} The cohort create response.
 */
export async function createCohort(input: CreateCohortInput): Promise<CreateCohortResponse> {
  const parsedInput = CreateCohortInputSchema.parse(input);
  return parseApiResponse(
    CreateCohortResponseSchema,
    'createCohort',
    await callApi('createCohort', parsedInput)
  );
}

/**
 * Sends a cohort-update request to the backend transport.
 *
 * @param {UpdateCohortInput} input Cohort update input.
 * @returns {Promise<UpdateCohortResponse>} The cohort update response.
 */
export async function updateCohort(input: UpdateCohortInput): Promise<UpdateCohortResponse> {
  const parsedInput = UpdateCohortInputSchema.parse(input);
  return parseApiResponse(
    UpdateCohortResponseSchema,
    'updateCohort',
    await callApi('updateCohort', parsedInput)
  );
}

/**
 * Sends a cohort-delete request to the backend transport.
 *
 * @param {DeleteCohortInput} input Cohort delete input.
 * @returns {Promise<DeleteCohortResponse>} The cohort delete response.
 */
export async function deleteCohort(input: DeleteCohortInput): Promise<DeleteCohortResponse> {
  const parsedInput = DeleteCohortInputSchema.parse(input);
  return parseApiResponse(
    DeleteCohortResponseSchema,
    'deleteCohort',
    await callApi('deleteCohort', parsedInput)
  );
}

/**
 * Retrieves year-group reference-data records from the backend transport.
 *
 * @returns {Promise<YearGroupListResponse>} The year-group list response.
 */
export async function getYearGroups(): Promise<YearGroupListResponse> {
  return parseApiResponse(
    YearGroupListResponseSchema,
    'getYearGroups',
    await callApi('getYearGroups')
  );
}

/**
 * Sends a year-group-create request to the backend transport.
 *
 * @param {CreateYearGroupInput} input Year-group create input.
 * @returns {Promise<CreateYearGroupResponse>} The year-group create response.
 */
export async function createYearGroup(
  input: CreateYearGroupInput
): Promise<CreateYearGroupResponse> {
  const parsedInput = CreateYearGroupInputSchema.parse(input);
  return parseApiResponse(
    CreateYearGroupResponseSchema,
    'createYearGroup',
    await callApi('createYearGroup', parsedInput)
  );
}

/**
 * Sends a year-group-update request to the backend transport.
 *
 * @param {UpdateYearGroupInput} input Year-group update input.
 * @returns {Promise<UpdateYearGroupResponse>} The year-group update response.
 */
export async function updateYearGroup(
  input: UpdateYearGroupInput
): Promise<UpdateYearGroupResponse> {
  const parsedInput = UpdateYearGroupInputSchema.parse(input);
  return parseApiResponse(
    UpdateYearGroupResponseSchema,
    'updateYearGroup',
    await callApi('updateYearGroup', parsedInput)
  );
}

/**
 * Sends a year-group-delete request to the backend transport.
 *
 * @param {DeleteYearGroupInput} input Year-group delete input.
 * @returns {Promise<DeleteYearGroupResponse>} The year-group delete response.
 */
export async function deleteYearGroup(
  input: DeleteYearGroupInput
): Promise<DeleteYearGroupResponse> {
  const parsedInput = DeleteYearGroupInputSchema.parse(input);
  return parseApiResponse(
    DeleteYearGroupResponseSchema,
    'deleteYearGroup',
    await callApi('deleteYearGroup', parsedInput)
  );
}

/**
 * Retrieves assignment-topic reference-data records from the backend transport.
 *
 * @returns {Promise<AssignmentTopicListResponse>} The assignment-topic list response.
 */
export async function getAssignmentTopics(): Promise<AssignmentTopicListResponse> {
  return parseApiResponse(
    AssignmentTopicListResponseSchema,
    'getAssignmentTopics',
    await callApi('getAssignmentTopics')
  );
}

/**
 * Sends an assignment-topic-create request to the backend transport.
 *
 * @param {CreateAssignmentTopicInput} input Assignment-topic create input.
 * @returns {Promise<CreateAssignmentTopicResponse>} The assignment-topic create response.
 */
export async function createAssignmentTopic(
  input: CreateAssignmentTopicInput
): Promise<CreateAssignmentTopicResponse> {
  const parsedInput = CreateAssignmentTopicInputSchema.parse(input);
  return parseApiResponse(
    CreateAssignmentTopicResponseSchema,
    'createAssignmentTopic',
    await callApi('createAssignmentTopic', parsedInput)
  );
}

/**
 * Sends an assignment-topic-update request to the backend transport.
 *
 * @param {UpdateAssignmentTopicInput} input Assignment-topic update input.
 * @returns {Promise<UpdateAssignmentTopicResponse>} The assignment-topic update response.
 */
export async function updateAssignmentTopic(
  input: UpdateAssignmentTopicInput
): Promise<UpdateAssignmentTopicResponse> {
  const parsedInput = UpdateAssignmentTopicInputSchema.parse(input);
  return parseApiResponse(
    UpdateAssignmentTopicResponseSchema,
    'updateAssignmentTopic',
    await callApi('updateAssignmentTopic', parsedInput)
  );
}

/**
 * Sends an assignment-topic-delete request to the backend transport.
 *
 * @param {DeleteAssignmentTopicInput} input Assignment-topic delete input.
 * @returns {Promise<DeleteAssignmentTopicResponse>} The assignment-topic delete response.
 */
export async function deleteAssignmentTopic(
  input: DeleteAssignmentTopicInput
): Promise<DeleteAssignmentTopicResponse> {
  const parsedInput = DeleteAssignmentTopicInputSchema.parse(input);
  return parseApiResponse(
    DeleteAssignmentTopicResponseSchema,
    'deleteAssignmentTopic',
    await callApi('deleteAssignmentTopic', parsedInput)
  );
}
