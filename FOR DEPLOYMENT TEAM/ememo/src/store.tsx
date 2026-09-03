// Cross-cutting client state: display prefs (lang / era / theme) persisted to
// the same localStorage keys as the GAS app, plus mock auth. Mirrors the
// LANG / DATE_ERA / html.dark / _authToken / _verifiedEmail / _rvManager globals.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { makeT, type Lang, type Era, type Strings } from './i18n'
import { mockSignIn, PREVIEW_OWNER } from './api'

const lsGet = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export interface Auth { token: string; email: string; manager: boolean }

interface Store {
  lang: Lang; setLang: (l: Lang) => void
  era: Era; setEra: (e: Era) => void
  dark: boolean; setDark: (d: boolean) => void
  t: (k: keyof Strings) => string
  auth: Auth | null
  signIn: (email?: string) => Auth
  signOut: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Theme and language read the SHARED keys the rest of VCB Connect uses
  // (vcb_theme / vcb_lang), not this module's old vcb-dm / vcb-lang. Those
  // were private to E-Memo, so switching appearance or language in the portal
  // did not follow the person in here — the whole point of one website.
  //
  // vcb_theme holds 'light' | 'dark' | 'auto'; 'auto' follows the OS, which is
  // also the shared default. Thai is the shared default language.
  const [lang, setLangState] = useState<Lang>(() => (lsGet('vcb_lang') === 'en' ? 'en' : 'th'))
  const [era, setEraState] = useState<Era>(() => (lsGet('vcb-era') === 'be' ? 'be' : 'ce'))
  const [dark, setDarkState] = useState<boolean>(() => {
    const t = lsGet('vcb_theme') || 'auto'
    if (t === 'dark') return true
    if (t === 'light') return false
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
  })
  const [auth, setAuth] = useState<Auth | null>(null)

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); lsSet('vcb_theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { lsSet('vcb_lang', lang); document.documentElement.lang = lang }, [lang])
  useEffect(() => { lsSet('vcb-era', era) }, [era])

  const t = useMemo(() => makeT(lang), [lang])

  const signIn = useCallback((email: string = PREVIEW_OWNER): Auth => {
    const a = mockSignIn(email)
    setAuth(a)
    try { localStorage.removeItem('vcbSignedOut') } catch { /* ignore */ }
    return a
  }, [])
  const signOut = useCallback(() => {
    setAuth(null)
    try { localStorage.setItem('vcbSignedOut', '1') } catch { /* ignore */ }
  }, [])

  const value: Store = {
    lang, setLang: setLangState, era, setEra: setEraState, dark, setDark: setDarkState,
    t, auth, signIn, signOut,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
