import React, { useCallback, useEffect, useState } from 'react';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
import { useHrData } from './HrData';
import { usePrefs } from './prefs';
import { Button, Card, Flash, Hint, Segmented, TextInput } from './ui';
import { addSite, listSitesAdmin, setSiteActive, siteKeyFrom } from './lib/hrApi';
import { errorMessage } from './lib/errors';

/** A labelled row with its control on the right. */
function Row({ title, desc, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0 dark:border-line-dark">
      <div className="min-w-0">
        <div className="font-semibold text-ink dark:text-ink-dark">{title}</div>
        {desc && <Hint>{desc}</Hint>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <Card>
      <h2 className="m-0 text-base font-bold text-ink dark:text-ink-dark">{title}</h2>
      {sub && <p className="mb-1 mt-0.5 text-sm text-ink-muted dark:text-ink-dark-muted">{sub}</p>}
      {children}
    </Card>
  );
}

/* ------------------------------ projects admin ---------------------------- */

/**
 * Opening and closing projects — an ADMIN action that affects everyone.
 *
 * Distinct from the per-device "visible sites" list below: closing a project
 * stops new entries for the whole company, while hiding one only declutters
 * this browser. Conflating them is how a site manager once "hid" a project for
 * the entire company.
 */
function ProjectsAdmin({ onFlash }) {
  const { t } = useI18n();
  const { reload } = useHrData();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (signal) =>
      listSitesAdmin({ signal })
        .then((list) => setRows(Array.isArray(list) ? list : []))
        .catch((err) => {
          if (err?.name !== 'AbortError') onFlash({ kind: 'error', text: errorMessage(err, t) });
        })
        .finally(() => setLoading(false)),
    [onFlash, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function toggle(key, active) {
    try {
      await setSiteActive(key, active);
      onFlash({ kind: 'ok', text: active ? t('set.projectReopened') : t('set.projectClosed') });
      await load();
      reload();
    } catch (err) {
      onFlash({ kind: 'error', text: errorMessage(err, t) });
    }
  }

  async function create() {
    const nm = name.trim();
    if (!nm) return onFlash({ kind: 'error', text: t('set.projectNameRequired') });
    if (rows.some((r) => r.name.trim() === nm)) {
      return onFlash({ kind: 'error', text: t('set.projectDuplicate') });
    }
    setBusy(true);
    try {
      // The key is a permanent internal id and must be lowercase ASCII, so it
      // is derived here rather than typed: a Thai project name yields no ASCII
      // at all and falls back to a stable hash of the name.
      const key = siteKeyFrom(nm, rows.map((r) => r.key));
      await addSite({ key, name: nm, company: company.trim() });
      setName('');
      setCompany('');
      onFlash({ kind: 'ok', text: t('set.projectAdded') });
      await load();
      reload();
    } catch (err) {
      onFlash({ kind: 'error', text: errorMessage(err, t) });
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <Section title={t('set.projects')} sub={t('set.projectsHint')}>
      {loading ? (
        <Hint>{t('common.loading')}</Hint>
      ) : (
        rows.map((p) => (
          <Row
            key={p.key}
            title={p.active ? p.name : `${p.name} · ${t('set.closeProject')}`}
            // The still-assigned headcount warns how many people a closure
            // affects. It warns rather than blocks: projects routinely end
            // before HR moves staff.
            desc={`${p.company || ''}${p.emps ? ` · ${p.emps} ${t('roster.people')}` : ''}`}
          >
            <Segmented
              value={p.active ? 'on' : 'off'}
              onChange={(v) => toggle(p.key, v === 'on')}
              options={[
                ['on', t('set.visibleSites')],
                ['off', t('set.closeProject')],
              ]}
            />
          </Row>
        ))
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <TextInput
          className="flex-1 basis-48"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('set.newProjectName')}
        />
        <TextInput
          className="flex-1 basis-40"
          value={company}
          maxLength={160}
          onChange={(e) => setCompany(e.target.value)}
          placeholder={t('set.newProjectCompany')}
        />
        <Button disabled={busy} onClick={create}>
          + {t('set.addProject')}
        </Button>
      </div>
    </Section>
  );
}

/* -------------------------------- settings -------------------------------- */

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { isAdmin, sites, email, role, lockDays } = useHrData();
  const prefs = usePrefs();
  const [flash, setFlash] = useState(null);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Card className="px-4 py-3">
        <h1 className="m-0 text-xl font-bold text-ink dark:text-ink-dark">
          ⚙️ {t('nav.settings')}
        </h1>
        <p className="m-0 text-sm text-ink-muted dark:text-ink-dark-muted">{t('set.sub')}</p>
      </Card>

      {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

      <Section title={t('set.display')} sub={t('set.storedPerDevice')}>
        {/* Theme and language are shared across every VCB Connect app now —
            changing them here changes them in the portal too, which is the
            point of "one website". */}
        <Row title={t('settings.theme')} desc={t('set.themeHint')}>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              ['light', `☀ ${t('theme.light')}`],
              ['dark', `🌙 ${t('theme.dark')}`],
              ['auto', t('theme.auto')],
            ]}
          />
        </Row>
        <Row title={t('settings.language')} desc={t('set.languageHint')}>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              ['th', 'ไทย'],
              ['en', 'EN'],
            ]}
          />
        </Row>
        <Row title={t('set.yearFormat')} desc={t('set.yearHint')}>
          <Segmented
            value={prefs.yearFmt}
            onChange={prefs.setYearFmt}
            options={[
              ['be', 'พ.ศ.'],
              ['ce', 'ค.ศ.'],
            ]}
          />
        </Row>
        <Row title={t('set.dashDefault')} desc={t('set.dashDefaultHint')}>
          <Segmented
            value={prefs.dashView}
            onChange={prefs.setDashView}
            options={[
              ['progress', t('dash.progress')],
              ['topact', t('dash.topAct')],
              ['topcost', t('dash.topCost')],
            ]}
          />
        </Row>
        <Row title={t('set.cellDisplay')} desc={t('set.cellDisplayDesc')}>
          <Segmented
            value={prefs.cellNames}
            onChange={prefs.setCellNames}
            options={[
              ['code', t('idx.code')],
              ['name', t('set.cellFullName')],
            ]}
          />
        </Row>
      </Section>

      {isAdmin && <ProjectsAdmin onFlash={setFlash} />}

      <Section title={t('set.visibleSites')} sub={t('set.visibleSitesDesc')}>
        {sites.map((s) => (
          <Row key={s.key} title={s.name} desc={s.company}>
            <Segmented
              value={prefs.isHidden(s.key) ? 'hide' : 'show'}
              onChange={(v) => prefs.toggleHidden(s.key, v === 'hide')}
              options={[
                ['show', t('set.visibleSites')],
                ['hide', t('set.hide')],
              ]}
            />
          </Row>
        ))}
        {!sites.length && <Hint>{t('set.noSites')}</Hint>}
      </Section>

      <Section title={t('set.system')}>
        {/* LOCK_DAYS is read-only here. It lives in hr.config and is enforced by
            a database trigger for the whole company; changing it is a migration,
            not a per-user preference, and there is no API route to write it. */}
        <Row title="LOCK_DAYS" desc={t('set.lockDaysDesc')}>
          <span className="font-mono text-sm text-ink dark:text-ink-dark">{lockDays}</span>
        </Row>
      </Section>

      <Section title={t('set.about')}>
        <Row title={t('set.version')}>
          <code className="text-sm">1.0.0</code>
        </Row>
        <Row title={t('set.user')}>
          <span className="text-sm">{email || user?.email}</span>
        </Row>
        <Row title={t('set.rights')}>
          <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-sm dark:bg-surface-dark-sunken">
            {role}
          </span>
        </Row>
        <Row title={t('set.sitesManaged')}>
          <span className="text-sm">{sites.length}</span>
        </Row>
      </Section>
    </div>
  );
}
