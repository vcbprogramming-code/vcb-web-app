import crypto from 'node:crypto';
import { query, queryOne } from '../config/db.js';

/**
 * Read-only share links for สำเนาเรียน (CC) recipients.
 *
 * A CC recipient is copied in "เพื่อทราบ" — they never approve. But the notice
 * linked to /memos/:id, which needs an account, and accounts are provisioned by
 * an admin only (the client's rule: เฉพาะอีเมลที่อยู่ในระบบ). Anyone copied in
 * from outside that list hit the login wall with no way through.
 *
 * So each recipient gets their own unguessable token that opens THAT ONE
 * document, read-only: the letter, its status and its approval trail. No
 * register, no other documents, no actions, and it expires. Same trust model as
 * the approval links already in use — the secret IS the authorisation.
 */

// Long enough that guessing is hopeless; URL-safe so it survives an email client.
const TOKEN_BYTES = 32;
// 90 days: a "เพื่อทราบ" copy is often read weeks later, and a dead link means a
// support call. Still bounded — an old link doesn't stay live forever.
const TTL_DAYS = 90;

const makeToken = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');
const expiry = () => new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000).toISOString();

/**
 * Get the live share token for (document, email), creating it if there isn't one
 * and refreshing the expiry so a re-sent notice always carries a working link.
 * Returns the token string, or null if anything went wrong (never throws — a
 * failed link must not stop the email from going out).
 */
export async function ensureShareToken(documentId, email) {
  const addr = String(email || '').trim();
  if (!documentId || !addr) return null;
  try {
    const row = await queryOne(
      `insert into document_share_tokens (document_id, email, token, expires_at)
       values ($1, $2, $3, $4)
       on conflict (document_id, lower(email))
         do update set expires_at = excluded.expires_at
       returning token`,
      [documentId, addr, makeToken(), expiry()]
    );
    return row?.token || null;
  } catch (e) {
    console.error('ensureShareToken failed:', e.message);
    return null;
  }
}

/**
 * Resolve a share token to its document. Returns null when the token is unknown
 * or expired — the caller turns both into the same 404 so a probe can't tell an
 * expired link from a wrong one.
 */
export async function resolveShareToken(token) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const row = await queryOne(
    `select id, document_id, email, expires_at
       from document_share_tokens
      where token = $1 and expires_at > now()`,
    [token]
  );
  if (!row) return null;
  // best-effort access log — the document owner can see the copy was opened
  query(
    `update document_share_tokens
        set last_viewed_at = now(), view_count = view_count + 1
      where id = $1`,
    [row.id]
  ).catch(() => {});
  return row;
}
