// ผลต่าง — plan versus actual for a month.
//
// Fetches the same month twice, once per variant, and compares the totals. The
// two calls go in parallel: they are independent and the view cannot render
// until both land.
//
// The bars are hand-drawn SVG. TECH_STACK.md rules out recharts/chart.js/d3,
// and a two-series comparison over three measures does not need one.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { money } from '../lib/format.js';
import { projName } from '../lib/lookups.js';
import { PLAN_EXCLUDE } from '../lib/domain.js';
import { Card, Empty, Select, Spinner } from '../components/ui.jsx';

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions() {
  const out = [];
  const now = new Date();
  for (let d = -6; d <= 6; d += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() + d, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Sum a variant's periods into the three figures the T-bar balances. */
function totals(periods) {
  let received = 0;
  let deducted = 0;
  for (const p of periods || []) {
    received +=
      (Number(p.income) || 0) +
      (p.incomeBreak || []).reduce((s, r) => s + (Number(r.pnAmount) || 0), 0) +
      (p.extraRows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    deducted +=
      (p.deductions || []).reduce((s, r) => s + (Number(r.amount) || 0), 0) +
      (Number(p.avalAmount) || 0);
  }
  return { received, deducted, net: received - deducted };
}

export default function VarianceView() {
  const t = useT();
  const { projects, notify } = useData();
  const [month, setMonth] = useState(currentMonth);
  const [project, setProject] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const planProjects = useMemo(
    () => (projects || []).filter((p) => !PLAN_EXCLUDE[p.code]),
    [projects]
  );

  useEffect(() => {
    if (!project && planProjects.length) setProject(planProjects[0].code);
  }, [planProjects, project]);

  const load = useCallback(async () => {
    if (!project || !month) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const [plan, actual] = await Promise.all([
        apiCredit.getCashPlan(project, month, 'plan'),
        apiCredit.getCashPlan(project, month, 'actual'),
      ]);
      setData({ plan: totals(plan), actual: totals(actual), hasAny: Boolean(plan?.length || actual?.length) });
    } catch (err) {
      notify(`${t('plan.loadFailed')} ${err?.code || ''}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [project, month, notify, t]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data
    ? [
        { key: 'var.received', plan: data.plan.received, actual: data.actual.received },
        { key: 'var.deducted', plan: data.plan.deducted, actual: data.actual.deducted },
        { key: 'var.net', plan: data.plan.net, actual: data.actual.net },
      ]
    : [];

  const scale = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.plan), Math.abs(r.actual)]));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
        <Select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          aria-label={t('filter.project')}
          className="w-auto min-w-[12rem]"
        >
          <option value="">{t('plan.selectProjectToLoad')}</option>
          {planProjects.map((p) => (
            <option key={p.code} value={p.code}>
              {projName(projects, p.code)}
            </option>
          ))}
        </Select>

        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={t('date.month')}
          className="w-auto min-w-[8rem]"
        >
          {monthOptions().map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner label={t('plan.loading')} />
      ) : !data || !data.hasAny ? (
        <Empty>{t('var.none')}</Empty>
      ) : (
        <Card className="mx-4 mb-6 p-4 sm:mx-6">
          <h2 className="mb-4 text-sm font-bold text-ink dark:text-ink-dark">{t('var.title')}</h2>

          <div className="flex flex-col gap-5">
            {rows.map((r) => {
              const diff = r.actual - r.plan;
              return (
                <div key={r.key}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {t(r.key)}
                    </span>
                    <span
                      className={`tabular text-xs font-bold ${
                        diff < 0 ? 'text-danger dark:text-danger-dark' : 'text-ok dark:text-ok-dark'
                      }`}
                    >
                      {diff >= 0 ? '+' : ''}
                      {money(diff)}
                    </span>
                  </div>

                  {/* Two bars on one baseline: plan above, actual below, both
                      scaled to the largest absolute figure on screen so the
                      lengths are comparable across the three measures. */}
                  <svg
                    viewBox="0 0 100 14"
                    preserveAspectRatio="none"
                    className="h-7 w-full"
                    role="img"
                    aria-label={`${t(r.key)}: ${t('var.plan')} ${money(r.plan)}, ${t('var.actual')} ${money(r.actual)}`}
                  >
                    <rect x="0" y="1" width={(Math.abs(r.plan) / scale) * 100} height="5" rx="1.5" className="fill-brand-500" />
                    <rect x="0" y="8" width={(Math.abs(r.actual) / scale) * 100} height="5" rx="1.5" className="fill-accent" />
                  </svg>

                  <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                    <span className="tabular">
                      <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-500" />
                      {t('var.plan')} ฿{money(r.plan)}
                    </span>
                    <span className="tabular">
                      <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />
                      {t('var.actual')} ฿{money(r.actual)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
