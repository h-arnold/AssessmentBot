import { Button, Result } from 'antd';
import type { ApplicationAccessReason } from './ApplicationAccessContext';

const PERMISSIONS_REQUIRED_TITLE = 'Permissions required';
const OAUTH_ERROR_RETRY_LABEL = 'Retry';

const APPLICATION_NOT_CONFIGURED_TITLE = 'Application not configured';
const APPLICATION_NOT_CONFIGURED_SUBTITLE =
  'The application is not yet configured and your identity could not be resolved. ' +
  'Reload the application to retry identity resolution.';
const BROKEN_CONFIGURATION_TITLE = 'Authentication configuration invalid';
const BROKEN_CONFIGURATION_SUBTITLE =
  'The authentication configuration is invalid and must be repaired by a script editor.';
const ACCESS_DENIED_TITLE = 'Access denied';
const ACCESS_DENIED_SUBTITLE = 'You are not authorised to use this application.';

/**
 * Renders the fail-closed "Permissions required" gate surface for an OAuth scope denial.
 *
 * @returns {JSX.Element} The permissions-required result.
 */
export function PermissionsRequiredResult() {
  return <Result status="warning" title={PERMISSIONS_REQUIRED_TITLE} />;
}

/**
 * Renders the OAuth transport-error surface with a retry affordance.
 *
 * @param {Readonly<{ onRetry: () => void; title: string }>} properties Retry callback and message.
 * @returns {JSX.Element} The transport-error result.
 */
export function OAuthTransportErrorResult(properties: Readonly<{ onRetry: () => void; title: string }>) {
  const { onRetry, title } = properties;

  return (
    <Result
      status="warning"
      title={title}
      extra={
        <Button type="primary" onClick={onRetry}>
          {OAUTH_ERROR_RETRY_LABEL}
        </Button>
      }
    />
  );
}

/**
 * Renders the blocking application-access result for a non-`ok` access reason.
 *
 * @param {Readonly<{ reason: 'freshInstall' | 'brokenConfig' | 'denied' }>} properties Blocking reason.
 * @returns {JSX.Element} The blocking access result.
 */
export function ApplicationAccessBlockingResult(
  properties: Readonly<{ reason: Exclude<ApplicationAccessReason, 'ok'> }>
) {
  const { reason } = properties;

  switch (reason) {
    case 'freshInstall': {
      return (
        <Result
          status="warning"
          title={APPLICATION_NOT_CONFIGURED_TITLE}
          subTitle={APPLICATION_NOT_CONFIGURED_SUBTITLE}
        />
      );
    }
    case 'brokenConfig': {
      return (
        <Result
          status="error"
          title={BROKEN_CONFIGURATION_TITLE}
          subTitle={BROKEN_CONFIGURATION_SUBTITLE}
        />
      );
    }
    case 'denied': {
      return (
        <Result
          status="warning"
          title={ACCESS_DENIED_TITLE}
          subTitle={ACCESS_DENIED_SUBTITLE}
        />
      );
    }
  }
}
