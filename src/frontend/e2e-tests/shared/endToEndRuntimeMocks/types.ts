/**
 * Base response item type for API scenarios.
 */
export type ResponseItem = Readonly<
  | {
      kind: 'success';
      data: unknown;
    }
  | {
      kind: 'failureEnvelope';
      data?: unknown;
      message?: string;
      code?: string;
    }
  | {
      kind: 'transportFailure';
      data?: unknown;
      message?: string;
      code?: string;
    }
  | {
      kind: 'deferredSuccess';
      data: unknown;
    }
>;

/**
 * Runtime scenario type for API method queues.
 */
export type RuntimeScenario = Readonly<{
  getAuthorisationStatus?: ReadonlyArray<ResponseItem>;
  getABClassPartials?: ReadonlyArray<ResponseItem>;
  getCohorts?: ReadonlyArray<ResponseItem>;
  getYearGroups?: ReadonlyArray<ResponseItem>;
  getAssignmentTopics?: ReadonlyArray<ResponseItem>;
  getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>;
  getGoogleClassrooms?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinitionPartials?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  deleteAssignmentDefinition?: ReadonlyArray<ResponseItem>;
}>;
