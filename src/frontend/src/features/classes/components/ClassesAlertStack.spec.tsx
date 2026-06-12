import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClassesAlertStack } from './ClassesAlertStack';

const alertCountAllVariants = 3;

describe('ClassesAlertStack', () => {
  it('renders nothing when no alerts are provided', () => {
    const { container } = render(
      <ClassesAlertStack
        blockingErrorMessage={null}
        nonBlockingWarningMessage={null}
        refreshRequiredMessage={null}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders blocking, warning, and refresh alerts in order', () => {
    render(
      <ClassesAlertStack
        blockingErrorMessage="Blocking classes error"
        nonBlockingWarningMessage="Partial refresh warning"
        refreshRequiredMessage="Refresh required after mutation"
      />
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(alertCountAllVariants);
    expect(alerts[0]).toHaveTextContent('Classes feature is unavailable.');
    expect(alerts[1]).toHaveTextContent('Some classes data may be stale.');
    expect(alerts[2]).toHaveTextContent('Update succeeded but refresh is required.');
  });
});
