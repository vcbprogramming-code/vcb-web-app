// สรุปค่าใช้จ่าย — spend per cost category, against the budget cap.
//
// Only AUTHORISED rows count towards spend: a request still sitting at
// คำขอใหม่ has not committed any money, so including it would show a project
// over budget on the strength of paperwork nobody has approved.
//
// The bar is the hand-written <Meter>; TECH_STACK.md rules out chart libraries.

import React, { useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import { money } from '../lib/format.js';
import { applyFilters } from '../lib/lookups.js';
import { NO_CATEGORY, categoryColor, categoryTextColor, isAuthorized } from '../lib/domain.js';
import { Card, Empty, Meter } from '../components/ui.jsx';
import CapDialog from '../components/CapDialog.jsx';

export default function CostView() {
  const t = useT();
  const { transactions, categoryCaps, projects, facTypes, isManager } = useData();
  const { filters } = useFilters();
  const [editing, setEditing] = useState(null);

  const groups = useMemo(() => {
    const rows = applyFilters(transactions, { projects, facTypes, filters }).filter((r) =>
      isAuthorized(r.status)
    );

    const byCat = new Map();
    for (const r of rows) {
      const cat = (r.costCategory || '').trim() || NO_CATEGORY;
      const g = byCat.get(cat) || { cat, total: 0, count: 0 };
      g.total += Number(r.amount) || 0;
      g.count += 1;
      byCat.set(cat, g);
    }

    // A cap is per (project, category). With no project filter there is no
    // single budget to compare against, so the cap column stays empty rather
    // than summing budgets that belong to different projects.
    const capFor = (cat) =>
      filters.proj
        ? (categoryCaps || []).find(
            (c) => c.project === filters.proj && c.costCategory === cat
          ) || null
        : null;

    return [...byCat.values()]
      .map((g) => {
        const cap = capFor(g.cat);
        const capAmt = cap ? Number(cap.cap) || 0 : 0;
        return {
          ...g,
          cap: capAmt,
          capNote: cap?.note || '',
          hasCap: Boolean(cap && capAmt > 0),
          pct: capAmt > 0 ? Math.round((g.total / capAmt) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions, categoryCaps, projects, facTypes, filters]);

  if (!groups.length) return <Empty>{t('cost.none')}</Empty>;

  const grand = groups.reduce((s, g) => s + g.total, 0);

  return (
    <>
      <Card className="mx-4 mb-6 overflow-hidden sm:mx-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 dark:border-line-dark">
          <h2 className="text-sm font-bold text-ink dark:text-ink-dark">{t('cost.summary')}</h2>
          <span className="tabular text-sm font-bold text-ink dark:text-ink-dark">
            {t('plan.total')} ฿{money(grand)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-left dark:border-line-dark dark:bg-surface-dark-sunken">
                <Th>{t('req.costCategory')}</Th>
                <Th className="text-right">{t('col.count')}</Th>
                <Th className="text-right">{t('col.amountTHB')}</Th>
                <Th className="text-right">{t('col.budget')}</Th>
                <Th className="w-44">{t('col.pctUsed')}</Th>
                {isManager && filters.proj ? <Th className="text-right" /> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.cat}
                  className="border-b border-line last:border-0 dark:border-line-dark"
                >
                  <Td>
                    <span
                      className="inline-block whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: categoryColor(g.cat),
                        color: categoryTextColor(g.cat),
                      }}
                    >
                      {g.cat === NO_CATEGORY ? t('cost.noCategory') : g.cat}
                    </span>
                    {g.capNote ? (
                      <div className="mt-1 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                        {g.capNote}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="tabular text-right">{g.count}</Td>
                  <Td className="tabular text-right font-semibold">฿{money(g.total)}</Td>
                  <Td className="tabular text-right">
                    {g.hasCap ? (
                      `฿${money(g.cap)}`
                    ) : (
                      <span className="text-ink-muted dark:text-ink-dark-muted">
                        {t('cost.notSet')}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {g.hasCap ? (
                      <>
                        <Meter pct={g.pct} />
                        <div
                          className={`mt-1 text-[11px] font-semibold ${
                            g.pct >= 100
                              ? 'text-danger dark:text-danger-dark'
                              : g.pct >= 80
                                ? 'text-warn dark:text-warn-dark'
                                : 'text-ink-muted dark:text-ink-dark-muted'
                          }`}
                        >
                          {g.pct}%{' '}
                          {g.pct >= 100
                            ? t('cost.overBudget')
                            : g.pct >= 80
                              ? t('cost.nearBudget')
                              : t('cost.withinBudget')}
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-ink-muted dark:text-ink-dark-muted">
                        {t('cost.noBudgetSet')}
                      </span>
                    )}
                  </Td>
                  {isManager && filters.proj ? (
                    <Td className="text-right">
                      {g.cat === NO_CATEGORY ? (
                        <span
                          title={t('cost.uncategorizedHint')}
                          className="cursor-help text-xs text-ink-muted dark:text-ink-dark-muted"
                        >
                          —
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({ project: filters.proj, category: g.cat, cap: g.cap, note: g.capNote })
                          }
                          className="focusable rounded-control px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-surface-sunken dark:text-accent-dark dark:hover:bg-surface-dark-sunken"
                        >
                          {t('cost.setBudget')}
                        </button>
                      )}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filters.proj ? (
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
            {t('cost.noBudgetYet')}
          </p>
        ) : null}
      </Card>

      <CapDialog cap={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}
