/** Base response item type for API scenarios. */
export type ResponseItem = Readonly<
  | { kind: 'success'; data: unknown }
  | { kind: 'failureEnvelope'; data?: unknown; message?: string; code?: string }
  | { kind: 'transportFailure'; data?: unknown; message?: string; code?: string }
  | { kind: 'deferredSuccess'; data: unknown }
  | { kind: 'deferredFailure'; code?: string; message: string }
>;

/** Runtime scenario type for API method queues. */
export type RuntimeScenario = Readonly<{
  hasScriptAuthorisation?: ReadonlyArray<ResponseItem>;
  getApplicationAccess?: ReadonlyArray<ResponseItem>;
  getAuthenticationSettings?: ReadonlyArray<ResponseItem>;
  setAuthenticationSettings?: ReadonlyArray<ResponseItem>;
  getABClassPartials?: ReadonlyArray<ResponseItem>;
  getABClass?: ReadonlyArray<ResponseItem>;
  getCohorts?: ReadonlyArray<ResponseItem>;
  getYearGroups?: ReadonlyArray<ResponseItem>;
  getAssignmentTopics?: ReadonlyArray<ResponseItem>;
  getGoogleClassroomAssignments?: ReadonlyArray<ResponseItem>;
  getGoogleClassrooms?: ReadonlyArray<ResponseItem>;
  startAssessmentRun?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinitionPartials?: ReadonlyArray<ResponseItem>;
  getAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  /** Real-data popover wiring. Mirrors the two-entry StrictMode pattern used by `getABClass`. */
  getAssignment?: ReadonlyArray<ResponseItem>;
  upsertAssignmentDefinition?: ReadonlyArray<ResponseItem>;
  deleteAssignmentDefinition?: ReadonlyArray<ResponseItem>;
}>;
