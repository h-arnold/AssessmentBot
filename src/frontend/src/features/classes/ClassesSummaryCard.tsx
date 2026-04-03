import { Card, Space, Statistic, Typography } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesSummaryCardProps {
  rows: readonly ClassesManagementRow[];
  selectedCount: number;
}

/**
 * Displays a compact classes summary.
 *
 * @param {ClassesSummaryCardProps} props Summary inputs.
 * @returns {JSX.Element} Summary card.
 */
export function ClassesSummaryCard(props: ClassesSummaryCardProps) {
  const activeCount = props.rows.filter((row) => row.status === 'active').length;
  const inactiveCount = props.rows.filter((row) => row.status === 'inactive').length;

  return (
    <Card size="small" title="Summary">
      <Space size="large" wrap>
        <Statistic title="Total rows" value={props.rows.length} />
        <Statistic title="Active" value={activeCount} />
        <Statistic title="Inactive" value={inactiveCount} />
      </Space>
      <Typography.Text>{`Selected rows: ${props.selectedCount}`}</Typography.Text>
    </Card>
  );
}
