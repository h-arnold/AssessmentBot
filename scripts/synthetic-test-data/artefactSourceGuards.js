import { fail, isRecord } from './invariantGuards.js';
import { requireItemRecord } from './validationRecordGuards.js';

/**
 * Artefact-source guards for the persistence, full-transport, and
 * class-partial validators.
 *
 * @remarks
 * Usable artefact bodies keep their raw shapes: string bodies for plain
 * documents and data-URL images, raw 2D grids for SPREADSHEET records, with
 * role-scoped blankness and null placeholder pairs beside permitted causes.
 */

/**
 * Asserts one artefact's contentHash key is a non-blank string.
 *
 * @param {object} options Hash inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
export function assertArtefactHash({ artefact, label }) {
  const hash = artefact.contentHash;
  if (typeof hash !== 'string' || hash.length === 0) {
    fail(
      `${label} contentHash must be a non-blank string beside its present raw body; received ${JSON.stringify(hash === null ? null : typeof hash)}.`
    );
  }
}

/**
 * Asserts body shape for one usable artefact record whose body type is not a
 * SPREADSHEET: a non-string body violates the `content` rule, an IMAGE body
 * must be a data URL, and blankness is role-scoped.
 *
 * @param {object} options Artefact inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record.
 * @param {string} options.label Failure-message context.
 * @param {boolean} options.allowBlank Whether this role may carry a blank body.
 * @returns {void}
 */
function assertStringArtefactBody({ artefact, label, allowBlank }) {
  const content = artefact.content;
  if (typeof content !== 'string') {
    fail(
      `${label} content must be a usable raw body; received ${JSON.stringify(content === null ? null : typeof content)}.`
    );
  }
  if (artefact.type === 'IMAGE' && !content.startsWith('data:image/')) {
    fail(`${label} image body must be a usable image data URL; received a non-image body.`);
  }
  if (content.length === 0 && !allowBlank) {
    fail(`${label} content must be a non-blank body.`);
  }
}

/**
 * Asserts one SPREADSHEET grid row's cells are null, strings, or finite numbers.
 *
 * @param {object} options Row inputs.
 * @param {Array<unknown>} options.row Grid row under test.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertSpreadsheetGridRow({ row, label }) {
  for (const cell of row) {
    const isUsable =
      cell === null ||
      typeof cell === 'string' ||
      (typeof cell === 'number' && Number.isFinite(cell));
    if (!isUsable) {
      fail(`${label} SPREADSHEET grid cells must be null, string, or finite numbers.`);
    }
  }
}

/**
 * Asserts body shape for one usable SPREADSHEET artefact record: a raw 2D array
 * of usable cells, whose blankness is role-scoped.
 *
 * @param {object} options Artefact inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record.
 * @param {string} options.label Failure-message context.
 * @param {boolean} options.allowBlank Whether this role may carry a blank body.
 * @returns {void}
 */
function assertSpreadsheetArtefactBody({ artefact, label, allowBlank }) {
  const content = artefact.content;
  if (!Array.isArray(content)) {
    fail(`${label} SPREADSHEET content must be a raw 2D grid, not an encoded ${typeof content}.`);
  }
  for (const row of content) {
    if (!Array.isArray(row)) {
      fail(`${label} SPREADSHEET grid rows must be arrays; a raw grid is required.`);
    }
    assertSpreadsheetGridRow({ row: /** @type {Array<unknown>} */ (row), label });
  }
  if (content.length === 0 && !allowBlank) {
    fail(`${label} content must be a non-blank SPREADSHEET grid.`);
  }
}

/**
 * Asserts body shape for one usable artefact record; unexpected raw shapes
 * name their `content` rule, while IMAGE and SPREADSHEET bodies name their
 * type as the rule marker.
 *
 * @param {object} options Artefact inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record.
 * @param {string} options.label Failure-message context.
 * @param {boolean} options.allowBlank Whether this role may carry a blank body.
 * @returns {void}
 */
export function assertUsableArtefactBody({ artefact, label, allowBlank }) {
  if (artefact.type === 'SPREADSHEET') {
    assertSpreadsheetArtefactBody({ artefact, label, allowBlank });
    return;
  }
  assertStringArtefactBody({ artefact, label, allowBlank });
}

/**
 * Reports a contradiction between null source content and the item's entries.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item under test.
 * @param {string} options.label Failure-message context.
 * @returns {void} Fails when the combination is contradictory.
 */
