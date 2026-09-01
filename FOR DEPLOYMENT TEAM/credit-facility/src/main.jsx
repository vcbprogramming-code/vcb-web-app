import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';

import App from './App.jsx';
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
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
