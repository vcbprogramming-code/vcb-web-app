/**
 * Copy a string to the clipboard, with a fallback.
 *
 * navigator.clipboard can hang rather than reject — a focus-related quirk that
 * leaves the caller waiting forever and the user with no feedback. A timeout
 * guards against that, but it has to be generous: a short one fired while the
 * write was still in flight, the fallback then reported false, and the button
 * said "คัดลอกไม่สำเร็จ" over a clipboard that had the link in it. Telling
 * someone their copy failed when it worked is worse than waiting a moment.
 */
export async function copyText(text) {
  const viaApi = async () => {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard api');
    await navigator.clipboard.writeText(text);
  };
  try {
    await Promise.race([
      viaApi(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** An absolute link to the current page carrying one extra query parameter. */
export function shareUrl(key, value) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?${key}=${encodeURIComponent(value)}`;
}
