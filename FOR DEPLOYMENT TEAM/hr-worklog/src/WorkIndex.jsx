import React, { useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { useHrData } from './HrData';
import { Card, Hint, TextInput } from './ui';

/**
 * The master work index — the two vocabularies every cell is built from.
 *
 *   กิจกรรม (Activity)      what was done          A-1, B-2, Z-2 …
 *   หมวดงาน (Work Category) which ERP cost it hits  1, 5, 20 …
 *
 * A `one-to-one` activity carries its own fixed cost and the picker stops after
 * step 1; `one-to-many` asks for a category as step 2. That mapping is what
 * decides whether the picker is one click or two, so it is shown here plainly.
 *
 * Read-only. Editing reference data is PUT /api/hr/index/activity and is admin
 * only; the write UI is not carried over from the sheet, where it was a
 * paste-from-Excel bulk import that this port deliberately does not reproduce
 * (see the note at the foot of api/src/routes/hr.js).
 */
export default function WorkIndex() {
  const { t } = useI18n();
  const { activities, costs } = useHrData();
  const [tab, setTab] = useState('work');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const shownActivities = useMemo(
    () =>
      !q
        ? activities
        : activities.filter((a) =>
            [a.code, a.name, a.desc, a.category].some((x) =>
              String(x || '').toLowerCase().includes(q)
            )
          ),
    [activities, q]
  );

  const shownCosts = useMemo(
    () =>
      !q
        ? costs
        : costs.filter((c) =>
            [c.code, c.name, c.name_en].some((x) => String(x || '').toLowerCase().includes(q))
          ),
    [costs, q]
  );

  const th =
    'border-b border-line px-2 py-2 text-left text-xs font-bold uppercase tracking-wide ' +
    'text-ink-muted dark:border-line-dark dark:text-ink-dark-muted';
  const td = 'border-b border-line/60 px-2 py-1.5 align-top dark:border-line-dark/60';

  return (
    <>
      <Card className="px-4 py-3">
        <h1 className="m-0 text-xl font-bold text-ink dark:text-ink-dark">{t('nav.index')}</h1>
        <p className="m-0 mb-3 text-sm text-ink-muted dark:text-ink-dark-muted">{t('idx.sub')}</p>
        <div className="flex flex-wrap items-center gap-1 border-b border-line dark:border-line-dark">
          {[
            ['work', `${t('idx.activityTab')} (${activities.length})`],
            ['cost', `${t('idx.costTab')} (${costs.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                'relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
                (tab === id
                  ? 'border-brand-700 text-brand-700 dark:border-brand-300 dark:text-brand-300'
                  : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-dark-muted')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <TextInput
            className="max-w-xs"
            placeholder={t('pick.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Hint>
            {(tab === 'work' ? shownActivities.length : shownCosts.length)} / {t('dash.records')}
          </Hint>
        </div>

        <div className="overflow-x-auto">
          {tab === 'work' ? (
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-20`}>{t('idx.code')}</th>
                  <th className={`${th} w-80`}>{t('idx.activityTab')}</th>
                  <th className={th}>{t('idx.categoryCol')}</th>
                  <th className={`${th} w-36`}>{t('idx.mappingCol')}</th>
                </tr>
              </thead>
              <tbody>
                {shownActivities.map((a) => (
                  <tr key={a.id ?? a.code}>
                    <td className={td}>
                      <code className="font-mono font-bold text-brand-700 dark:text-brand-300">
                        {a.code}
                      </code>
                    </td>
                    <td className={td}>
                      <b className="text-ink dark:text-ink-dark">{a.name}</b>
                      {a.desc && (
                        <div className="text-xs text-ink-muted dark:text-ink-dark-muted">
                          {a.desc}
                        </div>
                      )}
                    </td>
                    <td className={`${td} text-xs text-ink-muted dark:text-ink-dark-muted`}>
                      {a.category}
                    </td>
                    <td className={td}>
                      {/* 1:1 means the picker stops at step 1 and takes the
                          fixed cost; 1:N means it asks for a category. */}
                      <span
                        className={
                          'rounded-pill px-2 py-0.5 text-xs font-semibold ' +
                          (a.mapping === 'one-to-one'
                            ? 'bg-ok-bg text-ok-fg dark:bg-ok/20 dark:text-ok-dark'
                            : 'bg-warn-bg text-warn-fg dark:bg-warn/20 dark:text-warn-dark')
                        }
                      >
                        {a.mapping === 'one-to-one'
                          ? `1:1${a.fixed_cost ? ` · ${a.fixed_cost}` : ''}`
                          : '1:N'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!shownActivities.length && (
                  <tr>
                    <td className={`${td} text-ink-muted dark:text-ink-dark-muted`} colSpan={4}>
                      {t('idx.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${th} w-20`}>{t('idx.code')}</th>
                  <th className={`${th} w-80`}>{t('idx.costNameTh')}</th>
                  <th className={th}>Work Category (English)</th>
                </tr>
              </thead>
              <tbody>
                {shownCosts.map((c) => (
                  <tr key={c.id ?? c.code}>
                    <td className={td}>
                      <code className="font-mono font-bold text-brand-700 dark:text-brand-300">
                        {c.code}
                      </code>
                    </td>
                    <td className={td}>
                      <b className="text-ink dark:text-ink-dark">{c.name}</b>
                    </td>
                    <td className={`${td} text-xs text-ink-muted dark:text-ink-dark-muted`}>
                      {c.name_en}
                    </td>
                  </tr>
                ))}
                {!shownCosts.length && (
                  <tr>
                    <td className={`${td} text-ink-muted dark:text-ink-dark-muted`} colSpan={3}>
                      {t('idx.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}
