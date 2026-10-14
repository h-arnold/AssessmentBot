import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useReferenceDataManagement } from './useReferenceDataManagement';
import type { ReferenceDataManagementConfig } from './useReferenceDataManagement';

type Entity = { key: string; name: string };

/**
 * Creates the reference-data configuration needed to render the management hook.
 *
 * @param {NonNullable<ReferenceDataManagementConfig<Entity>['renderFormDialog']>} renderFormDialog - Custom form-dialog renderer.
 * @param {NonNullable<ReferenceDataManagementConfig<Entity>['renderDeleteDialog']>} renderDeleteDialog - Custom delete-dialog renderer.
 * @returns {ReferenceDataManagementConfig<Entity>} Hook configuration for a cohort entity.
 */
function createConfig(
  renderFormDialog: NonNullable<ReferenceDataManagementConfig<Entity>['renderFormDialog']>,
  renderDeleteDialog: NonNullable<ReferenceDataManagementConfig<Entity>['renderDeleteDialog']>
): ReferenceDataManagementConfig<Entity> {
  return {
    entityLabel: 'cohort',
    entityKey: 'cohorts',
    queryOptions: { queryKey: ['cohorts'], queryFn: () => Promise.resolve([]) },
    createService: () => Promise.resolve(),
    updateService: () => Promise.resolve(),
    deleteService: () => Promise.resolve(),
    supportsToggleActive: false,
    formValidationMessage: 'Enter a name',
    loadFailureCopy: 'Unable to load cohorts',
    refreshStatusCopy: 'Refreshing cohorts',
    formDialogLabelId: 'form-label',
    deleteDialogLabelId: 'delete-label',
    deleteDialogTitle: 'Delete cohort',
    renderFormDialog,
    renderDeleteDialog,
  };
}

/**
 * Renders the reference-data management hook with its required query client.
 *
 * @param {ReferenceDataManagementConfig<Entity>} config - Configuration supplied to the management hook.
 * @returns {ReturnType<typeof renderHook>} The rendered hook result and Testing Library utilities.
 */
function renderManagementHook(config: ReferenceDataManagementConfig<Entity>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useReferenceDataManagement(config), {
    wrapper: ({ children }) => {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    },
  });
}

describe('useReferenceDataManagement inline dialog precedence', () => {
  it('does not invoke or propagate errors from the delete renderer when the form renderer returns a dialog', () => {
    const formDialog = <div />;
    const renderFormDialog = vi.fn(() => formDialog);
    const renderDeleteDialog = vi.fn(() => {
      throw new Error('delete renderer should be skipped');
    });

    const { result } = renderManagementHook(
      createConfig(renderFormDialog, renderDeleteDialog)
    );

    expect(result.current.inlineDialog).toBe(formDialog);
    expect(renderFormDialog).toHaveBeenCalledTimes(1);
    expect(renderDeleteDialog).not.toHaveBeenCalled();
  });

  it('invokes the delete renderer when the form renderer returns null and returns its dialog', () => {
    const deleteDialog = <div />;
    const renderFormDialog = vi.fn(() => null);
    const renderDeleteDialog = vi.fn(() => deleteDialog);

    const { result } = renderManagementHook(
      createConfig(renderFormDialog, renderDeleteDialog)
    );

    expect(result.current.inlineDialog).toBe(deleteDialog);
    expect(renderFormDialog).toHaveBeenCalledTimes(1);
    expect(renderDeleteDialog).toHaveBeenCalledTimes(1);
  });
});
