import { assertSerialisable, fail } from './invariantGuards.js';
import { buildValidationContext } from './validationContext.js';
import { validatePersistenceGraph } from './validatePersistenceGraph.js';
import { validateTransportGraph } from './validateTransportGraph.js';
import { assertTransportShape } from './validateTransportViews.js';

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

  const { manifest, referenceData, persistence, transport } = graph;
  assertTransportShape(transport);

  const context = buildValidationContext(manifest, referenceData, persistence);

  validatePersistenceGraph({ manifest, referenceData, persistence, context });
  validateTransportGraph({ transport, assignments: persistence.assignments, context });
}
