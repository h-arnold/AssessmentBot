import type { ReactNode } from 'react';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the dashboard landing page.
 */
/**
 * Renders the dashboard landing page.
 */
type DashboardPageProperties = Readonly<{ contentSlot?: ReactNode }>;

/**
 * Dashboard landing page component.
 *
 * @param {DashboardPageProperties} properties Dashboard page properties.
 * @returns {JSX.Element} The dashboard page.
 */
export function DashboardPage(properties: DashboardPageProperties) {
  const { contentSlot } = properties;
  return (
    <PageSection
      heading={pageContent.dashboard.heading}
      summary={pageContent.dashboard.summary}
    >
      {contentSlot}
    </PageSection>
  );
}
