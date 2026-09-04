// The overview cards above the tabs.
//
// Two rules carried over from cards() in legacy.js, both non-obvious:
//
//  1. The cards ignore the facility-TYPE filter on purpose. Clicking a card
//     SETS that filter to drill into the table below, so if the cards also
//     obeyed it they would collapse to a single box the moment you used one.
//     They are scoped only by company and project.
//
//  2. Facility lines are folded, because the bank does not treat them
//     separately. The three หนังสือค้ำประกัน (#1-3) become one BG box, and
//     L/G วัสดุ (#5), DLC (#9) and PN-post (#10) share the B/E credit cap with
//     AVAL (#6), so their limit and used are folded into the B/E box.
//
// The meters are the hand-written <Meter> — no chart library, per TECH_STACK.md.

import React, { useMemo } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import { useDashPrefs } from '../lib/DashPrefsContext.jsx';
import { money } from '../lib/format.js';
import { dueBucket, isDueWithin7 } from '../lib/format.js';
import { matchCompany } from '../lib/lookups.js';
import { BE_FOLDED, BE_FOLD_INTO, BG_PARTS, STATUS, isAuthorized } from '../lib/domain.js';
import { Card, Meter } from './ui.jsx';

export default function Dashboard({ onDrill }) {
  const t = useT();
  const { facilities, transactions, projects } = useData();
  const { filters } = useFilters();
  const { prefs } = useDashPrefs();

  const stats = useMemo(
    () => computeStats({ facilities, transactions, projects, filters }),
    [facilities, transactions, projects, filters]
  );

  // Data-driven, so the prefs checkboxes in Settings (Display > Dashboard)
  // can gate each card by the same 'tl'/'bg'/'ml'/'be'/'pn' key the original
  // used — legacy's LINES array, ported directly rather than reinvented.
  const lineCards = [
    {
      key: 'bg',
      label: 'BG',
      agg: stats.bg,
      parts: stats.bgParts,
      accent: '#1D4E89',
      onClick: () => onDrill({ type: 'LG' }),
      title: t('dash.creditLines'),
    },
    {
      key: 'tl',
      label: 'T/L',
      agg: stats.agg[4],
      accent: '#C2410C',
      onClick: () => onDrill({ type: 'TL' }),
      title: t('dash.longTerm'),
    },
    {
      key: 'ml',
      label: 'M/L',
      agg: stats.agg[8],
      accent: '#9333EA',
      onClick: () => onDrill({ type: 'ML' }),
      title: 'M/L',
    },
    {
      key: 'be',
      label: 'B/E',
      agg: stats.agg[6],
      parts: stats.beParts,
      accent: '#1F9D55',
      onClick: () => onDrill({ type: 'AVAL' }),
      title: t('dash.viewBE'),
    },
    {
      key: 'pn',
      label: 'P/N',
      agg: stats.agg[7],
      accent: '#3A5BFF',
      onClick: () => onDrill({ type: 'PN' }),
      title: t('dash.revolving'),
    },
  ].filter((c) => prefs.lines[c.key]);

  const dueCards = [
    {
      key: 'week',
      label: t('set.within1Week'),
      amount: stats.due7,
      count: stats.cnt7,
      accent: '#B3261E',
      onClick: () => onDrill({ due: 'week' }),
      title: t('set.within1Week'),
    },
    {
      key: 'this',
      label: t('dash.dueThisMonth'),
      amount: stats.dueThis,
      count: stats.cntThis,
      extra: stats.due7 > 0 ? `${t('filter.due7')} ฿${money(stats.due7)}` : '',
      accent: '#C2410C',
      onClick: () => onDrill({ due: 'this' }),
      title: t('dash.viewDueThis'),
    },
    {
      key: 'next',
      label: t('dash.dueNextMonth'),
      amount: stats.dueNext,
      count: stats.cntNext,
      extra: stats.dueOver > 0 ? `${t('dash.overdueOutstanding')} ฿${money(stats.dueOver)}` : '',
      accent: '#B3261E',
      onClick: () => onDrill({ due: 'next' }),
      title: t('dash.viewDueNext'),
    },
  ].filter((c) => prefs.due[c.key]);

  const statusCards = [
    {
      key: 'new',
      label: t('status.new'),
      count: stats.cNew,
      amount: stats.aNew,
      accent: '#B3261E',
      onClick: () => onDrill({ status: STATUS.NEW }),
    },
    {
      key: 'proposed',
      label: t('set.proposed'),
      count: stats.cWait,
      amount: stats.aWait,
      accent: '#C2410C',
      onClick: () => onDrill({ status: STATUS.PENDING }),
    },
    {
      key: 'approved',
      label: t('status.approved'),
      count: stats.cAppr,
      amount: stats.aAppr,
      accent: '#1F9D55',
      onClick: () => onDrill({ status: STATUS.APPROVED }),
    },
  ].filter((c) => prefs.status[c.key]);

  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-6 md:grid-cols-3 xl:grid-cols-6">
      {lineCards.map((c) => (
        <FacilityCard key={c.key} {...c} />
      ))}
      {dueCards.map((c) => (
        <DueCard key={c.key} {...c} />
      ))}
      {statusCards.map((c) => (
        <StatusCard key={c.key} {...c} />
      ))}
    </div>
  );
}

