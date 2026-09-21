import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  createForcedReparsePayload,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
} from './assignmentDefinitionUpsertTestHelpers.js';

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager/index.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser/index.js', () => ({
  default: class {
    extractTaskDefinitions = (...a) => extractSlidesTaskDefinitionsMock(...a);
  },
}));
vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => ({
  SheetsParser: class {
    extractTaskDefinitions = (...a) => extractSheetsTaskDefinitionsMock(...a);
  },
}));

// Reparse weighting reconciliation matrices (issue #301): equivalent, changed,
// new and removed tasks on the forced and timestamp-triggered paths. Equivalent
// tasks keep their stored weighting including valid zeroes; changed and new
// tasks fall back to the TaskDefinition constructor default of 1; removed tasks
// disappear. Ordinary upserts without document changes never parse.
describe('AssignmentDefinitionController upsert — reparse weighting reconciliation', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
  });

  function createTimestampPayload(overrides = {}) {
    const payload = createUpsertPayload({ definitionKey: 'existing-stable-key', ...overrides });
    delete payload.taskWeightings;
    return payload;
  }

  function triggerTimestampRefresh() {
    globalThis.DriveManager.getFileModifiedTime = vi
      .fn()
      .mockReturnValue('2025-06-01T00:00:00.000Z');
  }

  describe('forced reparse weighting reconciliation', () => {
    it('preserves a stored non-zero weighting for equivalent tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 3 },
      });
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

      expect(saved.tasks.t_task_1.taskWeighting).toBe(3);
    });

    it('preserves a stored zero weighting for equivalent tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 0 },
      });
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

      expect(saved.tasks.t_task_1.taskWeighting).toBe(0);
    });

    it('falls back to the default weighting for changed tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 5 },
      });
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A Revised', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

      expect(saved.tasks.t_task_1.taskWeighting).toBe(1);
    });

    it('defaults new tasks while keeping equivalent stored weightings', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 4 },
      });
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
        createParsedTaskDefinition({ id: 't_task_2_new', taskTitle: 'Task B', index: 1 }),
      ]);

      const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

      expect(saved.tasks.t_task_1.taskWeighting).toBe(4);
      expect(saved.tasks.t_task_2_new.taskWeighting).toBe(1);
    });

    it('drops removed tasks from the refreshed definition', () => {
      const existing = seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        overrides: {
          tasks: {
            t_task_1: {
              id: 't_task_1',
              taskTitle: 'Task A',
              artifacts: { reference: [], template: [] },
              taskWeighting: 2,
            },
            t_task_old: {
              id: 't_task_old',
              taskTitle: 'Old task',
              artifacts: { reference: [], template: [] },
              taskWeighting: 2,
            },
          },
        },
      });
      expect(existing.tasks.t_task_old).toBeDefined();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createForcedReparsePayload({ forceReparse: true }));

      expect(saved.tasks.t_task_1).toBeDefined();
      expect(saved.tasks.t_task_old).toBeUndefined();
    });
  });

  describe('timestamp-triggered reparse weighting reconciliation', () => {
    it('preserves a stored non-zero weighting for equivalent tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 3 },
      });
      triggerTimestampRefresh();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createTimestampPayload());

      expect(extractSlidesTaskDefinitionsMock).toHaveBeenCalled();
      expect(saved.tasks.t_task_1.taskWeighting).toBe(3);
    });

    it('preserves a stored zero weighting for equivalent tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 0 },
      });
      triggerTimestampRefresh();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createTimestampPayload());

      expect(saved.tasks.t_task_1.taskWeighting).toBe(0);
    });

    it('falls back to the default weighting for changed tasks', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 5 },
      });
      triggerTimestampRefresh();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A Revised', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createTimestampPayload());

      expect(saved.tasks.t_task_1.taskWeighting).toBe(1);
    });

    it('defaults new tasks while keeping equivalent stored weightings', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        taskOverrides: { taskWeighting: 4 },
      });
      triggerTimestampRefresh();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
        createParsedTaskDefinition({ id: 't_task_2_new', taskTitle: 'Task B', index: 1 }),
      ]);

      const saved = controller.upsertDefinition(createTimestampPayload());

      expect(saved.tasks.t_task_1.taskWeighting).toBe(4);
      expect(saved.tasks.t_task_2_new.taskWeighting).toBe(1);
    });

    it('drops removed tasks from the refreshed definition', () => {
      seedExistingDefinition({
        mockFullCollection,
        mockRegistryCollection,
        overrides: {
          tasks: {
            t_task_1: {
              id: 't_task_1',
              taskTitle: 'Task A',
              artifacts: { reference: [], template: [] },
              taskWeighting: 2,
            },
            t_task_old: {
              id: 't_task_old',
              taskTitle: 'Old task',
              artifacts: { reference: [], template: [] },
              taskWeighting: 2,
            },
          },
        },
      });
      triggerTimestampRefresh();
      extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
        createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      ]);

      const saved = controller.upsertDefinition(createTimestampPayload());

      expect(saved.tasks.t_task_1).toBeDefined();
      expect(saved.tasks.t_task_old).toBeUndefined();
    });
  });
});
