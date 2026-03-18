import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the settings placeholder page.
 *
 * @returns {JSX.Element} The settings page.
 */
export function SettingsPage() {
  return (
    <PageSection
      heading={pageContent.settings.heading}
      summary={pageContent.settings.summary}
    />
  );
}
