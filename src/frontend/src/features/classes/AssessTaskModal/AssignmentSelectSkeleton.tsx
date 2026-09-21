import { Skeleton, Space } from 'antd';
import { APP_SPACE_SIZE_DEFAULT } from '../../../theme/spacing';

export type AssignmentSelectSkeletonProperties = Readonly<{
  ariaLabel: string;
}>;

/**
 * Renders the initial blocking-load treatment for the assignment selection
 * panel: a label skeleton and a full-width input skeleton to represent the
 * Select dropdown.
 *
 * @remarks
 * Wraps the skeleton in an `<output>` element, whose implicit `status` role and
 * `aria-busy="true"` expose the blocking-load state to assistive technology. Do
 * not add an explicit `role="status"` — the redundancy trips SonarCloud
 * `typescript:S6822`.
 *
 * @param {AssignmentSelectSkeletonProperties} properties Component properties.
 * @returns {JSX.Element} Loading skeleton content.
 */
export function AssignmentSelectSkeleton(
  properties: AssignmentSelectSkeletonProperties
) {
  return (
    <output aria-label={properties.ariaLabel} aria-busy="true">
      <Space vertical size={APP_SPACE_SIZE_DEFAULT} style={{ width: '100%' }}>
        <Skeleton active title={{ width: '30%' }} paragraph={false} />
        <Skeleton.Input active style={{ width: '100%' }} />
      </Space>
    </output>
  );
}
