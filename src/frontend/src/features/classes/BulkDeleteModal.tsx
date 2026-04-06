/**
 * Bulk delete confirmation modal.
 *
 * Renders an Ant Design Modal that asks the user to confirm a bulk delete
 * operation.  The confirmation copy explicitly names both full and partial
 * records so users understand the full scope of the deletion.
 */

import { Modal } from 'antd';
import type { ClassTableRow } from './bulkCreateFlow';

/** Properties for the BulkDeleteModal component. */
export type BulkDeleteModalProperties = {
  /** Whether the modal is open. */
  open: boolean;
  /** The rows the user has selected for deletion. */
  selectedRows: ClassTableRow[];
  /** Called when the user confirms the deletion. */
  onConfirm: () => void;
  /** Called when the user cancels the operation. */
  onCancel: () => void;
};

/**
 * Renders a confirmation modal for bulk class deletion.
 *
 * The copy explicitly states that both full and partial AssessmentBot records
 * will be removed.  Callers are responsible for performing the actual deletion
 * on confirmation.
 *
 * @param {BulkDeleteModalProperties} properties Modal properties.
 * @returns {JSX.Element} The rendered confirmation modal.
 */
export function BulkDeleteModal({
  open,
  selectedRows,
  onConfirm,
  onCancel,
}: Readonly<BulkDeleteModalProperties>) {
  const count = selectedRows.length;
  const classWord = count === 1 ? 'class' : 'classes';

  return (
    <Modal
      open={open}
      title="Delete classes"
      okText="Delete"
      cancelText="Cancel"
      onOk={onConfirm}
      onCancel={onCancel}
    >
      <p>
        You are about to delete {count} {classWord} from AssessmentBot. This will permanently
        remove all full and partial records associated with the selected{' '}
        {classWord} and cannot be undone.
      </p>
    </Modal>
  );
}
