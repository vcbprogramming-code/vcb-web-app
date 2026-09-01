// Date and time formatting for meeting rows.
//
// The old lib/i18n.ts mixed these in with the dictionary. They are separate
// here because the dictionary now comes from @vcb/shared and these are pure
// functions of a meeting row — nothing about them needs a provider.
//
// EVERY YEAR SHOWN TO A USER IS BUDDHIST. The stored `date` is ISO Gregorian
// (the database column is a real date), and the meeting rows people read say
// 2569, not 2026. That conversion is applied here, once, rather than at each
// call site — the old code did it in three places and one of them was a
// different arithmetic.

import { MONTHS, MONTHS_SHORT } from '@vcb/shared';

/** Gregorian -> Buddhist era. */
const BE = (y) => y + 543;

/** Split an ISO yyyy-mm-dd into numbers, or null when it is not one. */
function parseIso(value) {
  const p = String(value || '').split('-');
  if (p.length !== 3) return null;
  const y = +p[0];
  const mo = +p[1];
  const d = +p[2];
  if (!y || mo < 1 || mo > 12 || !d) return null;
  return { y, mo, d };
}

/**
 * The letterhead date on the rendered A4 page: "วันที่ 21 พฤษภาคม 2569".
 *
 * Always Thai regardless of the interface language — it is printed onto a Thai
 * company letterhead above Thai body text, and an English date line there would
 * read as a mistake on the document itself, not as a translation.
 */
export function fmtThaiDate(meeting) {
  const p = parseIso(meeting?.date);
  if (!p) return '';
  return `วันที่ ${p.d} ${MONTHS.th[p.mo - 1]} ${BE(p.y)}`;
}

/**
 * The short date on a card or a detail bar, in the reader's language.
 *
 * Falls back, in order, to: the ISO date; the literal word for an Overview row,
 * which has no date by design; and finally the free-text dateLabel with any
 * trailing time stripped off — older rows carry "21 May 2569 10:00" in one
 * field and the time is shown separately.
 */
export function fmtDate(meeting, lang, t) {
  const p = parseIso(meeting?.date);
  if (p) {
    const months = lang === 'th' ? MONTHS.th : MONTHS_SHORT.en;
    return `${p.d} ${months[p.mo - 1]} ${BE(p.y)}`;
  }
  if (meeting?.kind === 'overview') return t ? t('meeting.overview') : 'Overview';
  return String(meeting?.dateLabel || '')
    .replace(/\s*\d{1,2}\s*[:.]\s*\d{2}\s*(?:AM|PM|am|pm|น\.?)?\s*$/i, '')
    .trim();
}

/**
 * The time, normalised to "HH:MM น." — the Thai time suffix, kept in both
 * languages because that is how the source rows are written and how the printed
 * minutes read.
 */
export function fmtTime(meeting) {
  const mm = String(meeting?.time || '').match(/(\d{1,2}):(\d{2})/);
  if (!mm) return '';
  return `${mm[1].length < 2 ? '0' : ''}${mm[0]} น.`;
}

/** "· 10:00 น." or '' — the separator belongs with the value, not the caller. */
export function timeSuffix(meeting) {
  const t = fmtTime(meeting);
  return t ? ` · ${t}` : '';
}

/**
 * Date suffix for an exported PDF's filename: "d.m.yy" in the Buddhist era.
 *
 * Matches the filenames already in the user's export folder ("VCB Meeting
 * Minutes 18.8.69"): dot-separated, NO zero padding, two-digit BE year. Dots
 * are legal in a filename on every OS; slashes are not.
 *
 * Falls back to parsing dateLabel when the ISO field is empty (older rows, and
 * anything the importer could not parse), and returns '' when there is no
 * usable date at all — the filename then simply omits it rather than carrying
 * something misleading like "NaN-NaN-NaN".
 */
export function pdfDateSuffix(meeting) {
  let y = 0;
  let mo = 0;
  let d = 0;

  const p = parseIso(meeting?.date);
  if (p) ({ y, mo, d } = p);

  if (!(y && mo >= 1 && mo <= 12 && d)) {
    const mm = String(meeting?.dateLabel || '').match(
      /(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/
    );
    if (mm) {
      d = +mm[1];
      mo = +mm[2];
      y = +mm[3];
    }
  }
  if (!(y && mo >= 1 && mo <= 12 && d)) return '';

  // Stored years may be Gregorian or already Buddhist; normalise to Buddhist.
  if (y < 2400) y = BE(y);
  return `${d}.${mo}.${y % 100}`;
}

/** A timestamp for a comment or an audit row, in the reader's locale. */
export function fmtTimestamp(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'th' ? 'th-TH-u-nu-latn' : 'en-GB';
  try {
    return `${d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}, ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Month names for the timeline axis and the calendar grid. */
export function monthLabel(monthIndex, lang, short) {
  const table = short ? MONTHS_SHORT : MONTHS;
  return table[lang === 'th' ? 'th' : 'en'][monthIndex] || '';
}
