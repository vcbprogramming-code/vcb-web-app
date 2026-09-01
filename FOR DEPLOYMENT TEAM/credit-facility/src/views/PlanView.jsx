// แผนการเงิน (T-bar) — the monthly cash plan, and หักค่างานตามจริง, its recorded
// counterpart.
//
// One component serves both: they are the same structure over the same
// endpoint, separated by credit.cash_plan.variant ('plan' | 'actual'). The API
// keys a period on (project, month, period_idx, variant), so the two never
// collide.
//
// A "period" is a T-bar section: money in on the left, money out on the right.
// The three the finance team uses are ขอเบิก P/N, รับเงินค่างาน + หักหนี้ and
// ขอออก Aval จัดสรร — created from the picker below, then edited in place.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { money } from '../lib/format.js';
import { projName } from '../lib/lookups.js';
import { PLAN_EXCLUDE } from '../lib/domain.js';
import { Button, Card, ConfirmDialog, Empty, Select, Spinner } from '../components/ui.jsx';

/** The month picker's range: six months back, six forward. */
function monthOptions() {
  const out = [];
  const now = new Date();
  for (let d = -6; d <= 6; d += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() + d, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

/** The three section templates, in the order the T-bar is worked through. */
const PERIOD_TYPES = [
  { type: 'pn', labelKey: 'plan.drawPN', descKey: 'plan.drawPNDesc' },
  { type: 'work', labelKey: 'plan.receiveDeduct', descKey: 'plan.receiveDesc' },
  { type: 'aval', labelKey: 'plan.issueAval', descKey: 'plan.avalDesc' },
];

export default function PlanView({ variant = 'plan' }) {
  const t = useT();
  const { projects, isManager, notify } = useData();
  const [month, setMonth] = useState(currentMonth);
  const [project, setProject] = useState('');
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const planProjects = useMemo(
    () => (projects || []).filter((p) => !PLAN_EXCLUDE[p.code]),
    [projects]
  );

  // Default to the first eligible project once reference data arrives.
  useEffect(() => {
    if (!project && planProjects.length) setProject(planProjects[0].code);
  }, [planProjects, project]);

  const load = useCallback(async () => {
    if (!project || !month) {
      setPeriods([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await apiCredit.getCashPlan(project, month, variant);
      setPeriods(Array.isArray(rows) ? rows : []);
    } catch (err) {
      notify(`${t('plan.loadFailed')} ${err?.code || ''}`);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, [project, month, variant, notify, t]);

  useEffect(() => {
    load();
  }, [load]);

  const addPeriod = async (type) => {
    // period_idx is part of the natural key the API upserts on, so it must be
    // the next free slot rather than the array length — deleting a middle
    // section would otherwise reuse an index that still exists.
    const nextIdx = periods.reduce((max, p) => Math.max(max, Number(p.periodIdx) || 0), -1) + 1;
    if (nextIdx >= 5) {
      notify(t('plan.max5'));
      return;
    }
    const tpl = PERIOD_TYPES.find((x) => x.type === type);
    try {
      await apiCredit.saveCashPlanPeriod({
        project,
        month,
        variant,
        periodIdx: nextIdx,
        periodLabel: t(tpl.labelKey),
        periodType: type,
        income: 0,
      });
      notify(t('plan.added'));
      await load();
    } catch (err) {
      notify(t(`error.${err?.code}`) || t('misc.saveFailed'));
    }
  };

  const removePeriod = (period) =>
    setConfirm({
      message: t('plan.deleteSectionQ'),
      okLabel: t('common.delete'),
      onOk: async () => {
        try {
          await apiCredit.deleteCashPlanPeriod(period.id);
          await load();
        } catch (err) {
          notify(t(`error.${err?.code}`) || t('misc.failed'));
        }
        setConfirm(null);
      },
    });

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

        {isManager && project
          ? PERIOD_TYPES.map((p) => (
              <Button
                key={p.type}
                variant="ghost"
                title={t(p.descKey)}
                onClick={() => addPeriod(p.type)}
              >
                {t('plan.addSection')} · {t(p.labelKey)}
              </Button>
            ))
          : null}
      </div>

      {loading ? (
        <Spinner label={t('plan.loading')} />
      ) : !project ? (
        <Empty>{t('plan.selectProjectToLoad')}</Empty>
      ) : !periods.length ? (
        <Empty>
          {t('plan.noSections')} {t('plan.addSection')} {t('plan.toStart')}
        </Empty>
      ) : (
        <div className="grid gap-4 px-4 pb-6 sm:px-6 xl:grid-cols-2">
          {periods.map((p) => (
            <PeriodCard
              key={p.id}
              period={p}
              canEdit={isManager}
              onDelete={() => removePeriod(p)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        message={confirm?.message}
        okLabel={confirm?.okLabel}
        onOk={confirm?.onOk}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

/**
 * One T-bar section. Money in on the left, money out on the right, and the net
 * underneath — which is the whole point of the shape: the two columns must
 * balance before the month is committed.
 */
function PeriodCard({ period, canEdit, onDelete }) {
  const t = useT();

  const incomeBreak = period.incomeBreak || [];
  const deductions = period.deductions || [];
  const extraRows = period.extraRows || [];

  const totalIn =
    (Number(period.income) || 0) +
    incomeBreak.reduce((s, r) => s + (Number(r.pnAmount) || 0), 0) +
    extraRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOut = deductions.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = totalIn - totalOut;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 dark:border-line-dark">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-ink dark:text-ink-dark">
            {period.periodLabel || `${t('plan.period')} ${period.periodIdx + 1}`}
          </h3>
          {period.periodDate ? (
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
              {t('plan.submitDate')} {period.periodDate}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button variant="quiet" className="px-2 py-1 text-xs" onClick={onDelete}>
            {t('plan.deleteSection')}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 divide-x divide-line dark:divide-line-dark">
        {/* left: money in */}
        <div className="p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ok dark:text-ok-dark">
            {t('plan.totalIn')}
          </h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {period.income ? (
              <LineItem label={t('plan.netWorkPayment')} amount={period.income} />
            ) : null}
            {incomeBreak.map((r, i) => (
              <LineItem key={`inc-${i}`} label={r.label || t('plan.pnAmount')} amount={r.pnAmount} />
            ))}
            {extraRows.map((r, i) => (
              <LineItem key={`ext-${i}`} label={r.label || '—'} amount={r.amount} />
            ))}
            {!period.income && !incomeBreak.length && !extraRows.length ? (
              <li className="text-xs text-ink-muted dark:text-ink-dark-muted">
                {t('plan.noItemsInSection')}
              </li>
            ) : null}
          </ul>
        </div>

        {/* right: money out */}
        <div className="p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-danger dark:text-danger-dark">
            {t('plan.totalOut')}
          </h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {deductions.map((r, i) => (
              <LineItem key={`ded-${i}`} label={r.label || '—'} amount={r.amount} />
            ))}
            {period.avalAmount ? (
              <LineItem label={t('plan.issueAval')} amount={period.avalAmount} />
            ) : null}
            {!deductions.length && !period.avalAmount ? (
              <li className="text-xs text-ink-muted dark:text-ink-dark-muted">
                {t('plan.noItemsInSection')}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-4 py-2.5 dark:border-line-dark dark:bg-surface-dark-sunken">
        <span className="tabular text-xs text-ink-muted dark:text-ink-dark-muted">
          {t('plan.totalIn')} ฿{money(totalIn)} · {t('plan.totalOut')} ฿{money(totalOut)}
        </span>
        <span
          className={`tabular text-sm font-bold ${
            net < 0 ? 'text-danger dark:text-danger-dark' : 'text-ok dark:text-ok-dark'
          }`}
        >
          {t('var.net')} ฿{money(net)}
        </span>
      </div>

      {period.note ? (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
          {period.note}
        </p>
      ) : null}
    </Card>
  );
}

function LineItem({ label, amount }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 truncate text-ink dark:text-ink-dark">{label}</span>
      <span className="tabular shrink-0 font-semibold text-ink dark:text-ink-dark">
        ฿{money(amount)}
      </span>
    </li>
  );
}
