/** Hold controls shared by every response item kind. */
type ResponseHold = Readonly<{
  /** Fixed hold before the response is delivered, in milliseconds. */
  delayMs?: number;
  /** Named signal that holds the response until it is released. */
  releaseSignal?: string;
}>;

/** Base response item type for API scenarios. */
export type ResponseItem = Readonly<
  (
    | { kind: 'success'; data: unknown }
    | { kind: 'failureEnvelope'; data?: unknown; message?: string; code?: string }
    | { kind: 'transportFailure'; data?: unknown; message?: string; code?: string }
    | { kind: 'deferredSuccess'; data: unknown }
    | { kind: 'deferredFailure'; code?: string; message: string }
  ) &
    ResponseHold
>;

/** Runtime scenario type for API method queues. */
export type RuntimeScenario = Readonly<{
  hasScriptAuthorisation?: ReadonlyArray<ResponseItem>;
  getApplicationAccess?: ReadonlyArray<ResponseItem>;
  getAuthenticationSettings?: ReadonlyArray<ResponseItem>;
  setAuthenticationSettings?: ReadonlyArray<ResponseItem>;
  getBackendConfig?: ReadonlyArray<ResponseItem>;
  setBackendConfig?: ReadonlyArray<ResponseItem>;
  getABClassPartials?: ReadonlyArray<ResponseItem>;
  getABClass?: ReadonlyArray<ResponseItem>;
  upsertABClass?: ReadonlyArray<ResponseItem>;
  updateABClass?: ReadonlyArray<ResponseItem>;
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
