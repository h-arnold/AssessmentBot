/* eslint-disable react-refresh/only-export-components */

import { FilterFilled } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Modal,
  Skeleton,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import type { FilterDropdownProps, FilterValue } from 'antd/es/table/interface';
import type { ReactElement } from 'react';
import { type AssignmentDefinitionPartial } from '../../services/assignmentDefinitionPartialsService';
import type {
  AssignmentsFilterOption,
  DeleteOutcome,
} from './types';
import {
  BLOCKING_ERROR_MESSAGE,
} from './types';

const { Text } = Typography;

/**
 * Renders one table filter dropdown with exact-match options.
 *
 * @param {Readonly<{ options: ReadonlyArray<{ text: string; value: string }>; selectedValues: FilterValue | null; onSelectOption: (value: string) => void; dropdownProperties: FilterDropdownProps; }>} properties Filter-dropdown properties.
 * @returns {JSX.Element} Dropdown content.
 */
export function AssignmentsFilterDropdown(
  properties: Readonly<{
    options: ReadonlyArray<AssignmentsFilterOption>;
    selectedValues: FilterValue | null;
    onSelectOption: (value: string) => void;
    dropdownProperties: FilterDropdownProps;
  }>
) {
  const selectedValues = new Set((properties.selectedValues ?? []).map(String));

  return (
    <Space orientation="vertical" size={0}>
      {properties.options.map((option) => {
        const isSelected = selectedValues.has(option.value);

        return (
          <button
            key={option.value}
            onClick={() => {
              properties.onSelectOption(option.value);
              properties.dropdownProperties.setSelectedKeys([option.value]);
              properties.dropdownProperties.confirm({ closeDropdown: true });
            }}
            style={{
              background: isSelected ? 'rgba(22, 119, 255, 0.1)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              textAlign: 'left',
            }}
            type="button"
          >
            {option.text}
          </button>
        );
      })}
    </Space>
  );
}

/**
 * Renders one table-column filter icon with an explicit accessible label.
 *
 * @param {Readonly<{ isFiltered: boolean; label: string; }>} properties Icon properties.
 * @returns {JSX.Element} Filter icon.
 */
export function AssignmentsFilterIcon(properties: Readonly<{ isFiltered: boolean; label: string }>) {
  return (
    <FilterFilled
      aria-label={properties.label}
      style={{ color: properties.isFiltered ? 'var(--ant-color-primary)' : undefined }}
    />
  );
}

/**
 * Renders the status and action card for assignments management.
 *
 * @param {Readonly<{ shouldRenderBlockingState: boolean; deleteOutcome: DeleteOutcome | null; shouldRenderActionLoadingState: boolean; onRefreshAssignmentsData: () => void; onCreateAssignment: () => void; hasTrustworthyData: boolean; }>} properties Card properties.
 * @returns {JSX.Element} Card content.
 */
export function AssignmentsStatusAndActionsCard(
  properties: Readonly<{
    shouldRenderBlockingState: boolean;
    deleteOutcome: DeleteOutcome | null;
    shouldRenderActionLoadingState: boolean;
    onRefreshAssignmentsData: () => void;
    onCreateAssignment: () => void;
    hasTrustworthyData: boolean;
  }>
) {
  return (
    <Card size="small" title="Status and actions">
      <Flex vertical gap={12}>
        {properties.shouldRenderBlockingState ? (
          <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
        ) : null}

        {properties.deleteOutcome === null ? null : (
          <Alert
            showIcon
            title={properties.deleteOutcome.message}
            type={properties.deleteOutcome.type === 'success' ? 'success' : 'error'}
          />
        )}

        {properties.shouldRenderActionLoadingState ? (
          <div aria-label="Assignments actions loading" aria-live="polite">
            <Space>
              <Skeleton.Button active />
              <Skeleton.Button active />
              <Skeleton.Button active />
            </Space>
          </div>
        ) : (
          <Flex gap={8} justify="space-between" wrap>
            <Space wrap>
              <Button onClick={properties.onRefreshAssignmentsData}>
                Refresh assignments data
              </Button>
              <Button
                disabled={!properties.hasTrustworthyData}
                onClick={properties.onCreateAssignment}
              >
                Create assignment
              </Button>
            </Space>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

/**
 * Renders the assignment definitions table card when the page is not blocked.
 *
 * @param {Readonly<{ shouldRenderBlockingState: boolean; shouldRenderTableLoadingState: boolean; onResetSortAndFilters: () => void; tableColumns: TableColumnsType<AssignmentDefinitionPartial>; visibleRows: readonly AssignmentDefinitionPartial[]; }>} properties Card properties.
 * @returns {JSX.Element | null} Card content, or null for blocking state.
 */
export function renderAssignmentsDefinitionsCard(
  properties: Readonly<{
    shouldRenderBlockingState: boolean;
    shouldRenderTableLoadingState: boolean;
    onResetSortAndFilters: () => void;
    tableColumns: TableColumnsType<AssignmentDefinitionPartial>;
    visibleRows: readonly AssignmentDefinitionPartial[];
  }>
): ReactElement | null {
  if (properties.shouldRenderBlockingState) {
    return null;
  }

  return (
    <Card
      size="small"
      title="Assignment definitions"
      extra={
        properties.shouldRenderTableLoadingState ? null : (
          <Button onClick={properties.onResetSortAndFilters}>Reset sort and filters</Button>
        )
      }
    >
      {properties.shouldRenderTableLoadingState ? (
        <div aria-label="Assignments table loading" aria-live="polite">
          <Skeleton active paragraph={{ rows: 6 }} title={{ width: '30%' }} />
        </div>
      ) : (
        <Table<AssignmentDefinitionPartial>
          aria-label="Assignment definitions table"
          columns={properties.tableColumns}
          dataSource={properties.visibleRows}
          locale={{
            emptyText: <Empty description="No assignment definitions found." />,
          }}
          pagination={false}
          rowKey="definitionKey"
        />
      )}
    </Card>
  );
}

/**
 * Renders the delete-confirmation modal.
 *
 * @param {Readonly<{ deleteTarget: AssignmentDefinitionPartial | null; isDeleteMutationPending: boolean; onCancel: () => void; onConfirm: () => void; error: string | null; }>} properties Modal properties.
 * @returns {JSX.Element} Delete modal.
 */
export function AssignmentsDeleteModal(
  properties: Readonly<{
    deleteTarget: AssignmentDefinitionPartial | null;
    isDeleteMutationPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    error: string | null;
  }>
) {
  const isDeleteBusy = properties.isDeleteMutationPending;

  return (
    <Modal
      centered
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={isDeleteBusy} onClick={properties.onCancel}>
            Cancel
          </Button>
          <Button
            disabled={isDeleteBusy}
            loading={isDeleteBusy}
            onClick={properties.onConfirm}
            type="primary"
          >
            Delete definition
          </Button>
        </Space>
      }
      keyboard={!isDeleteBusy}
      onCancel={properties.onCancel}
      open={properties.deleteTarget !== null}
      title="Delete assignment definition"
      transitionName=""
    >
      <Space orientation="vertical" size="small">
        {properties.error && (
          <Alert
            description={properties.error}
            showIcon
            type="error"
            style={{ marginBottom: 16 }}
          />
        )}
        <Text>You are deleting this assignment definition.</Text>
        {properties.deleteTarget === null ? null : (
          <Text strong>{properties.deleteTarget.primaryTitle}</Text>
        )}
        <Text>This delete is permanent and cannot be undone.</Text>
      </Space>
    </Modal>
  );
}
