import { Card, Space, Statistic, Typography } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export interface ClassesSummaryCardProperties {
  rows: readonly ClassesManagementRow[];
  selectedCount: number;
}

/**
 * Displays a compact classes summary.
 *
 * @param {Readonly<ClassesSummaryCardProperties>} properties Summary inputs.
 * @returns {JSX.Element} Summary card.
 */
export function ClassesSummaryCard(properties: Readonly<ClassesSummaryCardProperties>) {
  const activeCount = properties.rows.filter((row) => row.status === 'active').length;
  const inactiveCount = properties.rows.filter((row) => row.status === 'inactive').length;

  return (
    <Card size="small" title="Summary">
      <Space size="large" wrap>
        <Statistic title="Total rows" value={properties.rows.length} />
        <Statistic title="Active" value={activeCount} />
        <Statistic title="Inactive" value={inactiveCount} />
      </Space>
      <Typography.Text>{`Selected rows: ${properties.selectedCount}`}</Typography.Text>
    </Card>
  );
}
