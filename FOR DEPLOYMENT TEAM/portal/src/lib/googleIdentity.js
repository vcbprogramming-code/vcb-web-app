// Actually getting a Google ID token in the browser, via Google Identity
// Services (GIS) — the piece that was missing entirely. signInWithGoogle()
// in shared/src/auth.jsx always required a real idToken (the API verifies it
// against Google server-side, in auth.js's verifyGoogleIdToken), but nothing
// in this app ever obtained one: the button called signInWithGoogle() with no
// argument, so every click silently sent idToken: undefined and failed.
//
// Gated on VITE_GOOGLE_CLIENT_ID. Without it, `available` is false and the
// caller hides the button — a visible button that can never succeed is worse
// than no button, and the password path stays open either way.

import { useCallback, useEffect, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * @returns {{ available: boolean, requestIdToken: () => Promise<string> }}
 *
 * `requestIdToken()` shows Google's own One Tap / account-chooser prompt and
 * resolves with a signed idToken (a JWT) once the person picks an account —
 * this is the credential the /api/auth/google route actually verifies, not
 * anything invented client-side.
 */
export function useGoogleIdToken() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestIdToken = useCallback(() => {
    if (!CLIENT_ID) {
      return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured'));
    }
    return new Promise((resolve, reject) => {
      loadGis()
        .then(() => {
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            // credential is the idToken; resolve/reject drive the caller's
            // own busy state rather than this hook holding UI state.
            callback: (response) => {
              if (response?.credential) resolve(response.credential);
              else reject(new Error('No credential returned'));
            },
          });
          // prompt() shows One Tap, or the account chooser if One Tap was
          // dismissed/skipped recently — notification covers both paths so a
          // declined/unavailable prompt still rejects instead of hanging.
          window.google.accounts.id.prompt((notification) => {
            if (
              notification.isNotDisplayed?.() ||
              notification.isSkippedMoment?.()
            ) {
              reject(new Error('Google sign-in was not shown'));
            }
          });
        })
        .catch(reject);
    });
  }, []);

  return { available: Boolean(CLIENT_ID) && ready, requestIdToken };
}