/* ------------------------------- the cards -------------------------------- */

function FacilityCard({ label, agg, parts, accent, onClick, title }) {
  const t = useT();
  const lim = agg?.lim || 0;
  const used = agg?.used || 0;
  const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : used > 0 ? 100 : 0;
  const avail = lim - used;
  const empty = lim === 0 && used === 0;

  return (
    <Card
      as="button"
      className="flex cursor-pointer flex-col p-3 text-left transition-shadow hover:shadow-card-hover"
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="focusable flex h-full w-full flex-col rounded-[inherit] text-left"
      >
        <div
          className="-mx-3 -mt-3 mb-2.5 h-[3px] rounded-t-card"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <div className="text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
          {label}
        </div>

        {empty ? (
          <div className="mt-auto pt-2 text-sm text-ink-muted dark:text-ink-dark-muted">
            {t('dash.noData')}
          </div>
        ) : (
          <>
            <div className="tabular mt-1 text-lg font-extrabold text-ink dark:text-ink-dark">
              ฿{money(avail)}
            </div>
            <div className="mt-2">
              <Meter pct={pct} />
            </div>
            <div className="mt-1.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">
              {t('fac.usedPct')} {pct}%
            </div>

            {parts && parts.length > 1 ? (
              <div className="mt-2 flex flex-col gap-0.5 border-t border-dashed border-line pt-1.5 dark:border-line-dark">
                {parts.map((p) => (
                  <div key={p.label} className="flex justify-between gap-2 text-[10.5px]">
                    <span className="truncate text-ink-muted dark:text-ink-dark-muted">
                      {p.label}
                    </span>
                    <span className="tabular shrink-0 text-ink dark:text-ink-dark">
                      {t('fac.used')} ฿{money(p.used)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </button>
    </Card>
  );
}

function DueCard({ label, amount, count, extra, accent, onClick, title }) {
  const t = useT();
  return (
    <Card className="flex flex-col p-3 transition-shadow hover:shadow-card-hover">
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="focusable flex h-full w-full flex-col rounded-[inherit] text-left"
      >
        <div
          className="-mx-3 -mt-3 mb-2.5 h-[3px] rounded-t-card"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <div className="text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
          {label}
        </div>
        <div className="tabular mt-1 text-lg font-extrabold text-ink dark:text-ink-dark">
          ฿{money(amount)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted dark:text-ink-dark-muted">
          {count} {t('misc.items')}
        </div>
        {extra ? (
          <div className="tabular mt-auto pt-1.5 text-[10.5px] font-semibold text-danger dark:text-danger-dark">
            {extra}
          </div>
        ) : null}
        <div className="mt-1.5 text-[11px] font-semibold text-brand-700 dark:text-accent-dark">
          {t('dash.viewList')}
        </div>
      </button>
    </Card>
  );
}

function StatusCard({ label, count, amount, accent, onClick }) {
  const t = useT();
  return (
    <Card className="flex flex-col p-3 transition-shadow hover:shadow-card-hover">
      <button
        type="button"
        onClick={onClick}
        title={label}
        className="focusable flex h-full w-full flex-col rounded-[inherit] text-left"
      >
        <div
          className="-mx-3 -mt-3 mb-2.5 h-[3px] rounded-t-card"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <div className="text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
          {label}
        </div>
        <div className="tabular mt-1 text-lg font-extrabold text-ink dark:text-ink-dark">
          ฿{money(amount)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted dark:text-ink-dark-muted">
          {count} {t('misc.items')}
        </div>
        <div className="mt-1.5 text-[11px] font-semibold text-brand-700 dark:text-accent-dark">
          {t('dash.viewList')}
        </div>
      </button>
    </Card>
  );
}

/* ------------------------------- the numbers ------------------------------ */

function computeStats({ facilities, transactions, projects, filters }) {
  const scoped = (facilities || []).filter(
    (x) =>
      (!filters.proj || x.project === filters.proj) && matchCompany(projects, x.project, filters)
  );

  const agg = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) agg[n] = { lim: 0, used: 0 };
  for (const x of scoped) {
    const a = agg[Number(x.facilityNo)];
    if (a) {
      a.lim += Number(x.limit) || 0;
      a.used += Number(x.used) || 0;
    }
  }

  // Capture the B/E breakdown BEFORE folding, so the card can show the shared
  // components as visible subsets. Only components with activity appear.
  const beParts = [
    { no: 6, label: 'B/E' },
    { no: 5, label: 'L/G วัสดุ' },
    { no: 9, label: 'DLC' },
    { no: 10, label: 'PN-post' },
  ]
    .map((z) => ({ label: z.label, used: agg[z.no].used, lim: agg[z.no].lim }))
    .filter((z) => z.used > 0 || z.lim > 0);

  for (const n of BE_FOLDED) {
    agg[BE_FOLD_INTO].lim += agg[n].lim;
    agg[BE_FOLD_INTO].used += agg[n].used;
    agg[n] = { lim: 0, used: 0 };
  }

  const bg = BG_PARTS.reduce(
    (r, n) => ({ lim: r.lim + agg[n].lim, used: r.used + agg[n].used }),
    { lim: 0, used: 0 }
  );
  const bgParts = [
    { no: 1, label: 'ค้ำสัญญา 5%' },
    { no: 2, label: 'ค้ำ Advance 15%' },
    { no: 3, label: 'ค้ำประกันผลงาน' },
  ].map((z) => ({ label: z.label, used: agg[z.no].used, lim: agg[z.no].lim }));

  // Amounts coming due. The 7-day window is additive: a row can be both "this
  // month" and "within 7 days", so it is counted in each.
  let dueThis = 0;
  let dueNext = 0;
  let dueOver = 0;
  let cntThis = 0;
  let cntNext = 0;
  let due7 = 0;
  let cnt7 = 0;
  let cNew = 0;
  let cWait = 0;
  let cAppr = 0;
  let aNew = 0;
  let aWait = 0;
  let aAppr = 0;

  for (const tr of transactions || []) {
    if (filters.proj && tr.project !== filters.proj) continue;
    if (!matchCompany(projects, tr.project, filters)) continue;

    const trAmt = Number(tr.amount) || 0;
    if (tr.status === STATUS.NEW) {
      cNew += 1;
      aNew += trAmt;
    } else if (tr.status === STATUS.PENDING) {
      cWait += 1;
      aWait += trAmt;
    } else if (isAuthorized(tr.status)) {
      cAppr += 1;
      aAppr += trAmt;
    }

    const low = String(tr.status).toLowerCase();
    // Settled and cancelled rows are not owing.
    if (tr.status === STATUS.SETTLED || low === 'void') continue;
    const amt = Number(tr.amount) || 0;
    // Only outstanding instruments to pay; a negative amount is a release.
    if (amt <= 0) continue;

    const b = dueBucket(tr.due);
    if (b === 'this') {
      dueThis += amt;
      cntThis += 1;
    } else if (b === 'next') {
      dueNext += amt;
      cntNext += 1;
    } else if (b === 'overdue') {
      dueOver += amt;
    }
    if (isDueWithin7(tr.due)) {
      due7 += amt;
      cnt7 += 1;
    }
  }

  return {
    agg,
    bg,
    bgParts,
    beParts,
    dueThis,
    dueNext,
    dueOver,
    cntThis,
    cntNext,
    due7,
    cnt7,
    cNew,
    cWait,
    cAppr,
    aNew,
    aWait,
    aAppr,
  };
}