function assertNullSourcePlaceholder({ item, label }) {
  const taskId = String(item.taskId);
  const assessments = /** @type {import('./validationRecordGuards.js').RawRecord} */ (
    item.assessments
  );
  const entries = /** @type {Array<import('./validationRecordGuards.js').RawRecord>} */ (
    Object.values(assessments)
  );
  const assessmentStageCause = entries.some(
    (entry) =>
      /** @type {import('./validationRecordGuards.js').RawRecord} */ (entry)?.error?.stage ===
      'assessment'
  );
  if (assessmentStageCause) {
    fail(
      `${label} task "${taskId}" carries an assessment-stage placeholder beside null source content; assessment-stage errors cannot arise without usable stored source content.`
    );
  }
  const nonPlaceholderEntry = entries.some(
    (entry) => /** @type {import('./validationRecordGuards.js').RawRecord} */ (entry)?.score !== 'E'
  );
  if (nonPlaceholderEntry) {
    fail(
      `${label} task "${taskId}" carries null artefact content beside complete numeric results; a null source body only supports placeholder entries.`
    );
  }
}

/**
 * Asserts one document-submission item whose content key is present but null
 * is a legal null-source placeholder beside permitted causes, with a consistent
 * null contentHash.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertNullContentDocumentPlaceholder({ item, label, artefact }) {
  if (artefact.contentHash !== null) {
    fail(
      `${label} contentHash must be exactly null beside its null content; the explicit null placeholder pair keeps null content with null contentHash, received ${describeArtefactHash(
        artefact.contentHash
      )}.`
    );
  }
  assertNullSourcePlaceholder({ item, label });
}

/**
 * Describes a raw artefact hash value for the failure diagnostic.
 *
 * @param {unknown} storedValue Raw contentHash value.
 * @returns {string} Human-readable hash description.
 */
function describeArtefactHash(storedValue) {
  if (storedValue === undefined) return 'a missing hash key';
  return typeof storedValue === 'object' && storedValue !== null
    ? 'a non-null object'
    : JSON.stringify(storedValue);
}

/**
 * Asserts one document item's artefact carries its full usable body and hash,
 * or a legal null placeholder pair beside permitted causes.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
function assertDocumentItemArtefact({ item, location }) {
  const artefact = requireItemRecord(item.artifact, `${location} task artifact`);
  const label = `${location} task "${String(item.taskId)}"`;
  if (!('content' in artefact)) {
    fail(`${label} artefact is missing the required "content" key of a full submission.`);
  }
  if (artefact.content === null) {
    assertNullContentDocumentPlaceholder({ item, label, artefact });
    return;
  }
  // A successfully read blank student SPREADSHEET is the permitted `[]` grid
  // beside its normal string hash; blankness stays invalid for every other
  // submission body type and for reference artefacts.
  assertUsableArtefactBody({
    artefact,
    label,
    allowBlank: artefact.type === 'SPREADSHEET',
  });
  assertArtefactHash({ artefact, label });
}

/**
 * Asserts one null-document artefact keeps every required full source field
 * key explicitly present and null: a missing or undefined key is not the
 * canonical explicit-null placeholder shape of the pinned null-parent record.
 *
 * @param {object} options Field inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.artefact Artefact record under test.
 * @param {string} options.field Field name, passed as a literal at the call site.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertNullArtefactField({ artefact, field, label }) {
  let value;
  switch (field) {
    case 'content':
      value = artefact.content;
      break;
    case 'contentHash':
      value = artefact.contentHash;
      break;
    case 'pageId':
      value = artefact.pageId;
      break;
    default:
      value = artefact.documentId;
  }
  if (!Object.hasOwn(artefact, field) || value !== null) {
    fail(
      `${label} null-document artefact field "${field}" must be an explicit null key beneath the null-document record; received ${describeArtefactHash(
        value
      )}.`
    );
  }
}

/**
 * Asserts one null-document auxiliary artefact map stays empty: the approved
 * null-parent shape keeps empty metadata beside the null source state, so a
 * populated (or non-record) map contradicts the placeholder.
 *
 * @param {object} options Map inputs.
 * @param {unknown} options.value Map value under test.
 * @param {string} options.field Field name, passed as a literal at the call site.
 * @param {string} options.marker Owned rule marker for the failure.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertNullDocumentEmptyMap({ value, field, marker, label }) {
  if (isRecord(value) && Object.keys(value).length === 0) return;
  fail(
    `${label} null-document ${marker} must be an explicitly present empty object beneath the null-document record; "${field}" received ${JSON.stringify(
      value === undefined ? null : value
    )}.`
  );
}

/**
 * Asserts one null-document artefact keeps its null source state fields and
 * empty metadata, and the item beside it keeps empty feedback.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
function assertNullDocumentArtefact({ item, location }) {
  const taskId = String(item.taskId);
  const artefact = requireItemRecord(
    item.artifact,
    `${location} task "${taskId}" null-document artefact`
  );
  const label = `${location} task "${taskId}"`;
  if (artefact.type !== 'base') {
    fail(
      `${label} null-document artefact type must be the pinned "base" placeholder beneath the null-document record; received ${JSON.stringify(
        artefact.type
      )}.`
    );
  }
  if (artefact.role !== 'submission') {
    fail(
      `${label} null-document artefact role must be the pinned "submission" placeholder beneath the null-document record; received ${JSON.stringify(
        artefact.role
      )}.`
    );
  }
  assertNullArtefactField({ artefact, field: 'content', label });
  assertNullArtefactField({ artefact, field: 'contentHash', label });
  assertNullArtefactField({ artefact, field: 'pageId', label });
  assertNullArtefactField({ artefact, field: 'documentId', label });
  assertNullDocumentEmptyMap({
    value: artefact.metadata,
    field: 'metadata',
    marker: 'metadata',
    label,
  });
  assertNullDocumentEmptyMap({
    value: item.feedback,
    field: 'feedback',
    marker: 'feedback',
    label,
  });
}

/**
 * Asserts one submission item's artefact source state.
 *
 * @param {object} options Item inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.item Submission item record.
 * @param {string} options.location Failure-message context.
 * @param {boolean} options.nullParent True beneath the null parent document.
 * @param {'full'|'partial'} options.representation Representation under test.
 * @returns {void}
 */
