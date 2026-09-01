// Turning an ApiError into something a person can act on.
//
// shared/src/api.js is explicit that `err.message` is a machine-readable code
// and must never be printed at a user. So every catch block in this module ends
// here, and this is the only place that decides what a failure reads as.

/**
 * The error codes this module handles beyond the shared set. The shared
 * dictionary already covers NETWORK_ERROR, FORBIDDEN, FORBIDDEN_SITE,
 * NOT_FOUND, VALIDATION_FAILED, INTERNAL and the auth codes under `error.*`.
 */
export const HR_ERROR_KEYS = {
  // The one that matters most. enforce_entry_window in 004_hr.sql refuses a
  // write outside the editable window and the API translates it to a 403 with
  // this code. It is a BUSINESS RULE, not a bug: the person is trying to edit a
  // day that closed, or to fill in further ahead than tomorrow. Saying
  // "something went wrong" here sends them to IT for a system working exactly
  // as designed, so it gets its own sentence naming the window.
  OUTSIDE_EDIT_WINDOW: 'err.outsideEditWindow',
  ALREADY_DECIDED: 'err.alreadyDecided',
  BAD_RANGE: 'req.badRange',
  ALREADY_EXISTS: 'err.duplicateSite',
};

/**
 * The message to show for a failed request.
 *
 *   catch (err) { setError(errorMessage(err, t, { lockDays })) }
 *
 * Falls through to the shared `error.<CODE>` entries, then to a generic
 * message — never to err.message.
 */
export function errorMessage(err, t, vars) {
  const code = err?.code || 'INTERNAL';

  const own = HR_ERROR_KEYS[code];
  if (own) return t(own, vars);

  // The shared dictionary keys its API errors as error.<CODE>. translate()
  // returns the key itself when there is no entry, which is how we detect a
  // code nobody has written copy for yet.
  const key = `error.${code}`;
  const text = t(key, vars);
  return text === key ? t('common.error') : text;
}

/** True when the failure is the edit window closing, not a fault. */
export const isEditWindowError = (err) => err?.code === 'OUTSIDE_EDIT_WINDOW';
