import type { ReactNode } from 'react';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the dashboard landing page.
 */
export function DashboardPage({ contentSlot }: { contentSlot?: ReactNode }) {
  return (
    <PageSection
      heading={pageContent.dashboard.heading}
      summary={pageContent.dashboard.summary}
    >
      {contentSlot}
    </PageSection>
  );
}
