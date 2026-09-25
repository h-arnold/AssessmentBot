/**
 * Build the canonical definition-scoped task key.
 *
 * @param {string} definitionKey - Assignment definition identifier.
 * @param {string} taskId - Task identifier.
 * @returns {string} The `${definitionKey}::${taskId}` task key.
 */
export function buildTaskKey(definitionKey: string, taskId: string): string {
  return `${definitionKey}::${taskId}`;
}
