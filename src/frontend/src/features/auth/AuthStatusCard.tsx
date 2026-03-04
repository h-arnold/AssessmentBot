import { Card, Result, Space, Spin, Typography } from 'antd';
import { useAuthorisationStatus } from './useAuthorisationStatus';

const { Text } = Typography;

/**
 * Renders the auth status card content for loading and resolved states.
 */
export function AuthStatusCard() {
  const { authViewState, authError } = useAuthorisationStatus();
  const isLoading = authViewState === 'loading';
  const isAuthorised = authViewState === 'authorised';

  return (
    <Card className="auth-card">
      <Space orientation="vertical" size="middle" className="auth-card-content">
        {isLoading ? (
          <>
            <Spin size="large" />
            <Text>Checking authorisation status...</Text>
          </>
        ) : (
          <Result
            status={isAuthorised ? 'success' : 'error'}
            title={isAuthorised ? 'Authorised' : 'Unauthroised'}
            subTitle={authError ?? undefined}
          />
        )}
      </Space>
    </Card>
  );
}
