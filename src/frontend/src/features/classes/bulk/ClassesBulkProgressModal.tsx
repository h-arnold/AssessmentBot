import { Button, Flex, Modal, Progress, Typography } from 'antd';
import type { BatchProgressSnapshot } from './runQueuedBatchMutation';

interface ClassesBulkProgressModalProperties {
  open: boolean;
  progress: BatchProgressSnapshot;
  verb: string;
  onCancel: () => void;
  onDismiss: () => void;
}

const PERCENT_MULTIPLIER = 100;

/**
 * Progress modal for queued bulk class operations.
 *
 * Displays current item text, progress bar, count, and a Cancel button
 * for remaining pending items. The close X and mask click call
 * `onDismiss` without cancelling the queue.
 *
 * @param {Readonly<ClassesBulkProgressModalProperties>} properties - Component properties.
 * @returns {JSX.Element} The progress modal.
 */
export function ClassesBulkProgressModal(properties: Readonly<ClassesBulkProgressModalProperties>) {
  const { open, progress, verb, onCancel, onDismiss } = properties;
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * PERCENT_MULTIPLIER);

  return (
    <Modal
      open={open}
      title="Bulk class update in progress"
      centered
      onCancel={onDismiss}
      footer={
        <Flex justify="flex-end">
          <Button disabled={progress.pendingCount === 0} onClick={onCancel}>
            Cancel remaining
          </Button>
        </Flex>
      }
    >
      <Flex vertical>
        <div aria-live="polite" aria-busy={undefined}>
          <Flex justify="space-between">
            <Typography.Text>
              {verb} class {progress.currentItem?.className ?? ''}
            </Typography.Text>
            <Typography.Text>
              {progress.completed} / {progress.total}
            </Typography.Text>
          </Flex>
        </div>
        <div aria-busy={progress.isInProgress ? 'true' : undefined}>
          <Progress percent={percent} status="active" showInfo={false} />
        </div>
      </Flex>
    </Modal>
  );
}
