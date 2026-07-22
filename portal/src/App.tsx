import { useEffect, useRef, useState, useCallback } from 'react'
import { APPS, I18N } from './data'
import { GlobeIcon, GearIcon, AnnouncementIcon, AppIcon } from './icons'
import Globe from './Globe'
import AdminModal from './AdminModal'
import { getActiveUserEmail, getAnnouncement } from './mockBackend'
import type { Announcement, CSSVarStyle, Dict, Lang } from './types'

const LANG_STORE_KEY = 'vcb_connect_lang'
const DISMISS_KEY = 'vcb_connect_ann_dismissed'

function getInitialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_STORE_KEY)
    return v === 'th' || v === 'en' ? v : 'en'
  } catch {
    return 'en'
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getInitialLang)
  const dict = I18N[lang]
  const t = useCallback(<K extends keyof Dict>(key: K): Dict[K] => I18N[lang][key], [lang])

  // null = still connecting, '' = guest, otherwise a formatted name
  const [userName, setUserName] = useState<string | null>(null)
  const [userTitle, setUserTitle] = useState('')
  const [announcement, setAnnouncement] = useState<Announcement | null>(() => getAnnouncement())
  const [dismissed, setDismissed] = useState(false)
  const [adminVisible, setAdminVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const previewRestoreTimer = useRef<number | null>(null)

  // Delays clearing the preview until after the globe panel's fade-out
  // transition (260ms) finishes, so the mission text never flashes mid-fade.
  function showPreview(key: string): void {
    if (previewRestoreTimer.current !== null) {
      window.clearTimeout(previewRestoreTimer.current)
      previewRestoreTimer.current = null
    }
    setPreviewKey(key)
  }
  function hidePreview(): void {
    if (previewRestoreTimer.current !== null) window.clearTimeout(previewRestoreTimer.current)
    previewRestoreTimer.current = window.setTimeout(() => {
      setPreviewKey(null)
      previewRestoreTimer.current = null
    }, 260)
  }
  useEffect(() => {
    return () => {
      if (previewRestoreTimer.current !== null) window.clearTimeout(previewRestoreTimer.current)
    }
  }, [])

  // reflect <html lang> + persist choice (mirrors applyLang + setLang)
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    try {
      localStorage.setItem(LANG_STORE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

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

  function toggleLang(): void {
    setLang((cur) => (cur === 'en' ? 'th' : 'en'))
  }

  // page-load reveal choreography — ported from the IIFE in index.html
  useEffect(() => {
    if (!document.documentElement.classList.contains('js')) return
    const reduce = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    const late = document.querySelectorAll<HTMLElement>('.app-card.reveal, footer.reveal')
    const early = document.querySelectorAll<HTMLElement>('.reveal:not(.app-card):not(footer)')
    const timers: number[] = []

    const run = (list: NodeListOf<HTMLElement>, start: number, step: number): void => {
      list.forEach((el, idx) => {
        const d = reduce ? 0 : start + idx * step
        timers.push(window.setTimeout(() => el.classList.add('in'), d))
        timers.push(window.setTimeout(() => el.classList.remove('reveal', 'in'), d + 1000))
      })
    }

    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        run(early, 0, 70) // quiet frame, up front
        run(late, reduce ? 0 : 1200, 90) // panels ride the globe's energy pulse
      }),
    )
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((id) => clearTimeout(id))
    }
  }, [])

  const showBanner = !!announcement && announcement.show && !dismissed
  const year = new Date().getFullYear()

  // a real name is language-neutral and overrides the i18n "Guest"
  const greeting = userName === null ? t('connecting') : userName === '' ? t('guest') : userName

  return (
    <>
      <div className="stars"></div>

      <div className="wrap">
        {/* ===== top bar ===== */}
        <header className="topbar reveal">
          <div className="brand">
            <div
              className="brand-logo lang-toggle"
              role="button"
              tabIndex={0}
              aria-label={dict.toggle_title}
              title={dict.toggle_title}
              onClick={toggleLang}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleLang()
                }
              }}
            >
              <GlobeIcon />
              <span className="lang-badge">{dict.badge}</span>
            </div>
            <div>
              <div className="brand-name">
                VCB <span>CONNECT</span>
              </div>
              <div className="brand-sub">{dict.brand_sub}</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="user-chip">
              <span className="dot"></span>
              <span id="user-name" title={userTitle}>
                {greeting}
              </span>
            </div>
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
          </div>
        </header>

        {/* ===== announcement banner ===== */}
        {showBanner && announcement && (
          <div className="announcement" data-id={announcement.id}>
            <div className="ann-icon">
              <AnnouncementIcon />
            </div>
            <div className="ann-body">
              {announcement.title && <div className="ann-title">{announcement.title}</div>}
              {announcement.body && <div className="ann-text">{announcement.body}</div>}
            </div>
            <button
              className="ann-dismiss"
              title="Dismiss"
              aria-label="Dismiss announcement"
              onClick={dismissBanner}
            >
              ×
            </button>
          </div>
        )}

        {/* ===== hero ===== */}
        <section className="hero">
          <div className="hero-text">
            <h1 className="reveal">
              <span className="glow-text">VCB&nbsp;Connect</span>
            </h1>
            <p className="reveal">{dict.hero_desc}</p>
            <div className="hero-meta reveal">
              <span className="meta-pill">{dict.system_online}</span>
              <span className="meta-pill">
                {APPS.length} {dict.apps_word}
              </span>
              <span className="meta-pill">VCB-CON.COM</span>
            </div>
          </div>

          <Globe
            label="Jump to applications"
            mission={dict.mission}
            missionLink={dict.mission_link}
            previewApp={(() => {
              if (!previewKey) return null
              const entry = dict.apps[previewKey]
              const app = APPS.find((a) => a.key === previewKey)
              if (!entry || !app) return null
              return { name: entry.name, preview: entry.preview, accent: app.accent }
            })()}
            onActivate={() =>
              document.getElementById('apps-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        </section>

        {/* ===== apps ===== */}
        <div className="section-title reveal" id="apps-section">
          <h2>{dict.applications}</h2>
          <span className="count">
            {APPS.length} {dict.available}
          </span>
        </div>

        <div className="apps-grid">
          {APPS.map((a) => {
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
                onMouseEnter={() => showPreview(a.key)}
                onMouseLeave={hidePreview}
                onFocus={() => showPreview(a.key)}
                onBlur={hidePreview}
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

        {/* ===== footer ===== */}
        <footer className="reveal">
          <span>{dict.footer_left}</span>
          <span className="right">v1.1 · {year}</span>
        </footer>
      </div>

      {/* ===== admin modal ===== */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          setAnnouncement(saved)
          setDismissed(false)
        }}
      />
    </>
  )
}
