// Light / dark / auto, for all seven SPAs.
//
// ---------------------------------------------------------------------------
// This replaces four different selectors and five storage keys.
// ---------------------------------------------------------------------------
// What the modules did before the port:
//
//   hr-worklog       document.body.classList.toggle('dark')     key: hr_theme
//   portal           <html data-theme="dark|light">             key: (data-theme)
//   sop              <html class="theme-dark">                  key: sop-night
//   meeting-minutes  <html class="dark">                        key: vcb_mm_theme
//   credit-facility  <html class="dark">                        key: vcb-dark
//
// Four selectors meant a component lifted from one module rendered unstyled in
// another, and five keys meant switching to dark in one app left the rest
// bright — which is exactly what blocks "one website". The single convention
// from here on:
//
//   selector: class="dark" on <html>  (Tailwind 3 darkMode: 'class')
//   storage:  vcb_theme               ('light' | 'dark' | 'auto')
//
// Nothing else. If a module's CSS still keys off body.dark or [data-theme],
// that CSS is unported — fix the CSS, do not add a second selector here.
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const THEMES = ['light', 'dark', 'auto'];
export const THEME_KEY = 'vcb_theme';

// 'auto' as the default: the OS preference is a real signal, and someone who
// runs their machine dark expects apps to follow without being told.
export const DEFAULT_THEME = 'auto';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : null;
  } catch {
    // Blocked storage must not throw during the very first render. Same
    // reasoning as api.js and i18n.jsx.
    return null;
  }
}

function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* choice will not survive a reload; the app still works */
  }
}

function systemPrefersDark() {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** 'light' | 'dark' | 'auto' -> the mode actually painted right now. */
export function resolveTheme(theme) {
  return theme === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
}

/**
 * Put the mode on <html>.
 *
 * color-scheme is set alongside the class so the browser's own chrome — form
 * controls, scrollbars, the flash of background before CSS paints — matches.
 * Without it a dark page keeps white native scrollbars.
 */
function applyTheme(resolved) {
  try {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  } catch {
    /* no document */
  }
}

/**
 * Run before React mounts, from an inline <script> in index.html, to stop the
 * white flash on load for people on dark:
 *
 *   <script>
 *     (function () {
 *       try {
 *         var t = localStorage.getItem('vcb_theme') || 'auto';
 *         var d = t === 'dark' || (t !== 'light' &&
 *           matchMedia('(prefers-color-scheme: dark)').matches);
 *         document.documentElement.classList.toggle('dark', d);
 *         document.documentElement.style.colorScheme = d ? 'dark' : 'light';
 *       } catch (e) {}
 *     })();
 *   </script>
 *
 * Exported here as well for anything that renders outside the provider.
 */
export function applyStoredThemeEarly() {
  applyTheme(resolveTheme(readStoredTheme() || DEFAULT_THEME));
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children, defaultTheme = DEFAULT_THEME }) {
  const [theme, setThemeState] = useState(() => readStoredTheme() || defaultTheme);
  const [resolved, setResolved] = useState(() =>
    resolveTheme(readStoredTheme() || defaultTheme)
  );

  useEffect(() => {
    const mq = (() => {
      try {
        return window.matchMedia(DARK_QUERY);
      } catch {
        return null;
      }
    })();

    const sync = () => {
      const next = theme === 'auto' ? (mq?.matches ? 'dark' : 'light') : theme;
      setResolved(next);
      applyTheme(next);
    };
    sync();

    // Only 'auto' listens. In 'auto' the OS can flip mid-session — a scheduled
    // sundown switch, or someone toggling system dark mode — and the page must
    // follow without a reload. In light/dark the person has overridden the OS,
    // so its changes are none of our business.
    if (theme !== 'auto' || !mq) return undefined;

    // addEventListener on MediaQueryList is unsupported in Safari < 14, which
    // still shows up on older iPads on site.
    if (mq.addEventListener) {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    writeStoredTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({
      theme, // what was chosen: 'light' | 'dark' | 'auto'
      resolved, // what is painted: 'light' | 'dark'
      isDark: resolved === 'dark',
      setTheme,
      // Cycles through the three so one button can drive the whole thing.
      cycleTheme: () =>
        setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]),
      // Explicit light/dark, leaving 'auto' behind — for a plain two-state switch.
      toggleTheme: () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
      themes: THEMES,
    }),
    [theme, resolved, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
