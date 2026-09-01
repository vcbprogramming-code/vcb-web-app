// วงเงินสินเชื่อ — the facility table.
//
// `used` and `available` are computed server-side by the credit.facility_used
// view (the override, else the sum of unpaid transactions), so nothing here
// recomputes them. `usedOverridden` tells the row to mark itself as pinned.

import React, { useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import { money } from '../lib/format.js';
import { filterFacilities, kindShort, projThShort, typeKind, typeName } from '../lib/lookups.js';
import { Card, Empty, KindPill, Meter } from '../components/ui.jsx';
import LimitDialog from '../components/LimitDialog.jsx';

export default function FacilitiesView() {
  const t = useT();
  const { facilities, facTypes, projects, isManager } = useData();
  const { filters } = useFilters();
  const [editing, setEditing] = useState(null);

  const rows = useMemo(
    () => filterFacilities(facilities, { projects, facTypes, filters }),
    [facilities, projects, facTypes, filters]
  );

  if (!rows.length) return <Empty>{t('fac.none')}</Empty>;

  return (
    <>
      <Card className="mx-4 mb-6 overflow-hidden sm:mx-6">
        {/* Wide tables scroll inside their own container so the page body never
            scrolls sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-left dark:border-line-dark dark:bg-surface-dark-sunken">
                <Th>{t('col.project')}</Th>
                <Th>{t('fac.type')}</Th>
                <Th className="text-right">{t('fac.limitTHB')}</Th>
                <Th className="text-right">{t('fac.used')}</Th>
                <Th className="text-right">{t('fac.remaining')}</Th>
                <Th className="w-40">{t('fac.utilization')}</Th>
                {isManager ? <Th className="w-20 text-right">{t('common.edit')}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const lim = Number(f.limit) || 0;
                const used = Number(f.used) || 0;
                const avail = Number(f.available ?? lim - used);
                const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : used > 0 ? 100 : 0;
                const kind = typeKind(facTypes, f.facilityNo);

                return (
                  <tr
                    key={`${f.project}|${f.facilityNo}`}
                    className="border-b border-line last:border-0 hover:bg-surface-sunken/60 dark:border-line-dark dark:hover:bg-surface-dark-sunken/60"
                  >
                    <Td>
                      <div className="font-semibold text-ink dark:text-ink-dark">{f.project}</div>
                      <div className="text-xs text-ink-muted dark:text-ink-dark-muted">
                        {projThShort(projects, f.project)}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <KindPill kind={kind}>{kindShort(facTypes, f.facilityNo)}</KindPill>
                        <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
                          {typeName(facTypes, f.facilityNo)}
                        </span>
                      </div>
                      {/* credit.facilities.interest is free text — "MLR ต่อปี",
                          "1.25 % ต่อปีเรียกเก็บทุก 3 เดือน" — so it is shown
                          verbatim, never parsed into a number here. */}
                      {f.interest ? (
                        <div className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                          {f.interest}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="tabular text-right">฿{money(lim)}</Td>
                    <Td className="tabular text-right">
                      ฿{money(used)}
                      {f.usedOverridden ? (
                        <span
                          title={t('fac.overrideNote')}
                          className="ml-1 cursor-help text-warn dark:text-warn-dark"
                        >
                          ✎
                        </span>
                      ) : null}
                    </Td>
                    <Td
                      className={`tabular text-right font-semibold ${
                        avail < 0 ? 'text-danger dark:text-danger-dark' : ''
                      }`}
                    >
                      ฿{money(avail)}
                    </Td>
                    <Td>
                      <Meter pct={pct} />
                      <div className="mt-1 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                        {pct}%
                      </div>
                    </Td>
                    {isManager ? (
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(f)}
                          className="focusable rounded-control px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-surface-sunken dark:text-accent-dark dark:hover:bg-surface-dark-sunken"
                        >
                          {t('action.adjust')}
                        </button>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <LimitDialog facility={editing} onClose={() => setEditing(null)} />
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
