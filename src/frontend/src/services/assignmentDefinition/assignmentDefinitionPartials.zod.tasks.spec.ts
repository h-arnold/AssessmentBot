import { describe, expect, it } from 'vitest';
import {
  asParserSchema,
  createMutableRowFixture,
  loadAssignmentDefinitionPartialsSchemas,
  validAssignmentDefinitionPartialRow,
} from '@/test/assignmentDefinition/assignmentDefinitionTestFixtures';

describe('assignmentDefinitionPartials.zod schemas', () => {
  describe('tasks field backend-shape compatibility', () => {
    it('accepts a partial with tasks as array of TaskPartial objects', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      const result = assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks: [{ taskId: 't_abc123', taskWeighting: 2, taskTitle: null }],
      } as Record<string, unknown>);

      expect(result).toHaveProperty('tasks');
      expect((result as Record<string, unknown>).tasks).toEqual([
        { taskId: 't_abc123', taskWeighting: 2, taskTitle: null },
      ]);
    });

    it('accepts a partial with tasks as empty array', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      const result = assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks: [],
      } as Record<string, unknown>);

      expect((result as Record<string, unknown>).tasks).toEqual([]);
    });

    it('rejects a partial with tasks set to null', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(() => {
        return assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          tasks: null,
        });
      }).toThrow();
    });

    it('rejects a partial with extra fields in inner task objects', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(() => {
        return assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          tasks: [{ taskId: 't_abc123', taskWeighting: 2, taskTitle: null, extra: 'x' }],
        } as Record<string, unknown>);
      }).toThrow();
    });

    it('accepts a partial with nullable taskTitle on inner task objects', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      const result = assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks: [{ taskId: 't_abc123', taskWeighting: 2, taskTitle: null }],
      } as Record<string, unknown>);

      expect(result).toHaveProperty('tasks');
      expect((result as Record<string, unknown>).tasks).toEqual([
        { taskId: 't_abc123', taskWeighting: 2, taskTitle: null },
      ]);
    });

    it('accepts a partial with non-null taskTitle on inner task objects', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      const result = assignmentDefinitionPartialSchema.parse({
        ...validAssignmentDefinitionPartialRow,
        tasks: [{ taskId: 't_abc123', taskWeighting: 2, taskTitle: 'My Task' }],
      } as Record<string, unknown>);

      expect(result).toHaveProperty('tasks');
      expect((result as Record<string, unknown>).tasks).toEqual([
        { taskId: 't_abc123', taskWeighting: 2, taskTitle: 'My Task' },
      ]);
    });

    it.each([
      {
        caseName: 'string',
        tasks: 'not-valid',
      },
      {
        caseName: 'number',
        tasks: 1,
      },
      {
        caseName: 'boolean',
        tasks: true,
      },
    ])('rejects unsupported tasks type: $caseName', async ({ tasks }) => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(() => {
        return assignmentDefinitionPartialSchema.parse({
          ...validAssignmentDefinitionPartialRow,
          tasks,
        });
      }).toThrow();
    });
  });

  describe('nullable document ID fields', () => {
    it('accepts a partial with referenceDocumentId set to null', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );
      const row = createMutableRowFixture();
      (row as Record<string, unknown>).referenceDocumentId = null;

      const result = assignmentDefinitionPartialSchema.parse(row);

      expect(result).toHaveProperty('referenceDocumentId', null);
    });

    it('accepts a partial with templateDocumentId set to null', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );
      const row = createMutableRowFixture();
      (row as Record<string, unknown>).templateDocumentId = null;

      const result = assignmentDefinitionPartialSchema.parse(row);

      expect(result).toHaveProperty('templateDocumentId', null);
    });

    it('still accepts a partial with both doc IDs as non-null strings (regression)', async () => {
      const schemas = await loadAssignmentDefinitionPartialsSchemas();
      const assignmentDefinitionPartialSchema = asParserSchema(
        schemas.AssignmentDefinitionPartialSchema
      );

      expect(assignmentDefinitionPartialSchema.parse(validAssignmentDefinitionPartialRow)).toEqual(
        validAssignmentDefinitionPartialRow
      );
    });
  });
});
