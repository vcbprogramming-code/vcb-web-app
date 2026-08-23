import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Confirm.jsx';
import { ThemeProvider } from './theme/ThemeContext.jsx';
import { HeaderSlotProvider } from './components/HeaderSlot.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { LangProvider } from './lib/i18n.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        {/* Outermost of the app providers: every screen can ask for a string,
            and with Thai selected t() hands back exactly what it was given, so
            nothing below this line renders differently than it does today. */}
        <LangProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <HeaderSlotProvider>
                  <App />
                </HeaderSlotProvider>
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        </LangProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
