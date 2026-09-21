import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { toTransportViews } from '../../scripts/synthetic-test-data/toTransportViews.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TRANSPORT_VIEWS_PATH = join(
  REPOSITORY_ROOT,
  'scripts/synthetic-test-data/toTransportViews.js'
);
const SMALL_PROFILE = 'small';
const EDGE_DEFINITION_KEY = 'definition-keyed-partial-edge';
const EDGE_ASSIGNMENT_ID = 'assignment-keyed-partial-edge';

type PersistenceGraph = {
  referenceData: { yearGroups: Array<{ key: string; name: string }> };
  persistence: {
    classes: Array<{ classId: string }>;
    assignmentDefinitions: Array<Record<string, unknown>>;
    assignments: Array<Record<string, unknown>>;
  };
};

/**
 * Returns the generated small-profile graph with persistence records exposed.
 *
 * @returns The small-profile logical graph.
 */
function loadSmallGraph(): PersistenceGraph {
  return generateSyntheticAnalysisGraph(SMALL_PROFILE) as unknown as PersistenceGraph;
}

/**
 * Builds transport inputs with a keyed-task definition missing document IDs.
 *
 * @returns Transport inputs carrying the invalid partial record edge case.
 */
function buildEdgeCaseInputs(): {
  referenceData: unknown;
  classes: Array<Record<string, unknown>>;
  assignmentDefinitions: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
} {
  const graph = loadSmallGraph();
  const fullDefinition = graph.persistence.assignmentDefinitions.find(
    (definition) => !Array.isArray(definition.tasks)
  );
  if (fullDefinition === undefined) {
    throw new Error('Expected at least one full definition in the small profile.');
  }
  const baseAssignment = graph.persistence.assignments[0];
  if (baseAssignment === undefined) {
    throw new Error('Expected at least one assignment in the small profile.');
  }
  const edgeDefinition = {
    ...(structuredClone(fullDefinition) as Record<string, unknown>),
    definitionKey: EDGE_DEFINITION_KEY,
    referenceDocumentId: null,
    templateDocumentId: null,
  };
  const edgeAssignment = {
    ...(structuredClone(baseAssignment) as Record<string, unknown>),
    assignmentId: EDGE_ASSIGNMENT_ID,
    assignmentDefinitionKey: EDGE_DEFINITION_KEY,
  };
  return {
    referenceData: (graph as unknown as { referenceData: unknown }).referenceData,
    classes: graph.persistence.classes as Array<Record<string, unknown>>,
    assignmentDefinitions: [
      ...(graph.persistence.assignmentDefinitions as Array<Record<string, unknown>>),
      edgeDefinition,
    ],
    assignments: [
      ...(graph.persistence.assignments as Array<Record<string, unknown>>),
      edgeAssignment,
    ],
  };
}

describe('synthetic full-definition projection predicate', () => {
  it('reuses the single full-definition predicate in buildAssignmentsByKey', () => {
    const source = readFileSync(TRANSPORT_VIEWS_PATH, 'utf8');
    const builderStart = source.indexOf('function buildAssignmentsByKey');
    expect(builderStart).toBeGreaterThanOrEqual(0);
    const builderSource = source.slice(builderStart);
    expect(builderSource).toContain('isFullDefinition');
  });

  it('never hydrates a keyed-task partial record missing document IDs', () => {
    const inputs = buildEdgeCaseInputs();
    const views = toTransportViews(inputs as unknown as Parameters<typeof toTransportViews>[0]);
    expect(views.assignmentsByKey).not.toHaveProperty(EDGE_ASSIGNMENT_ID);
    expect(views.editableDefinitions).not.toHaveProperty(EDGE_DEFINITION_KEY);
  });

  it('keeps hydrating full definitions with document IDs and keyed tasks', () => {
    const graph = loadSmallGraph();
    const views = toTransportViews({
      referenceData: (graph as unknown as { referenceData: never }).referenceData,
      classes: graph.persistence.classes as never,
      assignmentDefinitions: graph.persistence.assignmentDefinitions as never,
      assignments: graph.persistence.assignments as never,
    });
    expect(Object.keys(views.assignmentsByKey).length).toBeGreaterThan(0);
  });
});
