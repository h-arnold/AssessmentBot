import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { logFrontendError } from '../../logging/frontendLogger';

/** Maximum number of distinct Class-page pipeline diagnostics retained per hook instance. */
const LOGGED_ERROR_KEYS_MAX = 256;

/**
 * Emit one Class-page pipeline diagnostic for a distinct error identity.
 *
 * @param {Set<string>} loggedErrorKeys - Per-hook keys already emitted.
 * @param {string} context - Stable log context.
 * @param {string} classId - Class correlation identifier.
 * @param {Error} error - Error to emit.
 * @param {Record<string, unknown> | undefined} metadata - Structured log metadata.
 * @returns {void} Nothing.
 */
function logClassPagePipelineError(
  loggedErrorKeys: Set<string>,
  context: string,
  classId: string,
  error: Error,
  metadata?: Record<string, unknown>
): void {
  const key = `${context}|${classId}|${error.message}|${JSON.stringify(metadata ?? {})}`;
  if (loggedErrorKeys.has(key)) {
    return;
  }

  loggedErrorKeys.add(key);
  // Keep repeat-run dedupe bounded for a long-lived Class-page hook instance.
  if (loggedErrorKeys.size > LOGGED_ERROR_KEYS_MAX) {
    const oldestKey = loggedErrorKeys.values().next().value;
    if (oldestKey !== undefined) {
      loggedErrorKeys.delete(oldestKey);
    }
  }
  logFrontendError(context, error, metadata);
}

/**
 * Own post-render Class-page pipeline diagnostics.
 *
 * @remarks
 * The analyser and adapter run inside `useMemo`, so logging there would be a
 * render-time side effect that React Strict Mode can invoke twice. This hook
 * emits after commit and keeps a per-instance key set so repeat runs with the
 * same context, class, message, and metadata emit only once while retained. Zod failures retain
 * their structured `zodIssues` metadata.
 *
 * @param {string} classId - Class correlation identifier.
 * @param {Error | null} analyserError - Analyser failure, if any.
 * @param {Error | null} adapterError - Adapter failure, if any.
 * @returns {void} Nothing.
 */
export function useClassPagePipelineDiagnostics(
  classId: string,
  analyserError: Error | null,
  adapterError: Error | null
): void {
  const loggedErrorKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (analyserError !== null) {
      const metadata =
        analyserError instanceof z.ZodError
          ? { classId, zodIssues: analyserError.issues }
          : { classId };
      logClassPagePipelineError(
        loggedErrorKeys.current,
        'useClassPageData.runAnalyserStep',
        classId,
        analyserError,
        metadata
      );
      return;
    }

    if (adapterError !== null) {
      logClassPagePipelineError(
        loggedErrorKeys.current,
        'useClassPageData.runAdapterStep',
        classId,
        adapterError
      );
    }
  }, [adapterError, analyserError, classId]);
}
