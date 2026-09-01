import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';
import App from './App';
import { dictionary } from './i18n';
import { PrefsProvider } from './prefs';
import { HrDataProvider } from './HrData';
import { api } from './lib/hrApi';
import './index.css';

// Provider order is fixed by shared/src/index.js: theme outermost so it touches
// <html> before anything paints, then i18n so the strings auth's error messages
// need are already available, then auth. This module's own providers nest
// inside those — prefs reads i18n, and HrData cannot fetch before auth settles.
//
// AuthProvider is handed the SAME api instance lib/hrApi.js uses, so the token
// source and the 401 handling it installs apply to every HR call. A second
// createApi() here would leave those calls unsigned, and every one of them
// would 401 against an otherwise valid session.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={dictionary}>
        <AuthProvider api={api}>
          <PrefsProvider>
            <HrDataProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </HrDataProvider>
          </PrefsProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
