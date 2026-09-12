import { Alert, Button, Card, Flex, Form, Input, Modal, Select, Skeleton, Typography } from 'antd';
import { useMemo, type ReactElement } from 'react';
import { APP_GAP_LG } from '../../../theme/spacing';
import { useAuthenticationSettings } from './useAuthenticationSettings';
import type { AuthMode } from './useAuthenticationSettings.helpers';
import { AuthenticationSettingsUserTable } from './AuthenticationSettingsUserTable';
import type {
  AuthUserEntry,
  AuthUserRole,
} from '../../../services/authService/authService.zod';

const { Text, Title } = Typography;

const authenticationSettingsRefreshStatusCopy = 'Refreshing authentication settings...';
const membershipNoteCopy =
  'Membership is managed in Google Groups; the app-managed user list does not apply.';
const authenticationProviderCardTitle = 'Authentication provider';

const authModeOptions = [
  { label: 'Google Groups', value: 'googleGroups' },
  { label: 'Script Properties', value: 'scriptProperties' },
] as const;

/**
 * Resolves the mode-switch modal consequence copy for the target mode.
 *
 * @param {AuthMode} targetMode The mode being switched to.
 * @returns {string} The consequence copy shown in the confirmation modal.
 */
function getModeSwitchConsequenceCopy(targetMode: AuthMode): string {
  if (targetMode === 'scriptProperties') {
    return 'Access will be verified against the authorised user list below; your admin access must be present in that list or the save will be rejected.';
  }

  return 'Access will be verified against membership of the Google Group; your admin status must come from a fresh group role lookup or the save will be rejected.';
}

/**
 * Resolves the helper sentence for the selected authentication mode, shown beneath the mode
 * `Form.Item` per the Authentication settings layout contract.
 *
 * @param {AuthMode} authMode The currently selected authentication mode.
 * @returns {string} The mode helper sentence.
 */
function getAuthenticationModeHelperCopy(authMode: AuthMode): string {
  if (authMode === 'googleGroups') {
    return 'Access is verified against Google Group membership.';
  }

  return 'Access is verified against the saved user list with roles.';
}

/**
 * Renders the admin-only Authentication settings tab content.
 *
 * @remarks
 * The tab owns its staged state through `useAuthenticationSettings` and renders the
 * single-Form/single-submit layout required by the settings layout contract: a status stack
 * sits outside the `Form`, the `Form` wraps the provider card and the Save `Form.Item`, and
 * the mode-switch confirmation is a separate `Modal` that never reaches the backend on its own.
 * Load failure renders a blocking `Card`/`Alert` with no interactive controls.
 *
 * @returns {JSX.Element} The Authentication settings tab panel.
 */
export function AuthenticationSettingsTab() {
  const {
    isInitialLoading,
    isRefreshing,
    loadError,
    stagedAuthMode,
    authGroupEmail,
    authUsers,
    isSaving,
    staleRevisionWarning,
    saveError,
    pendingModeSwitch,
    addUser,
    changeUserRole,
    removeUser,
    setAuthGroupEmail,
    requestModeSwitch,
    confirmModeSwitch,
    cancelModeSwitch,
    save,
  } = useAuthenticationSettings();

  const handleFinish = (): void => {
    void save();
  };

  const modeSwitchConsequenceCopy = useMemo(
    () => (pendingModeSwitch === null ? '' : getModeSwitchConsequenceCopy(pendingModeSwitch)),
    [pendingModeSwitch]
  );

  if (loadError !== null) {
    return (
      <Card
        className="settings-tab-panel settings-tab-panel--authentication"
        role="region"
        aria-label="Authentication settings panel"
      >
        <Alert title={loadError} showIcon type="error" />
      </Card>
    );
  }

  // Gate ready-state content on the seeded mode: until the query seed has populated the
  // staged state, the Select would transiently render the wrong region, so keep the
  // skeleton visible instead. The explicit null check narrows `stagedAuthMode` to a
  // concrete `AuthMode` for the ready-state content below.
  if (isInitialLoading || stagedAuthMode === null) {
    return (
      <Card
        className="settings-tab-panel settings-tab-panel--authentication"
        role="region"
        aria-label="Authentication settings panel"
      >
        <div aria-label="Loading authentication settings" role="status">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </Card>
    );
  }

  const authenticationModeHelperCopy = getAuthenticationModeHelperCopy(stagedAuthMode);

  return (
    <Card
      className="settings-tab-panel settings-tab-panel--authentication"
      role="region"
      aria-label="Authentication settings panel"
      aria-busy={isRefreshing ? 'true' : undefined}
    >
      <Flex vertical gap={APP_GAP_LG} style={{ width: '100%' }}>
        <AuthenticationStatusStack
          isRefreshing={isRefreshing}
          refreshCopy={authenticationSettingsRefreshStatusCopy}
          staleRevisionWarning={staleRevisionWarning}
          saveError={saveError}
        />

        <Form layout="vertical" onFinish={handleFinish}>
          <Card
            title={
              <Title level={3} style={{ margin: 0 }}>
                {authenticationProviderCardTitle}
              </Title>
            }
          >
            <Flex vertical gap={APP_GAP_LG} style={{ width: '100%' }}>
              <Form.Item
                extra={authenticationModeHelperCopy}
                label="Authentication mode"
              >
                <Select<AuthMode>
                  aria-label="Authentication mode"
                  disabled={isSaving}
                  options={[...authModeOptions]}
                  value={stagedAuthMode}
                  onChange={(value) => requestModeSwitch(value)}
                />
              </Form.Item>

              <AuthenticationProviderRegions
                authMode={stagedAuthMode}
                authGroupEmail={authGroupEmail}
                authUsers={authUsers}
                isSaving={isSaving}
                addUser={addUser}
                changeUserRole={changeUserRole}
                removeUser={removeUser}
                setAuthGroupEmail={setAuthGroupEmail}
              />
            </Flex>
          </Card>

          <Form.Item>
            <Button
              disabled={isSaving}
              htmlType="submit"
              loading={isSaving}
              type="primary"
            >
              Save
            </Button>
          </Form.Item>
        </Form>
      </Flex>

      <AuthenticationModeSwitchModal
        pendingModeSwitch={pendingModeSwitch}
        confirmModeSwitch={confirmModeSwitch}
        cancelModeSwitch={cancelModeSwitch}
        consequenceCopy={modeSwitchConsequenceCopy}
      />
    </Card>
  );
}

