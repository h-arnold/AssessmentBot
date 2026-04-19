import { Modal } from 'antd';
import type { ClassesManagementRow } from './classesManagementViewModel';

export type BulkDeleteModalProperties = {
  open: boolean;
  selectedRows: ClassesManagementRow[];
  onConfirm: () => void;
  onCancel: () => void;
  confirmLoading?: boolean;
};

/**
 * Confirmation modal for bulk class deletion.
 *
 * @param {Readonly<BulkDeleteModalProperties>} properties Modal properties.
 * @returns {JSX.Element} Confirmation modal.
 */
export function BulkDeleteModal(properties: Readonly<BulkDeleteModalProperties>) {
  const { open, selectedRows, onConfirm, onCancel, confirmLoading } = properties;
  const count = selectedRows.length;
  const classWord = count === 1 ? 'class' : 'classes';

  return (
    <Modal
      open={open}
      title="Delete classes"
      okText="Delete"
      cancelText="Cancel"
      confirmLoading={confirmLoading}
      onOk={onConfirm}
      onCancel={onCancel}
      cancelButtonProps={{ disabled: confirmLoading }}
    >
      <p>
        You are about to delete {count} {classWord} from AssessmentBot. This will permanently
        remove all full and partial records associated with the selected {classWord} and cannot be undone.
      </p>
    </Modal>
  );
}
