import { Button, Flex, Input, Popconfirm, Select, Table, Typography } from 'antd';
import { useState } from 'react';
import { APP_GAP_COMPACT, APP_GAP_MD } from '../../../theme/spacing';
import type { AuthUserEntry, AuthUserRole } from '../../../services/authService/authService.zod';

const { Text } = Typography;

const emptyUserListExplanation =
  'At least one administrator is required. Add an administrator before saving.';

const authUserRoleOptions = [
  { label: 'admin', value: 'admin' },
  { label: 'user', value: 'user' },
] as const;

type AuthenticationSettingsUserTableProperties = Readonly<{
  users: ReadonlyArray<AuthUserEntry>;
  onAddUser: (rawEmail: string, role: AuthUserRole) => void;
  onChangeUserRole: (email: string, role: AuthUserRole) => void;
  onRemoveUser: (email: string) => void;
  isDisabled: boolean;
}>;

/**
 * Renders the Script Properties authorised-user staging region (add row + table).
 *
 * @param {AuthenticationSettingsUserTableProperties} properties User-table region properties.
 * @returns {JSX.Element} The authorised-user table region.
 */
export function AuthenticationSettingsUserTable(
  properties: AuthenticationSettingsUserTableProperties
) {
  const { users, onAddUser, onChangeUserRole, onRemoveUser, isDisabled } = properties;
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AuthUserRole>('user');

  const handleAdd = (): void => {
    onAddUser(newUserEmail, newUserRole);
    setNewUserEmail('');
    setNewUserRole('user');
  };

  return (
    <Flex vertical gap={APP_GAP_MD} style={{ width: '100%' }}>
      <Flex gap={APP_GAP_COMPACT} wrap="wrap">
        <Input
          aria-label="Email"
          disabled={isDisabled}
          placeholder="colleague@example.com"
          type="email"
          value={newUserEmail}
          onChange={(event) => setNewUserEmail(event.target.value)}
          onPressEnter={handleAdd}
          style={{ minWidth: 240 }}
        />
        <Select<AuthUserRole>
          aria-label="New user role"
          disabled={isDisabled}
          options={[...authUserRoleOptions]}
          value={newUserRole}
          onChange={(value) => setNewUserRole(value)}
          style={{ width: 120 }}
        />
        <Button disabled={isDisabled || newUserEmail.trim() === ''} type="primary" onClick={handleAdd}>
          Add
        </Button>
      </Flex>

      <Table<AuthUserEntry>
        dataSource={users}
        locale={{ emptyText: <Text type="secondary">{emptyUserListExplanation}</Text> }}
        pagination={false}
        rowKey="email"
        size="middle"
      >
        <Table.Column<AuthUserEntry>
          dataIndex="email"
          key="email"
          title="Email"
        />
        <Table.Column<AuthUserEntry>
          dataIndex="role"
          key="role"
          title="Role"
          render={(role: AuthUserRole, user: AuthUserEntry) => (
            <Select<AuthUserRole>
              aria-label="Role"
              disabled={isDisabled}
              options={[...authUserRoleOptions]}
              value={role}
              onChange={(value) => onChangeUserRole(user.email, value)}
              style={{ width: 120 }}
            />
          )}
        />
        <Table.Column<AuthUserEntry>
          key="actions"
          title="Actions"
          render={(user: AuthUserEntry) => (
            <Popconfirm
              cancelText="Cancel"
              okText="Confirm removal"
              onConfirm={() => onRemoveUser(user.email)}
              title={`Remove ${user.email} from authorised users?`}
            >
              <Button danger disabled={isDisabled} type="link">
                {`Remove ${user.email}`}
              </Button>
            </Popconfirm>
          )}
        />
      </Table>
    </Flex>
  );
}
