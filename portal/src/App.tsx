import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { APPS, I18N } from './data'
import {
  GlobeIcon,
  GearIcon,
  AnnouncementIcon,
  AppIcon,
  SearchIcon,
  MenuIcon,
  HelpIcon,
  DashboardIcon,
  NavArrowIcon,
  OnboardingIcon,
  ErpIcon,
  ZoomIcon,
  AiTavernIcon,
} from './icons'
import Globe from './Globe'
import Tooltip, { useTooltip } from './Tooltip'
import AdminModal from './AdminModal'
import HelpModal from './HelpModal'
import { getActiveUserEmail, getAnnouncement } from './mockBackend'
import type { Announcement, CSSVarStyle, Dict, Lang, Theme } from './types'

const LANG_STORE_KEY = 'vcb_connect_lang'
const THEME_STORE_KEY = 'vcb_connect_theme'
const DISMISS_KEY = 'vcb_connect_ann_dismissed'

const SAMPLE_BIRTHDAYS = [
  { name: 'Mimiese Abubakar', when: 'Today' },
  { name: 'Kenny Avwerose', when: 'Tomorrow' },
  { name: 'Omo Jefe', when: 'Wed, 25 July' },
]

function getInitialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_STORE_KEY)
    return v === 'th' || v === 'en' ? v : 'en'
  } catch {
    return 'en'
  }
}

function getInitialTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORE_KEY)
    return v === 'dark' || v === 'light' ? v : 'light'
  } catch {
    return 'light'
  }
}

function initialsFromName(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase()
}

