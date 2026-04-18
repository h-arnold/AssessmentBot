import { Button, Space, Typography } from 'antd';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

const { Paragraph } = Typography;

/**
 * Renders the assignments placeholder page.
 *
 * @returns {JSX.Element} The assignments page.
 */
export function AssignmentsPage() {
  const startupWarmupState = useStartupWarmupState();
  const assignmentDatasetSnapshot = startupWarmupState.snapshot.datasets.assignmentDefinitionPartials;
  const isAssignmentsDatasetReady = startupWarmupState.isDatasetReady('assignmentDefinitionPartials');
  const isAssignmentsDatasetFailed = startupWarmupState.isDatasetFailed('assignmentDefinitionPartials');
  const isAssignmentsDatasetTrustworthy = assignmentDatasetSnapshot.isTrustworthy;
  const shouldBlockAssignmentsSurface =
    isAssignmentsDatasetFailed || !isAssignmentsDatasetReady || !isAssignmentsDatasetTrustworthy;

  return (
    <PageSection
      heading={pageContent.assignments.heading}
      summary={shouldBlockAssignmentsSurface ? '' : pageContent.assignments.summary}
    >
      {shouldBlockAssignmentsSurface ? (
        <Space orientation="vertical" size="small">
          <Paragraph>Assignment definitions could not be loaded with trustworthy data.</Paragraph>
          <Button type="primary">Retry assignments data</Button>
        </Space>
      ) : null}
    </PageSection>
  );
}
