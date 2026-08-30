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
  const [lang, setLangState] = useState<Lang>(() => (lsGet('vcb-lang') === 'th' ? 'th' : 'en'))
  const [era, setEraState] = useState<Era>(() => (lsGet('vcb-era') === 'be' ? 'be' : 'ce'))
  const [dark, setDarkState] = useState<boolean>(() => lsGet('vcb-dm') === '1')
  const [auth, setAuth] = useState<Auth | null>(null)

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); lsSet('vcb-dm', dark ? '1' : '0') }, [dark])
  useEffect(() => { lsSet('vcb-lang', lang); document.documentElement.lang = lang }, [lang])
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