function greetingKeyForHour(h: number): 'good_morning' | 'good_afternoon' | 'good_evening' {
  if (h < 12) return 'good_morning'
  if (h < 18) return 'good_afternoon'
  return 'good_evening'
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getInitialLang)
  const [langSwapping, setLangSwapping] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const dict = I18N[lang]

  // EN and TH strings differ enough in length/font metrics that swapping
  // text in place visibly reflows the layout. Briefly fade the shell out,
  // swap the language while invisible, then fade back in.
  const changeLang = useCallback((next: Lang) => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLang(next)
      return
    }
    setLangSwapping(true)
    window.setTimeout(() => {
      setLang(next)
      requestAnimationFrame(() => setLangSwapping(false))
    }, 100)
  }, [])
  const t = useCallback(<K extends keyof Dict>(key: K): Dict[K] => I18N[lang][key], [lang])

  // null = still connecting, '' = guest, otherwise a formatted name
  const [userName, setUserName] = useState<string | null>(null)
  const [userTitle, setUserTitle] = useState('')
  const [announcement, setAnnouncement] = useState<Announcement | null>(() => getAnnouncement())
  const [dismissed, setDismissed] = useState(false)
  const [adminVisible, setAdminVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const { state: tooltipState, bind: bindTooltip } = useTooltip()

  // reflect <html lang> + persist choice (mirrors applyLang + setLang)
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    try {
      localStorage.setItem(LANG_STORE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  // reflect <html data-theme> + persist choice (mirrors applyTheme + setTheme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // reveal the admin gear only when ?admin=1 is in the URL
  useEffect(() => {
    if (/(\?|&)admin=1(\b|&)/.test(window.location.search)) setAdminVisible(true)
  }, [])

  // header greeting (mock getActiveUserEmail) — mirrors the success/failure handlers
  useEffect(() => {
    let alive = true
    getActiveUserEmail()
      .then((email) => {
        if (!alive) return
        if (!email) {
          setUserName('')
          return
        }
        const name = (email.split('@')[0] ?? '')
          .replace(/[._-]+/g, ' ')
          .replace(/\b([a-z])/g, (_m, c: string) => c.toUpperCase())
        setUserName(name || email)
        setUserTitle(email)
      })
      .catch(() => {
        if (alive) setUserName('')
      })
    return () => {
      alive = false
    }
  }, [])

  // hide banner if this id was already dismissed on this device (wireDismiss)
  useEffect(() => {
    if (!announcement) {
      setDismissed(false)
      return
    }
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === announcement.id)
    } catch {
      setDismissed(false)
    }
  }, [announcement])

  function dismissBanner(): void {
    setDismissed(true)
    try {
      if (announcement) localStorage.setItem(DISMISS_KEY, announcement.id)
    } catch {
      /* ignore */
    }
  }

  // settings dropdown: close on outside click / Escape
  useEffect(() => {
    if (!settingsOpen) return
    function onDocClick(e: MouseEvent): void {
      const menu = settingsRef.current
      const btn = settingsBtnRef.current
      if (menu && !menu.contains(e.target as Node) && e.target !== btn) setSettingsOpen(false)
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  // welcome clock + greeting word — ticks every 30s like index.html
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  // page-load reveal choreography — ported from the IIFE in index.html
  useEffect(() => {
    if (!document.documentElement.classList.contains('js')) return
    const reduce = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const timers: number[] = []
    els.forEach((el, idx) => {
      const d = reduce ? 0 : idx * 45
      timers.push(window.setTimeout(() => el.classList.add('in'), d))
      timers.push(window.setTimeout(() => el.classList.remove('reveal', 'in'), d + 800))
    })
    return () => {
      timers.forEach((id) => clearTimeout(id))
    }
  }, [])

  const showBanner = !!announcement && announcement.show && !dismissed

  // a real name is language-neutral and overrides the i18n "Guest"
  const greeting = userName === null ? t('connecting') : userName === '' ? t('guest') : userName
  const initials = initialsFromName(greeting)
  const greetingWord = t(greetingKeyForHour(now.getHours()))
  const clockText = `${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`

  const q = query.trim().toLowerCase()
  const filteredApps = useMemo(() => {
    if (!q) return APPS
    return APPS.filter((a) => {
      const entry = dict.apps[a.key]
      const hay = `${entry?.name ?? a.name} ${entry?.desc ?? a.desc}`.toLowerCase()
      return hay.includes(q)
    })
  }, [q, dict])

  return (
    <div className={`shell${langSwapping ? ' lang-swapping' : ''}`}>
      {/* ===== sidebar ===== */}
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <GlobeIcon />
          </div>
          <div>
            <div className="sidebar-brand-name">VCB CONNECT</div>
            <div className="sidebar-brand-sub">{dict.brand_sub}</div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{userName === null ? '?' : initials}</div>
          <div>
            <div className="sidebar-user-name" title={userTitle}>
              {greeting}
            </div>
            <div className="sidebar-user-role">{dict.staff}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">{dict.nav_menu}</div>
          <button className="nav-item active" type="button">
            <DashboardIcon />
            <span>{dict.nav_dashboard}</span>
          </button>

          <div className="sidebar-label">{dict.nav_applications}</div>
          {APPS.map((a) => {
            const entry = dict.apps[a.key]
            return (
              <a
                key={a.key}
                className="nav-item"
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                data-key={a.key}
                {...bindTooltip({
                  key: `nav-${a.key}`,
                  name: entry?.name ?? a.name,
                  desc: entry?.preview || entry?.desc || a.desc,
                  kind: 'nav',
                })}
              >
                <AppIcon icon={a.icon} />
                <span className="nav-app-name">{entry?.name ?? a.name}</span>
                <NavArrowIcon />
              </a>
            )
          })}

          <div className="sidebar-label">{dict.nav_more}</div>
          <a
            className="nav-item"
            href="https://script.google.com/macros/s/AKfycbwYEjPc_fS-0ygn4gPg8ePSBIm2DkTyS94BTon-IgC5AtiUYYQnZ6v3seV8GsGwGHrL/exec"
            target="_blank"
            rel="noopener noreferrer"
          >
            <OnboardingIcon />
            <span>{dict.nav_onboarding}</span>
          </a>
          <a
            className="nav-item"
            href="https://www.vcbcon.com/newproduction.anywhere/page/authentication/login/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ErpIcon />
            <span>{dict.nav_erp}</span>
          </a>
          <a className="nav-item" href="https://zoom.us" target="_blank" rel="noopener noreferrer">
            <ZoomIcon />
            <span>{dict.nav_zoom}</span>
          </a>
          <button className="nav-item" type="button" title="Coming soon" disabled>
            <AiTavernIcon />
            <span>{dict.nav_ai_tavern}</span>
          </button>
          <button className="nav-item" type="button" onClick={() => setHelpOpen(true)}>
            <HelpIcon />
            <span>{dict.nav_help}</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <span>{dict.footer_left}</span>
        </div>
      </aside>
      <div
        className="sidebar-scrim"
        id="sidebar-scrim"
        onClick={() => setSidebarOpen(false)}
        {...(!sidebarOpen ? { hidden: true } : {})}
      ></div>

      {/* ===== main column ===== */}
      <div className="main">
        {/* ===== top bar ===== */}
        <header className="topbar reveal">
          <button
            className="icon-btn menu-btn"
            id="menu-btn"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </button>

          <div className="topbar-search">
            <SearchIcon />
            <input
              type="text"
              id="app-search"
              placeholder={dict.search_placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="topbar-right">
            {adminVisible && (
              <button
                className="icon-btn"
                title="Manage announcement"
                aria-label="Manage announcement"
                onClick={() => setModalOpen(true)}
              >
                <GearIcon />
              </button>
            )}

            <div className="settings-wrap">
              <button
                className="icon-btn"
                id="settings-btn"
                ref={settingsBtnRef}
                aria-label="Settings"
                aria-haspopup="true"
                aria-expanded={settingsOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  setSettingsOpen((o) => !o)
                }}
              >
                <GearIcon />
              </button>
              <div
                className="settings-menu"
                id="settings-menu"
                role="menu"
                ref={settingsRef}
                {...(settingsOpen ? { 'data-open': '' } : {})}
              >
                <div className="settings-section">{dict.settings_language}</div>
                <div className="settings-row">
                  <div className="seg" id="lang-seg" role="group" aria-label="Language">
                    <button
                      type="button"
                      className={lang === 'en' ? 'is-active' : ''}
                      onClick={() => changeLang('en')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={lang === 'th' ? 'is-active' : ''}
                      onClick={() => changeLang('th')}
                    >
                      ไทย
                    </button>
                  </div>
                </div>
                <div className="settings-section">{dict.settings_theme}</div>
                <div className="settings-row">
                  <div className="seg" id="theme-seg" role="group" aria-label="Theme">
                    <button
                      type="button"
                      className={theme === 'light' ? 'is-active' : ''}
                      onClick={() => setTheme('light')}
                    >
                      {dict.theme_light}
                    </button>
                    <button
                      type="button"
                      className={theme === 'dark' ? 'is-active' : ''}
                      onClick={() => setTheme('dark')}
                    >
                      {dict.theme_dark}
                    </button>
                  </div>
                </div>
                <div className="settings-divider"></div>
                <button
                  className="settings-link"
                  id="settings-help"
                  onClick={() => {
                    setSettingsOpen(false)
                    setHelpOpen(true)
                  }}
                >
                  <HelpIcon />
                  <span>{dict.nav_help}</span>
                </button>
              </div>
            </div>

            <div className="user-chip">
              <span className="mini-avatar">{userName === null ? '?' : initials}</span>
              <span id="user-name" title={userTitle}>
                {greeting}
              </span>
            </div>
          </div>
        </header>

        <div className="content">
          {/* ===== announcement banner ===== */}
          {showBanner && announcement && (
            <div
              className="card"
              id="announcement"
              data-id={announcement.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 18px',
                marginBottom: 16,
              }}
            >
              <div className="app-icon" style={{ flex: '0 0 32px', width: 32, height: 32 }}>
                <AnnouncementIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {announcement.title && <div className="ann-item-title">{announcement.title}</div>}
                {announcement.body && <div className="ann-item-body">{announcement.body}</div>}
              </div>
              <button
                className="icon-btn"
                id="ann-dismiss"
                title="Dismiss"
                aria-label="Dismiss announcement"
                style={{ width: 28, height: 28 }}
                onClick={dismissBanner}
              >
                ×
              </button>
            </div>
          )}

          <div className="page-head reveal">
            <h1>{dict.nav_dashboard}</h1>
            <p>{dict.dash_sub}</p>
          </div>

          <div className="dash-grid">
            {/* ===== left: welcome + apps ===== */}
            <div className="dash-main">
              <div className="card welcome-card reveal">
                <div className="welcome-text">
                  <p className="welcome-greeting">
                    <span id="welcome-greeting-word">{greetingWord}</span>,{' '}
                    <span id="welcome-name">{greeting}</span>
                  </p>
                  <p className="welcome-sub">{dict.welcome_sub}</p>
                </div>
                <div className="welcome-status">
                  <span className="status-pill">
                    <span className="dot"></span>
                    <span>{dict.system_online}</span>
                  </span>
                  <span className="welcome-clock" id="welcome-clock">
                    {clockText}
                  </span>
                </div>
              </div>

              <div className="section-title reveal" id="apps-section">
                <h2>{dict.applications}</h2>
                <span className="count">
                  {APPS.length} {dict.available}
                </span>
              </div>

              <div className="apps-grid" id="apps-grid">
                {filteredApps.map((a) => {
                  const entry = dict.apps[a.key]
                  const style: CSSVarStyle = { '--card-accent': a.accent }
                  return (
                    <a
                      key={a.key}
                      className="app-card reveal"
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-key={a.key}
                      style={style}
                      {...bindTooltip({
                        key: `card-${a.key}`,
                        name: entry?.name ?? a.name,
                        desc: entry?.preview || entry?.desc || a.desc,
                        kind: 'card',
                      })}
                    >
                      <div className="app-row">
                        <div className="app-icon">
                          <AppIcon icon={a.icon} />
                        </div>
                        <div className="app-name">{entry?.name ?? a.name}</div>
                      </div>
                      <div className="app-desc">{entry?.desc ?? a.desc}</div>
                      <div className="app-cta">
                        <span>{dict.launch}</span> <span className="arrow">→</span>
                      </div>
                    </a>
                  )
                })}
              </div>
              {filteredApps.length === 0 && (
                <p className="ann-empty" id="apps-empty">
                  {dict.search_empty}
                </p>
              )}
            </div>

            {/* ===== right: globe + announcements + birthdays ===== */}
            <div className="side-col">
              <div className="card globe-card reveal" aria-hidden="true">
                <Globe />
              </div>

              <div className="card panel reveal">
                <div className="panel-head">
                  <h3>{dict.panel_announcements}</h3>
                </div>
                <div id="announcements-list">
                  {announcement && announcement.show && (announcement.title || announcement.body) ? (
                    <div className="ann-item">
                      {announcement.title && (
                        <div className="ann-item-title">{announcement.title}</div>
                      )}
                      {announcement.body && <div className="ann-item-body">{announcement.body}</div>}
                    </div>
                  ) : (
                    <p className="ann-empty">{dict.panel_announcements_empty}</p>
                  )}
                </div>
              </div>

              <div className="card panel reveal" id="birthdays-panel">
                <div className="panel-head">
                  <h3>{dict.panel_birthdays}</h3>
                </div>
                <div id="birthdays-list">
                  {SAMPLE_BIRTHDAYS.map((b) => (
                    <div className="bday-row" key={b.name}>
                      <div className="bday-avatar">{initialsFromName(b.name)}</div>
                      <div>
                        <div className="bday-name">{b.name}</div>
                        <div className="bday-when">{b.when}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="panel-note">{dict.panel_birthdays_note}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tooltip state={tooltipState} />

      {/* ===== admin modal ===== */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          setAnnouncement(saved)
          setDismissed(false)
        }}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} dict={dict} />
    </div>
  )
}
