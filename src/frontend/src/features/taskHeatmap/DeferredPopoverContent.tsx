import type { JSX } from 'react';

/**
 * Defer a Popover content builder until the overlay mounts its content.
 *
 * Ant Design evaluates function-valued `content` props while the Popover is
 * rendered, even when it is closed. This component keeps expensive content
 * construction behind the overlay's open-state mount boundary.
 *
 * @param {Readonly<{ buildContent: () => JSX.Element }>} props - Content builder.
 * @returns {JSX.Element} The built Popover content.
 */
export function DeferredPopoverContent({
  buildContent,
}: Readonly<{ buildContent: () => JSX.Element }>): JSX.Element {
  return buildContent();
}