type AuthenticationModeSwitchModalProperties = Readonly<{
  pendingModeSwitch: AuthMode | null;
  confirmModeSwitch: () => void;
  cancelModeSwitch: () => void;
  consequenceCopy: string;
}>;

/**
 * Renders the mode-switch confirmation modal for a pending authentication-mode change.
 *
 * @param {AuthenticationModeSwitchModalProperties} properties Mode-switch modal properties.
 * @returns {ReactElement | null} The confirmation modal, or null when no switch is pending.
 */
function AuthenticationModeSwitchModal(
  properties: AuthenticationModeSwitchModalProperties
): ReactElement | null {
  if (properties.pendingModeSwitch === null) {
    return null;
  }

  return (
    <Modal
      cancelButtonProps={{ autoFocus: true }}
      cancelText="Cancel"
      okText="Confirm switch"
      open
      title="Change authentication mode?"
      onCancel={properties.cancelModeSwitch}
      onOk={properties.confirmModeSwitch}
    >
      <Text>{properties.consequenceCopy}</Text>
    </Modal>
  );
}

type AuthenticationStatusStackProperties = Readonly<{
  isRefreshing: boolean;
  refreshCopy: string;
  staleRevisionWarning: string | null;
  saveError: string | null;
}>;

/**
 * Renders the authentication settings status stack: an inline refresh indicator and any
 * persistent stale-revision or save-error alerts.
 *
 * @param {AuthenticationStatusStackProperties} properties Status-stack properties.
 * @returns {ReactElement} The status stack nodes.
 */
function AuthenticationStatusStack(
  properties: AuthenticationStatusStackProperties
): ReactElement {
  return (
    <>
      {properties.isRefreshing ? (
        <output>
          <Text type="secondary">{properties.refreshCopy}</Text>
        </output>
      ) : null}
      {properties.staleRevisionWarning === null ? null : (
        <Alert title={properties.staleRevisionWarning} showIcon type="warning" />
      )}
      {properties.saveError === null ? null : (
        <Alert title={properties.saveError} showIcon type="error" />
      )}
    </>
  );
}

type AuthenticationProviderRegionsProperties = Readonly<{
  authMode: AuthMode | null;
  authGroupEmail: string;
  authUsers: ReadonlyArray<AuthUserEntry>;
  isSaving: boolean;
  addUser: (rawEmail: string, role: AuthUserRole) => void;
  changeUserRole: (email: string, role: AuthUserRole) => void;
  removeUser: (email: string) => void;
  setAuthGroupEmail: (value: string) => void;
}>;

/**
 * Renders the mode-dependent provider configuration regions: the authorised-user table in
 * Script Properties mode and the group email field plus membership note in Google Groups mode.
 *
 * @param {AuthenticationProviderRegionsProperties} properties Region render properties.
 * @returns {ReactElement | null} The active mode region, or null when the mode is unset.
 */
function AuthenticationProviderRegions(
  properties: AuthenticationProviderRegionsProperties
): ReactElement | null {
  if (properties.authMode === 'scriptProperties') {
    return (
      <AuthenticationSettingsUserTable
        isDisabled={properties.isSaving}
        users={properties.authUsers}
        onAddUser={properties.addUser}
        onChangeUserRole={properties.changeUserRole}
        onRemoveUser={properties.removeUser}
      />
    );
  }

  if (properties.authMode === 'googleGroups') {
    return (
      <>
        <Form.Item extra="Cannot be cleared once set." label="Auth group email">
          <Input
            aria-label="Auth group email"
            disabled={properties.isSaving}
            type="email"
            value={properties.authGroupEmail}
            onChange={(event) => properties.setAuthGroupEmail(event.target.value)}
          />
        </Form.Item>
        <Text type="secondary">{membershipNoteCopy}</Text>
      </>
    );
  }

  return null;
}
