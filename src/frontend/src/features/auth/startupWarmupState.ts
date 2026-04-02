import {
  createContext,
  createElement,
  useContext,
  type PropsWithChildren,
} from 'react';

export type StartupWarmupStatus = 'loading' | 'ready' | 'failed';

export type StartupWarmupContextValue = Readonly<{
  warmupState: StartupWarmupStatus;
  isLoading: boolean;
  isReady: boolean;
  isFailed: boolean;
}>;

const startupWarmupContext = createContext<StartupWarmupContextValue | undefined>(undefined);

/**
 * Builds the shared warm-up context value from the current state.
 *
 * @param {StartupWarmupStatus} warmupState Current startup warm-up state.
 * @returns {StartupWarmupContextValue} Context value for consumers.
 */
export function createStartupWarmupContextValue(
  warmupState: StartupWarmupStatus
): StartupWarmupContextValue {
  return {
    warmupState,
    isLoading: warmupState === 'loading',
    isReady: warmupState === 'ready',
    isFailed: warmupState === 'failed',
  };
}

/**
 * Provides the shared startup warm-up state to descendant consumers.
 *
 * @param {Readonly<PropsWithChildren<{ warmupState: StartupWarmupStatus }>>} properties Provider properties.
 * @returns {React.ReactNode} Provider wrapper.
 */
export function StartupWarmupStateProvider(
  properties: Readonly<PropsWithChildren<{ warmupState: StartupWarmupStatus }>>
) {
  const { children, warmupState } = properties;

  return createElement(
    startupWarmupContext.Provider,
    { value: createStartupWarmupContextValue(warmupState) },
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
