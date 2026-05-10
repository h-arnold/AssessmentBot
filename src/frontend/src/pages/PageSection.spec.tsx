import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSection } from './PageSection';

describe('PageSection', () => {
  it('applies the optional content class when provided', () => {
    const { container } = render(
      <PageSection
        contentClassName="custom-content"
        heading="Example"
        sectionClassName="custom-section"
        summary="Example summary"
      >
        <div>Example child</div>
      </PageSection>
    );

    expect(container.querySelector('.app-page.custom-section')).toBeInTheDocument();
    expect(container.querySelector('.app-page-content.custom-content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Example' })).toBeInTheDocument();
    expect(screen.getByText('Example child')).toBeInTheDocument();
  });
});
