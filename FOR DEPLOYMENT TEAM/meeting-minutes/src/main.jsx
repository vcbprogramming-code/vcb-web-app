import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, I18nProvider, ThemeProvider } from '@vcb/shared';
import App from './App';
import { dictionary } from './i18n';
import { MinutesDataProvider } from './MinutesData';
import { api } from './lib/minutesApi';
import './index.css';

// Provider order is fixed by shared/src/index.js: theme outermost so it touches
// <html> before anything paints, then i18n so the strings auth's error messages
// need are already available, then auth. This module's own provider nests
// inside those — MinutesData refetches whenever identity changes, because a
// LOCKED project is absent from an anonymous response and a HIDDEN meeting is
// absent from a non-editor's, so it cannot load before auth has settled.
//
// AuthProvider is handed the SAME api instance lib/minutesApi.js uses, so the
// token source and the 401 handling it installs apply to every minutes call. A
// second createApi() here would leave those calls unsigned, and every one of
// them would 401 against an otherwise valid session — a failure that shows up
// only at runtime.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider dictionary={dictionary}>
        <AuthProvider api={api}>
          <MinutesDataProvider>
            <BrowserRouter>
              {/*
                Reading is anonymous by design — this app was deployed
                ANYONE_ANONYMOUS and a visitor with no session is a normal,
                expected caller. So there is no RequireRole around these routes
                and there must not be one: a sign-in wall here would be a
                regression, and the API already filters every response by tier.

                The URL is the source of truth for what is selected, which is
                what makes the back button and a reload work. Legacy
                ?meeting= / ?project= links are redirected onto these routes in
                App.jsx.
              */}
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/p/:projectId" element={<App />} />
                <Route path="/m/:meetingId" element={<App />} />
                <Route path="/timeline" element={<App />} />
                {/* Anything else is a mistyped or stale link, not an error
                    worth a page of its own. */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </MinutesDataProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
