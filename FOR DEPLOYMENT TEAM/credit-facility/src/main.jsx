import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';

import App from './App.jsx';
import { api } from './lib/api.js';
import { dictionary } from './lib/i18n.js';
import './index.css';

// Provider order is fixed by shared/src/index.js: theme touches <html> before
// anything paints, and i18n supplies the strings auth's error messages need —
// so ThemeProvider wraps I18nProvider wraps AuthProvider.
//
// The router sits inside them because route components read all three.
const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={dictionary}>
        {/* AuthProvider must get the SAME api instance lib/api.js uses. Left
            bare it falls back to the shared singleton, and the token then lives
            on an object this module never calls — which works only because both
            read the same localStorage key, and stops working the moment storage
            is blocked (Safari private windows, blocked site data). Every
            request would go out unsigned, at runtime, with no build error. */}
        <AuthProvider api={api}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
