/**
 * Shared deferred promise utilities for frontend tests.
 * 
 * Provides reusable deferred promise patterns for testing async scenarios,
 * particularly useful for testing React Query startup warmup and cache behaviour.
 */

/**
 * Creates a deferred promise for async test control.
 *
 * The deferred promise pattern allows tests to control when async operations complete,
 * which is essential for testing race conditions, timeouts, and complex async flows.
 *
 * @template T
 * @returns {{ promise: Promise<T>; resolvePromise: (value: T) => void; rejectPromise: (error: unknown) => void }} Deferred promise helpers.
 * @example
 * ```typescript
 * const { promise, resolvePromise, rejectPromise } = createDeferredPromise<number>();
 * 
 * // In one part of the test:
 * someAsyncFunction().then(resolvePromise);
 * 
 * // In another part:
 * await promise; // Waits for the async function to complete
 * ```
 */
export function createDeferredPromise<T>(): {
  promise: Promise<T>;
  resolvePromise: (value: T) => void;
  rejectPromise: (error: unknown) => void;
} {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolvePromise,
    rejectPromise,
  };
}

/**
 * The result type of createDeferredPromise for a specific type.
 */
export type DeferredPromiseResult<T> = {
  promise: Promise<T>;
  resolvePromise: (value: T) => void;
  rejectPromise: (error: unknown) => void;
};

/**
 * Result type for deferred startup datasets.
 */
export type DeferredStartupDatasetsResult<TDatasets extends Record<string, unknown>> = {
  [K in keyof TDatasets as `${string & K}Deferred`]: DeferredPromiseResult<TDatasets[K]>;
};

/**
 * Options for creating deferred startup datasets configuration.
 */
export interface CreateDeferredStartupDatasetsOptions<TDatasets extends Record<string, unknown>> {
  /**
   * Map of dataset keys to deferred promise factories.
   * Each factory should return a deferred promise for the dataset.
   */
  datasetFactories: {
    [K in keyof TDatasets]: () => DeferredPromiseResult<TDatasets[K]>;
  };
}

/**
 * Creates deferred startup datasets and wires service mocks to them.
 *
 * This helper consolidates the pattern of creating multiple deferred promises
 * for startup datasets and wiring service mocks to resolve with those promises.
 *
 * @param {CreateDeferredStartupDatasetsOptions<TDatasets>} options Configuration options.
 * @returns {DeferredStartupDatasetsResult<TDatasets>} Deferred datasets with mocks wired.
 *
 * @example
 * ```typescript
 * const deferreds = createDeferredStartupDatasets({
 *   datasetFactories: {
 *     classPartials: () => createDeferredPromise<Array<{ classId: string }>>(),
 *     cohorts: () => createDeferredPromise<Array<{ key: string; name: string }>>(),
 *   },
 * });
 * 
 * // Use in tests:
 * deferreds.classPartialsDeferred.resolvePromise([{ classId: 'class-1' }]);
 * ```
 */
export function createDeferredStartupDatasets<TDatasets extends Record<string, unknown>>(
  options: CreateDeferredStartupDatasetsOptions<TDatasets>
): DeferredStartupDatasetsResult<TDatasets> {
  const { datasetFactories } = options;

  const result = {} as unknown as DeferredStartupDatasetsResult<TDatasets>;

  // datasetFactories is a typed parameter with known structure - safe to iterate
  for (const key in datasetFactories) {
    if (Object.prototype.hasOwnProperty.call(datasetFactories, key)) {
      const factory = datasetFactories[key as keyof TDatasets];
      const deferred = factory();
      const deferredKey = `${String(key)}Deferred`;
      
      // Build result with proper typing - key comes from datasetFactories which is typed
      // eslint-disable-next-line security/detect-object-injection
      (result as Record<string, unknown>)[deferredKey] = deferred;
    }
  }

  return result;
}

/**
 * Simplified startup warmup datasets configuration for common assignment-related tests.
 *
 * This provides a pre-configured set of deferred datasets for the most common
 * startup warmup testing scenarios involving assignment definitions.
 */
