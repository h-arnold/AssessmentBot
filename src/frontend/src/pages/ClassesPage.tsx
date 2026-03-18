import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Renders the classes placeholder page.
 *
 * @returns {JSX.Element} The classes page.
 */
export function ClassesPage() {
  return (
    <PageSection
      heading={pageContent.classes.heading}
      summary={pageContent.classes.summary}
    />
  );
}
