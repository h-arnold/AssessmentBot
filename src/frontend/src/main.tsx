import { createRoot } from 'react-dom/client';
import App from './App';
import { StrictMode } from './StrictMode';
import './index.css';
import { AppQueryProvider } from './query/AppQueryProvider';

const rootElement = document.querySelector('#root');
if (!(rootElement instanceof HTMLElement)) {
  throw new TypeError('Root element "#root" was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppQueryProvider>
      <App />
    </AppQueryProvider>
  </StrictMode>
);
