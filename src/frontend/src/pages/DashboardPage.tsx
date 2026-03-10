import type { ReactNode } from 'react';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the dashboard landing page.
 */
/**
 * Renders the dashboard landing page.
 */
type DashboardPageProps = Readonly<{ contentSlot?: ReactNode }>;

/**
 * Dashboard landing page component.
 */
export function DashboardPage({ contentSlot }: DashboardPageProps) {
  return (
    <PageSection
      heading={pageContent.dashboard.heading}
      summary={pageContent.dashboard.summary}
    >
      {contentSlot}
    </PageSection>
  );
}
