import { useStartupWarmupState } from '@/features/auth/startupWarmupState';

/**
 * Probes the startup warm-up hook state for assertions.
 *
 * @returns {JSX.Element} Serialised hook state.
 */
export function StartupWarmupProbe() {
  const warmupState = useStartupWarmupState();

  return (
    <output data-testid="startup-warmup-probe">
      {JSON.stringify({
        warmupState: warmupState.warmupState,
        isLoading: warmupState.isLoading,
        isReady: warmupState.isReady,
        isFailed: warmupState.isFailed,
      })}
    </output>
  );
}
