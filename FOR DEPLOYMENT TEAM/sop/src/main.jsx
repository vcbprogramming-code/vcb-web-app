/**
 * Entry point.
 *
 * Provider order is the one documented in shared/src/index.js, outermost
 * first — theme touches <html> before anything paints, and i18n supplies the
 * strings auth's error messages need:
 *
 *   ThemeProvider > I18nProvider > AuthProvider > (router) > StoreProvider
 *
 * StoreProvider is inside AuthProvider because it reads useAuth(), and inside
 * the router because its screens navigate. AuthProvider is handed the same api
 * instance the SOP calls go through, so a 401 on any SOP request clears the
 * session exactly once instead of leaving a dead token in place.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';

import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { sopDict } from './i18n/dict.js';
import { api } from './lib/sopApi.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={sopDict}>
        <AuthProvider api={api}>
          <BrowserRouter>
            <StoreProvider>
              <App />
            </StoreProvider>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
