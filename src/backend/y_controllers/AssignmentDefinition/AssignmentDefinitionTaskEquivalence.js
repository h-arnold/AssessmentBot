/**
 * AssignmentDefinitionTaskEquivalence
 *
 * Pure task-equivalence comparator for assignment-definition reparses (issue #301).
 * Decides whether a reparsed task carries equivalent assessment content to the
 * stored task, so the upsert orchestrator preserves stored weightings for
 * unchanged tasks and falls back to the default weighting for new or changed ones.
 *
 * Equivalence rule: same task identity and equivalent parsed content (title,
 * notes, task metadata, ordered reference/template artefact collections).
 * Object keys compare independent of insertion order; array order is preserved.
 * Weighting, derived content hashes, generated UIDs and positional bookkeeping
 * are excluded. No hash-equality-only shortcuts and no fuzzy matching: any
 * task/page identity difference is a change.
 *
 * Parser-volatile fields are excluded wherever carried: `taskWeighting`
 * (operator-owned, never parsed content),
 * `contentHash` (derived from content, recomputed on every parse), `uid` on
 * serialised artefacts and `_uid` on live artefact instances (regenerated per
 * parse), `index` on tasks, `taskIndex` and `artifactIndex` bookkeeping.
 */

/**
 * Compares a stored task with its reparsed counterpart.
 *
 * @param {Object} previousTask - Stored task (TaskDefinition instance or plain JSON).
 * @param {Object} reparsedTask - Freshly parsed task (TaskDefinition instance or plain JSON).
 * @returns {{equivalent: boolean, reason: string}} Equivalence decision with reason code.
 * @throws {TypeError} When either argument is not a task object.
 */
function compareTaskEquivalence_(previousTask, reparsedTask) {
  if (!isTaskObject_(previousTask) || !isTaskObject_(reparsedTask)) {
    throw new TypeError('compareTaskEquivalence_ requires two task objects.');
  }

  if (previousTask.id !== reparsedTask.id) {
    return { equivalent: false, reason: 'task-id-changed' };
  }

  // Optional fields are normalised to their canonical parsed form first: the
  // parser turns absent values into null (scalars) or {} (metadata) while
  // stored tasks may omit those keys, and neither spelling is a content change.
  if (absentToNull_(previousTask.pageId) !== absentToNull_(reparsedTask.pageId)) {
    return { equivalent: false, reason: 'page-id-changed' };
  }

  if (previousTask.taskTitle !== reparsedTask.taskTitle) {
    return { equivalent: false, reason: 'title-changed' };
  }

  if (absentToNull_(previousTask.taskNotes) !== absentToNull_(reparsedTask.taskNotes)) {
    return { equivalent: false, reason: 'notes-changed' };
  }

  if (
    !valuesEqual_(
      absentToEmptyObject_(previousTask.taskMetadata),
      absentToEmptyObject_(reparsedTask.taskMetadata)
    )
  ) {
    return { equivalent: false, reason: 'task-metadata-changed' };
  }

  if (!artefactCollectionsEqual_(previousTask, reparsedTask)) {
    return { equivalent: false, reason: 'artefact-changed' };
  }

  return { equivalent: true, reason: 'equivalent' };
}

/**
 * Returns whether a value is a task-like object.
 *
 * @param {*} value - Value to inspect.
 * @returns {boolean} True for non-null, non-array objects.
 */
function isTaskObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Compares the ordered reference and template artefact collections of two tasks.
 * Any count, order or content difference reports inequality.
 *
 * @param {Object} previousTask - Stored task.
 * @param {Object} reparsedTask - Freshly parsed task.
 * @returns {boolean} True when both collections match element by element.
 */
function artefactCollectionsEqual_(previousTask, reparsedTask) {
  return (
    artefactListsEqual_(
      artefactCollectionOf_(previousTask, 'reference'),
      artefactCollectionOf_(reparsedTask, 'reference')
    ) &&
    artefactListsEqual_(
      artefactCollectionOf_(previousTask, 'template'),
      artefactCollectionOf_(reparsedTask, 'template')
    )
  );
}

