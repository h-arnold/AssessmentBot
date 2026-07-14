/**
 * Reference Data Initial Loading State
 *
 * Shared loading skeleton component for reference-data management modals.
 * Accepts an ariaLabel prop for accessibility.
 */

import { Flex, Skeleton } from 'antd';
import { APP_GAP_COMPACT } from '../../theme/spacing';

export type ReferenceDataInitialLoadingStateProperties = Readonly<{
  ariaLabel: string;
  role?: string;
  'aria-live'?: 'polite' | 'off' | 'assertive';
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
    <output aria-label={properties.ariaLabel} aria-live={properties['aria-live']} role={properties.role}>
      <Flex vertical gap={APP_GAP_COMPACT}>
        <Skeleton.Button active />
        <Skeleton active paragraph={{ rows: 5 }} title={{ width: '24%' }} />
      </Flex>
    </output>
  );
}
