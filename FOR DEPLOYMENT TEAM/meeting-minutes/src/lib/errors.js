// Turning an ApiError into something a person can act on.
//
// shared/src/api.js is explicit that `err.message` is a machine-readable code
// and must never be printed at a user. The old code did exactly that, in about
// thirty catch blocks: `onToast('Failed: ' + e.message)`. Under the mock that
// produced readable English by accident; against the real API it would show a
// Thai reader the string "VALIDATION_FAILED". So every catch block in this
// module ends here, and this is the only place that decides what a failure
// reads as.

/**
 * The error codes this module handles beyond the shared set. The shared
 * dictionary already covers NETWORK_ERROR, FORBIDDEN, NOT_FOUND,
 * VALIDATION_FAILED, INTERNAL and the auth codes under `error.*`.
 */
export const MINUTES_ERROR_KEYS = {
  // Deleting one of the original five. They carry the Doc-era history, and
  // removing one would cascade away its guest list and orphan its minutes.
  // A business rule, not a fault — it needs its own sentence saying so.
  PROJECT_BUILTIN: 'err.projectBuiltin',
  // Deleting a project that still holds meetings.
  PROJECT_NOT_EMPTY: 'err.projectNotEmpty',
  // Tagging INTO an inbox. Recordings move out of an inbox by being tagged
  // elsewhere; an inbox is never a tag target.
  CANNOT_TAG_INBOX: 'err.cannotTagInbox',
  // Tagging a row that is not an inbox recording at all.
  NOT_AN_INBOX_ROW: 'err.notAnInboxRow',
  PROJECT_NOT_FOUND: 'err.projectNotFound',
  COMMENT_NOT_FOUND: 'err.commentNotFound',
  BAD_VERSION: 'err.badVersion',
  UPLOAD_FAILED: 'err.uploadFailed',
};

/**
 * The message to show for a failed request.
 *
 *   catch (err) { toast(errorMessage(err, t)) }
 *
 * Falls through to the shared `error.<CODE>` entries, then to a generic
 * message — never to err.message.
 */
export function errorMessage(err, t, vars) {
  const code = err?.code || 'INTERNAL';

  // INVALID_EMAIL carries the offending addresses, and naming them is the whole
  // value of the message: the API rejects the WHOLE pasted batch on one bad
  // entry, so "check your list" without saying which is useless.
  if (code === 'INVALID_EMAIL') {
    const bad = err?.body?.emails;
    return Array.isArray(bad) && bad.length
      ? t('err.invalidEmailList', { emails: bad.join(', ') })
      : t('err.invalidEmail');
  }

  const own = MINUTES_ERROR_KEYS[code];
  if (own) return t(own, vars);

  // The shared dictionary keys its API errors as error.<CODE>. translate()
  // returns the key itself when there is no entry, which is how we detect a
  // code nobody has written copy for yet.
  const key = `error.${code}`;
  const text = t(key, vars);
  return text === key ? t('common.error') : text;
}

/**
 * True when a read came back 404 because the caller may not see it.
 *
 * The API answers 404, not 403, for a meeting in a project the caller cannot
 * read — the id itself is not something a locked project should confirm. So the
 * UI cannot distinguish "gone" from "not yours" and must not try: both read as
 * "not found".
 */
export const isNotFound = (err) => err?.status === 404;
