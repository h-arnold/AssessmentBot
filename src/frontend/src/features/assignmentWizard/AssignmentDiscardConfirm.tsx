import { Button, Modal, Space, Typography } from 'antd';
import { useCallback, type JSX } from 'react';
import {
  APP_SPACE_SIZE_DEFAULT,
} from '../../theme/spacing';

const { Text } = Typography;

/**
 * Deterministic accessible-name id for the shared discard confirmation.
 *
 * @remarks
 * rc-dialog labels every dialog with the same auto-generated id, so a nested
 * confirmation would otherwise inherit the owning modal's accessible name.
 * Anchoring the confirmation to its own title keeps the two dialogs
 * distinctly labelled for assistive technology.
 */
const DISCARD_CONFIRM_TITLE_ID = 'assignment-discard-confirm-title';

export type AssignmentDiscardConfirmProperties = Readonly<{
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}>;

/**
 * Renders the feature-local dirty-discard confirmation shared by the
 * assignment-definition wizard, the in-modal create review and the
 * stale-recovery review surface.
 *
 * @remarks
 * This narrow extraction owns the nested confirmation copy, footer actions,
 * dismissal wiring and deterministic accessible-name anchoring for its three
 * approved callers only. It must not widen into a generic app-wide
 * confirmation wrapper.
 *
 * @param {AssignmentDiscardConfirmProperties} properties Confirmation visibility and handlers.
 * @returns {JSX.Element} The discard-confirmation dialog.
 */
export function AssignmentDiscardConfirm(
  properties: AssignmentDiscardConfirmProperties
): JSX.Element {
  const { open, onKeepEditing, onDiscard } = properties;

  // Re-anchors the nested discard dialog's accessible name to its own title.
  // rc-dialog labels every dialog with the same auto-generated id, so without
  // this the confirmation would inherit the owning modal's name.
  const labelDiscardDialog = useCallback((node: HTMLDivElement | null): void => {
    node?.setAttribute('aria-labelledby', DISCARD_CONFIRM_TITLE_ID);
  }, []);

  return (
    <Modal
      centered
      destroyOnHidden
      footer={
        <Space size={APP_SPACE_SIZE_DEFAULT}>
          <Button onClick={onKeepEditing}>Keep editing</Button>
          <Button danger onClick={onDiscard} type="primary">
            Discard changes
          </Button>
        </Space>
      }
      keyboard
      onCancel={onKeepEditing}
      open={open}
      panelRef={labelDiscardDialog}
      title={<span id={DISCARD_CONFIRM_TITLE_ID}>Discard changes</span>}
      transitionName=""
    >
      <Text>You have unsaved changes. Discard and close?</Text>
    </Modal>
  );
}
