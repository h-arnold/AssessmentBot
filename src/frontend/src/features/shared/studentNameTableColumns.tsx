/**
 * Shared Forename and Surname table columns.
 *
 * Both the Class page and Task Heatmap surfaces display the same split
 * student-name pair. This module owns the Ant Design column shape while the
 * pure name splitting and comparison functions remain in
 * `utils/splitStudentName.ts`.
 */

import type { JSX } from 'react';
import { Typography } from 'antd';
import type { TableColumnType } from 'antd';

import { compareStudentNamePart, splitStudentName } from '../../utils/splitStudentName';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME } from '../../theme/spacing';

/** Structural row fields required by the shared student-name columns. */
type StudentNameTableRow = Readonly<{
  studentId: string;
  studentName: string;
}>;

/** Options controlling the shared columns' table-surface behaviour. */
export type StudentNameTableColumnsOptions = Readonly<{
  sticky: boolean;
}>;

/**
 * Build the shared Forename and Surname columns for a table row type.
 *
 * The columns deliberately omit `defaultSortOrder`; each table's row model owns
 * the initial full-name ordering, while these sorters provide the derived-name
 * ordering after an explicit header interaction. The `sticky` option preserves
 * the surface-specific distinction between the sticky heatmap columns and the
 * non-sticky Class-page columns.
 *
 * @param {StudentNameTableColumnsOptions} options - Column behaviour options.
 * @returns {TableColumnType<Row>[]} The two shared student-name columns.
 */
export function buildStudentNameColumns<Row extends StudentNameTableRow>(
  options: StudentNameTableColumnsOptions
): TableColumnType<Row>[] {
  const fixedColumnProperties = options.sticky ? { fixed: 'start' as const } : {};
  const forenameColumn: TableColumnType<Row> = {
    key: 'forename',
    title: 'Forename',
    ...fixedColumnProperties,
    width: APP_COL_WIDTH_FORENAME,
    sorter: {
      compare: (a: Row, b: Row): number => compareStudentNamePart('forename', a, b),
    },
    render: (_: unknown, record: Row): JSX.Element => (
      <Typography.Text>{splitStudentName(record.studentName).forename}</Typography.Text>
    ),
  };

  const surnameColumn: TableColumnType<Row> = {
    key: 'surname',
    title: 'Surname',
    ...fixedColumnProperties,
    width: APP_COL_WIDTH_SURNAME,
    sorter: {
      compare: (a: Row, b: Row): number => compareStudentNamePart('surname', a, b),
    },
    render: (_: unknown, record: Row): JSX.Element => (
      <Typography.Text>{splitStudentName(record.studentName).surname}</Typography.Text>
    ),
  };

  return [forenameColumn, surnameColumn];
}
