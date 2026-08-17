import { Card, Result, Space } from 'antd';
import { useAuthorisationStatus } from './useAuthorisationStatus';
import { APP_SPACE_SIZE_DEFAULT } from '../../theme/spacing';

/**
 * Renders the auth status card content for resolved states.
 *
 * @returns {JSX.Element} The auth status card.
 */
export function AuthStatusCard() {
  const { isAuthorised } = useAuthorisationStatus();

  return (
    <Card className="auth-card">
      <Space orientation="vertical" size={APP_SPACE_SIZE_DEFAULT} className="auth-card-content">
        <Result
          status={isAuthorised ? 'success' : 'error'}
          title={isAuthorised ? 'Authorised' : 'You do not have access to this application.'}
        />
      </Space>
    </Card>
  );
}
