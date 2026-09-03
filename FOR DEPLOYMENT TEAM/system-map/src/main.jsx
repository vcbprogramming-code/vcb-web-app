import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, ThemeProvider, I18nProvider } from '@vcb/shared';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { dictionary } from './i18n.js';
import './index.css';

// Provider order follows shared/src/index.js: theme outermost so it touches
// <html> before anything paints, then i18n so every string is available to the
// tree below it, then this module's own view store.
//
// AuthProvider is present only so the bar can say who is signed in, which it
// does in every module. It gates nothing here: the provider renders its
// children unconditionally, and its one request (/api/auth/me) fires only when
// a token already exists and is caught if it fails. This module stays a static
// renderer — no role decides what the map shows.
//
// No BrowserRouter either: the app is a single view. Its "screens" (the L0
// overview, the trace overlay, the function registry) are overlays over one
// map, toggled by store state, not addressable routes.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={dictionary}>
        <AuthProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
