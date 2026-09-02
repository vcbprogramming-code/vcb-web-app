// @vcb/shared — the frontend foundation every VCB Connect SPA imports.
//
//   import { AuthProvider, I18nProvider, ThemeProvider, api, useAuth } from '@vcb/shared';
//
// Wrap the app once, outermost first — theme touches <html> before anything
// paints, i18n supplies the strings auth's error messages need:
//
//   <ThemeProvider>
//     <I18nProvider dictionary={moduleDict}>
//       <AuthProvider>
//         <App />
//       </AuthProvider>
//     </I18nProvider>
//   </ThemeProvider>

export {
  api,
  createApi,
  ApiError,
  TOKEN_KEY,
  readStoredToken,
  writeStoredToken,
  clearStoredToken,
} from './api.js';

export { AuthProvider, useAuth, RequireRole } from './auth.jsx';

export {
  I18nProvider,
  useI18n,
  useT,
  createDictionary,
  mergeDictionaries,
  commonDictionary,
  translate,
  LANGS,
  LANG_KEY,
  DEFAULT_LANG,
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS,
} from './i18n.jsx';

export {
  ThemeProvider,
  useTheme,
  applyStoredThemeEarly,
  resolveTheme,
  THEMES,
  THEME_KEY,
  DEFAULT_THEME,
} from './theme.jsx';

