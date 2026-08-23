import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN } from './en.js';

/**
 * ไทย / English.
 *
 * The dictionary is keyed by the THAI text, not by an invented code. Two reasons,
 * both about not breaking what already works:
 *
 *   1. Converting a screen is mechanical — wrap the string that is already there.
 *      No key has to be invented, and no key can be mistyped into a blank label.
 *   2. A missing translation falls back to the Thai, which is correct and is what
 *      every user sees today. With code keys a gap renders as "ememo.title" —
 *      worse than the language the reader may well prefer anyway.
 *
 * So the Thai side can never regress: with lang='th' t() returns its argument
 * unchanged, and the component tree renders exactly what it renders now.
 */
const LangContext = createContext({ lang: 'th', setLang: () => {}, t: (s) => s });

const KEY = 'vcb_lang';
const initial = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'en' || v === 'th' ? v : 'th';
  } catch { return 'th'; }
};

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initial);

  const setLang = useCallback((v) => {
    const next = v === 'en' ? 'en' : 'th';
    setLangState(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    // let the page's own lang attribute follow, so the browser hyphenates and
    // spell-checks in the right language
    document.documentElement.setAttribute('lang', next);
  }, []);

  useEffect(() => { document.documentElement.setAttribute('lang', lang); }, [lang]);

  // `ctx` disambiguates a homograph. One Thai string can be two English ones —
  // "ยกเลิก" is the Cancel button and also the Cancelled status — and with the
  // Thai text as the key there is nothing else to tell them apart. A context
  // makes the difference explicit at the call site instead of letting whichever
  // dictionary entry came last win everywhere.
  const t = useCallback((s, vars, ctx) => {
    if (s == null) return s;
    const src = String(s);
    let out = lang === 'en' ? (ctx && EN[`${ctx}::${src}`]) ?? EN[src] ?? src : src;
    // "เหลือ {n} วัน" — interpolation stays outside the dictionary so a number
    // never ends up baked into a translation key
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** `const { t, lang, setLang } = useLang()` — t(text, vars, ctx) */
export function useLang() { return useContext(LangContext); }

/** For the common case where only the function is wanted: `const t = useT()`. */
export function useT() { return useContext(LangContext).t; }

/** How many of the strings we know about have an English side — used by the
 *  test suite to hold the line on coverage rather than let it quietly rot. */
export const translationCount = () => Object.keys(EN).length;
