import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { isInboxProject } from '../lib/minutes';
import { Button, Dot, Loading, TextInput, useConfirm } from '../ui';

/**
 * Who may open each project.
 *
 * A full-page workspace, not a dialog: naming the people who may see each
 * project means many projects times many addresses, and a centred modal gave
 * that a cramped scroll box floating over a dimmed app.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN NO LONGER DOES, AND WHY.
 * ---------------------------------------------------------------------------
 * The Apps Script app was deployed ANYONE_ANONYMOUS, so Google never told the
 * server who a visitor was and the app had to run its own credential system:
 * an editor allow-list, per-person 4-digit PINs, a shared team PIN, and a
 * forced PIN change on first sign-in. All of that was a workaround for having
 * no identity, and all of it is gone. Identity is a JWT now and roles live in
 * one place for all seven modules (api/src/auth.js), so:
 *
 *   - the Editors tab is gone         -> roles are granted in the portal
 *   - PIN management is gone          -> there are no PINs
 *   - the shared team PIN is gone     -> it existed only to avoid making accounts
 *
 * Two per-project features also went, because the ported schema has no column
 * for them and the API exposes no route:
 *
 *   - "allow the whole @vcb-con.com domain"  (ProjectAccess.domain)
 *   - "copy this guest list to other projects" (copyProjectViewers)
 *
 * Both are noted in PORT_NOTES.md. The domain flag in particular must not be
 * faked client-side by adding every staff address: that would look identical in
 * this list but would not follow new hires, and removing someone would silently
 * differ from what an admin expected.
 */
