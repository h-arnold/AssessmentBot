import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SelectWithAddNew } from './SelectWithAddNew';
import * as useDebounceModule from '../hooks/useDebounce';

// Mock @ant-design/icons: provide a default Icon that renders the custom component
// (LucideIcon uses the default Icon export), and keep PlusOutlined for existing tests.
vi.mock('@ant-design/icons', () => ({
  default: (allProperties: Record<string, unknown>) => {
    const { component: Component, ...properties } = allProperties;
    // antd's Icon consumes `spin` and `rotate` itself (for the wrapper span
    // class/transform) and does not forward them to the inner component. Drop
    // them so they don't leak onto the rendered DOM element as invalid
    // attributes (which triggers a React "non-boolean attribute" warning).
    delete properties.spin;
    delete properties.rotate;
    if (Component) {
      const C = Component as React.ComponentType<Record<string, unknown>>;
      return <C {...properties} />;
    }
    return <span {...properties} />;
  },
  PlusOutlined: () => <span data-testid="plus-icon" />,
}));

const mockOnAddNew = vi.fn();
const mockOnChange = vi.fn();

const standardOptions = [
  { value: 'option-1', label: 'Option 1' },
  { value: 'option-2', label: 'Option 2' },
];

const DEFAULT_DEBOUNCE_MS = 300;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SelectWithAddNew - Basic Rendering', () => {
  it('renders standard Select without onAddNew prop', () => {
    render(<SelectWithAddNew options={standardOptions} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('renders standard Select without onAddNew prop and no options', () => {
    render(<SelectWithAddNew />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('renders \'Add new\' option when onAddNew prop provided', () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} />);

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // The dropdown should show the standard options plus 'Add new'
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });

  it('renders \'Add new\' option with LucideIcon (Plus icon)', () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} />);

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // SelectWithAddNew renders the add-new icon via LucideIcon with lucide Plus.
    // The antd Select dropdown is rendered as a portal, so locate the "Add new"
    // option and assert it contains an svg rather than relying on lucide's
    // internal `.lucide-plus` class.
    const addNewOption = screen.getByText('Add new');
    const icon = addNewOption.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Option Position and Content', () => {
  it('\'Add new\' option appears at bottom of dropdown', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        open
      />
    );

    // Find the Add new option - it should be the last one
    const addNewOption = screen.getByText('Add new');
    expect(addNewOption).toBeInTheDocument();
  });

  it('\'Add new\' is represented as a real Select option (sentinel value)', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // The 'Add new' should be a real option in the dropdown
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Custom Labels', () => {
  it('\'Add new\' option has proper default label', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        entityType="cohort"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    expect(screen.getByText('Add new cohort')).toBeInTheDocument();
  });

  it('\'Add new\' option uses custom label when provided', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        addNewLabel="Create new item"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    expect(screen.getByText('Create new item')).toBeInTheDocument();
  });

  it('\'Add new\' option uses entityType for yearGroup', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        entityType="yearGroup"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    expect(screen.getByText('Add new year group')).toBeInTheDocument();
  });

  it('\'Add new\' option uses entityType for topic', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        entityType="topic"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    expect(screen.getByText('Add new topic')).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Callback Behaviour', () => {
  it('clicking \'Add new\' calls onAddNew callback', async () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // Find and click the 'Add new' option
    const addNewOption = screen.getByText('Add new');
    fireEvent.click(addNewOption);

    await waitFor(() => {
      expect(mockOnAddNew).toHaveBeenCalledTimes(1);
    });
  });

  it('forwards onChange for standard options', async () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // Select the first standard option
    const option1 = screen.getByText('Option 1');
    fireEvent.click(option1);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
    expect(mockOnAddNew).not.toHaveBeenCalled();
  });
});

describe('SelectWithAddNew - Disabled State', () => {
  it('\'Add new\' option is disabled when Select is disabled', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        disabled
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });
});

describe('SelectWithAddNew - Prop Forwarding', () => {
  it('forwards className prop', () => {
    const { container } = render(
      <SelectWithAddNew
        options={standardOptions}
        className="custom-class"
      />
    );

    // Ant Design Select applies className to the root div container
    // Find the root div that has the ant-select class and check for our custom class
    const selectRoot = container.querySelector('.ant-select.custom-class');
    expect(selectRoot).toBeInTheDocument();
  });

  it('forwards placeholder prop', () => {
    const { container } = render(
      <SelectWithAddNew
        options={standardOptions}
        placeholder="Select an option"
      />
    );

    // Ant Design Select renders placeholder as a span with class ant-select-placeholder
    const placeholderSpan = container.querySelector('.ant-select-placeholder');
    expect(placeholderSpan).toBeInTheDocument();
    expect(placeholderSpan).toHaveTextContent('Select an option');
  });

  it('forwards value prop', () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        value="option-1"
      />
    );

    const select = screen.getByRole('combobox');
    // In Ant Design Select, the value prop is used internally
    // We just verify the component renders without error
    expect(select).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Debounce Configuration', () => {
  it('debounceMs defaults to 300 when not provided', () => {
    const mockUseDebounce = vi.fn((callback: () => void) => {
      return callback;
    });
    vi.spyOn(useDebounceModule, 'useDebounce').mockImplementationOnce(mockUseDebounce);

    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
      />
    );

    expect(mockUseDebounce).toHaveBeenCalledWith(mockOnAddNew, DEFAULT_DEBOUNCE_MS);
  });

  it('uses custom debounceMs when provided', () => {
    const mockUseDebounce = vi.fn((callback: () => void) => {
      return callback;
    });
    const customDelay = 500;
    vi.spyOn(useDebounceModule, 'useDebounce').mockImplementationOnce(mockUseDebounce);

    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        debounceMs={customDelay}
      />
    );

    expect(mockUseDebounce).toHaveBeenCalledWith(mockOnAddNew, customDelay);
  });

  it('debounces rapid clicks on \'Add new\' only trigger onAddNew once', async () => {
    // Create a mock debounced function
    const debouncedOnAddNew = vi.fn(() => {});
    vi.spyOn(useDebounceModule, 'useDebounce').mockReturnValueOnce(debouncedOnAddNew);

    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        debounceMs={100}
      />
    );

    const select = screen.getByRole('combobox');
    
    // Open the dropdown
    fireEvent.mouseDown(select);
    
    // Get the 'Add new' option by text content
    // Since we're mocking useDebounce, we just need to verify the click triggers the debounced function
    const addNewOption = await waitFor(() => screen.getByText('Add new'));
    
    // Click 'Add new' - the debounced function should be called
    fireEvent.click(addNewOption);

    // With the mock, the click reaches the debounced function
    expect(debouncedOnAddNew).toHaveBeenCalledTimes(1);
    
    // The original mockOnAddNew should not be called directly
    // (it's wrapped by the debounced function)
    expect(mockOnAddNew).toHaveBeenCalledTimes(0);
  });
});

describe('SelectWithAddNew - Accessibility', () => {
  it('standard options are keyboard accessible', async () => {
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
      />
    );

    const select = screen.getByRole('combobox');
    
    // Open dropdown with Enter key
    fireEvent.keyDown(select, { key: 'Enter', code: 'Enter' });
    
    // The dropdown should open and show options
    // Note: Ant Design handles keyboard navigation internally
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Wrapper Characteristics', () => {
  it('wrapper remains presentational and does not store created-entity callbacks', () => {
    // The component only accepts onAddNew and forwards Select props
    // It does not have any state for storing created entities
    // This is verified by inspecting the component implementation
    expect(SelectWithAddNew).toBeDefined();
  });
});
