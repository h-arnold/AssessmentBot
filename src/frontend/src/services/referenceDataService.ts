import { callApi } from './apiService';
import type {
    CohortListResponse,
    CreateCohortInput,
    CreateCohortResponse,
    CreateYearGroupInput,
    CreateYearGroupResponse,
    DeleteCohortInput,
    DeleteCohortResponse,
    DeleteYearGroupInput,
    DeleteYearGroupResponse,
    UpdateCohortInput,
    UpdateCohortResponse,
    UpdateYearGroupInput,
    UpdateYearGroupResponse,
    YearGroupListResponse,
} from './referenceData.zod';
import {
    CohortListResponseSchema,
    CreateCohortInputSchema,
    CreateCohortResponseSchema,
    CreateYearGroupInputSchema,
    CreateYearGroupResponseSchema,
    DeleteCohortInputSchema,
    DeleteCohortResponseSchema,
    DeleteYearGroupInputSchema,
    DeleteYearGroupResponseSchema,
    UpdateCohortInputSchema,
    UpdateCohortResponseSchema,
    UpdateYearGroupInputSchema,
    UpdateYearGroupResponseSchema,
    YearGroupListResponseSchema,
} from './referenceData.zod';

/**
 * Retrieves cohort reference-data records from the backend transport.
 */
export async function getCohorts(): Promise<CohortListResponse> {
    return CohortListResponseSchema.parse(await callApi('getCohorts'));
}

/**
 * Sends a cohort-create request to the backend transport.
 */
export async function createCohort(input: CreateCohortInput): Promise<CreateCohortResponse> {
    const parsedInput = CreateCohortInputSchema.parse(input);
    return CreateCohortResponseSchema.parse(await callApi('createCohort', parsedInput));
}

/**
 * Sends a cohort-update request to the backend transport.
 */
export async function updateCohort(input: UpdateCohortInput): Promise<UpdateCohortResponse> {
    const parsedInput = UpdateCohortInputSchema.parse(input);
    return UpdateCohortResponseSchema.parse(await callApi('updateCohort', parsedInput));
}

/**
 * Sends a cohort-delete request to the backend transport.
 */
export async function deleteCohort(input: DeleteCohortInput): Promise<DeleteCohortResponse> {
    const parsedInput = DeleteCohortInputSchema.parse(input);
    return DeleteCohortResponseSchema.parse(await callApi('deleteCohort', parsedInput));
}

/**
 * Retrieves year-group reference-data records from the backend transport.
 */
export async function getYearGroups(): Promise<YearGroupListResponse> {
    return YearGroupListResponseSchema.parse(await callApi('getYearGroups'));
}

/**
 * Sends a year-group-create request to the backend transport.
 */
export async function createYearGroup(
    input: CreateYearGroupInput
): Promise<CreateYearGroupResponse> {
    const parsedInput = CreateYearGroupInputSchema.parse(input);
    return CreateYearGroupResponseSchema.parse(await callApi('createYearGroup', parsedInput));
}

/**
 * Sends a year-group-update request to the backend transport.
 */
export async function updateYearGroup(
    input: UpdateYearGroupInput
): Promise<UpdateYearGroupResponse> {
    const parsedInput = UpdateYearGroupInputSchema.parse(input);
    return UpdateYearGroupResponseSchema.parse(await callApi('updateYearGroup', parsedInput));
}

/**
 * Sends a year-group-delete request to the backend transport.
 */
export async function deleteYearGroup(
    input: DeleteYearGroupInput
): Promise<DeleteYearGroupResponse> {
    const parsedInput = DeleteYearGroupInputSchema.parse(input);
    return DeleteYearGroupResponseSchema.parse(await callApi('deleteYearGroup', parsedInput));
}