import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Paragraph, Title } = Typography;

/**
 * Renders the shared page section chrome for navigation views.
 */
/**
 * Renders the shared page section chrome for navigation views.
 */
type PageSectionProps = Readonly<{
  children?: ReactNode;
  heading: string;
  summary: string;
}>;

/**
 * Shared page section wrapper used across navigation views.
 */
export function PageSection({
  children,
  heading,
  summary,
}: PageSectionProps) {
  return (
    <section className="app-page" aria-label={`${heading} page`}>
      <Space orientation="vertical" size="middle" className="app-page-content">
        <div>
          <Title level={2}>{heading}</Title>
          <Paragraph>{summary}</Paragraph>
        </div>
        {children}
      </Space>
    </section>
  );
}
