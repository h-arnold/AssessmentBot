import { assertSerialisable, fail, isRecord } from './invariantGuards.js';
import { buildValidationContext } from './validationContext.js';
import { validatePersistenceGraph } from './validatePersistenceGraph.js';
import { validateTransportGraph } from './validateTransportGraph.js';
import { assertTransportShape } from './validateTransportViews.js';

/**
 * Asserts a required graph container is a non-null object record.
 *
 * @param {unknown} value Container under test.
 * @param {string} path Full field path used in failure messages.
 */
function assertGraphRecord(value, path) {
  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }
}

/**
 * Asserts a required graph container is an array.
 *
 * @param {unknown} value Container under test.
 * @param {string} path Full field path used in failure messages.
 */
function assertGraphArray(value, path) {
  if (!Array.isArray(value)) {
    fail(`${path} must be an array.`);
  }
}

/**
 * Asserts every graph and nested collection container dereferenced by context
 * construction and persistence validation is present with the expected shape.
 *
 * @remarks
 * This runs before `buildValidationContext` so a missing or malformed container
 * fails with an actionable invariant error rather than a native dereference
 * error. Parent containers are checked before their nested fields.
 *
 * @param {object} graph The generated logical graph.
 */
function assertRequiredGraphContainers(graph) {
  assertGraphRecord(graph.manifest, 'graph.manifest');
  assertGraphRecord(graph.manifest.generatedEntityCounts, 'graph.manifest.generatedEntityCounts');

  assertGraphRecord(graph.referenceData, 'graph.referenceData');
  assertGraphArray(graph.referenceData.cohorts, 'graph.referenceData.cohorts');
  assertGraphArray(graph.referenceData.yearGroups, 'graph.referenceData.yearGroups');
  assertGraphArray(graph.referenceData.assignmentTopics, 'graph.referenceData.assignmentTopics');

  assertGraphRecord(graph.persistence, 'graph.persistence');
  assertGraphArray(graph.persistence.classes, 'graph.persistence.classes');
  assertGraphArray(
    graph.persistence.assignmentDefinitions,
    'graph.persistence.assignmentDefinitions'
  );
  assertGraphArray(graph.persistence.assignments, 'graph.persistence.assignments');
}

/**
 * Validates all four named transport views, reference integrity, redaction,
 * serialisability, and profile counts.
 *
 * @param {unknown} graph The generated logical graph.
 * @throws {Error} When any invariant fails, with an actionable message.
 */
export function validateSyntheticAnalysisGraph(graph) {
  if (graph === null || typeof graph !== 'object') {
    fail('graph must be an object.');
  }
  assertSerialisable(graph, 'graph');
  assertRequiredGraphContainers(graph);

  const { manifest, referenceData, persistence, transport } = graph;
  assertTransportShape(transport);

  const context = buildValidationContext(manifest, referenceData, persistence);

  validatePersistenceGraph({ manifest, referenceData, persistence, context });
  validateTransportGraph({ transport, assignments: persistence.assignments, context });
}
