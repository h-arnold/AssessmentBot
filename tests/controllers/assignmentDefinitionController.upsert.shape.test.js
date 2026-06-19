import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignmentDefinition } from '../../src/backend/Models/AssignmentDefinition.js';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  createWizardUpsertPayload,
  expectCanonicalFullDefinitionShape,
  expectTaskWeightingMapEntries,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
  setupDuplicateDetectionWithExisting,
} from './assignmentDefinitionUpsertTestHelpers.js';

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser.js', () => ({
  default: class {
    extractTaskDefinitions = (...a) => extractSlidesTaskDefinitionsMock(...a);
  },
}));
vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => ({
  SheetsParser: class {
    extractTaskDefinitions = (...a) => extractSheetsTaskDefinitionsMock(...a);
  },
}));

describe('AssignmentDefinitionController upsert behaviour — transport shape', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockDbManager;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockDbManager = ctx.mockDbManager;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
  });

  it('returns the canonical full-definition transport shape for create/write/read flows', () => {
    const stored = {};
    mockFullCollection.findOne.mockImplementation(
      (filter) => stored[filter?.definitionKey] ?? null
    );
    mockFullCollection.insertOne.mockImplementation((doc) => {
      if (doc?.definitionKey) stored[doc.definitionKey] = doc;
    });
    mockFullCollection.replaceOne.mockImplementation((filter, doc) => {
      if (filter?.definitionKey) stored[filter.definitionKey] = doc;
    });
    mockRegistryCollection.findOne.mockReturnValue(null);

    const saved = controller.upsertDefinition(createWizardUpsertPayload());
    const readBack = controller.getDefinitionByKey(saved.definitionKey, { form: 'full' });

    expect(saved).toBeInstanceOf(AssignmentDefinition);
    expect(readBack).toBeInstanceOf(AssignmentDefinition);

    expectCanonicalFullDefinitionShape(controller.getFullAssignmentDefinition(saved));
    expectCanonicalFullDefinitionShape(controller.getFullAssignmentDefinition(readBack));
  });

  it('defaults parsed task weightings to 1 for stage-one creates when taskWeightings are omitted', () => {
    mockFullCollection.findOne.mockReturnValue(null);
    mockRegistryCollection.findOne.mockReturnValue(null);

    const payload = createWizardUpsertPayload();
    delete payload.taskWeightings;

    const saved = controller.upsertDefinition(payload);

    expectTaskWeightingMapEntries(saved.tasks, [
      ['t_task_1', 1],
      ['t_task_2', 1],
    ]);
  });

  it('resolves yearGroupLabel from yearGroupKey on canonical reads', () => {
    const staleLabelDefinition = {
      ...createWizardUpsertPayload({ definitionKey: 'existing-stable-key' }),
      primaryTopic: 'Science',
      yearGroupKey: 'year-group-8',
      yearGroupLabel: 'Outdated label',
      tasks: {
        t_task_1: {
          id: 't_task_1',
          taskTitle: 'Task A',
          taskWeighting: 2,
          artifacts: { reference: [], template: [] },
        },
      },
      referenceLastModified: '2025-04-01T00:00:00.000Z',
      templateLastModified: '2025-04-01T00:00:00.000Z',
    };

    mockFullCollection.findOne.mockImplementation((filter) => {
      if (filter?.definitionKey === 'existing-stable-key') {
        return staleLabelDefinition;
      }
      return null;
    });

    const readBack = controller.getDefinitionByKey('existing-stable-key', { form: 'full' });
    const canonicalReadBack = controller.getFullAssignmentDefinition(readBack);

    expect(canonicalReadBack.yearGroupLabel).toBe('Year 8');
  });

  it('re-parse keeps matching task weightings and defaults new tasks to 1', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      taskOverrides: { taskWeighting: 8 },
    });

    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([
      createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 }),
      createParsedTaskDefinition({ id: 't_task_3', taskTitle: 'Task C', index: 2 }),
    ]);

    const saved = controller.upsertDefinition(
      createUpsertPayload({
        definitionKey: 'existing-stable-key',
        referenceDocumentId: 'new-ref-doc-id',
        templateDocumentId: 'new-tpl-doc-id',
      })
    );

    expectTaskWeightingMapEntries(saved.tasks, [
      ['t_task_1', 8],
      ['t_task_3', 1],
    ]);
  });

  it('detects duplicate tuples on final save when title/topic/yearGroupKey changes', () => {
    const payload = setupDuplicateDetectionWithExisting(
      mockDbManager,
      mockFullCollection,
      mockRegistryCollection
    );
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
  });

  it('detects duplicate tuples using yearGroupKey only (ignoring yearGroup field in stored data)', () => {
    const payload = setupDuplicateDetectionWithExisting(
      mockDbManager,
      mockFullCollection,
      mockRegistryCollection
    );
    expect(() => controller.upsertDefinition(payload)).toThrow(/duplicate/i);
  });

  it('rejects same-document identifier pairs for save writes', () => {
    const runUpsert = () =>
      controller.upsertDefinition(
        createWizardUpsertPayload({
          referenceDocumentId: 'same-doc',
          templateDocumentId: 'same-doc',
        })
      );

    expect(runUpsert).toThrow();
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockRegistryCollection.insertOne).not.toHaveBeenCalled();
  });
});
