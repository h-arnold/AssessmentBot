import { fireEvent, render, screen } from '@testing-library/react';
import type { TabsProps } from 'antd';
import { TabbedPageSection } from './TabbedPageSection';

const tabbedPageSectionTabs = [
  {
    key: 'overview',
    label: 'Overview',
    children: <div>Overview panel</div>,
  },
  {
    key: 'advanced',
    label: 'Advanced',
    children: <div>Advanced panel</div>,
  },
] satisfies NonNullable<TabsProps['items']>;

describe('TabbedPageSection', () => {
  it('renders shared page chrome with the supplied default tab content', () => {
    render(
      <TabbedPageSection
        defaultActiveKey="overview"
        heading="Reusable settings"
        summary="Shared tabbed layout summary"
        tabs={tabbedPageSectionTabs}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Reusable settings' })).toBeInTheDocument();
    expect(screen.getByText('Shared tabbed layout summary')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Overview panel')).toBeInTheDocument();
  });

  it('switches panel content when a different tab is selected', () => {
    render(
      <TabbedPageSection
        defaultActiveKey="overview"
        heading="Reusable settings"
        summary="Shared tabbed layout summary"
        tabs={tabbedPageSectionTabs}
      />
    );

    const advancedTab = screen.getByRole('tab', { name: 'Advanced' });

    fireEvent.click(advancedTab);

    expect(advancedTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Advanced panel')).toBeInTheDocument();
  });
});
