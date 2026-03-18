import { AppThemeShell } from './AppThemeShell';
import { AuthStatusCard } from './features/auth/AuthStatusCard';

/**
 * Renders the application shell with the authentication status card.
 *
 * @returns {JSX.Element} The composed application element.
 */
function App() {
  return <AppThemeShell dashboardContent={<AuthStatusCard />} />;
}

export default App;
