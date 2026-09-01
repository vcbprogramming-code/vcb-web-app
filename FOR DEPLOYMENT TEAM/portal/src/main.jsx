import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';
import App from './App';
import { dictionary } from './i18n';
import { api } from './lib/portalApi';
import './index.css';

// Provider order is fixed by shared/src/index.js: theme outermost so it touches
// <html> before anything paints, then i18n so the strings auth's error messages
// need are already available, then auth. The router wraps App inside them —
// routing is this module's concern, not the shared foundation's.
//
// AuthProvider is handed the same api instance lib/portalApi.js uses, so the
// token source and the 401 handling it installs apply to every portal call. A
// second createApi() here would leave those calls unsigned.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={dictionary}>
        <AuthProvider api={api}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
