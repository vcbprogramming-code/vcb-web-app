import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, I18nProvider } from '@vcb/shared';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { dictionary } from './i18n.js';
import './index.css';

// Provider order follows shared/src/index.js: theme outermost so it touches
// <html> before anything paints, then i18n so every string is available to the
// tree below it, then this module's own view store.
//
// AuthProvider is deliberately absent. This module is a static renderer — it
// has no API, no database, and nothing in it is role-gated: every user sees the
// same map, and the only "permissions" anywhere in the source were the
// role="button" ARIA attribute on a clickable span. Wrapping it in
// AuthProvider would add a login wall to a page that has nothing to protect
// and nothing to fetch. Access control, if it is ever wanted, belongs at the
// portal link that opens this module.
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
        <StoreProvider>
          <App />
        </StoreProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
