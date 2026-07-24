import { useEffect, useRef } from 'react';

/**
 * A hook that invokes a callback exactly once when a condition becomes true.
 *
 * Uses `useRef` to track whether the callback has already been invoked,
 * preventing duplicate execution in React 19 StrictMode double-effects.
 *
 * @param {boolean} condition - When truthy, the callback is invoked (once).
 * @param {() => void} callback - The function to call exactly once when the
 *   condition is truthy, including on the initial render if it is already true.
 */
export function useLogOnce(condition: boolean, callback: () => void): void {
  const hasLoggedReference = useRef(false);

  useEffect(() => {
    if (condition && !hasLoggedReference.current) {
      hasLoggedReference.current = true;
      callback();
    }
  }, [condition, callback]);
}
