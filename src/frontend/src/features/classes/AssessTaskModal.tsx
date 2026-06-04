import { Alert, Button, Empty, Modal, Select, Space, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { getGoogleClassroomAssignments } from '../../services/googleClassroomAssignmentsService';

type Assignment = { assignmentId: string; title: string };

export type AssessTaskModalProperties = Readonly<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}>;

/**
 * Modal for selecting a Google Classroom assignment to assess.
 *
 * Fetches assignments on open and presents a dropdown selection.
 * Start Assessment is a no-op placeholder for future wiring.
 *
 * @param {Readonly<AssessTaskModalProperties>} properties Modal properties.
 * @returns {JSX.Element} The assess task modal.
 */
export function AssessTaskModal(properties: Readonly<AssessTaskModalProperties>) {
  const { open, classId, className, onClose } = properties;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>();
  const [fetchState, setFetchState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!open) return;

    getGoogleClassroomAssignments(classId)
      .then((data) => {
        setAssignments(data);
        setFetchState('ready');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch assignments';
        setErrorMessage(message);
        setFetchState('error');
      });
  }, [open, classId]);

  const isStartDisabled = fetchState !== 'ready' || selectedAssignmentId === undefined;

  const bodyContent = (function renderBody(): React.ReactNode {
    if (fetchState === 'loading') {
      return (
        <div role="status" style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
        </div>
      );
    }
    if (fetchState === 'error') {
      return <Alert type="error" title={errorMessage} />;
    }
    if (assignments.length === 0) {
      return <Empty description="No assignments found for this class" />;
    }
    const selectOptions = assignments.map((assignment) => ({
      value: assignment.assignmentId,
      label: assignment.title,
    }));

    return (
      <Space vertical style={{ width: '100%' }}>
        <Typography.Text>Select assignment</Typography.Text>
        <Select
          placeholder="Select an assignment"
          value={selectedAssignmentId}
          onChange={(value) => {
            setSelectedAssignmentId(value);
          }}
          options={selectOptions}
          style={{ width: '100%' }}
        />
        {selectedAssignmentId && (
          <Typography.Text type="secondary">
            {assignments.find(a => a.assignmentId === selectedAssignmentId)?.title}
          </Typography.Text>
        )}
      </Space>
    );
  })();

  return (
    <Modal
      key={classId}
      title={`Assess Task — ${className}`}
      open={open}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" disabled={isStartDisabled} onClick={() => { /* no-op */ }}>
            Start Assessment
          </Button>
        </>
      }
    >
      {bodyContent}
    </Modal>
  );
}
