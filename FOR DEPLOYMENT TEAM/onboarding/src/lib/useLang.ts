import { useCallback, useState, useEffect } from "react";

// Ported from the original app's setLang/localStorage['vcb-lang'] logic
// (app.html) — same key, defaults to 'en'.
export type Lang = "en" | "th";
const LANG_KEY = "vcb-lang";

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "th" ? "th" : "en";
  } catch {
    return "en";
  }
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  // Keep <html lang> in step with the rendered language. index.html
  // hardcodes lang="en"; without this, switching to Thai leaves a screen
  // reader announcing Thai text with an English voice. Runs on first mount
  // as well as every switch, so the attribute always matches what's shown.
  // Ported from applyLangUI in the original app's app.html.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // best-effort, matches original
    }
  }, []);

  return { lang, setLang };
}
