import { fail, isRecord } from './invariantGuards.js';

/**
 * Asserts a named transport view is present with the expected JSON container shape.
 *
 * @param {unknown} view The transport view under test.
 * @param {string} viewName The transport view name used in failure messages.
 * @param {'array'|'record'} expectedShape The expected container shape.
 */
export function assertTransportView(view, viewName, expectedShape) {
  if (expectedShape === 'array') {
    if (!Array.isArray(view)) {
      fail(`transport.${viewName} must be an array.`);
    }
    return;
  }

  if (!isRecord(view)) {
    fail(`transport.${viewName} must be a record keyed by identifier.`);
  }
}

/**
 * Asserts the four named transport views are present with the expected shapes.
 *
 * @param {unknown} transport Generated transport view.
 */
export function assertTransportShape(transport) {
  if (!isRecord(transport)) {
    fail('graph.transport must be an object carrying the four named views.');
  }
  assertTransportView(transport.classPartials, 'classPartials', 'array');
  assertTransportView(
    transport.assignmentDefinitionPartials,
    'assignmentDefinitionPartials',
    'array'
  );
  assertTransportView(transport.classesById, 'classesById', 'record');
  assertTransportView(transport.assignmentsByKey, 'assignmentsByKey', 'record');
}
