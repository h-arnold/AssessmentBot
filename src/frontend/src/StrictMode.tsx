import { StrictMode as ReactStrictMode, type PropsWithChildren } from 'react';

/**
 * Preserves a named StrictMode wrapper for entrypoint composition tests.
 *
 * @param {Readonly<PropsWithChildren>} properties Wrapper properties.
 * @returns {JSX.Element} The React StrictMode wrapper.
 */
export function StrictMode(properties: Readonly<PropsWithChildren>) {
  const { children } = properties;
  return <ReactStrictMode>{children}</ReactStrictMode>;
}