/**
 * Reads one artefact collection from a task, tolerating absent collections.
 *
 * @param {Object} task - Task holding the collections.
 * @param {string} role - Collection role ('reference' or 'template').
 * @returns {Array} Artefact list, or an empty array when absent.
 */
function artefactCollectionOf_(task, role) {
  const collections = task ? task.artifacts : null;
  const list = collections ? collections[role] : null;
  return Array.isArray(list) ? list : [];
}

/**
 * Compares two artefact lists element by element with array order preserved.
 *
 * @param {Array} previousList - Stored artefacts.
 * @param {Array} reparsedList - Freshly parsed artefacts.
 * @returns {boolean} True when the lists match element by element.
 */
function artefactListsEqual_(previousList, reparsedList) {
  if (previousList.length !== reparsedList.length) {
    return false;
  }

  return previousList.every((previousArtefact, position) =>
    valuesEqual_(normaliseArtefact_(previousArtefact), normaliseArtefact_(reparsedList[position]))
  );
}

/**
 * Canonicalises an artefact to its persisted assessment content. Model instances
 * serialise before comparison so runtime internals cannot make unchanged content
 * appear different from persisted JSON.
 * Absent optional fields take their canonical parsed form for the same reason
 * as task-level fields.
 *
 * @param {Object} artefact - Artefact instance or plain JSON.
 * @returns {Object} Canonical persisted artefact fields.
 */
function normaliseArtefact_(artefact) {
  const source =
    artefact && typeof artefact.toJSON === 'function' ? artefact.toJSON() : artefact || {};
  return {
    taskId: absentToNull_(source.taskId),
    role: absentToNull_(source.role),
    pageId: absentToNull_(source.pageId),
    documentId: absentToNull_(source.documentId),
    content: absentToNull_(source.content),
    metadata: absentToEmptyObject_(source.metadata),
    type: absentToNull_(source.type),
  };
}

/**
 * Maps an absent optional scalar to its canonical parsed form (null).
 *
 * @param {*} value - Field value.
 * @returns {*} The value, or null when absent.
 */
function absentToNull_(value) {
  return value ?? null;
}

/**
 * Maps absent metadata to its canonical parsed form (empty object).
 *
 * @param {*} value - Metadata value.
 * @returns {*} The value, or an empty object when absent.
 */
function absentToEmptyObject_(value) {
  return value ?? {};
}

/**
 * Structural deep equality for parsed task content. Object keys compare
 * independent of insertion order; array order is preserved. Prototypes are
 * ignored so model instances and plain JSON compare alike, and a missing key
 * equals an explicit undefined.
 *
 * @param {*} first - First value.
 * @param {*} second - Second value.
 * @returns {boolean} True when the values are structurally equal.
 */
function valuesEqual_(first, second) {
  if (first === second) {
    return true;
  }

  if (first === null || second === null || first === undefined || second === undefined) {
    return false;
  }

  if (first instanceof Date || second instanceof Date) {
    return first instanceof Date && second instanceof Date && first.getTime() === second.getTime();
  }

  if (typeof first !== 'object' || typeof second !== 'object') {
    return false;
  }

  const firstIsArray = Array.isArray(first);
  const secondIsArray = Array.isArray(second);
  if (firstIsArray !== secondIsArray) {
    return false;
  }

  if (firstIsArray && secondIsArray) {
    return (
      first.length === second.length &&
      first.every((entry, position) => valuesEqual_(entry, second[position]))
    );
  }

  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  return firstKeys.every(
    (key) => Object.hasOwn(second, key) && valuesEqual_(first[key], second[key])
  );
}

// Export for Node tests / CommonJS environments. The script-scope function keeps
// a trailing underscore so GAS does not expose it to google.script.run; Node
// consumers use the contract name without the underscore.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compareTaskEquivalence: compareTaskEquivalence_ };
}
