import { Card, Result, Skeleton, Space } from 'antd';
import { useAuthorisationStatus } from './useAuthorisationStatus';

/**
 * Renders the auth status card content for loading and resolved states.
 *
 * @returns {JSX.Element} The auth status card.
 */
export function AuthStatusCard() {
  const { authViewState, authError } = useAuthorisationStatus();
  const isLoading = authViewState === 'loading';
  const isAuthorised = authViewState === 'authorised';

  if (isLoading) {
    return (
      <Card className="auth-card">
        <output aria-label="Loading authorisation status">
          <Skeleton active avatar={{ shape: 'circle', size: 64 }} paragraph={{ rows: 2 }} title={{ width: '40%' }} />
        </output>
      </Card>
    );
  }

  return (
    <Card className="auth-card">
      <Space orientation="vertical" size="middle" className="auth-card-content">
        <Result
          status={isAuthorised ? 'success' : 'error'}
          title={isAuthorised ? 'Authorised' : 'Unauthorised'}
          subTitle={authError ?? undefined}
        />
      </Space>
    </Card>
  );
}
