import React from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { CARD_CLASS } from './ui.jsx';

/**
 * The door to the portal.
 *
 * Two ways in, because the staff are not one population. Most people have a
 * vcb-con.com Google account and should never type a password — Google already
 * knows who they are, and an SSO button is one click. Site staff and anyone on
 * a shared machine may not, so email + password stays available rather than
 * locking them out of the launcher entirely.
 *
 * Google is presented first and given the visual weight: it is the path we want
 * people to take, and it is the one that cannot be phished out of them.
 */
export default function SignInScreen() {
  const { t } = useI18n();
  const { signInWithGoogle, signInWithPassword, error, loading } = useAuth();

  const [mode, setMode] = React.useState('choose'); // 'choose' | 'password'
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithPassword(email, password);
    } catch {
      // AuthProvider stores the error; it is rendered below.
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      /* same */
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || loading;


  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-surface p-4 dark:bg-surface-dark">
      {/* The rendered globe, not the canvas one.

          object-cover is the whole reason this works: it fills the viewport and
          crops from the centre at any aspect ratio, so the sphere is centred on
          a phone and on an ultrawide without a single measurement. The canvas
          version needed its size, its DOM overlays and its offsets kept in step
          by hand, and they came apart every time one of them moved.

          muted is what makes autoplay legal in every browser; playsInline stops
          iOS taking it fullscreen. The poster covers the moment before the first
          frame decodes, so the page never flashes an empty black box. */}
      <video
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] select-none object-cover opacity-100 dark:opacity-95"
        src="/globe.mp4"
        poster="/globe-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {/* Darkens the video enough for white text to hold up over the bright
          continents, without dimming the globe into mud. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-surface/25 dark:bg-surface-dark/35"
      />
      {/* A soft pool of shadow directly behind the card. Without it the card
          sits on the brightest part of the globe and the edges disappear. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 38% 42% at 50% 50%, rgba(0,0,0,0.32), transparent 72%)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand block, not a card — the portal is the product, and the sign-in
            page is the first thing anyone sees of it. */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 text-2xl">
            <span aria-hidden="true">🌐</span>
          </div>
          <h1 className="m-0 text-xl font-bold tracking-tight text-ink dark:text-ink-dark">
            VCB CONNECT
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-muted dark:text-ink-dark-muted">
            {t('portal.subtitle')}
          </p>
        </div>

        {/* backdrop-blur so the globe reads as depth behind the card rather
            than as texture through the middle of the form */}
        {/* Solid, not translucent. At /90 the globe read straight through the
            form and the text lost contrast; the blur alone gives the sense of
            depth without turning the card into a window. */}
        <div className={`${CARD_CLASS} bg-white p-6 shadow-2xl dark:bg-surface-dark-raised`}>
          {mode === 'choose' ? (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={google}
                disabled={disabled}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface disabled:opacity-60 dark:border-line-dark dark:bg-surface-dark-raised dark:text-ink-dark dark:hover:bg-surface-dark"
              >
                {/* Google's mark, inline: the CSP allows no external images and
                    a coloured G is what people look for on an SSO button. */}
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.5 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.1z" />
                  <path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.8-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.8-3.7-13.7-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
                </svg>
                {t('auth.signInWithGoogle')}
              </button>

              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-line dark:bg-line-dark" />
                <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  {t('auth.or')}
                </span>
                <span className="h-px flex-1 bg-line dark:bg-line-dark" />
              </div>

              <button
                type="button"
                onClick={() => setMode('password')}
                disabled={disabled}
                className="w-full rounded-lg border border-line bg-transparent px-4 py-3 text-sm font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-60 dark:border-line-dark dark:text-ink-dark-muted dark:hover:bg-surface-dark-raised"
              >
                {t('auth.usePassword')}
              </button>
            </div>
          ) : (
            <form onSubmit={submitPassword} className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
                  {t('auth.email')}
                </span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 dark:border-line-dark dark:bg-surface-dark-raised dark:text-ink-dark"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted">
                  {t('auth.password')}
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 dark:border-line-dark dark:bg-surface-dark-raised dark:text-ink-dark"
                />
              </label>

              <button
                type="submit"
                disabled={disabled}
                className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {busy ? t('auth.signingIn') : t('auth.signIn')}
              </button>

              <button
                type="button"
                onClick={() => setMode('choose')}
                disabled={disabled}
                className="w-full bg-transparent py-1 text-xs text-ink-muted underline-offset-2 hover:underline dark:text-ink-dark-muted"
              >
                {t('auth.back')}
              </button>
            </form>
          )}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error.code === 'BAD_CREDENTIALS' ? t('auth.badCredentials') : t('auth.failed')}
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted dark:text-ink-dark-muted">
          {t('portal.internalOnly')}
        </p>
      </div>
    </div>
  );
}
