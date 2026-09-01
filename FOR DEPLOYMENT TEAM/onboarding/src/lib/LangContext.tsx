import { createContext, useContext, type ReactNode } from "react";
import { useLang, type Lang } from "./useLang";
import { t as translate } from "./translations";

// A React context wrapping useLang/translations.ts's t() so any component
// can translate a string without prop-drilling `lang` through every
// layer — the original app's t() (translations.html) was a plain global
// function reading a module-level LANG variable; this achieves the same
// "call t(str) anywhere" ergonomic the idiomatic React way.

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (str: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useLang();
  const t = (str: string) => translate(str, lang);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used within a LangProvider");
  return ctx;
}
