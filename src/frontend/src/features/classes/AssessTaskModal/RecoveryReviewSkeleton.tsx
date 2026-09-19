import { Skeleton, Space } from 'antd';
import type { JSX } from 'react';

/**
 * Renders the shape-matched busy treatment for the recovery review region
 * while the forced reparse is in flight.
 *
 * @remarks
 * The `<output>` element carries the implicit `status` role, so it exposes
 * accessible busy semantics without a redundant explicit `role="status"`
 * (per `frontend-loading-and-width-standards.md` §8.1). The skeleton mirrors
 * the review form: metadata rows, a full-width field and the task table.
 *
 * @returns {JSX.Element} The reparsing skeleton.
 */
export function RecoveryReviewSkeleton(): JSX.Element {
  return (
    <output aria-busy="true" aria-label="Reparsing definition">
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
        <Skeleton.Input active block />
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      </Space>
    </output>
  );
}
