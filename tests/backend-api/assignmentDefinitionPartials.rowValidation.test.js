import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAssignmentDefinitionControllerHooks,
  installAssignmentDefinitionControllerStub,
  loadAssignmentDefinitionValidationModule,
} from '../helpers/assignmentDefinitionPartialsTestHelpers.js';
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

describe('toPartialJSON emits taskTitle per task', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();
  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it('emits taskTitle per task in toPartialJSON tasks array', () => {
    const { AssignmentDefinition } = require('#backend/Models/AssignmentDefinition.js');
    const { TaskDefinition } = require('#backend/Models/TaskDefinition.js');

    const task = new TaskDefinition({ taskTitle: 'My Task Title', pageId: 'p1' }, 3);
    const def = new AssignmentDefinition({
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      primaryTopicKey: 'topic-algebra',
      yearGroupKey: 'year-group-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-001',
      templateDocumentId: 'tpl-001',
      assignmentWeighting: null,
      definitionKey: 'algebra-baseline',
      tasks: { [task.id]: task },
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-06T12:30:00.000Z',
    });

    const partial = def.toPartialJSON();

    expect(partial.tasks).toHaveLength(1);
    expect(partial.tasks[0]).toHaveProperty('taskId', task.id);
    expect(partial.tasks[0]).toHaveProperty('taskWeighting', 3);
    expect(partial.tasks[0]).toHaveProperty('taskTitle', task.taskTitle);
  });
});