export function assertItemArtefactSource({ item, location, nullParent, representation }) {
  if (nullParent) {
    assertNullDocumentArtefact({ item, location });
    return;
  }
  if (representation === 'partial') {
    // Partial redaction is asserted by the class-partial validator; full
    // availability is never required of the partial owner.
    return;
  }
  assertDocumentItemArtefact({ item, location });
}

/**
 * Asserts one artefact of one required definition role carries usable
 * completed content in its raw shape and a non-blank string hash.
 *
 * @param {object} options Artefact inputs.
 * @param {unknown} options.artefact Artefact record under test.
 * @param {string} options.role Artefact role under test.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertRoleArtefact({ artefact, role, label }) {
  const record = requireItemRecord(artefact, `${label} entries`);
  if (record.content === null || !('content' in record)) {
    fail(`${label} must carry usable non-null ${role} content beside the completed assignment.`);
  }
  assertUsableArtefactBody({
    artefact: record,
    label,
    allowBlank: role === 'template',
  });
  assertArtefactHash({ artefact: record, label });
}

/**
 * Asserts one role's reference/template artefacts of a keyed definition task
 * carry usable completed bodies in their raw shapes. The literal artefact
 * collection is passed by the caller so no dynamic key read occurs.
 *
 * @param {object} options Role inputs.
 * @param {unknown} options.roleArtefacts Artefact array of this role, read with a literal key.
 * @param {string} options.role Artefact role under test.
 * @param {string} options.label Failure-message context.
 * @returns {void}
 */
function assertDefinitionRoleArtefacts({ roleArtefacts, role, label }) {
  const roleLabel = `${label} artefacts.${role}`;
  if (!Array.isArray(roleArtefacts)) {
    fail(`${roleLabel} must be an array of artefact records.`);
  }
  for (const artefact of roleArtefacts) {
    assertRoleArtefact({ artefact, role, label: roleLabel });
  }
}

/**
 * Asserts the shared reference/template artefacts of one keyed definition task
 * carry usable completed bodies in their raw shapes.
 *
 * @param {object} options Task inputs.
 * @param {import('./validationRecordGuards.js').RawRecord} options.task Keyed definition task record.
 * @param {string} options.taskId Key of the task record.
 * @param {string} options.location Failure-message context.
 * @returns {void}
 */
export function assertDefinitionTaskArtefacts({ task, taskId, location }) {
  const label = `${location} task "${taskId}"`;
  const artefacts = requireItemRecord(task.artifacts, `${label} definition artefacts`);
  assertDefinitionRoleArtefacts({
    roleArtefacts: artefacts.reference,
    role: 'reference',
    label,
  });
  assertDefinitionRoleArtefacts({
    roleArtefacts: artefacts.template,
    role: 'template',
    label,
  });
}

/**
 * Asserts every keyed (full) definition in the supplied map carries usable
 * required reference/template artefacts in their raw shapes.
 *
 * @param {object} options Definitions inputs.
 * @param {Map<string, object>} options.definitionByKey Definitions keyed by definition key.
 * @returns {void}
 */
export function assertFullDefinitionArtefacts({ definitionByKey }) {
  for (const [definitionKey, definition] of definitionByKey) {
    if (Array.isArray(definition.tasks)) {
      continue;
    }
    for (const [taskId, taskRaw] of Object.entries(definition.tasks)) {
      const task = requireItemRecord(taskRaw, `task "${taskId}" of definition "${definitionKey}"`);
      assertDefinitionTaskArtefacts({
        task,
        taskId,
        location: `Assignment definition "${definitionKey}"`,
      });
    }
  }
}
