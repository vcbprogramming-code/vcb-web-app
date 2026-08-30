// App-wide settings (language, theme, year format, cell display, hidden sites) —
// mirrors the GAS localStorage prefs (hr_lang/hr_theme/hr_yearfmt/hr_cellnames)
// and exposes a t() bound to the current language.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Lang, Theme, YearFmt, CellNames, DashView } from './types'
import { translate, monthName, dow } from './i18n'

function ls(key: string, def: string): string {
  try { return localStorage.getItem(key) ?? def } catch { return def }
}
function lsSet(key: string, v: string): void {
  try { localStorage.setItem(key, v) } catch { /* private mode */ }
}

interface SettingsCtx {
  lang: Lang; setLang: (l: Lang) => void
  theme: Theme; setTheme: (t: Theme) => void
  yearFmt: YearFmt; setYearFmt: (f: YearFmt) => void
  cellNames: CellNames; setCellNames: (c: CellNames) => void
  dashDefault: DashView; setDashDefault: (v: DashView) => void
  hiddenSites: string[]; toggleSite: (key: string, hide: boolean) => void
  t: (s: string) => string
  mname: (m: number) => string
  dow: (d: number) => string
  be: (y: number) => number
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(ls('hr_lang', 'th') as Lang)
  const [theme, setThemeState] = useState<Theme>(ls('hr_theme', 'light') as Theme)
  const [yearFmt, setYearFmtState] = useState<YearFmt>(ls('hr_yearfmt', 'be') as YearFmt)
  const [cellNames, setCellNamesState] = useState<CellNames>(ls('hr_cellnames', 'code') as CellNames)
  const [dashDefault, setDashDefaultState] = useState<DashView>(ls('hr_dashview', 'progress') as DashView)
  const [hiddenSites, setHiddenSites] = useState<string[]>(() => {
    try { return JSON.parse(ls('hr_hidden', '[]')) as string[] } catch { return [] }
  })

  // Theme: apply to <body>, and in 'auto' follow the OS, live-switching on change.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme
      document.body.classList.toggle('dark', mode === 'dark')
    }
    apply()
    if (theme === 'auto') { mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply) }
  }, [theme])

  const value = useMemo<SettingsCtx>(() => ({
    lang,
    setLang: (l) => { lsSet('hr_lang', l); setLangState(l) },
    theme,
    setTheme: (t) => { lsSet('hr_theme', t); setThemeState(t) },
    yearFmt,
    setYearFmt: (f) => { lsSet('hr_yearfmt', f); setYearFmtState(f) },
    cellNames,
    setCellNames: (c) => { lsSet('hr_cellnames', c); setCellNamesState(c) },
    dashDefault,
    setDashDefault: (v) => { lsSet('hr_dashview', v); setDashDefaultState(v) },
    hiddenSites,
    toggleSite: (key, hide) => setHiddenSites((prev) => {
      const next = hide ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)
      lsSet('hr_hidden', JSON.stringify(next)); return next
    }),
    t: (s) => translate(s, lang),
    mname: (m) => monthName(m, lang),
    dow: (d) => dow(d, lang),
    be: (y) => (yearFmt === 'be' ? y + 543 : y),
  }), [lang, theme, yearFmt, cellNames, dashDefault, hiddenSites])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
