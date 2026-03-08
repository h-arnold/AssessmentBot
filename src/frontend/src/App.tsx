import { AppThemeShell } from './AppThemeShell';
import { AuthStatusCard } from './features/auth/AuthStatusCard';

/**
 * Renders the application shell with the authentication status card.
 */
function App() {
  return <AppThemeShell dashboardContent={<AuthStatusCard />} />;
}

export default App;
