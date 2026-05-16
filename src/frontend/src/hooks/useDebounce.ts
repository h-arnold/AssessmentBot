import { useEffect, useRef, useCallback } from 'react';

/**
 * Default debounce delay in milliseconds.
 */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * A simple debounce hook that debounces a callback function.
 *
 * @param {() => void} callback The callback function to debounce.
 * @param {number} [delay] The debounce delay in milliseconds. Defaults to DEFAULT_DEBOUNCE_MS.
 * @returns {() => void} The debounced callback function.
 */
export function useDebounce(callback: () => void, delay: number = DEFAULT_DEBOUNCE_MS): () => void {
  const timeoutReference = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(() => {
    if (timeoutReference.current !== null) {
      clearTimeout(timeoutReference.current);
    }

    timeoutReference.current = setTimeout(() => {
      callback();
    }, delay);
  }, [callback, delay]);

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutReference.current !== null) {
        clearTimeout(timeoutReference.current);
      }
    };
  }, []);

  return debouncedCallback;
}
