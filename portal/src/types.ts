// Models mirroring the Google Apps Script API shapes (Code.js).

/** A registered portal app card — mirrors an entry of the GAS `APPS` array. */
export interface AppEntry {
  key: string
  name: string
  desc: string
  url: string
  icon: AppIconKey
  accent: string
}

/** Icon keys handled by the GAS scriptlet switch (others fall back to generic). */
export type AppIconKey = 'memo' | 'minutes' | 'sop' | 'sysmap' | 'hr' | 'credit' | (string & {})

/**
 * The announcement record persisted in ScriptProperties as ANNOUNCEMENT_JSON.
 * Mirrors the object minted by `saveAnnouncement` in Code.js.
 */
export interface Announcement {
  id: string
  title: string
  body: string
  show: boolean
  /** ISO timestamp from `new Date().toISOString()`. */
  updated: string
}

/** Editable subset the client sends to `saveAnnouncement`. */
export interface AnnouncementInput {
  title: string
  body: string
  show: boolean
}

export type Lang = 'en' | 'th'

/** Per-app localized name + description, keyed by app key. */
export interface AppI18n {
  name: string
  desc: string
  /** Longer paragraph shown on the globe when hovering this app's card. */
  preview: string
}

/** One language's dictionary — mirrors index.html I18N[lang]. */
export interface Dict {
  brand_sub: string
  hero_desc: string
  system_online: string
  apps_word: string
  applications: string
  available: string
  launch: string
  footer_left: string
  connecting: string
  guest: string
  toggle_title: string
  badge: string
  mission: string[]
  apps: Record<string, AppI18n>
}

export type I18nDict = Record<Lang, Dict>

/**
 * Allow CSS custom properties (e.g. `--card-accent`, `--i`) in inline styles.
 * React's CSSProperties doesn't permit arbitrary `--*` keys under strict TS.
 */
export type CSSVarStyle = React.CSSProperties & Record<`--${string}`, string | number>
