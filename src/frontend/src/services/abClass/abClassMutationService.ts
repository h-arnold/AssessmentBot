import { callApiQueued } from '../api/apiQueue';
import { parseApiResponse } from '../apiService';
import { ClassPartialSchema, type ClassPartial } from '../googleClassrooms/classPartials.zod';
import {
  UpsertABClassRequestSchema,
  UpdateABClassRequestSchema,
  type UpsertABClassRequest,
  type UpdateABClassRequest,
} from './abClassMutations.zod';

const JOB_NAME = 'classesBulkMutation';

/**
 * Creates or refreshes a class through the existing per-job FIFO.
 * @param {UpsertABClassRequest} parameters - Required configuration and optional metadata.
 * @returns {Promise<ClassPartial>} Validated partial class summary.
 * @remarks Validation and metadata detachment finish before enqueue. Omission,
 * explicit null and complete replacement stay distinct. Transport owns retries.
 * Never await this queued wrapper inside an active task on the same lane: it
 * deadlocks. A reserved-slot owner must use callApi directly with the shared
 * request schema and response parser instead.
 */
export async function upsertABClass(parameters: UpsertABClassRequest): Promise<ClassPartial> {
  const request = UpsertABClassRequestSchema.parse(parameters);
  const method = 'upsertABClass';
  const data = await callApiQueued(method, request, JOB_NAME);
  return parseApiResponse(ClassPartialSchema, method, data);
}

/**
 * Updates supplied editable fields without refreshing the class roster.
 * @param {UpdateABClassRequest} parameters - Class ID and optional editable fields.
 * @returns {Promise<ClassPartial>} Validated partial class summary.
 * @remarks Own undefined rejects before enqueue; metadata is a whole replacement,
 * not a nested patch. This shares the classesBulkMutation lane, not a global FIFO.
 * Never await this wrapper from that lane's active task; use callApi directly
 * inside the reserved slot with the shared schemas and parseApiResponse.
 * Transport errors propagate unchanged and retries remain transport-owned.
 */
export async function updateABClass(parameters: UpdateABClassRequest): Promise<ClassPartial> {
  const request = UpdateABClassRequestSchema.parse(parameters);
  const method = 'updateABClass';
  const data = await callApiQueued(method, request, JOB_NAME);
  return parseApiResponse(ClassPartialSchema, method, data);
}
