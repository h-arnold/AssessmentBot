import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Paragraph, Title } = Typography;

/**
 * Renders the shared page section chrome for navigation views.
 */
/**
 * Renders the shared page section chrome for navigation views.
 */
type PageSectionProperties = Readonly<{
  children?: ReactNode;
  contentClassName?: string;
  heading: string;
  sectionClassName?: string;
  summary: string;
}>;

/**
 * Shared page section wrapper used across navigation views.
 *
 * @param {PageSectionProperties} properties Page section properties.
 * @returns {JSX.Element} The page section wrapper.
 */
export function PageSection(properties: PageSectionProperties) {
  const { children, contentClassName, heading, sectionClassName, summary } = properties;
  const pageSectionClassName = sectionClassName === undefined ? 'app-page' : `app-page ${sectionClassName}`;
  const pageContentClassName =
    contentClassName === undefined ? 'app-page-content' : `app-page-content ${contentClassName}`;

  return (
    <section className={pageSectionClassName} aria-label={`${heading} page`}>
      <Space orientation="vertical" size="middle" className={pageContentClassName}>
        <div>
          <Title level={2}>{heading}</Title>
          <Paragraph>{summary}</Paragraph>
        </div>
        {children}
      </Space>
    </section>
  );
}