export default function AccessPage({ onClose, onToast, onBusy }) {
  const { t } = useI18n();
  const { projects, refresh } = useMinutesData();
  const { confirm, node: confirmNode } = useConfirm();

  // Guest lists are fetched per project — the API has no bulk endpoint, so one
  // request each, in parallel, once.
  const [access, setAccess] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  // An inbox has no guest list worth managing: its rows reach people through
  // whichever project they are tagged into.
  const manageable = useMemo(() => projects.filter((p) => !isInboxProject(p.id)), [projects]);

  useEffect(() => {
    if (!manageable.length) return undefined;
    let alive = true;
    const ac = new AbortController();
    setError('');

    Promise.all(
      manageable.map((p) =>
        minutesApi
          .getProjectAccess(p.id, { signal: ac.signal })
          // One unreadable project must not blank the whole screen; it shows
          // with an empty list rather than vanishing.
          .catch(() => ({ id: p.id, name: p.name, nameEn: p.nameEn, color: p.color, isPublic: p.isPublic, emails: [] }))
      )
    )
      .then((rows) => {
        if (alive) setAccess(rows);
      })
      .catch((err) => {
        if (!alive || err?.name === 'AbortError') return;
        setError(errorMessage(err, t));
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [manageable, t]);

  // This page owns the viewport while it is up, so the app behind it must not
  // scroll. Cleanup runs on close and on unmount alike.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape closes — unless a field has something typed in it, where it clears
  // the field instead of throwing away the screen.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const el = e.target;
      if (el?.tagName === 'INPUT' && el.value) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patchRow = (id, next) =>
    setAccess((rows) => (rows || []).map((r) => (r.id === id ? { ...r, ...next } : r)));

  async function togglePublic(row) {
    const willBePublic = !row.isPublic;
    if (willBePublic) {
      const ok = await confirm(t('access.confirmPublish'), {
        title: t('access.confirmPublishTitle'),
        okLabel: t('access.confirmPublishOk'),
      });
      if (!ok) return;
    }
    onBusy(willBePublic ? t('access.unlocking') : t('access.locking'));
    try {
      const { isPublic } = await minutesApi.setProjectPublic(row.id, willBePublic);
      patchRow(row.id, { isPublic });
      // Unlocking publishes every meeting already in the project, so the counts
      // and the meeting list both change.
      await refresh();
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function addGuests(row) {
    const text = (drafts[row.id] || '').trim();
    if (!text) return;
    onBusy(t('access.adding'));
    try {
      // One or many: the API splits on commas, semicolons and whitespace, and
      // rejects the WHOLE batch on a bad entry so a typo is reported rather
      // than half-saved. errorMessage names the offenders.
      const { emails } = await minutesApi.addProjectGuests(row.id, text);
      patchRow(row.id, { emails });
      setDrafts((d) => ({ ...d, [row.id]: '' }));
      onToast(t('access.updated'));
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function removeGuest(row, email) {
    onBusy(t('access.removing'));
    try {
      const { emails } = await minutesApi.removeProjectGuest(row.id, email);
      patchRow(row.id, { emails });
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  const q = filter.trim().toLowerCase();
  const shown = (access || []).filter(
    (p) => !q || `${p.name} ${p.nameEn} ${(p.emails || []).join(' ')}`.toLowerCase().includes(q)
  );

  // Locked with nobody named means admins and editors only — legitimate, but
  // easy to arrive at by accident and hard to diagnose from outside.
  const bare = (access || []).filter((p) => !p.isPublic && !p.emails?.length);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-surface dark:bg-surface-dark">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-line bg-surface-card px-7 pb-3.5 pt-5 dark:border-line-dark dark:bg-surface-dark-card">
        <div>
          <h2 className="m-0 text-xl font-bold text-brand-900 dark:text-brand-300">
            {t('access.title')}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted dark:text-ink-dark-muted">
            {t('access.sub')}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-1.5 dark:border-line-dark dark:bg-surface-dark-sunken">
            <span aria-hidden="true" className="text-[13px] opacity-65">🔎</span>
            <input
              type="search"
              aria-label={t('access.filter')}
              placeholder={t('access.filter')}
              autoComplete="off"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-[240px] max-w-[40vw] border-0 bg-transparent p-0 text-[13px] text-ink outline-none dark:text-ink-dark"
            />
          </div>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-7 pb-10 pt-5">
        {error ? (
          <p className="text-danger dark:text-danger-dark">{error}</p>
        ) : access === null ? (
          <Loading />
        ) : (
          <>
            {bare.length ? (
              <div className="mb-4 rounded-[10px] border border-[#eac54f] bg-[#fff8c5] px-3.5 py-3 text-[12.5px] leading-relaxed text-warn-fg dark:border-[#6b5117] dark:bg-[#2d2410] dark:text-[#e3b341]">
                {t('access.bare', { n: bare.length })}
              </div>
            ) : null}

            <div className="mb-4 max-w-[900px] text-[12.5px] leading-relaxed text-ink-muted dark:text-ink-dark-muted">
              <p>
                <b>{t('access.public')}</b> — {t('access.legendPublic')}
              </p>
              <p>
                <b>{t('access.locked')}</b> — {t('access.legendLocked')}
              </p>
              <p className="mt-1.5 italic">{t('access.legendTip')}</p>
            </div>

            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(380px,1fr))]">
              {shown.map((p) => (
                <section
                  key={p.id}
                  className={`flex flex-col rounded-card border border-line bg-surface-card px-[17px] py-4 dark:border-line-dark dark:bg-surface-dark-card ${
                    p.isPublic ? 'opacity-[.82]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2 font-bold text-brand-900 dark:text-brand-300">
                      <Dot color={p.color} size={9} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePublic(p)}
                      className={`shrink-0 rounded-pill border px-3 py-1 text-xs font-semibold ${
                        p.isPublic
                          ? 'border-[#7ee2a8] bg-ok-bg text-ok-fg dark:border-[#2ea043] dark:bg-[#0d3321] dark:text-[#7ee2a8]'
                          : 'border-line bg-surface text-ink-muted dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark-muted'
                      }`}
                    >
                      {p.isPublic ? t('access.public') : t('access.locked')}
                    </button>
                  </div>

                  {p.isPublic ? (
                    // A guest list on a public project would be a control that
                    // does nothing; say so rather than showing a dead input.
                    <div className="mt-3 border-t border-dashed border-line pt-3 text-xs leading-relaxed text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
                      {t('access.publicNote')}
                      {p.emails?.length
                        ? t('access.publicNoteKept', { n: p.emails.length })
                        : '.'}
                    </div>
                  ) : (
                    <div className="mt-3 border-t border-dashed border-line pt-3 dark:border-line-dark">
                      <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[.03em] text-ink-muted dark:text-ink-dark-muted">
                        {p.emails?.length
                          ? t('access.whoCanSeeN', { n: p.emails.length })
                          : t('access.whoCanSee')}
                      </div>

                      {p.emails?.length ? (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {p.emails.map((em) => (
                            <span
                              key={em}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-line bg-surface py-[3px] pl-3 pr-1.5 text-[12.5px] dark:border-line-dark dark:bg-surface-dark-sunken"
                            >
                              <span className="truncate text-ink dark:text-ink-dark">{em}</span>
                              <button
                                type="button"
                                onClick={() => removeGuest(p, em)}
                                title={t('access.removeEmail', { email: em })}
                                aria-label={t('access.removeEmail', { email: em })}
                                className="rounded-full px-1 text-sm leading-none text-ink-muted hover:bg-danger-bg hover:text-danger dark:text-ink-dark-muted dark:hover:bg-danger/20 dark:hover:text-danger-dark"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-2 text-[12.5px] text-ink-muted dark:text-ink-dark-muted">
                          {t('access.nobodyNamed')}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <TextInput
                          value={drafts[p.id] || ''}
                          placeholder={t('access.addPlaceholder')}
                          autoComplete="off"
                          onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addGuests(p);
                            }
                          }}
                          className="min-w-0 flex-1 px-2.5 py-1.5 text-[12.5px]"
                        />
                        <Button variant="primary" onClick={() => addGuests(p)}>
                          {t('common.add')}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {!shown.length ? (
              <p className="px-0.5 py-7 text-center text-ink-muted dark:text-ink-dark-muted">
                {t('access.noMatch')}
              </p>
            ) : null}
          </>
        )}
      </div>
      {confirmNode}
    </div>
  );
}
