/**
 * Shared Forename and Surname table columns.
 *
 * Both the Class page and Task Heatmap surfaces display the same split
 * student-name pair. This module owns the Ant Design column shape while the
 * pure name splitting and comparison functions remain in
 * `utils/splitStudentName.ts`.
 *
 * Both columns are always fixed start columns. The former `sticky` option was
 * removed per `SPEC.md` decision 5 ("No non-fixed variant"), because both
 * consumers require fixed name columns.
 */

import type { JSX } from 'react';
import { Typography } from 'antd';
import type { TableColumnType } from 'antd';

import { compareStudentNamePart, splitStudentName } from '@/utils/splitStudentName';
import { APP_COL_WIDTH_FORENAME, APP_COL_WIDTH_SURNAME } from '@/theme/spacing';

/** Structural row fields required by the shared student-name columns. */
type StudentNameTableRow = Readonly<{
  studentId: string;
  studentName: string;
}>;

/**
 * Build the shared Forename and Surname columns for a table row type.
 *
 * Both columns carry `fixed: 'start'`, so they stay at the table's start edge
 * while its metric and task columns scroll horizontally. The columns
 * deliberately omit `defaultSortOrder`; each table's row model owns the
 * initial full-name ordering, while these sorters provide the derived-name
 * ordering after an explicit header interaction.
 *
 * @returns {TableColumnType<Row>[]} The two shared student-name columns.
 */
export function buildStudentNameColumns<Row extends StudentNameTableRow>(): TableColumnType<Row>[] {
  const forenameColumn: TableColumnType<Row> = {
    key: 'forename',
    title: 'Forename',
    fixed: 'start',
    width: APP_COL_WIDTH_FORENAME,
    sorter: {
      compare: (a: Row, b: Row): number => compareStudentNamePart('forename', a, b),
    },
    render: (_: unknown, record: Row): JSX.Element => {
      return (
        <Typography.Text>{splitStudentName(record.studentName).forename}</Typography.Text>
      );
    },
  };

  const surnameColumn: TableColumnType<Row> = {
    key: 'surname',
    title: 'Surname',
    fixed: 'start',
    width: APP_COL_WIDTH_SURNAME,
    sorter: {
      compare: (a: Row, b: Row): number => compareStudentNamePart('surname', a, b),
    },
    render: (_: unknown, record: Row): JSX.Element => {
      return (
        <Typography.Text>{splitStudentName(record.studentName).surname}</Typography.Text>
      );
    },
  };

  return [forenameColumn, surnameColumn];
}