describe('validatePartialRow_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  const buildValidRow = (overrides = {}) => ({
    primaryTitle: 'Algebra Baseline',
    primaryTopic: 'Algebra',
    primaryTopicKey: 'topic-algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: null,
    definitionKey: 'algebra-baseline',
    tasks: [],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
    ...overrides,
  });

  it.each([
    {
      description: 'valid partial row',
      row: buildValidRow(),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'valid partial row at different index',
      row: buildValidRow({ definitionKey: 'geometry-baseline' }),
      rowIndex: 5,
      shouldThrow: false,
    },
    {
      description: 'null row',
      row: null,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'undefined row',
      row: undefined,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'string row',
      row: 'not-an-object',
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'number row',
      row: 123,
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'array row',
      row: ['not', 'an', 'object'],
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Each assignment definition partial row must be an object.',
      expectedField: null,
    },
    {
      description: 'row with empty definitionKey',
      row: buildValidRow({ definitionKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must be a non-empty string.',
      expectedField: 'definitionKey',
    },
    {
      description: 'row with untrimmed definitionKey',
      row: buildValidRow({ definitionKey: '  algebra-baseline' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'definitionKey must already be trimmed.',
      expectedField: 'definitionKey',
    },
    {
      description: 'row with empty primaryTopicKey',
      row: buildValidRow({ primaryTopicKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must be a non-empty string.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'row with untrimmed primaryTopicKey',
      row: buildValidRow({ primaryTopicKey: '  topic-algebra' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'primaryTopicKey must already be trimmed.',
      expectedField: 'primaryTopicKey',
    },
    {
      description: 'row with empty yearGroupKey',
      row: buildValidRow({ yearGroupKey: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupKey must be a non-empty string.',
      expectedField: 'yearGroupKey',
    },
    {
      description: 'row with empty yearGroupLabel',
      row: buildValidRow({ yearGroupLabel: '' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'yearGroupLabel must be a non-empty string.',
      expectedField: 'yearGroupLabel',
    },
    {
      description: 'row with valid tasks array (non-null)',
      row: buildValidRow({ tasks: [{ taskId: 't_001', taskWeighting: 1, taskTitle: 'Task 1' }] }),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'row with non-array tasks value',
      row: buildValidRow({ tasks: 'not-an-array' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'tasks must be an array.',
      expectedField: 'tasks',
    },
    {
      description: 'row with invalid createdAt',
      row: buildValidRow({ createdAt: 'invalid-date' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'createdAt must be null or an ISO datetime string.',
      expectedField: 'createdAt',
    },
    {
      description: 'row with invalid updatedAt',
      row: buildValidRow({ updatedAt: 'invalid-date' }),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'updatedAt must be null or an ISO datetime string.',
      expectedField: 'updatedAt',
    },
    {
      description: 'row with null createdAt (valid)',
      row: buildValidRow({ createdAt: null }),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'row with null updatedAt (valid)',
      row: buildValidRow({ updatedAt: null }),
      rowIndex: 0,
      shouldThrow: false,
    },
    {
      description: 'row missing required field: primaryTitle',
      row: (() => {
        const row = buildValidRow();
        delete row.primaryTitle;
        return row;
      })(),
      rowIndex: 0,
      shouldThrow: true,
      expectedError: 'Missing required field: primaryTitle.',
      expectedField: 'primaryTitle',
    },
  ])(
    'handles $description correctly',
    ({ row, rowIndex, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validatePartialRow_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validatePartialRow_(row, rowIndex)).toThrow(ApiValidationError);
        expect(() => validatePartialRow_(row, rowIndex)).toThrow(expectedError);
        try {
          validatePartialRow_(row, rowIndex);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('getAssignmentDefinitionPartials');
          expect(err.details).toBe(`rowIndex=${rowIndex}`);
        }
      } else {
        expect(() => validatePartialRow_(row, rowIndex)).not.toThrow();
      }
    }
  );
});

describe('validateTaskWeightingsShape_', () => {
  const { beforeEachHandler, afterEachHandler } = createAssignmentDefinitionControllerHooks();

  beforeEach(beforeEachHandler);
  afterEach(afterEachHandler);

  it.each([
    {
      description: 'undefined taskWeightings is valid',
      taskWeightings: undefined,
      shouldThrow: false,
    },
    {
      description: 'null taskWeightings throws error (not undefined)',
      taskWeightings: null,
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'empty array taskWeightings',
      taskWeightings: [],
      shouldThrow: false,
    },
    {
      description: 'valid single task weighting',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: 1 }],
      shouldThrow: false,
    },
    {
      description: 'valid multiple task weightings',
      taskWeightings: [
        { taskId: 'task-1', taskWeighting: 1 },
        { taskId: 'task-2', taskWeighting: 2 },
      ],
      shouldThrow: false,
    },
    {
      description: 'non-array taskWeightings',
      taskWeightings: 'not-an-array',
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'non-array taskWeightings (object)',
      taskWeightings: { taskId: 'task-1', taskWeighting: 1 },
      shouldThrow: true,
      expectedError: 'taskWeightings must be an array when provided.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with null entry',
      taskWeightings: [null],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with string entry',
      taskWeightings: ['not-an-object'],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with number entry',
      taskWeightings: [123],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array with array entry',
      taskWeightings: [['nested', 'array']],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must be objects.',
      expectedField: 'taskWeightings',
    },
    {
      description: 'array entry missing taskId',
      taskWeightings: [{ taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must include taskId.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with null taskId',
      taskWeightings: [{ taskId: null, taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must be a string.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with empty string taskId',
      taskWeightings: [{ taskId: '', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must be a non-empty string.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with untrimmed taskId',
      taskWeightings: [{ taskId: '  task-1', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId must already be trimmed.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry with taskId containing forward slash',
      taskWeightings: [{ taskId: 'invalid/key', taskWeighting: 1 }],
      shouldThrow: true,
      expectedError: 'taskWeightings.taskId contains unsafe characters.',
      expectedField: 'taskWeightings[0].taskId',
    },
    {
      description: 'array entry missing taskWeighting',
      taskWeightings: [{ taskId: 'task-1' }],
      shouldThrow: true,
      expectedError: 'taskWeightings entries must include taskWeighting.',
      expectedField: 'taskWeightings[0].taskWeighting',
    },
    {
      description: 'array entry with null taskWeighting (valid)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: null }],
      shouldThrow: false,
    },
    {
      description: 'array entry with zero taskWeighting (valid)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: 0 }],
      shouldThrow: false,
    },
    {
      description: 'array entry with negative taskWeighting (valid - no range check in transport)',
      taskWeightings: [{ taskId: 'task-1', taskWeighting: -1 }],
      shouldThrow: false,
    },
  ])(
    'handles $description correctly',
    ({ taskWeightings, shouldThrow, expectedError, expectedField }) => {
      installAssignmentDefinitionControllerStub([]);
      const { validateTaskWeightingsShape_ } = loadAssignmentDefinitionValidationModule();

      if (shouldThrow) {
        expect(() => validateTaskWeightingsShape_(taskWeightings)).toThrow(ApiValidationError);
        expect(() => validateTaskWeightingsShape_(taskWeightings)).toThrow(expectedError);
        try {
          validateTaskWeightingsShape_(taskWeightings);
        } catch (err) {
          expect(err.fieldName).toBe(expectedField);
          expect(err.method).toBe('upsertAssignmentDefinition');
        }
      } else {
        expect(() => validateTaskWeightingsShape_(taskWeightings)).not.toThrow();
      }
    }
  );
});
