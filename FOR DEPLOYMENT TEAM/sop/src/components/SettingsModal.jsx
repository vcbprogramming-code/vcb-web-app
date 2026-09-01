/**
 * Settings: account, theme, language, default view, sign-in/out, about.
 *
 * Theme and language now go through the shared providers, so a choice made here
 * follows the person into every other VCB Connect module — which is the point
 * of "one website". The old module-local sop-night / sop-lang keys are gone.
 *
 * Theme gained a third option: the shared provider's default is 'auto', which
 * follows the OS. The old two-way light/dark switch could not express it.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useI18n, useTheme } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { copyText } from '../lib/copy.js';
import { APP_VERSION, CHANGELOG, DEV_EMAIL, DEV_NAME, MODULE_ORDER, moduleLabel } from '../data/config.js';
import { getDefaultView, setDefaultView, useStore } from '../store.jsx';
import { Button, Field, Modal, Select } from './ui.jsx';

/** A segmented two-or-three-way switch. */
function Segmented({ value, options, onChange, label }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-control border border-line p-0.5 dark:border-line-dark"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            value === o.value
              ? 'bg-brand-700 text-white'
              : 'text-ink-muted hover:bg-surface-sunken dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken'
          }`}
        >
          {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0 dark:border-line-dark">
      <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

export default function SettingsModal({ onClose }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { signedIn, signOut } = useAuth();
  const { canEdit, hasEditorRole, userEmail } = useStore();
  const navigate = useNavigate();

  const [view, setView] = useState(() => getDefaultView());
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  function onCopyEmail() {
    copyText(DEV_EMAIL).then((ok) => {
      if (!ok) return;
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  function onChangeView(v) {
    setView(v);
    setDefaultView(v);
  }

  return (
    <Modal
      title={t('settings.title')}
      onClose={onClose}
      size="md"
      footer={
        <Button onClick={onClose} className="ml-auto">
          {t('common.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Section title={t('settings.signedIn')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold break-thai">
              {signedIn ? userEmail : t('auth.anonymous')}
            </span>
            {canEdit && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-ok-bg px-2 py-0.5 text-[11px] font-bold text-ok-fg dark:bg-ok/20 dark:text-ok-dark">
                <Icon name="shield" className="h-3 w-3" />
                {t('auth.editorBadge')}
              </span>
            )}
          </div>
          {/* Reading needs no session, so signing out is not a way of "leaving"
              the app — say what signing in is actually for. */}
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted">
            {signedIn && !canEdit ? t('error.notEditor') : t('auth.readOnlyNote')}
          </p>
        </Section>

        <Section title={t('settings.display')}>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t('settings.theme')}</span>
              <Segmented
                label={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: t('theme.light'), icon: 'sun' },
                  { value: 'dark', label: t('theme.dark'), icon: 'moon' },
                  { value: 'auto', label: t('theme.auto') },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t('settings.lang')}</span>
              <Segmented
                label={t('settings.lang')}
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'th', label: 'ไทย · TH' },
                  { value: 'en', label: 'English · EN' },
                ]}
              />
            </div>

            <Field label={t('settings.defaultView')} hint={t('settings.defaultViewHint')}>
              <Select value={view} onChange={(e) => onChangeView(e.target.value)}>
                <option value="flows">{t('flows.title')}</option>
                <option value="ALL">{t('label.all')}</option>
                {MODULE_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {m} · {moduleLabel(m, lang)}
                  </option>
                ))}
                <option value="reports">{t('reports.title')}</option>
              </Select>
            </Field>
          </div>
        </Section>

        {(canEdit || hasEditorRole) && (
          <Section title={t('settings.versions')}>
            <Button
              onClick={() => {
                onClose();
                navigate('/versions');
              }}
            >
              <Icon name="refresh" className="h-4 w-4" />
              {t('versions.title')}
            </Button>
          </Section>
        )}

        <Section title={t('auth.signIn')}>
          {signedIn ? (
            <Button onClick={signOut}>
              <Icon name="logout" className="h-4 w-4" />
              {t('settings.signOut')}
            </Button>
          ) : (
            // No sign-in form here: authentication is the portal's job and the
            // JWT is shared across every module. Sending people there keeps one
            // login screen rather than seven.
            <a href={import.meta.env.VITE_PORTAL_URL || '/'}>
              <Button variant="primary">
                <Icon name="logout" className="h-4 w-4" />
                {t('auth.signInToEdit')}
              </Button>
            </a>
          )}
        </Section>

        <Section title={t('settings.about')}>
          <div className="text-[13px]">
            <div>
              <span className="text-ink-muted dark:text-ink-dark-muted">
                {t('settings.versionTag')}
              </span>
              : <b>{APP_VERSION}</b>
            </div>
            <div className="mt-2.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
                {t('settings.updates')}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-ink-subtle break-thai dark:text-ink-dark-muted">
                {CHANGELOG.map((c, i) => (
                  <li key={i}>{lang === 'en' ? c.en || c.th : c.th || c.en}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title={t('settings.contact')}>
          <button
            type="button"
            onClick={onCopyEmail}
            title={t('settings.copyEmail')}
            className="flex w-full items-center gap-2 rounded-control border border-line px-3 py-2 text-left text-[13px] hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
          >
            <Icon name="mail" className="h-4 w-4 shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 truncate">
              {DEV_NAME} · {DEV_EMAIL}
            </span>
            <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4 shrink-0 text-ink-muted" />
          </button>
        </Section>
      </div>
    </Modal>
  );
}
