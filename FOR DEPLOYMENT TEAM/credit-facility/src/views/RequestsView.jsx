// คำขอสินเชื่อ — the request queue.
//
// ---------------------------------------------------------------------------
// This view exists because the old mock made it impossible.
// ---------------------------------------------------------------------------
// In src/mock/api.ts, addRequest() called insertTxn() and pushed onto the
// TRANSACTIONS array, while decideRequest() searched a separate, always-empty
// requests array. A request created through the UI therefore could never be
// found and never be approved — the queue had no rows to act on, so the old app
// never rendered one.
//
// The API has two proper tables. Requests are created by POST /api/credit/
// requests, listed from GET /data's `requests`, and decided by POST
// /api/credit/requests/:id/decide — which, on approval, also writes the linked
// drawdown transaction inside the same database transaction, so an approved
// request can never exist without its matching ledger row.
// ---------------------------------------------------------------------------

import React, { useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import * as apiCredit from '../lib/api.js';
import { money } from '../lib/format.js';
import { applyFilters, kindShort, projThShort, typeKind } from '../lib/lookups.js';
import { DECISION, statusMeta } from '../lib/domain.js';
import { Button, Card, ConfirmDialog, Empty, KindPill, StatusPill } from '../components/ui.jsx';
import RequestDialog from '../components/RequestDialog.jsx';

export default function RequestsView() {
  const t = useT();
  const { requests, facTypes, projects, isManager, mutate, notify } = useData();
  const { filters } = useFilters();
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const rows = useMemo(
    () => applyFilters(requests, { projects, facTypes, filters }),
    [requests, projects, facTypes, filters]
  );

  const run = async (fn, message) => {
    try {
      await mutate(fn, message);
    } catch (err) {
      // The API's error codes are machine-readable; render our own message for
      // them rather than printing err.message at the user (shared/src/api.js).
      notify(t(`error.${err?.code}`) || t('misc.failed'));
    }
    setConfirm(null);
  };

  const decide = (row, decision) =>
    setConfirm({
      message:
        decision === DECISION.APPROVE ? t('txn.confirmApprove') : `${t('misc.confirm')} — ${row.id}`,
      okLabel: decision === DECISION.APPROVE ? t('dash.approved') : t('common.confirm'),
      onOk: () =>
        run(() => apiCredit.decideRequest(row.id, decision), t('common.saved')),
    });

  const remove = (row) =>
    setConfirm({
      message: t('txn.confirmDelete'),
      okLabel: t('common.delete'),
      onOk: () => run(() => apiCredit.deleteRequest(row.id), t('txn.deleted')),
    });

  if (!rows.length) return <Empty>{t('req.none')}</Empty>;

  return (
    <>
      <Card className="mx-4 mb-6 overflow-hidden sm:mx-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[62rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken text-left dark:border-line-dark dark:bg-surface-dark-sunken">
                <Th>{t('req.date')}</Th>
                <Th>{t('col.project')}</Th>
                <Th>{t('fac.type')}</Th>
                <Th>{t('col.detailsBeneficiary')}</Th>
                <Th className="text-right">{t('col.amountTHB')}</Th>
                <Th>{t('col.due')}</Th>
                <Th>{t('filter.status')}</Th>
                {isManager ? <Th className="text-right">{t('common.edit')}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = statusMeta(r.status);
                const decided = r.status === DECISION.APPROVE || r.status === DECISION.REJECT;

                return (
                  <tr
                    key={r.id}
                    className="border-b border-line last:border-0 hover:bg-surface-sunken/60 dark:border-line-dark dark:hover:bg-surface-dark-sunken/60"
                  >
                    <Td className="whitespace-nowrap">{r.date || '-'}</Td>
                    <Td>
                      <div className="font-semibold text-ink dark:text-ink-dark">{r.project}</div>
                      <div className="text-xs text-ink-muted dark:text-ink-dark-muted">
                        {r.company || projThShort(projects, r.project)}
                      </div>
                    </Td>
                    <Td>
                      <KindPill kind={typeKind(facTypes, r.facilityNo)}>
                        {kindShort(facTypes, r.facilityNo)}
                      </KindPill>
                    </Td>
                    <Td className="max-w-[22rem]">
                      <div className="truncate text-ink dark:text-ink-dark">{r.purpose || '-'}</div>
                      {r.beneficiary ? (
                        <div className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                          {r.beneficiary}
                        </div>
                      ) : null}
                      {r.linkedTxn ? (
                        <div className="mt-0.5 text-xs font-semibold text-ok dark:text-ok-dark">
                          {t('req.linkedTxn')}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="tabular whitespace-nowrap text-right font-semibold">
                      ฿{money(r.amount)}
                    </Td>
                    <Td className="whitespace-nowrap">{r.maturity || '-'}</Td>
                    <Td className="whitespace-nowrap">
                      <StatusPill tone={meta.tone}>{meta.key ? t(meta.key) : meta.raw}</StatusPill>
                      {r.decidedBy ? (
                        <div className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                          {r.decidedBy} {r.decidedAt}
                        </div>
                      ) : null}
                    </Td>
                    {isManager ? (
                      <Td className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          {!decided ? (
                            <>
                              <Button
                                variant="quiet"
                                className="px-2 py-1 text-xs"
                                onClick={() => decide(r, DECISION.APPROVE)}
                              >
                                {t('dash.approved')}
                              </Button>
                              <Button
                                variant="quiet"
                                className="px-2 py-1 text-xs"
                                onClick={() => decide(r, DECISION.REJECT)}
                              >
                                {t('common.no')}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            variant="quiet"
                            className="px-2 py-1 text-xs"
                            onClick={() => setEditing(r)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="quiet"
                            className="px-2 py-1 text-xs"
                            onClick={() => remove(r)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <RequestDialog open={Boolean(editing)} request={editing} onClose={() => setEditing(null)} />

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
