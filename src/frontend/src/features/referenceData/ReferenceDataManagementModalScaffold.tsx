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

import { cloneElement, useEffect, useRef, type ReactElement } from 'react';
import { Alert, Button, Flex, Modal, Table, Typography, type TableColumnType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
    loadingState: React.ReactElement<{ role?: string; 'aria-live'?: 'polite' | 'off' | 'assertive' }>;
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
  const previousIsRefreshingReference = useRef<boolean | undefined>(undefined);
  const busyStateTimeoutReference = useRef<number | null>(null);

  // Track isRefreshing changes to trigger aria-busy updates
  // Note: setTimeout is used to defer DOM query to allow Ant Design classes to be applied
  // in test environments like HappyDOM where useEffect may run before class application is complete
  useEffect(() => {
    const currentIsRefreshing = properties.isRefreshing;
    const wasRefreshing = previousIsRefreshingReference.current;
    const shouldSyncBusyState = currentIsRefreshing !== wasRefreshing && properties.open;

    if (shouldSyncBusyState) {
      // Clear any existing timeout to prevent stale timer firing
      if (busyStateTimeoutReference.current !== null) {
        clearTimeout(busyStateTimeoutReference.current);
      }

      // Defer to next macrotask to allow HappyDOM to apply Ant Design classes
      busyStateTimeoutReference.current = setTimeout(() => {
        syncReferenceDataModalBusyState(
          '.reference-data-modal-scaffold-wrapper [role="dialog"]',
          currentIsRefreshing
        );
        busyStateTimeoutReference.current = null;
      }, 0);
    }

    previousIsRefreshingReference.current = currentIsRefreshing;

    // Cleanup: clear the timeout if it is still pending on unmount
    return () => {
      if (busyStateTimeoutReference.current !== null) {
        clearTimeout(busyStateTimeoutReference.current);
        busyStateTimeoutReference.current = null;
      }
    };
  }, [properties.isRefreshing, properties.open]);

  // Build the blocking body (initial load or error)
  // Note: Explicit null check ensures empty string loadError is treated as an error
  let blockingBody: React.ReactNode;
  if (properties.isInitialLoading) {
    blockingBody = cloneElement(properties.loadingState, {
      role: 'status',
      'aria-live': 'polite',
    });
  } else if (properties.loadError === null) {
    blockingBody = null;
  } else {
    blockingBody = <Alert description={properties.loadError} showIcon type="error" />;
  }

  return (
    <Modal
      open={properties.open}
      title={properties.modalTitle}
      onCancel={properties.onClose}
      mask={{ closable: true }}
      className="reference-data-modal-scaffold-dialog"
      classNames={{
        wrapper: `${properties.modalClassName} reference-data-modal-scaffold-wrapper`,
      }}
      footer={<Button onClick={properties.onClose}>Cancel</Button>}
      width={properties.modalWidth}
    >
      {blockingBody ?? (
        !properties.isInitialLoading &&
        properties.loadError === null && (
          <Flex vertical align="start" gap={12} style={{ width: '100%' }}>
            {properties.isRefreshing && (
              <div aria-live="polite" role="status">
                <Text type="secondary">{properties.refreshStatusCopy}</Text>
              </div>
            )}
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
            {properties.inlineAlert}
            <Table<T>
              aria-label={properties.tableAriaLabel}
              dataSource={properties.rows}
              columns={properties.columns}
              rowKey="key"
              pagination={false}
              locale={{ emptyText: properties.emptyTableCopy }}
              style={{ width: '100%' }}
            />
          </Flex>
        )
      )}
      {properties.inlineDialog}
    </Modal>
  );
}
