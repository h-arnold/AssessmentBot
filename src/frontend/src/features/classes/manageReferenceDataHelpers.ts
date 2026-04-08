/**
 * Shared helpers for the Manage Cohorts and Manage Year Groups modal workflows.
 *
 * Extracted here to avoid duplicating identical logic across both modal modules.
 * Keep this file local to the classes feature.
 */

import { ApiTransportError } from '../../errors/apiTransportError';

/**
 * Returns true when the API transport error signals that a record is in use.
 *
 * @param {unknown} error Error caught from a service call.
 * @returns {boolean} True when the error code is IN_USE.
 */
export function isInUseError(error: unknown): boolean {
  return error instanceof ApiTransportError && error.code === 'IN_USE';
}

/**
 * Derives a user-facing delete error message from the thrown error.
 *
 * @param {unknown} error Error caught from the delete service call.
 * @param {boolean} blocked Whether the error was an IN_USE block.
 * @param {string} entityLabel Singular lower-case label for the entity (e.g. 'cohort', 'year group').
 * @returns {string} User-facing error message.
 */
export function getDeleteErrorMessage(error: unknown, blocked: boolean, entityLabel: string): string {
  if (blocked) {
    return `This ${entityLabel} is in use by one or more classes and cannot be deleted.`;
  }

  return error instanceof Error ? error.message : `Unable to delete the ${entityLabel}.`;
}
