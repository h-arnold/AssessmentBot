import { Empty } from 'antd';

/**
 * Renders the classes-tab empty state when there are no active Google Classrooms.
 *
 * @returns {JSX.Element} Empty state panel.
 */
export function ClassesNoActiveClassroomsEmptyState() {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="No active Google Classrooms are available."
    />
  );
}
