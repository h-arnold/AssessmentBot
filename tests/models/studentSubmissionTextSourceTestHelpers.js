/**
 * Shared canonical TEXT-source lookup for StudentSubmission suites.
 *
 * Both the model suite and the content-replacement companion start from the
 * canonical `small` profile and need the first submission whose items include a
 * completed TEXT artefact. The duplicated preamble lives here.
 */

import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

/**
 * Finds the first assignment with submissions and, within it, the first
 * submission carrying a TEXT item with non-null content, together with that
 * item's task ID.
 *
 * @returns {{assignment: object, source: object, taskId: string}} The canonical
 *   assignment, the matching raw submission and the matching task ID.
 */
export function findTextSourceSubmission() {
  const assignment = Object.values(loadBackendModelInputs('small').assignmentsByKey).find(
    (row) => row.submissions?.length
  );
  const source = assignment.submissions.find((row) =>
    Object.values(row.items ?? {}).some(
      (item) => item.artifact?.type === 'TEXT' && item.artifact.content != null
    )
  );
  const taskId = Object.keys(source.items).find(
    (id) => source.items[id].artifact?.type === 'TEXT' && source.items[id].artifact.content != null
  );
  return { assignment, source, taskId };
}
