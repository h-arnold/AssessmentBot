import {
  createContext,
  createElement,
  useContext,
  type PropsWithChildren,
} from 'react';
import { startupWarmupDatasetKeys, type StartupWarmupDatasetKey } from '../../query/sharedQueries';

export type StartupWarmupStatus = 'loading' | 'ready' | 'failed';

export type StartupWarmupDatasetState = Readonly<{
  status: StartupWarmupStatus;
  isTrustworthy: boolean;
}>;

export type StartupWarmupSnapshot = Readonly<{
  datasets: Record<StartupWarmupDatasetKey, StartupWarmupDatasetState>;
}>;

export type StartupWarmupContextValue = Readonly<{
  warmupState: StartupWarmupStatus;
  isLoading: boolean;
  isReady: boolean;
  isFailed: boolean;
  snapshot: StartupWarmupSnapshot;
  isDatasetReady: (datasetKey: StartupWarmupDatasetKey) => boolean;
  isDatasetFailed: (datasetKey: StartupWarmupDatasetKey) => boolean;
}>;

const startupWarmupContext = createContext<StartupWarmupContextValue | undefined>(undefined);

/**
 * Returns the snapshot state for the selected startup dataset.
 *
 * @param {StartupWarmupSnapshot} snapshot Dataset snapshot.
 * @param {StartupWarmupDatasetKey} datasetKey Startup dataset key.
 * @returns {StartupWarmupDatasetState} Dataset state.
 */
function getDatasetState(
  snapshot: StartupWarmupSnapshot,
  datasetKey: StartupWarmupDatasetKey
): StartupWarmupDatasetState {
  for (const [currentDatasetKey, datasetState] of Object.entries(snapshot.datasets) as [
    StartupWarmupDatasetKey,
    StartupWarmupDatasetState,
  ][]) {
    if (currentDatasetKey === datasetKey) {
      return datasetState;
    }
  }

  throw new Error('Unknown startup warm-up dataset key: ' + datasetKey + '.');
}

/**
 * Creates the dataset snapshot for a scalar warm-up status.
 *
 * @param {StartupWarmupStatus} warmupState Shared warm-up status.
 * @returns {StartupWarmupSnapshot} Dataset snapshot with uniform status.
 */
export function createStartupWarmupSnapshotForStatus(
  warmupState: StartupWarmupStatus
): StartupWarmupSnapshot {
  const isTrustworthy = warmupState === 'ready';

  return {
    datasets: Object.fromEntries(
      startupWarmupDatasetKeys.map((datasetKey) => [datasetKey, { status: warmupState, isTrustworthy }])
    ) as Record<StartupWarmupDatasetKey, StartupWarmupDatasetState>,
  };
}

/**
 * Builds the shared warm-up context value from the current state.
 *
 * @param {StartupWarmupStatus} warmupState Current startup warm-up state.
 * @param {StartupWarmupSnapshot} [snapshot] Dataset-level warm-up snapshot.
 * @returns {StartupWarmupContextValue} Context value for consumers.
 */
export function createStartupWarmupContextValue(
  warmupState: StartupWarmupStatus,
  snapshot: StartupWarmupSnapshot = createStartupWarmupSnapshotForStatus(warmupState)
): StartupWarmupContextValue {
  return {
    warmupState,
    isLoading: warmupState === 'loading',
    isReady: warmupState === 'ready',
    isFailed: warmupState === 'failed',
    snapshot,
    isDatasetReady: (datasetKey: StartupWarmupDatasetKey) => {
      const datasetState = getDatasetState(snapshot, datasetKey);
      return datasetState.status === 'ready' && datasetState.isTrustworthy;
    },
    isDatasetFailed: (datasetKey: StartupWarmupDatasetKey) =>
      getDatasetState(snapshot, datasetKey).status === 'failed',
  };
}

type StartupWarmupStateProviderProperties = Readonly<PropsWithChildren<{
  warmupState: StartupWarmupStatus;
  snapshot?: StartupWarmupSnapshot;
}>>;

/**
 * Provides the shared startup warm-up state to descendant consumers.
 *
 * @param {StartupWarmupStateProviderProperties} properties Provider properties.
 * @returns {React.ReactNode} Provider wrapper.
 */
export function StartupWarmupStateProvider(properties: StartupWarmupStateProviderProperties) {
  const { children, warmupState, snapshot } = properties;

  return createElement(
    startupWarmupContext.Provider,
    { value: createStartupWarmupContextValue(warmupState, snapshot) },
    children
  );
}

/**
 * Reads the shared startup warm-up state.
 *
 * @returns {StartupWarmupContextValue} Current warm-up state.
 */
export function useStartupWarmupState(): StartupWarmupContextValue {
  const contextValue = useContext(startupWarmupContext);

  if (!contextValue) {
    throw new Error('useStartupWarmupState must be used within StartupWarmupStateProvider.');
  }

  return contextValue;
}
