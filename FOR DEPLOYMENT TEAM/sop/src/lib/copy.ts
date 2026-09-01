/**
 * Generic clipboard write with a timeout-race fallback, mirrors copyText() in
 * the canonical index.html (shared by shareCase/shareFlow and copyEmail there).
 *
 * navigator.clipboard.writeText() can hang indefinitely instead of resolving
 * or rejecting inside Apps Script's sandboxed iframe — a permission prompt
 * stuck in limbo in that cross-origin frame. This port isn't hosted inside
 * that sandbox, so the hang may not reproduce here, but the race is strictly
 * safer than a bare writeText() call, so it's ported as-is: whichever settles
 * first (the Clipboard API or a 600ms timeout) wins, and a timeout falls back
 * to execCommand('copy') immediately rather than leaving the caller waiting.
 */
export function copyText(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const fallback = () => {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
      done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      setTimeout(fallback, 600); // clipboard API didn't answer in time — don't wait on it
      navigator.clipboard.writeText(text).then(() => done(true), fallback);
    } else {
      fallback();
    }
  });
}
