/**
 * §3 — the site loses signal mid-entry.
 *
 * A foreman keying thirty people on a phone at the far end of a site will drop
 * the connection, and the criteria are explicit: what was typed must not be
 * lost, and must not be counted twice when the signal returns.
 *
 * Both fall out of the same decision — the queue stores the *intent* (this
 * person, this day, this value) rather than "an action that happened". The
 * server writes a day by upserting on (employee, date), so replaying an intent
 * twice lands on the same row. That is why there is no de-duplication logic
 * here: making the operation idempotent is what removes the need for it.
 */
const KEY = 'vcb_worklog_queue';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const write = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
};

/** One pending write, keyed so a newer value for the same cell replaces it. */
export function enqueue(entry) {
  const items = read().filter((x) => x.key !== entry.key);
  items.push({ ...entry, at: Date.now() });
  write(items);
  return items.length;
}

export function pending() { return read(); }
export function pendingCount() { return read().length; }
export function clearQueue() { write([]); }

/**
 * Send everything queued. Anything that fails for a reason the server gave
 * (locked day, verified row) is dropped — replaying it will never succeed and
 * keeping it would block the queue forever. Anything that fails because the
 * network is still down stays for the next attempt.
 */
export async function flush(send) {
  const items = read();
  if (!items.length) return { sent: 0, dropped: 0, kept: 0 };
  const keep = []; let sent = 0; let dropped = 0;
  for (const item of items) {
    try { await send(item); sent += 1; }
    catch (e) {
      if (e?.status && e.status >= 400 && e.status < 500) dropped += 1;
      else keep.push(item);
    }
  }
  write(keep);
  return { sent, dropped, kept: keep.length };
}

/** Run `fn` whenever the browser says it is back online, and once now. */
export function onReconnect(fn) {
  window.addEventListener('online', fn);
  return () => window.removeEventListener('online', fn);
}
