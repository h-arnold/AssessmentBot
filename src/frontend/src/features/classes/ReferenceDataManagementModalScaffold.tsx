/**
 * Reference Data Management Modal Scaffold
 *
 * A narrow shared shell for the classes reference-data modal family.
 * Owns the outer Ant Design Modal shell, standard Cancel footer, all close wiring,
 * modal-level aria-busy refresh semantics, and ready-state body composition.
 *
 * The scaffold is generic: <T extends { key: string }> so typed rows: T[] and
 * columns: TableColumnType<T>[] props do not require callers to cast their
 * entity-typed columns under TypeScript strict mode.
 */

import { Alert, Button, Flex, Modal, Table, Typography, type TableColumnType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { createElement, cloneElement, useEffect, useRef, type ReactElement } from 'react';
import { syncReferenceDataModalBusyState } from './manageReferenceDataHelpers';

const { Text } = Typography;

export type ReferenceDataManagementModalScaffoldProperties<T extends { key: string }> =
  Readonly<{
    open: boolean;
    modalTitle: string;
    modalClassName: string;
    modalWidth: number;
    createActionLabel: string;
    tableAriaLabel: string;
    emptyTableCopy: string;
    refreshStatusCopy: string;
    isInitialLoading: boolean;
    isRefreshing: boolean;
    loadError: string | null;
    loadingState: ReactElement;
    rows: T[];
    columns: TableColumnType<T>[];
    inlineAlert?: ReactElement | null;
    inlineDialog?: ReactElement | null;
    onClose: () => void;
    onCreate: () => void;
  }>;

/**
 * Renders the shared scaffold for reference-data management modals.
 *
 * Owns:
 * - Outer Ant Design Modal shell
 * - Standard Cancel footer
 * - All close wiring (footer Cancel, close icon, mask close, keyboard close)
 * - Modal-level aria-busy refresh semantics via syncReferenceDataModalBusyState
 * - Ready-state body composition: status, create row, alert slot, table slot
 * - Inline dialog slot (sibling of modal body)
 *
 * Caller supplies:
 * - modalTitle, modalClassName, modalWidth
 * - createActionLabel, tableAriaLabel, emptyTableCopy, refreshStatusCopy
 * - isInitialLoading, isRefreshing, loadError, loadingState
 * - rows, columns
 * - inlineAlert (optional), inlineDialog (optional)
 * - onClose, onCreate
 *
 * @remarks
 * Modal-level `aria-busy` is applied via `syncReferenceDataModalBusyState` using
 * the compound selector `.reference-data-modal-scaffold-wrapper [role="dialog"]`.
 * The class `reference-data-modal-scaffold-wrapper` is applied via `classNames.wrapper`
 * on the Ant Design `Modal`, which places it on `.ant-modal-wrap` (not on `.ant-modal`/
 * `[role="dialog"]` directly); the compound selector therefore navigates from the
 * wrapper to the inner dialog element.
 * This class is a scaffold invariant, not the caller-supplied `modalClassName`.
 * Do not remove it thinking it is only for CSS styling.
 *
 * @param {ReferenceDataManagementModalScaffoldProperties<T>} properties Scaffold properties.
 * @returns {JSX.Element} The rendered modal scaffold.
 */
export function ReferenceDataManagementModalScaffold<T extends { key: string }>(
  properties: ReferenceDataManagementModalScaffoldProperties<T>
): ReactElement {
  const previousIsRefreshingRef = useRef(properties.isRefreshing);

  // Track isRefreshing changes to trigger aria-busy updates
  useEffect(() => {
    const currentIsRefreshing = properties.isRefreshing;
    const wasRefreshing = previousIsRefreshingRef.current;

    if (currentIsRefreshing !== wasRefreshing && properties.open) {
      // Use requestAnimationFrame to ensure Ant Design Modal has rendered in jsdom
      const rafId = requestAnimationFrame(() => {
        syncReferenceDataModalBusyState(
          '.reference-data-modal-scaffold-wrapper [role="dialog"]',
          currentIsRefreshing
        );
      });

      return () => cancelAnimationFrame(rafId);
    }

    previousIsRefreshingRef.current = currentIsRefreshing;
  }, [properties.isRefreshing, properties.open]);

  // Build the blocking body (initial load or error) using the pattern from getReferenceDataBlockingBody
  const blockingBody = (function getBlockingBody() {
    if (properties.isInitialLoading) {
      // Ensure loadingState has role="status" for accessibility.
      // Clone the loadingState element to add role="status" and aria-live="polite"
      // if it doesn't already have them. This ensures tests can find it by role="status".
      return cloneElement(properties.loadingState, {
        role: 'status',
        'aria-live': 'polite',
      });
    }

    if (properties.loadError !== null) {
      // Use Alert component matching the pattern from getReferenceDataBlockingBody helper
      return createElement(Alert, {
        description: properties.loadError,
        showIcon: true,
        type: 'error',
      });
    }

    return null;
  })();

  // Build the ready-state body
  const readyBody = (function getReadyBody() {
    if (properties.isInitialLoading || properties.loadError !== null) {
      return null;
    }

    return (
      <Flex vertical gap={12}>
        {properties.isRefreshing ? (
          <div aria-live="polite" role="status">
            <Text type="secondary">{properties.refreshStatusCopy}</Text>
          </div>
        ) : null}
        <Button
          type="primary"
          onClick={properties.onCreate}
          icon={
            <PlusOutlined
              data-testid="reference-data-create-action-icon"
              aria-hidden="true"
            />
          }
        >
          {properties.createActionLabel}
        </Button>
        {properties.inlineAlert ?? null}
        <Table<T>
          aria-label={properties.tableAriaLabel}
          dataSource={properties.rows}
          columns={properties.columns}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: properties.emptyTableCopy }}
        />
      </Flex>
    );
  })();

  return (
    <Modal
      open={properties.open}
      title={properties.modalTitle}
      onCancel={properties.onClose}
      className="reference-data-modal-scaffold-dialog"
      classNames={{
        wrapper: `${properties.modalClassName} reference-data-modal-scaffold-wrapper`,
      }}
      footer={<Button onClick={properties.onClose}>Cancel</Button>}
      style={{ width: properties.modalWidth }}
    >
      {blockingBody ?? readyBody}
      {properties.inlineDialog ?? null}
    </Modal>
  );
}
