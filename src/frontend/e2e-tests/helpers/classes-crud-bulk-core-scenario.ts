import type { Page } from '@playwright/test';
import {
  baseCohorts,
  baseYearGroups,
  mockClassesCrudRuntime,
  strictModeSafeReadQueue,
  type ClassesCrudRuntimeScenario,
} from '../classes-crud.shared';

type MutationScenario = Readonly<
  | { kind: 'success'; data: unknown }
  | { kind: 'transportFailure'; message: string }
  | { kind: 'failureEnvelope'; code?: string; message: string }
>;

type BulkCoreScenario = Readonly<{
  googleClassrooms: readonly unknown[];
  classPartials: readonly unknown[];
  cohorts?: readonly unknown[];
  yearGroups?: readonly unknown[];
  classPartialsAfterMutation?: readonly unknown[];
  deleteABClass?: readonly MutationScenario[];
  updateABClass?: readonly MutationScenario[];
  upsertABClass?: readonly MutationScenario[];
}>;

const DEFAULT_MUTATION_QUEUE_LENGTH = 12;

/** Builds the core flow's default mutation safety queue.
 * @returns {ReadonlyArray<MutationScenario>} Default success responses.
 */
function buildDefaultMutationQueue(): ReadonlyArray<MutationScenario> {
  return Array.from({ length: DEFAULT_MUTATION_QUEUE_LENGTH }, () => {
    return {
      kind: 'success' as const,
      data: { ok: true },
    };
  });
}

/** Maps the shorthand scenario into the shared CRUD runtime contract.
 * @param {BulkCoreScenario} scenario The core flow fixture.
 * @returns {ClassesCrudRuntimeScenario} Shared harness scenario.
 */
function toClassesCrudScenario(scenario: BulkCoreScenario): ClassesCrudRuntimeScenario {
  const classPartialsQueue: ClassesCrudRuntimeScenario['getABClassPartials'] = [
    { kind: 'success', data: scenario.classPartials },
    ...(scenario.classPartialsAfterMutation === undefined
      ? []
      : [{ kind: 'success' as const, data: scenario.classPartialsAfterMutation }]),
  ];

  return {
    hasScriptAuthorisation: strictModeSafeReadQueue([{ kind: 'success', data: true }]),
    getABClassPartials: strictModeSafeReadQueue(classPartialsQueue),
    getCohorts: strictModeSafeReadQueue([
      { kind: 'success', data: scenario.cohorts ?? baseCohorts },
    ]),
    getYearGroups: strictModeSafeReadQueue([
      { kind: 'success', data: scenario.yearGroups ?? baseYearGroups },
    ]),
    getGoogleClassrooms: strictModeSafeReadQueue([
      { kind: 'success', data: scenario.googleClassrooms },
    ]),
    deleteABClass: scenario.deleteABClass ?? buildDefaultMutationQueue(),
    updateABClass: scenario.updateABClass ?? buildDefaultMutationQueue(),
    upsertABClass: scenario.upsertABClass ?? buildDefaultMutationQueue(),
  };
}

/** Installs the core-flow shorthand through the shared Classes CRUD harness.
 * @param {Page} page Page under test.
 * @param {BulkCoreScenario} scenario API fixture.
 */
export async function mockBulkCoreRuntime(page: Page, scenario: BulkCoreScenario): Promise<void> {
  await mockClassesCrudRuntime(page, toClassesCrudScenario(scenario));
}
