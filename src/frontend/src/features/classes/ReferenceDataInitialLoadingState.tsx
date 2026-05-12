/**
 * Reference Data Initial Loading State
 *
 * Shared loading skeleton component for reference-data management modals.
 * Accepts an ariaLabel prop for accessibility.
 */

import { Flex, Skeleton } from 'antd';

export type ReferenceDataInitialLoadingStateProperties = Readonly<{
  ariaLabel: string;
}>;

/**
 * Renders the initial blocking-load treatment for reference-data management modal bodies.
 *
 * @param {ReferenceDataInitialLoadingStateProperties} properties Component properties.
 * @returns {JSX.Element} Loading skeleton content.
 */
export function ReferenceDataInitialLoadingState(
  properties: ReferenceDataInitialLoadingStateProperties
) {
  return (
    <output aria-label={properties.ariaLabel}>
      <Flex vertical gap={12}>
        <Skeleton.Button active />
        <Skeleton active paragraph={{ rows: 5 }} title={{ width: '24%' }} />
      </Flex>
    </output>
  );
}
