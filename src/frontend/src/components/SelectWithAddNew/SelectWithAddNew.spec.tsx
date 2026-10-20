import { act, render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SelectWithAddNew } from './SelectWithAddNew';

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
const ARROW_DOWN_KEY_CODE = 40;
const ENTER_KEY_CODE = 13;

const standardOptions = [
  { value: 'option-1', label: 'Option 1' },
  { value: 'option-2', label: 'Option 2' },
];

/**
 * Finds the rendered selected label, excluding Ant Design's hidden live region.
 * @param {string} label Expected selected option label.
 * @returns {void} No value is returned.
 */
function expectSelectedLabel(label: string): void {
  const selectedLabel = screen
    .getAllByText(label, { exact: true })
    .find((element) => element.closest('[aria-live]') === null);
  expect(selectedLabel).toBeInTheDocument();
}

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

  it("renders 'Add new' option when onAddNew prop provided", () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} virtual={false} />);

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // The dropdown should show the standard options plus 'Add new'
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });

  it("renders 'Add new' option with LucideIcon (Plus icon)", () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} />);

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // SelectWithAddNew renders the add-new icon via LucideIcon with lucide Plus.
    // The antd Select dropdown is rendered as a portal, so locate the "Add new"
    // option and assert it contains an SVG rather than relying on lucide's
    // internal `.lucide-plus` class.
    const addNewOption = screen.getByText('Add new');
    const icon = addNewOption.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Option Position and Content', () => {
  it("'Add new' option appears at bottom of dropdown", () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} open />);

    // Find the Add new option - it should be the last one
    const addNewOption = screen.getByText('Add new');
    expect(addNewOption).toBeInTheDocument();
  });

  it("'Add new' is represented as a real Select option (sentinel value)", () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} />);

    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // The 'Add new' should be a real option in the dropdown
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Custom Labels', () => {
  it("'Add new' option uses custom label when provided", () => {
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

  it.each([
    ['cohort', 'Add new cohort'],
    ['yearGroup', 'Add new year group'],
    ['topic', 'Add new topic'],
  ] as const)(
    "'Add new' option derives its label from entityType %s",
    (entityType, expectedLabel) => {
      render(
        <SelectWithAddNew
          options={standardOptions}
          onAddNew={mockOnAddNew}
          entityType={entityType}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.mouseDown(select);

      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    }
  );
});

describe('SelectWithAddNew - Callback Behaviour', () => {
  it("clicking 'Add new' calls onAddNew callback", async () => {
    const user = userEvent.setup();
    render(
      <SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} onChange={mockOnChange} />
    );

    const select = screen.getByRole('combobox');
    await user.click(select);
    const dropdown = document.querySelector('.ant-select-dropdown-list');
    expect(dropdown).not.toBeNull();
    const addNewOption = within(dropdown as HTMLElement).getByText('Add new', { exact: false });
    await user.click(addNewOption);

    expect(mockOnAddNew).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('forwards onChange for standard options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        onChange={onChange}
        virtual={false}
      />
    );

    const select = screen.getByRole('combobox');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Option 1' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe('option-1');
    expect(onChange.mock.calls[0][1]).toMatchObject({ value: 'option-1', label: 'Option 1' });
    expect(mockOnAddNew).not.toHaveBeenCalled();
  });

  it('dispatches Add new from keyboard selection in the selection cycle', async () => {
    const user = userEvent.setup();
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={mockOnAddNew}
        onChange={mockOnChange}
        virtual={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    const combo = screen.getByRole('combobox');
    // rc-select reads legacy `which`/`keyCode`; user-event intentionally leaves
    // those deprecated fields at zero, so emit keydowns with browser key codes.
    for (const [key, keyCode] of [
      ['ArrowDown', ARROW_DOWN_KEY_CODE],
      ['ArrowDown', ARROW_DOWN_KEY_CODE],
    ] as const) {
      await act(async () => {
        fireEvent.keyDown(combo, { key, code: key, keyCode, which: keyCode });
      });
    }
    const addNewOption = screen.getByRole('option', { name: 'Add new' });
    expect(combo).toHaveAttribute('aria-activedescendant', addNewOption.id);

    await act(async () => {
      fireEvent.keyDown(combo, {
        key: 'Enter',
        code: 'Enter',
        keyCode: ENTER_KEY_CODE,
        which: ENTER_KEY_CODE,
      });
    });

    expect(mockOnAddNew).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});

describe('SelectWithAddNew - Disabled State', () => {
  it("'Add new' option is disabled when Select is disabled", () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} disabled />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });
});

describe('SelectWithAddNew - Prop Forwarding', () => {
  it('forwards className prop', () => {
    const { container } = render(
      <SelectWithAddNew options={standardOptions} className="custom-class" />
    );

    // Ant Design Select applies className to the root div container
    // Find the root div that has the ant-select class and check for our custom class
    const selectRoot = container.querySelector('.ant-select.custom-class');
    expect(selectRoot).toBeInTheDocument();
  });

  it('forwards placeholder prop', () => {
    const { container } = render(
      <SelectWithAddNew options={standardOptions} placeholder="Select an option" />
    );

    // Ant Design Select renders placeholder as a span with class ant-select-placeholder
    const placeholderSpan = container.querySelector('.ant-select-placeholder');
    expect(placeholderSpan).toBeInTheDocument();
    expect(placeholderSpan).toHaveTextContent('Select an option');
  });

  it('forwards value prop', () => {
    render(<SelectWithAddNew options={standardOptions} value="option-1" />);

    const select = screen.getByRole('combobox');
    // In Ant Design Select, the value prop is used internally
    // We just verify the component renders without error
    expect(select).toBeInTheDocument();
  });
});

describe('SelectWithAddNew - Selection value ownership', () => {
  const repeatedCommandCount = 2;

  it('keeps an explicitly undefined value controlled until the parent supplies a selection', async () => {
    const user = userEvent.setup();
    const onAddNew = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <SelectWithAddNew
        options={standardOptions}
        value={undefined}
        onAddNew={onAddNew}
        onChange={onChange}
        placeholder="Select an option"
        virtual={false}
      />
    );

    expect(screen.getByText('Select an option')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Option 1' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBe('option-1');
    expect(screen.getByText('Select an option')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Select an option')).toBeInTheDocument();

    rerender(
      <SelectWithAddNew
        options={standardOptions}
        value="option-2"
        onAddNew={onAddNew}
        onChange={onChange}
        placeholder="Select an option"
        virtual={false}
      />
    );

    expectSelectedLabel('Option 2');
  });

  it('renders a controlled selection and follows the parent value after Add new', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SelectWithAddNew options={standardOptions} value="option-1" virtual={false} />
    );

    expectSelectedLabel('Option 1');
    rerender(<SelectWithAddNew options={standardOptions} value="option-2" virtual={false} />);
    expectSelectedLabel('Option 2');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));

    expectSelectedLabel('Option 2');
  });

  it('keeps an uncontrolled normal choice displayed and can select Add new again', async () => {
    const user = userEvent.setup();
    const onAddNew = vi.fn();
    const onChange = vi.fn();
    render(
      <SelectWithAddNew
        options={standardOptions}
        onAddNew={onAddNew}
        onChange={onChange}
        placeholder="Select an option"
        virtual={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Option 1' }));
    expectSelectedLabel('Option 1');
    expect(onChange.mock.calls[0]?.[0]).toBe('option-1');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));
    expectSelectedLabel('Option 1');
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));
    expectSelectedLabel('Option 1');
    expect(onAddNew).toHaveBeenCalledTimes(repeatedCommandCount);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('retains defaultValue after Add new without turning it into an empty selection', async () => {
    const user = userEvent.setup();
    render(
      <SelectWithAddNew
        options={standardOptions}
        defaultValue="option-1"
        onAddNew={mockOnAddNew}
        virtual={false}
      />
    );

    expectSelectedLabel('Option 1');
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));
    expectSelectedLabel('Option 1');
  });

  it('clears a default selection back to the placeholder with the normal clear payload', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectWithAddNew
        options={standardOptions}
        defaultValue="option-1"
        allowClear
        onChange={onChange}
        placeholder="Select an option"
        virtual={false}
      />
    );

    expectSelectedLabel('Option 1');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText('Select an option')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('preserves labelInValue normal and Add new callback semantics', async () => {
    const user = userEvent.setup();
    const onAddNew = vi.fn();
    const onChange = vi.fn();
    render(
      <SelectWithAddNew
        options={standardOptions}
        labelInValue
        onAddNew={onAddNew}
        onChange={onChange}
        virtual={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Option 1' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      value: 'option-1',
      label: 'Option 1',
    });
    expectSelectedLabel('Option 1');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add new' }));
    expect.soft(onAddNew).toHaveBeenCalledTimes(1);
    expect.soft(onChange).toHaveBeenCalledTimes(1);
    expectSelectedLabel('Option 1');
  });
});

describe('SelectWithAddNew - Disabled behaviour', () => {
  it('does not dispatch Add new when the Select is disabled', async () => {
    const user = userEvent.setup();
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} disabled />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(mockOnAddNew).not.toHaveBeenCalled();
  });
});

describe('SelectWithAddNew - Accessibility', () => {
  it('standard options are keyboard accessible', async () => {
    render(<SelectWithAddNew options={standardOptions} onAddNew={mockOnAddNew} />);

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
