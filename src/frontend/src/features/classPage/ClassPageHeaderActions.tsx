/**
 * Presentational header action buttons for the Class page.
 *
 * Renders two top-right buttons:
 * 1. `Edit Student Details` — disabled, wrapped in a `Tooltip` via a `<span>`
 *    (Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly).
 * 2. `Start New Assessment` — enabled, calls `onStartNewAssessment` on click.
 *
 * @remarks
 * The `<span>`-wrapper pattern on the disabled button's `Tooltip` is the
 * established codebase convention (see `AssessTaskModal.tsx`).
 *
 * Pure presentational component; owns no state and performs no data fetching.
 *
 * @see SPEC_CLASS_PAGE.md — "ClassPageHeaderActions"
 * @see CLASS_PAGE_LAYOUT.md — "Page Heading and Header Actions"
 */

import type { JSX } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { APP_SPACE_SIZE_TIGHT } from '../../theme/spacing';

type ClassPageHeaderActionsProperties = Readonly<{
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
}>;

/**
 * Render the header action buttons for the Class page.
 *
 * Renders a disabled `Edit Student Details` button (wrapped in a `Tooltip`
 * via a `<span>`) and an enabled `Start New Assessment` button that invokes
 * the `onStartNewAssessment` callback.
 *
 * @param {Readonly<ClassPageHeaderActionsProperties>} root0 - Component properties.
 * @param {() => void} root0.onStartNewAssessment - Callback invoked when the user clicks "Start New Assessment".
 * @returns {JSX.Element} The header action buttons in a horizontal Space.
 */
export function ClassPageHeaderActions({
  onStartNewAssessment,
}: ClassPageHeaderActionsProperties): JSX.Element {
  return (
    <Space size={APP_SPACE_SIZE_TIGHT}>
      <Tooltip title="Coming soon" placement="top">
        <span>
          <Button type="default" disabled icon={<EditOutlined />}>
            Edit Student Details
          </Button>
        </span>
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} onClick={onStartNewAssessment}>
        Start New Assessment
      </Button>
    </Space>
  );
}
