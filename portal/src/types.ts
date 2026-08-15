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

/** Light is the default; dark is the historical VCB Connect look. */
export type Theme = 'light' | 'dark'

/** Per-app localized name + description, keyed by app key. */
export interface AppI18n {
  name: string
  desc: string
  /** Longer paragraph shown in the custom hover tooltip for this app's card/nav item. */
  preview: string
}

/** One language's dictionary — mirrors index.html I18N[lang]. */
export interface Dict {
  brand_sub: string
  staff: string
  nav_menu: string
  nav_dashboard: string
  nav_applications: string
  nav_shortcuts: string
  nav_more: string
  nav_onboarding: string
  nav_erp: string
  nav_zoom: string
  nav_ai_tavern: string
  nav_help: string
  dash_sub: string
  welcome_sub: string
  good_morning: string
  good_afternoon: string
  good_evening: string
  system_online: string
  applications: string
  available: string
  launch: string
  footer_left: string
  connecting: string
  guest: string
  settings_language: string
  settings_theme: string
  theme_light: string
  theme_dark: string
  search_placeholder: string
  search_empty: string
  panel_announcements: string
  panel_announcements_empty: string
  panel_calendar: string
  cal_dow: string
  cal_legend_holiday: string
  cal_legend_weekend: string
  cal_legend_today: string
  cal_next_holiday: string
  cal_days_away: string
  cal_today: string
  panel_birthdays: string
  panel_birthdays_note: string
  panel_leave: string
  panel_leave_empty: string
  tt_erp_desc: string
  tt_zoom_desc: string
  tt_onboarding_desc: string
  help_title: string
  help_sub: string
  help_area_label: string
  help_area_placeholder: string
  help_area_other: string
  help_message_label: string
  help_message_placeholder: string
  help_close: string
  help_send: string
  admin_role: string
  apps: Record<string, AppI18n>
}

export type I18nDict = Record<Lang, Dict>

/** One fixed-date Thai public holiday, mirrors an entry of Code.js THAI_HOLIDAYS_FIXED. */
export interface HolidayEntry {
  name_en: string
  name_th: string
}

/** Holidays for one year, keyed 'YYYY-MM-DD' — mirrors Code.js getHolidays() return shape. */
export type HolidaysByDate = Record<string, HolidayEntry>

/**
 * Allow CSS custom properties (e.g. `--card-accent`, `--i`) in inline styles.
 * React's CSSProperties doesn't permit arbitrary `--*` keys under strict TS.
 */
export type CSSVarStyle = React.CSSProperties & Record<`--${string}`, string | number>
