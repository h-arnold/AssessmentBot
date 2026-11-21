import { Flex } from 'antd';
import { APP_GAP_COMPACT } from '@/theme/spacing';
import { getClassesWorkflowBusyState } from '../components/classesManagementWorkflowBoundary';
import type { ClassesManagementWorkflowContentProperties } from '../classesManagementViewModel';
import { ClassesSummaryCard } from '../components/ClassesSummaryCard';
import { ClassesTable } from '../table/ClassesTable';
import { ClassesToolbar } from '../table/ClassesToolbar';
import { BulkCreateModal } from '../bulk/BulkCreateModal';
import { BulkDeleteModal } from '../bulk/BulkDeleteModal';
import { BulkSetCourseLengthModal } from '../bulk/BulkSetCourseLengthModal';
import { BulkSetSelectModal } from '../bulk/BulkSetSelectModal';
import { ManageCohortsModal } from '@/features/referenceData/ManageCohortsModal/ManageCohortsModal';
import { ManageYearGroupsModal } from '@/features/referenceData/ManageYearGroupsModal';
import { ClassesBulkProgressModal } from '../bulk/ClassesBulkProgressModal';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the classes workflow: summary card, toolbar, table and all workflow modals.
 *
 * Presentational only — all state and mutation handlers are owned by the panel
 * shell and supplied through typed view-model objects. The stale-data guard and
 * the `aria-busy` / `aria-label` behaviour stay with the workflow region.
 *
 * @param {Readonly<ClassesManagementWorkflowContentProperties>} properties Workflow view inputs.
 * @returns {JSX.Element | null} Workflow content, or null while stale rows are suppressed.
 */
export function ClassesManagementWorkflowContent(
  properties: Readonly<ClassesManagementWorkflowContentProperties>
) {
  const { data, busy, surfaces, progress, actions } = properties;

  if (properties.shouldSuppressStaleTableData) {
    return null;
  }

  return (
    <Flex vertical gap={APP_GAP_COMPACT}>
      <section
        aria-label="Classes data workflow"
        aria-busy={getClassesWorkflowBusyState(busy.isRefreshing)}
      >
        <Flex vertical gap={APP_GAP_COMPACT}>
          <ClassesSummaryCard rows={data.rows} selectedCount={data.selectedRowKeys.length} />
          <ClassesToolbar
            selectedRows={data.selectedRows}
            onBulkCreate={() => surfaces.create.setOpen(true)}
            onBulkDelete={() => surfaces.delete.setOpen(true)}
            onSetActive={actions.onSetActive}
            onSetInactive={actions.onSetInactive}
            onSetCohort={() => surfaces.setCohort.setOpen(true)}
            onSetYearGroup={() => surfaces.setYearGroup.setOpen(true)}
            onSetCourseLength={() => surfaces.setCourseLength.setOpen(true)}
            onManageCohorts={() => surfaces.manageCohorts.setOpen(true)}
            onManageYearGroups={() => surfaces.manageYearGroups.setOpen(true)}
            mutationInFlight={busy.isMutationBoundaryActive}
            setActiveLoading={busy.setActiveSubmitting}
            setInactiveLoading={busy.setInactiveSubmitting}
          />
          <ClassesTable
            rows={data.rows}
            selectedRowKeys={data.selectedRowKeys}
            onSelectedRowKeysChange={data.onSelectedRowKeysChange}
            selectionFrozen={busy.isMutationBoundaryActive}
          />
        </Flex>
      </section>
      <BulkCreateModal
        open={surfaces.create.isOpen}
        cohortOptions={data.cohortOptions}
        yearGroupOptions={data.yearGroupOptions}
        confirmLoading={busy.createSubmitting}
        onConfirm={actions.onBulkCreate}
        onCancel={() => surfaces.create.setOpen(false)}
        onCohortAddNew={actions.onCohortAddNew}
        onYearGroupAddNew={actions.onYearGroupAddNew}
        pendingCreatedCohortKey={data.pendingCreatedCohortKey}
        pendingCreatedYearGroupKey={data.pendingCreatedYearGroupKey}
      />
      <BulkDeleteModal
        open={surfaces.delete.isOpen}
        selectedRows={data.selectedRows}
        onConfirm={actions.onBulkDelete}
        onCancel={() => surfaces.delete.setOpen(false)}
        confirmLoading={busy.deleteSubmitting}
      />
      <BulkSetSelectModal
        open={surfaces.setCohort.isOpen}
        title="Set cohort"
        fieldLabel="Cohort"
        options={data.cohortOptions}
        confirmLoading={false}
        onConfirm={actions.onSetCohort}
        onCancel={() => surfaces.setCohort.setOpen(false)}
        onAddNew={actions.onCohortAddNew}
        pendingCreatedKey={data.pendingCreatedCohortKey}
      />
      <BulkSetSelectModal
        open={surfaces.setYearGroup.isOpen}
        title="Set year group"
        fieldLabel="Year group"
        options={data.yearGroupOptions}
        confirmLoading={false}
        onConfirm={actions.onSetYearGroup}
        onCancel={() => surfaces.setYearGroup.setOpen(false)}
        onAddNew={actions.onYearGroupAddNew}
        pendingCreatedKey={data.pendingCreatedYearGroupKey}
      />
      <BulkSetCourseLengthModal
        open={surfaces.setCourseLength.isOpen}
        confirmLoading={false}
        onConfirm={actions.onSetCourseLength}
        onCancel={() => surfaces.setCourseLength.setOpen(false)}
      />
      <ManageCohortsModal
        open={surfaces.manageCohorts.isOpen}
        onClose={() => surfaces.manageCohorts.setOpen(false)}
        onEntityCreated={actions.onCohortEntityCreated}
      />
      <ManageYearGroupsModal
        open={surfaces.manageYearGroups.isOpen}
        onClose={() => surfaces.manageYearGroups.setOpen(false)}
        onEntityCreated={actions.onYearGroupEntityCreated}
      />
      <ClassesBulkProgressModal
        open={progress.isProgressModalOpen}
        progress={progress.progress}
        verb={progress.verb}
        onCancel={progress.onCancelQueue}
        onDismiss={progress.onDismissProgressModal}
      />
    </Flex>
  );
}
