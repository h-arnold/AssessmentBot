/**
 * ReferenceDataManagementModalScaffold — unit tests.
 *
 * Covers: blocking, ready, empty, refresh, alert-slot, and inline-dialog-slot states.
 * Also covers: caller-supplied configuration preservation, modal-level aria-busy
 * refresh semantics, standard Cancel footer and close wiring, and create-action
 * presentation with test seam.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableColumnType } from 'antd';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ReferenceDataManagementModalScaffold } from './ReferenceDataManagementModalScaffold';

// Test entity type matching T extends { key: string }
type TestEntity = {
  key: string;
  name: string;
};

const testColumns: TableColumnType<TestEntity>[] = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
];

const testRows: TestEntity[] = [
  { key: 'test-1', name: 'Test Item 1' },
  { key: 'test-2', name: 'Test Item 2' },
];

const onCloseMock = vi.fn();
const onCreateMock = vi.fn();

const emptyTableCopy = 'No items';
const refreshStatusCopy = 'Refreshing...';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReferenceDataManagementModalScaffold', () => {
  describe('blocking state', () => {
    it('renders a blocking skeleton when isInitialLoading is true', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={true}
          isRefreshing={false}
          loadError={null}
          loadingState={<div aria-label="Loading items">Loading...</div>}
          rows={[]}
          columns={[]}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('status', { name: 'Loading items' })).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /create item/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /test items/i })).not.toBeInTheDocument();
    });

    it('renders a blocking Alert when loadError is present and not initial loading', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError="Failed to load"
          loadingState={<div>Loading...</div>}
          rows={[]}
          columns={[]}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Failed to load');
      expect(within(dialog).queryByRole('button', { name: /create item/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /test items/i })).not.toBeInTheDocument();
    });
  });

  describe('ready state', () => {
    it('renders the create action button with label in ready state', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('button', { name: 'Create item' })).toBeInTheDocument();
    });

    it('exposes data-testid="reference-data-create-action-icon" on the create action icon', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByTestId('reference-data-create-action-icon')).toBeInTheDocument();
    });

    it('renders the table with data in ready state', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      const table = await within(dialog).findByRole('table', { name: /test items/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Test Item 1')).toBeInTheDocument();
      expect(within(table).getByText('Test Item 2')).toBeInTheDocument();
    });

    it('renders empty table copy when no rows are present', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={[]}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByText(emptyTableCopy)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Create item' })).toBeInTheDocument();
    });
  });

  describe('refresh state', () => {
    it('keeps the ready body visible during background refresh', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={true}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('button', { name: 'Create item' })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /test items/i })).toBeInTheDocument();
      expect(within(dialog).getByText(refreshStatusCopy)).toBeInTheDocument();
    });

    it('applies aria-busy to the modal dialog during refresh', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={true}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      // The scaffold should apply aria-busy via syncReferenceDataModalBusyState
      // Using setTimeout in useEffect to defer DOM query for HappyDOM compatibility
      await waitFor(() => {
        expect(dialog).toHaveAttribute('aria-busy', 'true');
      });
    });
  });

  describe('caller-supplied configuration preservation', () => {
    it('preserves caller-supplied modal width', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={1000}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      // Ant Design Modal applies width inline style to the modal content wrapper
      // We verify the modal is rendered with the specified width
      // Using getAttribute instead of toHaveStyle to avoid HappyDOM limitations
      const style = dialog.getAttribute('style');
      expect(style?.toLowerCase()).toMatch(/width:\s*1000px/);
    });

    it('preserves caller-supplied modal class name', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="custom-modal-class"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      // The caller-supplied className should be present on the modal
      const modalContainer = screen.getByRole('dialog', { name: 'Test Modal' }).parentElement;
      expect(modalContainer).toHaveClass('custom-modal-class');
    });

    it('preserves caller-supplied empty table copy', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy="Custom empty message"
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={[]}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByText('Custom empty message')).toBeInTheDocument();
    });

    it('preserves caller-supplied refresh status copy', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy="Custom refreshing message..."
          isInitialLoading={false}
          isRefreshing={true}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByText('Custom refreshing message...')).toBeInTheDocument();
    });
  });

  describe('standard Cancel footer and close wiring', () => {
    it('renders a standard Cancel footer button', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls onClose when the Cancel footer button is clicked', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close icon is clicked', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      // Ant Design Modal's close icon button
      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('inline alert slot', () => {
    it('renders caller-supplied inline alert below the action row and before the table', async () => {
      const inlineAlert = <div role="alert" aria-live="polite">Test alert content</div>;

      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          inlineAlert={inlineAlert}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByText('Test alert content')).toBeInTheDocument();
      // Alert should appear after the create button and before the table
      const createButton = within(dialog).getByRole('button', { name: 'Create item' });
      const alertElement = within(dialog).getByText('Test alert content');
      const table = within(dialog).getByRole('table', { name: /test items/i });

      // Verify order in DOM
      // Node.DOCUMENT_POSITION_FOLLOWING = 4 (element follows the reference element)
      const DOCUMENT_POSITION_FOLLOWING = 4;
      expect(createButton.compareDocumentPosition(alertElement)).toBe(DOCUMENT_POSITION_FOLLOWING);
      expect(alertElement.compareDocumentPosition(table)).toBe(DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe('inline dialog slot', () => {
    it('renders caller-supplied inline dialog as sibling of modal body', async () => {
      const inlineDialog = (
        <div role="dialog" aria-labelledby="test-dialog-title">
          <h5 id="test-dialog-title">Test Dialog</h5>
          <p>Dialog content</p>
        </div>
      );

      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          inlineDialog={inlineDialog}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(screen.getByRole('dialog', { name: 'Test Dialog' })).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
      // The ready-state body (including create button and table) should still be visible
      expect(within(dialog).getByRole('button', { name: 'Create item' })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /test items/i })).toBeInTheDocument();
    });

    it('keeps ready-state body visible when inline dialog is open', async () => {
      const inlineDialog = (
        <div role="dialog" aria-labelledby="test-dialog-title">
          <h5 id="test-dialog-title">Test Dialog</h5>
        </div>
      );

      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          inlineDialog={inlineDialog}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).getByRole('button', { name: 'Create item' })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /test items/i })).toBeInTheDocument();
    });
  });

  describe('create action', () => {
    it('calls onCreate when the create action button is clicked', async () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create item' }));
      expect(onCreateMock).toHaveBeenCalledTimes(1);
    });

    it('does not call onCreate when create button is clicked during initial loading', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={true}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={true}
          isRefreshing={false}
          loadError={null}
          loadingState={<div aria-label="Loading items">Loading...</div>}
          rows={[]}
          columns={[]}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Modal' });
      expect(within(dialog).queryByRole('button', { name: 'Create item' })).not.toBeInTheDocument();
    });
  });

  describe('modal not open', () => {
    it('does not render the modal when open is false', () => {
      renderWithFrontendProviders(
        <ReferenceDataManagementModalScaffold<TestEntity>
          open={false}
          modalTitle="Test Modal"
          modalClassName="test-modal"
          modalWidth={800}
          createActionLabel="Create item"
          tableAriaLabel="test items"
          emptyTableCopy={emptyTableCopy}
          refreshStatusCopy={refreshStatusCopy}
          isInitialLoading={false}
          isRefreshing={false}
          loadError={null}
          loadingState={<div>Loading...</div>}
          rows={testRows}
          columns={testColumns}
          onClose={onCloseMock}
          onCreate={onCreateMock}
        />
      );

      expect(screen.queryByRole('dialog', { name: 'Test Modal' })).not.toBeInTheDocument();
    });
  });
});
