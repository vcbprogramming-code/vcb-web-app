/** Settings modal (gear button): account, theme/lang toggles, default-view
 *  selector, sync, sign-out, about/changelog, click-to-copy email.
 *  Mirrors the #settingsBg markup + updateSettingsModal() + copyEmail(). */
import { useEffect, useRef, useState } from 'react';
import type { Store } from '../store';
import { Icon } from '../lib/icons';
import { APP_VERSION, CHANGELOG, DEV_EMAIL, MODULES, MODULES_EN } from '../data/config';

export default function SettingsModal({ s }: { s: Store }) {
  const isDark = s.dark;
  const labels = (s.lang === 'en' ? MODULES_EN : MODULES) as Record<string, string>;
  const [defaultView, setDefaultViewLocal] = useState<string>(() => s.getDefaultView());
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-read the stored default each time the modal opens (mirrors updateSettingsModal).
  useEffect(() => {
    if (s.settingsOpen) setDefaultViewLocal(s.getDefaultView());
  }, [s.settingsOpen, s]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const account = s.userEmail ? s.userEmail + (s.isAdmin ? ' · admin' : '') : '(anonymous)';

  function onChangeDefault(v: string) {
    setDefaultViewLocal(v);
    s.setDefaultView(v);
  }

  function copyEmail() {
    function flash() {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(DEV_EMAIL).then(flash, fallback);
    } else {
      fallback();
    }
    function fallback() {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = DEV_EMAIL;
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
      if (ok) flash();
    }
  }

  return (
    <div
      className={'modal-bg' + (s.settingsOpen ? ' open' : '')}
      id="settingsBg"
      onClick={(e) => {
        if (e.target === e.currentTarget) s.closeSettings();
      }}
    >
      <div className="modal settings-modal">
        <h3>{s.t('settingsTitle')}</h3>

        <div className="sm-section sm-section-account">
          <div className="sm-section-label">{s.t('signedInLbl')}</div>
          <div className="sm-account" id="smAccount">
            {account}
          </div>
        </div>

        <div className="sm-section">
          <div className="sm-section-label">{s.t('displayHdr')}</div>

          <div className="sm-row">
            <label className="sm-row-label">{s.t('themeLbl')}</label>
            <div className="sm-toggle" id="themeToggle" role="group" aria-label="Theme">
              <button
                type="button"
                className={'sm-toggle-btn' + (!isDark ? ' active' : '')}
                data-value="light"
                onClick={() => s.setTheme('light')}
              >
                <Icon name="sun" />
                <span>{s.t('themeLight')}</span>
              </button>
              <button
                type="button"
                className={'sm-toggle-btn' + (isDark ? ' active' : '')}
                data-value="dark"
                onClick={() => s.setTheme('dark')}
              >
                <Icon name="moon" />
                <span>{s.t('themeDark')}</span>
              </button>
            </div>
          </div>

          <div className="sm-row">
            <label className="sm-row-label">{s.t('langLbl')}</label>
            <div className="sm-toggle" id="langToggle" role="group" aria-label="Language">
              <button
                type="button"
                className={'sm-toggle-btn' + (s.lang === 'th' ? ' active' : '')}
                data-value="th"
                onClick={() => s.setLang('th')}
              >
                ไทย · TH
              </button>
              <button
                type="button"
                className={'sm-toggle-btn' + (s.lang === 'en' ? ' active' : '')}
                data-value="en"
                onClick={() => s.setLang('en')}
              >
                English · EN
              </button>
            </div>
          </div>

          <div className="sm-row">
            <label className="sm-row-label" htmlFor="defaultViewSel">
              {s.t('defaultViewLbl')}
            </label>
            <select
              className="sm-select"
              id="defaultViewSel"
              value={defaultView}
              onChange={(e) => onChangeDefault(e.target.value)}
            >
              <option value="flows">{s.t('flowsTitle')}</option>
              <option value="ALL">{s.t('allTitle')}</option>
              {Object.keys(MODULES).map((m) => (
                <option key={m} value={m}>
                  {m} · {labels[m] || MODULES[m as keyof typeof MODULES]}
                </option>
              ))}
              <option value="reports">{s.t('reportsTitle')}</option>
            </select>
            <div className="sm-hint">{s.t('defaultViewHint')}</div>
          </div>
        </div>

        <div className="sm-section">
          <button
            className="sm-action"
            type="button"
            onClick={() => {
              s.doSync();
              s.closeSettings();
            }}
          >
            <Icon name="refresh" />
            <span>{s.t('menuSync')}</span>
          </button>
          <button className="sm-action sm-signout" type="button" onClick={s.signOut}>
            <Icon name="logout" />
            <span>{s.t('signOutLbl')}</span>
          </button>
        </div>

        <div className="sm-section sm-about">
          <div className="sm-section-label">{s.t('aboutHdr')}</div>
          <div className="sm-about-meta">
            <div>
              <span>{s.t('versionTag')}</span>: <b id="smVersion">{APP_VERSION}</b>
            </div>
            <div className="sm-updates">
              <div className="sm-updates-lbl">{s.t('updatesLbl')}</div>
              <ul id="smUpdates">
                {CHANGELOG.map((c: { th: string; en: string }, i: number) => (
                  <li key={i}>{s.lang === 'en' ? c.en || c.th : c.th || c.en}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="sm-section sm-contact-sec">
          <div className="sm-section-label">{s.t('contactHdr')}</div>
          <button
            className={'sm-action sm-contact' + (copied ? ' copied' : '')}
            id="smContact"
            type="button"
            onClick={copyEmail}
            title="คลิกเพื่อคัดลอกอีเมล · Click to copy"
          >
            <span className="sm-contact-mail">
              <Icon name="mail" />
            </span>
            <span id="smContactText" className="sm-contact-email">
              {DEV_EMAIL}
            </span>
            <span className="sm-contact-copy">
              <Icon name={copied ? 'check' : 'copy'} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
