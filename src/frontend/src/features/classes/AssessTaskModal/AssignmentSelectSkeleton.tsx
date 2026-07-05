import { Skeleton, Space } from 'antd';

export type AssignmentSelectSkeletonProperties = Readonly<{
  ariaLabel: string;
}>;

/**
 * Renders the initial blocking-load treatment for the assignment selection
 * panel: a label skeleton and a full-width input skeleton to represent the
 * Select dropdown.
 *
 * @param {AssignmentSelectSkeletonProperties} properties Component properties.
 * @returns {JSX.Element} Loading skeleton content.
 */
export function AssignmentSelectSkeleton(
  properties: AssignmentSelectSkeletonProperties
) {
  return (
    <output aria-label={properties.ariaLabel}>
      <Space vertical style={{ width: '100%' }}>
        <Skeleton active title={{ width: '30%' }} paragraph={false} />
        <Skeleton.Input active style={{ width: '100%' }} />
      </Space>
    </output>
  );
}
