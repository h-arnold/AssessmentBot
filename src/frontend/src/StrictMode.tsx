import { StrictMode as ReactStrictMode, type PropsWithChildren } from 'react';

/**
 * Preserves a named StrictMode wrapper for entrypoint composition tests.
 */
export function StrictMode({ children }: Readonly<PropsWithChildren>) {
  return <ReactStrictMode>{children}</ReactStrictMode>;
}
