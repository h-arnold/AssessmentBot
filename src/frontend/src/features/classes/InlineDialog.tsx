/**
 * Shared inline-dialog component for the Manage Cohorts and Manage Year Groups
 * modal workflows.
 *
 * Extracted here to avoid duplicating identical markup across both modal modules.
 * Keep this file local to the classes feature.
 *
 * Uses a native div with role="dialog" so tests can locate it by role and name
 * without relying on portal-based Ant Design Modal rendering in jsdom.
 */

import { Typography } from 'antd';

/**
 * Renders an inline dialog section with a labelled title.
 *
 * @param {Readonly<{
 *   labelId: string;
 *   title: string;
 *   children: React.ReactNode;
 * }>} properties Component properties.
 * @returns {JSX.Element} The rendered inline dialog.
 */
export function InlineDialog(properties: Readonly<{
  labelId: string;
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={properties.labelId}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: 24,
        marginTop: 16,
        background: '#fff',
      }}
    >
      <Typography.Title level={5} id={properties.labelId} style={{ marginTop: 0 }}>
        {properties.title}
      </Typography.Title>
      {properties.children}
    </div>
  );
}
