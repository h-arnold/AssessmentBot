import { Validate } from '#backend/Utils/Validate.js';
import {
  cleanupControllerTestMocks,
  createMockCollection,
  setupControllerTestMocks,
} from '../helpers/mockFactories.js';

const originalGlobals = Object.fromEntries(
  ['Validate', 'Cohort', 'YearGroup', 'AssignmentTopic'].map((key) => [key, globalThis[key]])
);

export async function setupReferenceDataTestGlobals() {
  const cohortModule = await import('#backend/Models/Cohort.js');
  const yearGroupModule = await import('#backend/Models/YearGroup.js');
  const assignmentTopicModule = await import('#backend/Models/AssignmentTopic.js');
  globalThis.Validate = Validate;
  globalThis.Cohort = cohortModule.Cohort ?? cohortModule.default?.Cohort;
  globalThis.YearGroup = yearGroupModule.YearGroup ?? yearGroupModule.default?.YearGroup;
  globalThis.AssignmentTopic =
    assignmentTopicModule.AssignmentTopic ?? assignmentTopicModule.default?.AssignmentTopic;
}

export function restoreReferenceDataTestGlobals() {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}

export async function setupReferenceDataTest(vi) {
  const collections = {
    cohorts: createMockCollection(vi),
    year_groups: createMockCollection(vi),
    abclass_partials: createMockCollection(vi),
    assignment_topics: createMockCollection(vi),
    assignment_definitions: createMockCollection(vi),
  };
  setupControllerTestMocks(vi);
  const mockDbManager = {
    getCollection: vi.fn((name) => {
      if (!collections[name]) throw new Error('Unexpected collection: ' + name);
      return collections[name];
    }),
  };
  globalThis.DbManager = { getInstance: () => mockDbManager };
  const module = await import('#backend/y_controllers/ReferenceDataController.js');
  return {
    ReferenceDataController: module.default ?? module.ReferenceDataController ?? module,
    cohortsCollection: collections.cohorts,
    yearGroupsCollection: collections.year_groups,
    partialsCollection: collections.abclass_partials,
    assignmentTopicsCollection: collections.assignment_topics,
    assignmentDefinitionPartialsCollection: collections.assignment_definitions,
    mockDbManager,
  };
}

export function teardownReferenceDataTest(vi) {
  vi.useRealTimers();
  cleanupControllerTestMocks();
  vi.restoreAllMocks();
}

export function primeCollectionLookupByKey(collection, records) {
  collection.find.mockReturnValue(records);
  collection.findOne.mockImplementation((filter = {}) => {
    if (filter?.key) return records.find((record) => record.key === filter.key) ?? null;
    return records[0] ?? null;
  });
}
