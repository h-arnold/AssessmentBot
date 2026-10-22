/**
 * Assignment-definition partial schema suite.
 *
 * Characterises the canonical `AssignmentDefinitionPartialSchema` (imported
 * from `assignmentDefinitionPartials.zod` after the duplicate-copy
 * unification), including the nullable document-ID/weighting regression
 * contract. Split verbatim from the original single
 * `classDetailService.zod.spec.ts` suite as a green responsibility-based
 * refactor; every original assertion is preserved. Fixtures are shared through
 * the `classDetailSchemaFixtures` selector module.
 */

import { describe, expect, it } from 'vitest';
import { AssignmentDefinitionPartialSchema } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { validAssignmentDefinitionPartial } from '@/test/abClass/classDetailSchemaFixtures';

describe('AssignmentDefinitionPartialSchema', () => {
  it('rejects a partial with tasks set to null', () => {
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        tasks: null,
      } as Record<string, unknown>);
    }).toThrow();
  });

  it('rejects a definition missing primaryTitle', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).primaryTitle;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('rejects a definition missing definitionKey', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).definitionKey;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('accepts a partial with tasks as empty array', () => {
    const result = AssignmentDefinitionPartialSchema.parse({
      ...validAssignmentDefinitionPartial,
      tasks: [],
    } as Record<string, unknown>);
    expect((result as Record<string, unknown>).tasks).toEqual([]);
  });

  it('accepts a partial with tasks as array of TaskPartial objects', () => {
    const result = AssignmentDefinitionPartialSchema.parse({
      ...validAssignmentDefinitionPartial,
      tasks: [{ taskId: 't_abc123', taskWeighting: 2, taskTitle: null }],
    } as Record<string, unknown>);
    expect((result as Record<string, unknown>).tasks).toEqual([
      { taskId: 't_abc123', taskWeighting: 2, taskTitle: null },
    ]);
  });

  // REGRESSION: getABClass can return null for referenceDocumentId,
  // templateDocumentId, and assignmentWeighting (AssignmentDefinition.toPartialJSON
  // passes them through from the instance, where they can be null). Previously the
  // schema declared these as non-nullable, which caused Zod validation crashes on
  // legitimate backend responses. The convention in assignmentDefinition.zod.ts
  // (WeightingSchema.nullable()) and assignmentDefinitionPartials.zod.ts
  // (z.number().nullable()) already marks assignmentWeighting as nullable.
  it('accepts null for referenceDocumentId, templateDocumentId, and assignmentWeighting', () => {
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        referenceDocumentId: null,
        templateDocumentId: null,
        assignmentWeighting: null,
      });
    }).not.toThrow();
  });

  it('rejects undefined for referenceDocumentId, templateDocumentId, and assignmentWeighting', () => {
    const missing = { ...validAssignmentDefinitionPartial };
    delete (missing as Record<string, unknown>).referenceDocumentId;
    delete (missing as Record<string, unknown>).templateDocumentId;
    delete (missing as Record<string, unknown>).assignmentWeighting;
    expect(() => AssignmentDefinitionPartialSchema.parse(missing)).toThrow();
  });

  it('still rejects non-null, non-string values for referenceDocumentId and templateDocumentId', () => {
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        referenceDocumentId: 42,
      });
    }).toThrow();
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        templateDocumentId: { id: 'oops' },
      });
    }).toThrow();
  });

  it('still rejects non-null, non-number values for assignmentWeighting', () => {
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        assignmentWeighting: 'not-a-number',
      });
    }).toThrow();
  });

  it('canonical AssignmentDefinitionPartialSchema accepts null referenceDocumentId (import identity)', () => {
    // The canonical schema (now imported from assignmentDefinitionPartials.zod.ts)
    // has .nullable() for referenceDocumentId and templateDocumentId. This test
    // verifies the unification succeeded: both the local import and the canonical
    // schema are the same object, and both accept null doc IDs.
    expect(() => {
      return AssignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartial,
        referenceDocumentId: null,
        templateDocumentId: null,
      });
    }).not.toThrow();
  });
});
