// Per-device "I have read this banner" state.
//
// ---------------------------------------------------------------------------
// The stored value's format changed in this port.
// ---------------------------------------------------------------------------
// The Apps Script portal minted a fresh uuid on every announcement save and the
// client stored that uuid to remember a dismissal. The database has no uuid: it
// bumps a `revision` bigint instead, and api/src/routes/portal.js exposes
// String(revision) as the announcement's id. So what this key now holds is
// "3", not "0f2c…-….
//
// A browser that used the old build still has a uuid sitting in localStorage
// under the old key, and possibly under this one after an upgrade. Neither is
// an error: a stored value that is not the current id simply means "this is not
// the banner you dismissed", which is exactly the answer we want — the banner
// shows. Everything below therefore compares as opaque strings and never parses
// the stored value, so a leftover uuid can only ever produce a false, never a
// crash or a NaN.
//
// The old key is also swept on first read, so the stale uuid does not sit in
// storage forever.
// ---------------------------------------------------------------------------

const KEY = 'vcb_portal_ann_dismissed';

// What the pre-port build wrote. Removed the first time this module runs.
const LEGACY_KEY = 'vcb_connect_ann_dismissed';

/**
 * Read the dismissed announcement id, or null.
 *
 * Always a string or null — never a number, never parsed. localStorage can also
 * throw outright (Safari private windows, blocked site data), which must never
 * take the page down over something as minor as a dismissed banner.
 */
export function readDismissedId() {
  try {
    // One-time sweep of the pre-port key. Its value is a uuid that can never
    // match a revision, so nothing is lost by dropping it.
    if (localStorage.getItem(LEGACY_KEY) !== null) {
      localStorage.removeItem(LEGACY_KEY);
    }
    const raw = localStorage.getItem(KEY);
    // Guard the shapes a corrupted or hand-edited entry can take. Anything that
    // is not a plain non-empty string is treated as "nothing stored".
    if (typeof raw !== 'string' || raw === '') return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Has this device dismissed this exact announcement?
 *
 * String comparison, deliberately: `id` is String(revision) today and was a
 * uuid before, and a device holding the old format must simply answer false and
 * see the banner again — not throw, and not coerce '3' and 3 into a match by
 * accident.
 */
export function isDismissed(id) {
  if (id == null) return false;
  const stored = readDismissedId();
  return stored !== null && stored === String(id);
}

export function markDismissed(id) {
  if (id == null) return;
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    /* storage blocked — the banner will simply come back on reload */
  }
}

export function clearDismissed() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
