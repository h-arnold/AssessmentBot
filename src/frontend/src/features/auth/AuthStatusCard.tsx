import { Card, Result, Space } from 'antd';
import { APP_SPACE_SIZE_DEFAULT } from '../../theme/spacing';

/**
 * Renders the auth status card content for the authorised surface.
 *
 * Denial messaging is owned by the AppAuthGate warm-up gate; this card only
 * presents the authorised state.
 *
 * @returns {JSX.Element} The auth status card.
 */
export function AuthStatusCard() {
  return (
    <Card className="auth-card">
      <Space orientation="vertical" size={APP_SPACE_SIZE_DEFAULT} className="auth-card-content">
        <Result status="success" title="Authorised" />
      </Space>
    </Card>
  );
}
