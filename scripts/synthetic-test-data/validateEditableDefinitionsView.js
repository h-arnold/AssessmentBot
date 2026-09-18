import { fail, isRecord } from './invariantGuards.js';
import { assertTransportView } from './validateTransportViews.js';

/**
 * Collects the definition keys of the full-definition rows of the partials
 * view. Partial-only registry rows carry null document identifiers and are
 * excluded, mirroring the editable-definitions projection.
 *
 * @param {Array<object>} assignmentDefinitionPartials Transport definition partials.
 * @returns {Set<string>} Full-definition keys.
 */
function collectFullDefinitionKeys(assignmentDefinitionPartials) {
  const fullDefinitionKeys = new Set();

  for (const partial of assignmentDefinitionPartials) {
    if (partial.referenceDocumentId !== null && partial.templateDocumentId !== null) {
      fullDefinitionKeys.add(partial.definitionKey);
    }
  }

  return fullDefinitionKeys;
}

/**
 * Asserts one editable-definitions entry is an object that omits the freshness
 * fields stripped at the transport boundary.
 *
 * @param {string} definitionKey The editable-definitions key under test.
 * @param {object} record The entry under test.
 */
function assertEditableDefinitionEntry(definitionKey, record) {
  if (!isRecord(record)) {
    fail(`transport.editableDefinitions entry "${definitionKey}" must be an object.`);
  }
  if ('referenceLastModified' in record) {
    fail(
      `transport.editableDefinitions entry "${definitionKey}" must not carry referenceLastModified; freshness fields are omitted at the transport boundary.`
    );
  }
  if ('templateLastModified' in record) {
    fail(
      `transport.editableDefinitions entry "${definitionKey}" must not carry templateLastModified; freshness fields are omitted at the transport boundary.`
    );
  }
}

/**
 * Asserts every editable-definitions key matches a full-definition row of the
 * partials view.
 *
 * @param {Record<string, object>} editableDefinitions Editable full-definition transport view.
 * @param {Set<string>} fullDefinitionKeys Full-definition keys from the partials view.
 */
function assertEditableDefinitionsKeysMatchPartials(editableDefinitions, fullDefinitionKeys) {
  for (const definitionKey of Object.keys(editableDefinitions)) {
    if (!fullDefinitionKeys.has(definitionKey)) {
      fail(
        `transport.editableDefinitions key "${definitionKey}" does not match any full-definition row of transport.assignmentDefinitionPartials.`
      );
    }
  }
}

/**
 * Asserts every full-definition row of the partials view is represented in the
 * editable-definitions view.
 *
 * @param {Record<string, object>} editableDefinitions Editable full-definition transport view.
 * @param {Set<string>} fullDefinitionKeys Full-definition keys from the partials view.
 */
function assertEditableDefinitionsCoverPartials(editableDefinitions, fullDefinitionKeys) {
  const editableDefinitionKeys = new Set(Object.keys(editableDefinitions));

  for (const definitionKey of fullDefinitionKeys) {
    if (!editableDefinitionKeys.has(definitionKey)) {
      fail(
        `transport.editableDefinitions is missing the full definition "${definitionKey}" from transport.assignmentDefinitionPartials.`
      );
    }
  }
}

/**
 * Asserts the editable-definitions view holds exactly the full-definition rows
 * of the partials view, with each entry omitting the freshness fields stripped
 * at the transport boundary.
 *
 * @param {object} options Validation inputs.
 * @param {Record<string, object>} options.editableDefinitions Editable full-definition transport view.
 * @param {Array<object>} options.assignmentDefinitionPartials Transport definition partials.
 */
export function assertEditableDefinitionsView({
  editableDefinitions,
  assignmentDefinitionPartials,
}) {
  assertTransportView(editableDefinitions, 'editableDefinitions', 'record');

  const fullDefinitionKeys = collectFullDefinitionKeys(assignmentDefinitionPartials);
  assertEditableDefinitionsKeysMatchPartials(editableDefinitions, fullDefinitionKeys);
  assertEditableDefinitionsCoverPartials(editableDefinitions, fullDefinitionKeys);

  for (const [definitionKey, record] of Object.entries(editableDefinitions)) {
    assertEditableDefinitionEntry(definitionKey, record);
  }
}
