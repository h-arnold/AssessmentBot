import { AssignmentsManagementSurface } from '../features/assignments/AssignmentsManagementSurface';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the assignments management page.
 *
 * @returns {JSX.Element} Assignments page content.
 */
export function AssignmentsPage() {
  return (
    <PageSection
      heading={pageContent.assignments.heading}
      summary={pageContent.assignments.summary}
    >
      <AssignmentsManagementSurface />
    </PageSection>
  );
}
