import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Paragraph, Title } = Typography;

/**
 * Renders the shared page section chrome for navigation views.
 */
export function PageSection({
  children,
  heading,
  summary,
}: {
  children?: ReactNode;
  heading: string;
  summary: string;
}) {
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
