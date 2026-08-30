import { useCallback, useEffect, useState } from "react";

// Ported from the original app's setTheme/localStorage['vcb-theme'] logic
// (app.html) — same key, same behavior (persisted choice, falls back to
// system preference via the @media block in index.css when nothing is
// saved yet).
export type Theme = "light" | "dark";
const THEME_KEY = "vcb-theme";

function getInitialTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme | null>(getInitialTheme);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // best-effort, matches original
    }
  }, []);

  return { theme, setTheme };
}
