import { describe, expect, it } from 'vitest';

import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

import {
  expectClassFieldsMatch,
  expectFullAssignmentFieldsMatch,
  expectFullAssignmentRoundTrip,
  expectNoSharedMutableNodes,
  expectRestoredClassMatches,
} from './syntheticBackendModelInputAssertions.js';
import { keySet, loadAdapterContext, type Inputs } from './syntheticBackendModelInputContext.js';
import {
  expectNoSharedNodesAcrossInputs,
  expectNoMutationLeaked,
  mutateFirstResult,
  selectMutationTargets,
} from './syntheticBackendModelInputSharing.js';

describe('canonical backend model inputs', () => {
  it.each(['small', 'medium'])(
    'adapts %s into complete, independently owned backend model inputs',
    async (profile) => {
      const sources = loadAdapterContext(profile);
      const sourceSnapshots = structuredClone({
        classPartials: sources.partials,
        classesById: sources.classes,
        assignmentsByKey: sources.assignments,
        editableDefinitions: sources.definitions,
        assignmentDefinitionPartials: sources.definitionPartials,
      });
      const first = loadBackendModelInputs(profile) as Inputs;
      const second = loadBackendModelInputs(profile) as Inputs;

      expect(first).toEqual({
        classPartials: expect.any(Array),
        classesById: expect.any(Object),
        assignmentsByKey: expect.any(Object),
      });
      expect(first.classPartials).not.toBe(sources.partials);
      expect(first.classesById).not.toBe(sources.classes);
      expect(first.assignmentsByKey).not.toBe(sources.assignments);
      expect(keySet(first.classesById)).toEqual(keySet(sources.classes));
      expect(keySet(first.assignmentsByKey)).toEqual(keySet(sources.assignments));
      expect(first.classPartials.map((row) => row.classId).sort()).toEqual(
        sources.partials.map((row) => row.classId).sort()
      );

      for (const [classId, modelInput] of Object.entries(first.classesById)) {
        const expectedAssignments = expectClassFieldsMatch(
          classId,
          modelInput,
          sources,
          sources.classes
        );
        const restoredClassItemCount = expectRestoredClassMatches(
          classId,
          modelInput,
          expectedAssignments,
          sources,
          sources.classes
        );
        expect(restoredClassItemCount).toBeGreaterThan(0);
      }

      for (const [key, input] of Object.entries(first.assignmentsByKey)) {
        const canonical = sources.assignments[key];
        const definition = expectFullAssignmentFieldsMatch(
          input,
          canonical,
          sources.definitions,
          sources
        );
        expectFullAssignmentRoundTrip(input, canonical, definition);
      }
      expect(sources.found.populatedFullSubmission).toBe(true);
      expect(sources.found.restoredClassOwner).toBe(true);

      expectNoSharedNodesAcrossInputs(first, sources);

      expectNoSharedMutableNodes(first, second);
      const selection = selectMutationTargets(first, second, sources.assignments);
      const before = {
        definitions: structuredClone(selection.fullAssignment.assignmentDefinition),
        secondDefinitions: structuredClone(selection.secondFullAssignment.assignmentDefinition),
        classMetadata: structuredClone(selection.classInput.metadata),
      };
      mutateFirstResult(selection);
      expectNoMutationLeaked(selection, sources, sourceSnapshots, before);
    }
  );
});
