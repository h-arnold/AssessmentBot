import { AppShell } from './AppShell';
import { AuthStatusCard } from './features/auth/AuthStatusCard';

/**
 * Renders the application shell with the authentication status card.
 */
function App() {
  return (
    <AppShell>
      <AuthStatusCard />
    </AppShell>
  );
}

export default App;
