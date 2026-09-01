// The sign-in screen.
//
// Under Apps Script, identity was free: Session.getActiveUser().getEmail() came
// from Google and could not be forged, so the app never had a login. As a SPA
// there is no such thing — identity is the JWT the API issues, and this screen
// is where it is obtained (TECH_STACK.md, "Apps Script ให้ identity ฟรี แต่ที่นี่ไม่มี").
//
// Password sign-in is what AuthProvider exposes without a Google client script
// on the page; the shared provider also carries signInWithGoogle(idToken) for
// wherever the portal supplies one.

import React, { useState } from 'react';
import { useAuth, useT } from '@vcb/shared';
import { Button, Card, Field, Input } from './ui.jsx';

export default function SignIn() {
  const t = useT();
  const { signInWithPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (error) {
      // err.code is the API's machine-readable code; render our own message
      // for it rather than showing err.message, which is not user copy.
      setErr(error?.code || 'INTERNAL');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 dark:bg-surface-dark">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-extrabold text-ink dark:text-ink-dark">{t('app.title')}</h1>
        <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">{t('app.subtitle')}</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
          <Field label={t('auth.email')} required>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label={t('auth.password')} required>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {err ? (
            <p className="rounded-control bg-danger-bg px-3 py-2 text-xs font-semibold text-danger-fg dark:bg-danger/20 dark:text-danger-dark">
              {t(`error.${err}`)}
            </p>
          ) : null}

          <Button type="submit" disabled={loading}>
            {loading ? t('common.loading') : t('auth.signIn')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
