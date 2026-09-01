// ตั้งค่า / Settings — theme, language, and the cost-category list.
//
// Theme and language come from the shared providers, so the choice follows the
// person across every VCB Connect module rather than being this app's private
// preference (see shared/src/theme.jsx on the five keys this replaces).
//
// The category list is server state: PUT /api/credit/cost-categories replaces
// it wholesale, because it is ordered and the client edits it as one array.

import React, { useEffect, useState } from 'react';
import { useI18n, useTheme } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { Button, Field, Input, Modal, Select } from './ui.jsx';

export default function SettingsDialog({ open, onClose }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme, themes } = useTheme();
  const { costCategories, isManager, mutate, notify } = useData();

  const [list, setList] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setList([...(costCategories || [])]);
  }, [open, costCategories]);

  const add = () => {
    const v = draft.trim();
    if (!v || list.includes(v)) {
      setDraft('');
      return;
    }
    setList((l) => [...l, v]);
    setDraft('');
  };

  const removeAt = (i) => setList((l) => l.filter((_, idx) => idx !== i));

  const move = (i, delta) =>
    setList((l) => {
      const j = i + delta;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setBusy(true);
    try {
      await mutate(() => apiCredit.setCostCategories(list), t('set.saved'));
      onClose();
    } catch (err) {
      notify(t(`error.${err?.code}`) || t('misc.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('set.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.close')}
          </Button>
          {isManager ? (
            <Button onClick={save} disabled={busy}>
              {busy ? t('common.saving') : t('action.save')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
            {t('set.display')}
          </h4>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('set.theme')}>
              <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
                {themes.map((x) => (
                  <option key={x} value={x}>
                    {t(`theme.${x}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('set.language')}>
              <Select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="th">{t('set.thai')}</option>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
            {t('set.costCategories')}
          </h4>
          <p className="mb-3 text-[11px] text-ink-muted dark:text-ink-dark-muted">
            {t('set.catOrderHint')}
          </p>

          {!list.length ? (
            <p className="py-4 text-center text-sm text-ink-muted dark:text-ink-dark-muted">
              {t('set.noCats')}
            </p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1">
              {list.map((c, i) => (
                <li
                  key={`${c}-${i}`}
                  className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-sm dark:border-line-dark"
                >
                  <span className="min-w-0 flex-1 truncate text-ink dark:text-ink-dark">{c}</span>
                  {isManager ? (
                    <>
                      <IconBtn label={t('action.moveUp')} onClick={() => move(i, -1)} disabled={i === 0}>
                        ▲
                      </IconBtn>
                      <IconBtn
                        label={t('action.moveDown')}
                        onClick={() => move(i, 1)}
                        disabled={i === list.length - 1}
                      >
                        ▼
                      </IconBtn>
                      <IconBtn label={t('common.delete')} onClick={() => removeAt(i)}>
                        ×
                      </IconBtn>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isManager ? (
            <div className="flex gap-2">
              <Input
                value={draft}
                placeholder={t('set.newCatPlaceholder')}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button variant="ghost" onClick={add}>
                {t('set.addCat')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

function IconBtn({ children, label, ...rest }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="focusable rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30 dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark"
      {...rest}
    >
      {children}
    </button>
  );
}
