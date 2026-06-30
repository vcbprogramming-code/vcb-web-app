// Typed browser-side stand-in for the Google Apps Script backend (Code.js).
//
// The GAS portal exposes these only via `google.script.run` (server-side, no
// REST /exec for portal data), so for visual/UX sign-off we mirror the exact
// contracts here and persist to localStorage. Function names, return shapes,
// validation rules, and error messages match Code.js verbatim.
//
// To wire to a real backend later, swap this module's implementations — the
// signatures are the contract.

import type { Announcement, AnnouncementInput } from './types'

const PROP_ANNOUNCEMENT = 'vcb_mock_announcement'
const PROP_ADMIN_HASH = 'vcb_mock_admin_hash'
const TOKEN_PREFIX = 'vcb_mock_tok_'
const ADMIN_TOKEN_TTL_MS = 1800 * 1000 // 30 min — mirrors ADMIN_TOKEN_TTL (Code.js)

/**
 * Demo identity for the user chip. GAS `getActiveUserEmail()` returns the
 * visitor's email, which is '' for ANYONE_ANONYMOUS access (the public state →
 * "Guest"). Set this to e.g. 'c.chavananand@vcb-con.com' to exercise the
 * name-formatting path that signed-in same-domain visitors would see.
 */
const DEMO_EMAIL = ''

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function sha256Hex(plain: string): Promise<string> {
  const data = new TextEncoder().encode(String(plain))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Mirrors getActiveUserEmail(): the visitor's email, or '' when anonymous. */
export async function getActiveUserEmail(): Promise<string> {
  await wait(250) // simulate the google.script.run round-trip
  return DEMO_EMAIL
}

/** Mirrors getAnnouncement(): the published announcement only when show=true. */
export function getAnnouncement(): Announcement | null {
  const raw = localStorage.getItem(PROP_ANNOUNCEMENT)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as Announcement
    return obj && obj.show ? obj : null
  } catch {
    return null
  }
}

/** Mirrors isAdminInitialized(): true once an admin password has been set. */
export function isAdminInitialized(): boolean {
  return !!localStorage.getItem(PROP_ADMIN_HASH)
}

/**
 * Mirrors unlockAdmin(password): first call sets the password; later calls
 * verify it. Returns a 30-min session token. Throws friendly errors.
 */
export async function unlockAdmin(password: string): Promise<string> {
  password = String(password || '')
  if (password.length < 6) throw new Error('Password must be at least 6 characters.')

  const existing = localStorage.getItem(PROP_ADMIN_HASH)
  const incoming = await sha256Hex(password)

  if (!existing) {
    localStorage.setItem(PROP_ADMIN_HASH, incoming)
  } else if (incoming !== existing) {
    await wait(700) // crude brute-force throttle (Utilities.sleep in GAS)
    throw new Error('Incorrect password.')
  }

  const token = uuid()
  localStorage.setItem(TOKEN_PREFIX + token, String(Date.now() + ADMIN_TOKEN_TTL_MS))
  return token
}

function isValidAdminToken(token: string | null): boolean {
  if (!token) return false
  const exp = localStorage.getItem(TOKEN_PREFIX + token)
  if (!exp) return false
  if (Date.now() > Number(exp)) {
    localStorage.removeItem(TOKEN_PREFIX + token)
    return false
  }
  return true
}

/**
 * Mirrors saveAnnouncement(token, payload): persists (or clears, when payload
 * is null) the announcement. Each save mints a fresh id so dismissed banners
 * re-show for everyone.
 */
export async function saveAnnouncement(
  token: string | null,
  payload: AnnouncementInput | null,
): Promise<Announcement | null> {
  if (!isValidAdminToken(token)) {
    throw new Error('Your admin session expired. Please unlock admin again.')
  }

  if (payload === null || payload === undefined) {
    localStorage.removeItem(PROP_ANNOUNCEMENT)
    return null
  }

  if (typeof payload !== 'object') throw new Error('Bad payload.')

  const obj: Announcement = {
    id: uuid(),
    title: String(payload.title || '').slice(0, 120).trim(),
    body: String(payload.body || '').slice(0, 600).trim(),
    show: !!payload.show,
    updated: new Date().toISOString(),
  }
  if (!obj.title && !obj.body) {
    throw new Error('Add at least a title or a message.')
  }
  localStorage.setItem(PROP_ANNOUNCEMENT, JSON.stringify(obj))
  return obj
}

/** Mirrors getAnnouncementForEdit(token): the record incl. show=false. */
export async function getAnnouncementForEdit(token: string | null): Promise<Announcement | null> {
  if (!isValidAdminToken(token)) {
    throw new Error('Your admin session expired. Please unlock admin again.')
  }
  const raw = localStorage.getItem(PROP_ANNOUNCEMENT)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Announcement
  } catch {
    return null
  }
}
