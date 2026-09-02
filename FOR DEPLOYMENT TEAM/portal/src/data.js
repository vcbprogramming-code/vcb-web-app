// What is still local data, and why.
//
// The APPS array and the I18N dictionary that used to live here are gone: tiles
// come from GET /api/portal/apps (lib/portalApi.js) and copy from the shared
// dictionary in i18n.js. What remains is the holiday table, which has no API
// endpoint and no table in supabase/migrations — it is a fixed calendar, not
// company data, so it stays compiled into the bundle exactly as the Apps Script
// version kept it in Code.js.

// Fixed-date Thai public holidays — ported verbatim from Code.js
// THAI_HOLIDAYS_FIXED. Month/day repeats every year, so no per-year table.
// Deliberately excludes lunar/Buddhist holidays (Makha Bucha, Visakha Bucha,
// Asalha Bucha, Buddhist Lent) and government "compensation day"
// (วันหยุดชดเชย) substitutions, since both shift yearly and are announced
// by cabinet resolution.
export const THAI_HOLIDAYS_FIXED = [
  { month: 1, day: 1, name_en: "New Year's Day", name_th: 'วันขึ้นปีใหม่' },
  { month: 4, day: 6, name_en: 'Chakri Day', name_th: 'วันจักรี' },
  { month: 4, day: 13, name_en: 'Songkran Festival', name_th: 'วันสงกรานต์' },
  { month: 4, day: 14, name_en: 'Songkran Festival', name_th: 'วันสงกรานต์' },
  { month: 4, day: 15, name_en: 'Songkran Festival', name_th: 'วันสงกรานต์' },
  { month: 5, day: 1, name_en: 'National Labor Day', name_th: 'วันแรงงานแห่งชาติ' },
  { month: 5, day: 4, name_en: 'Coronation Day', name_th: 'วันฉัตรมงคล' },
  { month: 7, day: 28, name_en: "King's Birthday", name_th: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { month: 8, day: 12, name_en: "Mother's Day", name_th: 'วันแม่แห่งชาติ' },
  { month: 10, day: 13, name_en: 'King Bhumibol Memorial Day', name_th: 'วันคล้ายวันสวรรคต ร.9' },
  { month: 10, day: 23, name_en: 'Chulalongkorn Day', name_th: 'วันปิยมหาราช' },
  { month: 12, day: 5, name_en: "Father's Day", name_th: 'วันพ่อแห่งชาติ' },
  { month: 12, day: 10, name_en: 'Constitution Day', name_th: 'วันรัฐธรรมนูญ' },
  { month: 12, day: 31, name_en: "New Year's Eve", name_th: 'วันสิ้นปี' },
];

/** Holidays for one year, keyed 'YYYY-MM-DD' — mirrors Code.js getHolidays(). */
export function getHolidays(year) {
  const out = {};
  for (const h of THAI_HOLIDAYS_FIXED) {
    const key = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
    out[key] = { name_en: h.name_en, name_th: h.name_th };
  }
  return out;
}

// Placeholder panels. Neither has an endpoint in api/src/routes/portal.js nor a
// table in supabase/migrations/002_portal.sql — the birthday panel says so in
// its own footnote (panel.birthdaysNote), and leave is deliberately empty,
// matching the Apps Script portal's default "no one on leave" state.
export const SAMPLE_BIRTHDAYS = [
  { name: 'กรกวรรษ จันทนาม', dept: 'DRIVER', when: 'Tue, Sep 8' },
  { name: 'ชาญ กรุณจินตดิฏฐ์', dept: 'ENG', when: 'Tue, Sep 8' },
  { name: 'จิราพร ศรีแก้ว', dept: 'ACCT', when: 'Wed, Sep 16' },
];

export const SAMPLE_LEAVE = [];

// Shortcut links that are not portal.apps rows: they point at third-party
// systems, not VCB Connect modules, so they are not tiles and have no key in
// the database.
//
// Onboarding used to be listed here with its Apps Script /exec URL, copied from
// the live portal where that was correct. It is NOT a shortcut: there is a full
// React onboarding module in this repo, so it belongs in portal.apps like every
// other module and its URL comes from the database. Leaving it here sent people
// from the new portal back into the stack we replatformed away from.
export const SHORTCUT_LINKS = {
  erp: 'https://www.vcbcon.com/newproduction.anywhere/page/authentication/login/',
  zoom: 'https://zoom.us/join',
};

/**
 * A module link that carries the current theme and language.
 *
 * WHY THIS IS NOT REDUNDANT ON ONE DOMAIN
 *
 * Once every module is served from vcb-connect.com/<path> (see
 * docs/ONE_DOMAIN.md) localStorage is shared and the parameters change nothing.
 * They matter in two cases that are not going away:
 *
 *   * Development. Each module runs on its own port, and a port is a different
 *     origin, so nothing in localStorage crosses between them. Without this,
 *     setting the portal to light and opening HR gives a dark HR - which looks
 *     like the preference was ignored rather than like a limitation of running
 *     eight dev servers side by side.
 *
 *   * A module opened directly. A bookmark, a link in an email, a machine that
 *     has never loaded the portal. There is no stored preference to read, and
 *     the module would fall back to the OS setting.
 *
 * The receiving app consumes the parameters once, writes them to its own
 * storage and strips them from the address bar - see readStoredTheme() in
 * shared/src/theme.jsx - so they do not linger in a bookmark and re-force a
 * preference the person has since changed.
 */
export function appLink(url, { theme, lang } = {}) {
  if (!url) return url;
  try {
    // Relative paths are the production shape ('/hr'); absolute ones are the
    // dev shape ('http://localhost:5181'). A base makes both parse.
    const u = new URL(url, window.location.origin);
    if (theme) u.searchParams.set('theme', theme);
    if (lang) u.searchParams.set('lang', lang);
    // Same-origin links stay relative so they do not look like they leave the
    // site, and so a rewrite in front of them keeps working.
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : u.toString();
  } catch {
    // A URL that will not parse is returned untouched: a tile that navigates
    // without the theme is far better than a tile that does not navigate.
    return url;
  }
}
