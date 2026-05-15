import { useEffect, useRef, useCallback } from 'react';

/**
 * Default debounce delay in milliseconds.
 */
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * A simple debounce hook that debounces a callback function.
 *
 * @param {() => void} callback The callback function to debounce.
 * @param {number} [delay] The debounce delay in milliseconds. Defaults to 300ms.
 * @returns {() => void} The debounced callback function.
 */
export function useDebounce<T extends (...arguments_: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = DEFAULT_DEBOUNCE_MS
): (...arguments_: Parameters<T>) => void {
  const timeoutReference = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...arguments_: Parameters<T>) => {
      if (timeoutReference.current !== null) {
        clearTimeout(timeoutReference.current);
      }

      timeoutReference.current = setTimeout(() => {
        callback(...arguments_);
      }, delay);
    },
    [callback, delay]
  );

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
