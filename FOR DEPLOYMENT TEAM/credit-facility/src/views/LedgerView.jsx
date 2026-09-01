// รายการสินเชื่อ — the credit ledger.
//
// Shows credit.transactions: drawdowns, guarantees issued, repayments (a
// negative amount releases the facility). Requests live in their own table and
// their own view; the two were conflated in the old mock and are not here.

import React, { useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import { daysOverdue, money } from '../lib/format.js';
import {
  applyFilters,
  attachText,
  kindShort,
  overdueInterest,
  projThShort,
  typeKind,
} from '../lib/lookups.js';
import { STATUS, statusMeta } from '../lib/domain.js';
import { Card, Empty, KindPill, StatusPill } from '../components/ui.jsx';
import TxnDetailDialog from '../components/TxnDetailDialog.jsx';

export default function LedgerView() {
  const t = useT();
  const { transactions, facilities, facTypes, projects } = useData();
  const { filters } = useFilters();
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ col: 'due', dir: 1 });

  const rows = useMemo(() => {
    const list = applyFilters(transactions, { projects, facTypes, filters });
    const dir = sort.dir || 1;
    return [...list].sort((a, b) => {
      const av = sortValue(a, sort.col);
      const bv = sortValue(b, sort.col);
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * dir;
    });
  }, [transactions, projects, facTypes, filters, sort]);

  if (!rows.length) return <Empty>{t('txn.none')}</Empty>;

  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: -s.dir } : { col, dir: 1 }));

  return (
    <>
      <Card className="mx-4 mb-6 overflow-hidden sm:mx-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-left dark:border-line-dark dark:bg-surface-dark-sunken">
                <Th sortKey="date" sort={sort} onSort={toggleSort}>
                  {t('col.date')}
                </Th>
                <Th>{t('col.project')}</Th>
                <Th>{t('fac.type')}</Th>
                <Th sortKey="ref" sort={sort} onSort={toggleSort}>
                  {t('col.docNo')}
                </Th>
                <Th>{t('col.detailsBeneficiary')}</Th>
                <Th className="text-right" sortKey="amount" sort={sort} onSort={toggleSort}>
                  {t('col.amountTHB')}
                </Th>
                <Th sortKey="due" sort={sort} onSort={toggleSort}>
                  {t('col.due')}
                </Th>
                <Th>{t('col.attachment')}</Th>
                <Th>{t('filter.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = statusMeta(r.status);
                const overdue = daysOverdue(r.due);
                const interest = overdueInterest(facilities, r);
                const amount = Number(r.amount) || 0;

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-sunken/60 dark:border-line-dark dark:hover:bg-surface-dark-sunken/60"
                  >
                    <Td className="whitespace-nowrap">{r.date || '-'}</Td>
                    <Td>
                      <div className="font-semibold text-ink dark:text-ink-dark">{r.project}</div>
                      <div className="text-xs text-ink-muted dark:text-ink-dark-muted">
                        {projThShort(projects, r.project)}
                      </div>
                    </Td>
                    <Td>
                      <KindPill kind={typeKind(facTypes, r.facilityNo)}>
                        {kindShort(facTypes, r.facilityNo)}
                      </KindPill>
                    </Td>
                    <Td className="max-w-[14rem] truncate">{r.ref || '-'}</Td>
                    <Td className="max-w-[22rem]">
                      <div className="truncate text-ink dark:text-ink-dark">{r.desc || '-'}</div>
                      {r.beneficiary ? (
                        <div className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                          {r.beneficiary}
                        </div>
                      ) : null}
                    </Td>
                    <Td
                      className={`tabular whitespace-nowrap text-right font-semibold ${
                        amount < 0 ? 'text-ok dark:text-ok-dark' : 'text-ink dark:text-ink-dark'
                      }`}
                    >
                      ฿{money(amount)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div>{r.due || '-'}</div>
                      {overdue > 0 && r.status !== STATUS.SETTLED ? (
                        <div className="text-xs font-semibold text-danger dark:text-danger-dark">
                          {overdue} {t('misc.days')}
                          {/* interest is null when the facility's rate is free
                              text like "MLR ต่อปี" — there is no number to
                              apply, so none is shown. */}
                          {typeof interest === 'number' && interest > 0
                            ? ` · ฿${money(interest)} ${t('misc.estimate')}`
                            : ''}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="max-w-[14rem] truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                      {attachText(r)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <StatusPill tone={meta.tone}>
                        {meta.key ? t(meta.key) : meta.raw}
                        {r.status === STATUS.SETTLED && r.paidDate ? ` ${r.paidDate}` : ''}
                      </StatusPill>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <TxnDetailDialog txn={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function sortValue(row, col) {
  if (col === 'amount') return Number(row.amount) || 0;
  if (col === 'due' || col === 'date') {
    // dd/mm/yyyy sorts wrongly as a string; compare as a date.
    const m = String(row[col] ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
  }
  return String(row[col] ?? '').toLowerCase();
}

function Th({ children, className = '', sortKey, sort, onSort }) {
  const active = sortKey && sort?.col === sortKey;
  return (
    <th
      className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted ${className}`}
    >
      {sortKey ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="focusable inline-flex items-center gap-1 rounded px-1 hover:text-ink dark:hover:text-ink-dark"
        >
          {children}
          <span aria-hidden="true">{active ? (sort.dir > 0 ? '▲' : '▼') : '⇅'}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Td({ children, className = '' }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}
