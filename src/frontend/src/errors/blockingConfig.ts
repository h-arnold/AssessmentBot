/**
 * Shared resolver for per-feature blocking-error → `Result` configuration.
 *
 * @remarks
 * Several features (Heatmaps, Class Page) each own a feature-specific copy map
 * whose value type is the shared {@link BlockingConfig}. The *mapping mechanism*
 * is identical across features, so it lives here once; the error copy itself
 * stays feature-owned (legitimately distinct per feature) and is supplied as the
 * `config` record. Promotion of this shared helper was agreed in the pre-PR
 * review (finding S-3) to remove a structural clone of the resolver.
 *
 * @see frontend-shared-helpers-and-abstraction-standards.md — error helpers
 */

/** User-safe configuration for a blocking `Result` (Ant Design `Result` taxonomy). */
export type BlockingConfig = Readonly<{
  /** Ant Design `Result` status variant. */
  status: 'error' | 'warning';
  /** User-facing title. */
  title: string;
  /** Whether a Retry action should be offered (retryable errors). */
  retryable: boolean;
}>;

/**
 * Resolve the blocking `Result` configuration for a structured surface error.
 *
 * @param {Readonly<{ type: T }>} error - The structured blocking error.
 * @param {Readonly<Record<T, BlockingConfig>>} config - The per-feature config record keyed by error type.
 * @returns {BlockingConfig} The user-safe result configuration.
 */
export function resolveBlockingResultConfig<T extends string>(
  error: Readonly<{ type: T }>,
  config: Readonly<Record<T, BlockingConfig>>
): BlockingConfig {
  return config[error.type];
}
