/**
 * Shared setup, test helpers, and constants for
 * AssignmentDefinitionWizardModal spec files.
 *
 * IMPORTANT: This file does NOT import from `src/test/` or use `vi.hoisted()`.
 * Mock and fixture dependencies are provided via parameter objects by the
 * consuming spec files.
 */

import type { AssignmentDefinition } from '../../services/assignmentDefinition.zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal mock-like interface for vi.fn() objects used in these tests.
 * Only the methods actually called by the shared helpers are declared.
 */
export interface MockFunction {
  mockReturnValue(value: unknown): this;
  mockResolvedValue(value: unknown): this;
}

/**
 * Container for all hoisted mock references that the shared helper functions
 * need to call. Each spec file creates this from its own `vi.hoisted()` block.
 */
export interface Mocks {
  useStartupWarmupStateMock: Pick<MockFunction, 'mockReturnValue'>;
  getAssignmentTopicsMock: Pick<MockFunction, 'mockResolvedValue'>;
  getCohortsMock: Pick<MockFunction, 'mockResolvedValue'>;
  getYearGroupsMock: Pick<MockFunction, 'mockResolvedValue'>;
  getAssignmentDefinitionMock: Pick<MockFunction, 'mockResolvedValue'>;
  upsertAssignmentDefinitionMock: Pick<MockFunction, 'mockResolvedValue'>;
}

/**
 * Container for fixture data and helper functions imported from
 * `../test/assignmentDefinition/` by each spec file.
 */
export interface Fixtures {
  createStartupWarmupState: (state: Record<string, string | undefined>) => unknown;
  mockTopics: readonly unknown[];
  mockYearGroups: readonly unknown[];
  mockCohorts: readonly unknown[];
  mockFullAssignmentDefinition: unknown;
  mockUpsertResponse: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expected number of upsert calls for a stage-one parse followed by a final save. */
export const EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT = 2;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Creates a base render options object for create mode tests.
 *
 * @param {Mocks} mocks        Container for hoisted mock references.
 * @param {Fixtures} fixtures     Container for fixture data / helpers from src/test.
 * @param {() => void} [onClose]      Optional onClose handler.
 * @param {Record<string, string | undefined>} [warmupState]  Optional warmup state override.
 * @returns {{
 *   mode: 'create';
 *   definitionKey: null;
 *   onClose?: () => void;
 *   open: boolean;
 *   topics: unknown[];
 *   yearGroups: unknown[];
 *   cohorts: unknown[];
 *   mockInvalidateQueries: boolean;
 * }} Render options for create mode.
 */
export function createBaseCreateOptions(
  mocks: Mocks,
  fixtures: Fixtures,
  onClose?: () => void,
  warmupState?: Record<string, string | undefined>
) {
  if (warmupState) {
    mocks.useStartupWarmupStateMock.mockReturnValue(
      fixtures.createStartupWarmupState(warmupState)
    );
  } else {
    mocks.useStartupWarmupStateMock.mockReturnValue(
      fixtures.createStartupWarmupState({
        assignmentTopicsStatus: 'ready',
        yearGroupsStatus: 'ready',
      })
    );
  }

  return {
    mode: 'create' as const,
    definitionKey: null,
    onClose,
    open: true,
    topics: [...fixtures.mockTopics],
    yearGroups: [...fixtures.mockYearGroups],
    cohorts: [...fixtures.mockCohorts],
    mockInvalidateQueries: true,
  };
}

/**
 * Creates a base render options object for update mode tests.
 *
 * @param {Mocks} mocks           Container for hoisted mock references.
 * @param {Fixtures} fixtures        Container for fixture data / helpers from src/test.
 * @param {string} [definitionKey]  Definition key for the assignment.
 * @param {import('../../services/assignmentDefinition.zod').AssignmentDefinition} [definition]  Assignment definition for update mode.
 * @param {() => void} [onClose]       Optional onClose handler.
 * @returns {{
 *   mode: 'update';
 *   definitionKey: string;
 *   assignmentDefinition: import('../../services/assignmentDefinition.zod').AssignmentDefinition;
 *   onClose?: () => void;
 *   open: boolean;
 *   topics: unknown[];
 *   yearGroups: unknown[];
 *   cohorts: unknown[];
 *   mockInvalidateQueries: boolean;
 * }} Render options for update mode.
 */
export function createBaseUpdateOptions(
  mocks: Mocks,
  fixtures: Fixtures,
  definitionKey = 'algebra-baseline',
  definition: AssignmentDefinition = fixtures.mockFullAssignmentDefinition as AssignmentDefinition,
  onClose?: () => void
) {
  mocks.useStartupWarmupStateMock.mockReturnValue(
    fixtures.createStartupWarmupState({
      assignmentTopicsStatus: 'ready',
      yearGroupsStatus: 'ready',
    })
  );

  return {
    mode: 'update' as const,
    definitionKey,
    assignmentDefinition: definition,
    onClose,
    open: true,
    topics: [...fixtures.mockTopics],
    yearGroups: [...fixtures.mockYearGroups],
    cohorts: [...fixtures.mockCohorts],
    mockInvalidateQueries: true,
  };
}

/**
 * Sets up service mocks for create mode tests.
 *
 * @param {Mocks} mocks    Container for hoisted mock references.
 * @param {Fixtures} fixtures Container for fixture data / helpers from src/test.
 */
export function setupCreateModeMocks(mocks: Mocks, fixtures: Fixtures): void {
  mocks.getAssignmentTopicsMock.mockResolvedValue(fixtures.mockTopics);
  mocks.getCohortsMock.mockResolvedValue(fixtures.mockCohorts);
  mocks.getYearGroupsMock.mockResolvedValue(fixtures.mockYearGroups);
  mocks.getAssignmentDefinitionMock.mockResolvedValue(fixtures.mockFullAssignmentDefinition);
  mocks.upsertAssignmentDefinitionMock.mockResolvedValue(fixtures.mockUpsertResponse);
}

/**
 * Sets up service mocks for update mode tests.
 *
 * @param {Mocks} mocks      Container for hoisted mock references.
 * @param {Fixtures} fixtures   Container for fixture data / helpers from src/test.
 * @param {unknown} definition  The assignment definition to use.
 */
export function setupUpdateModeMocks(
  mocks: Mocks,
  fixtures: Fixtures,
  definition: unknown
): void {
  mocks.getAssignmentTopicsMock.mockResolvedValue(fixtures.mockTopics);
  mocks.getCohortsMock.mockResolvedValue(fixtures.mockCohorts);
  mocks.getYearGroupsMock.mockResolvedValue(fixtures.mockYearGroups);
  mocks.getAssignmentDefinitionMock.mockResolvedValue(definition);
  mocks.upsertAssignmentDefinitionMock.mockResolvedValue(fixtures.mockUpsertResponse);
}