export interface AssignmentStartupDatasets {
  classPartials: Array<{ classId: string }>;
  assignmentDefinitionPartials: Array<{ definitionKey: string }>;
  cohorts: Array<{ key: string; name: string; active: boolean }>;
  assignmentTopics: Array<{ key: string; name: string }>;
  yearGroups: Array<{ key: string; name: string }>;
}

/**
 * Deferred datasets result for assignment startup tests.
 */
export type AssignmentStartupDeferreds = {
  classPartialsDeferred: DeferredPromiseResult<Array<{ classId: string }>>;
  assignmentDefinitionPartialsDeferred: DeferredPromiseResult<Array<{ definitionKey: string }>>;
  cohortsDeferred: DeferredPromiseResult<Array<{ key: string; name: string; active: boolean }>>;
  assignmentTopicsDeferred: DeferredPromiseResult<Array<{ key: string; name: string }>>;
  yearGroupsDeferred: DeferredPromiseResult<Array<{ key: string; name: string }>>;
};

/**
 * Creates deferred startup datasets for assignment-related startup warmup tests.
 *
 * This is a convenience wrapper around createDeferredStartupDatasets that provides
 * the standard set of datasets needed for testing assignment definition startup flows.
 *
 * @param {object} mocks Optional mock functions to wire the deferred promises to.
 * @param {any} mocks.getABClassPartialsMock Mock for getABClassPartials service.
 * @param {any} mocks.getAssignmentDefinitionPartialsMock Mock for getAssignmentDefinitionPartials service.
 * @param {any} mocks.getCohortsMock Mock for getCohorts service.
 * @param {any} mocks.getAssignmentTopicsMock Mock for getAssignmentTopics service.
 * @param {any} mocks.getYearGroupsMock Mock for getYearGroups service.
 * @returns {AssignmentStartupDeferreds} Deferred datasets with service mocks wired.
 */
export function configureDeferredWarmupDatasets(
  mocks: {
    getABClassPartialsMock?: ReturnType<typeof vi.fn>;
    getAssignmentDefinitionPartialsMock?: ReturnType<typeof vi.fn>;
    getCohortsMock?: ReturnType<typeof vi.fn>;
    getAssignmentTopicsMock?: ReturnType<typeof vi.fn>;
    getYearGroupsMock?: ReturnType<typeof vi.fn>;
  } = {}
): AssignmentStartupDeferreds {
  const {
    getABClassPartialsMock,
    getAssignmentDefinitionPartialsMock,
    getCohortsMock,
    getAssignmentTopicsMock,
    getYearGroupsMock,
  } = mocks;

  const classPartialsDeferred = createDeferredPromise<Array<{ classId: string }>>();
  const assignmentDefinitionPartialsDeferred = createDeferredPromise<Array<{ definitionKey: string }>>();
  const cohortsDeferred = createDeferredPromise<Array<{ key: string; name: string; active: boolean }>>();
  const assignmentTopicsDeferred = createDeferredPromise<Array<{ key: string; name: string }>>();
  const yearGroupsDeferred = createDeferredPromise<Array<{ key: string; name: string }>>();

  if (getABClassPartialsMock) {
    getABClassPartialsMock.mockImplementation(() => classPartialsDeferred.promise);
  }
  if (getAssignmentDefinitionPartialsMock) {
    getAssignmentDefinitionPartialsMock.mockImplementation(() => assignmentDefinitionPartialsDeferred.promise);
  }
  if (getCohortsMock) {
    getCohortsMock.mockImplementation(() => cohortsDeferred.promise);
  }
  if (getAssignmentTopicsMock) {
    getAssignmentTopicsMock.mockImplementation(() => assignmentTopicsDeferred.promise);
  }
  if (getYearGroupsMock) {
    getYearGroupsMock.mockImplementation(() => yearGroupsDeferred.promise);
  }

  return {
    classPartialsDeferred,
    assignmentDefinitionPartialsDeferred,
    cohortsDeferred,
    assignmentTopicsDeferred,
    yearGroupsDeferred,
  };
}
