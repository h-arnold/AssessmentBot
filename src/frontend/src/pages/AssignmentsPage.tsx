import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the assignments placeholder page.
 */
export function AssignmentsPage() {
  return (
    <PageSection
      heading={pageContent.assignments.heading}
      summary={pageContent.assignments.summary}
    />
  );
}
