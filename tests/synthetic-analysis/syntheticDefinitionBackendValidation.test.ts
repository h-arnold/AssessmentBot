import { describe, expect, it } from 'vitest';

import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';

/**
 * Generator-internal observation of a persisted assignment definition. Persistence
 * is not a frontend Zod contract, so this stays a narrow test-local view.
 */
type GeneratedDefinitionDocument = {
  definitionKey: string;
  referenceDocumentId: string | null;
  templateDocumentId: string | null;
  assignmentWeighting: number | null;
  tasks: Record<string, unknown> | unknown[];
};

/**
 * Generator-internal observation of the persisted definitions under test.
 */
type GeneratedSyntheticAnalysisGraph = {
  persistence: {
    assignmentDefinitions: GeneratedDefinitionDocument[];
  };
};

const COMPACT_PROFILES = ['small', 'medium', 'large-representative'];

describe('synthetic definitions through the backend AssignmentDefinition model', () => {
  it('hydrates every generated full definition with its persisted full-model values', () => {
    for (const profile of COMPACT_PROFILES) {
      const graph = generateSyntheticAnalysisGraph(profile) as GeneratedSyntheticAnalysisGraph;
      const fullDefinitions = graph.persistence.assignmentDefinitions.filter(
        (definition) => !Array.isArray(definition.tasks)
      );
      expect(fullDefinitions.length).toBeGreaterThan(0);

      for (const definition of fullDefinitions) {
        // The backend model enforces the full contract (non-null document IDs,
        // numeric weighting, keyed tasks) and would throw on an invalid record.
        const model = AssignmentDefinition.fromJSON(definition);
        const serialised = model.toJSON() as Record<string, unknown>;

        expect(serialised.referenceDocumentId).toBe(definition.referenceDocumentId);
        expect(serialised.templateDocumentId).toBe(definition.templateDocumentId);
        expect(serialised.assignmentWeighting).toBe(definition.assignmentWeighting);
        expect(serialised.definitionKey).toBe(definition.definitionKey);
      }
    }
  });

  it('hydrates every partial-only registry row through the documented partial path', () => {
    for (const profile of COMPACT_PROFILES) {
      const graph = generateSyntheticAnalysisGraph(profile) as GeneratedSyntheticAnalysisGraph;
      const partialOnlyDefinitions = graph.persistence.assignmentDefinitions.filter((definition) =>
        Array.isArray(definition.tasks)
      );
      expect(partialOnlyDefinitions.length).toBeGreaterThan(0);

      for (const definition of partialOnlyDefinitions) {
        const model = AssignmentDefinition.fromJSON(definition);
        const partial = model.toPartialJSON() as Record<string, unknown>;

        expect(partial.definitionKey).toBe(definition.definitionKey);
        expect(partial.referenceDocumentId).toBeNull();
        expect(partial.templateDocumentId).toBeNull();
        expect(Array.isArray(partial.tasks)).toBe(true);
      }
    }
  });
});
