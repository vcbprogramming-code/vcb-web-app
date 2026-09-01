// รายละเอียดรายการสินเชื่อ — one ledger row, with settle and delete.
//
// Settle is POST /transactions/:id/settle, which guards inside the UPDATE so
// two managers clicking at once cannot both succeed. It answers 409 with
// ALREADY_SETTLED or NOTHING_OWING, and those are distinct messages here
// because they mean different things to the person clicking.

import React, { useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { daysOverdue, money } from '../lib/format.js';
import { attachText, kindShort, overdueInterest, projName, typeName } from '../lib/lookups.js';
import { STATUS, statusMeta } from '../lib/domain.js';
import { Button, ConfirmDialog, Modal, StatusPill } from './ui.jsx';

export default function TxnDetailDialog({ txn, onClose }) {
  const t = useT();
  const { projects, facTypes, facilities, isManager, mutate, notify } = useData();
  const [confirm, setConfirm] = useState(null);

  if (!txn) return null;

  const meta = statusMeta(txn.status);
  const overdue = daysOverdue(txn.due);
  const interest = overdueInterest(facilities, txn);

  const run = async (fn, message) => {
    try {
      await mutate(fn, message);
      setConfirm(null);
      onClose();
    } catch (err) {
      setConfirm(null);
      notify(t(`error.${err?.code}`) || t('misc.failed'));
    }
  };

  const settle = () =>
    setConfirm({
      message: t('txn.confirmSettle'),
      okLabel: t('action.settle'),
      onOk: () => run(() => apiCredit.settleTxn(txn.id), t('txn.closed')),
    });

  const remove = () =>
    setConfirm({
      message: t('txn.confirmDelete'),
      okLabel: t('common.delete'),
      onOk: () => run(() => apiCredit.deleteTxn(txn.id), t('txn.deleted')),
    });

  return (
    <>
      <Modal
        open={Boolean(txn)}
        onClose={onClose}
        wide
        title={t('txn.details')}
        footer={
          isManager ? (
            <>
              <Button variant="ghost" onClick={remove}>
                {t('action.delete')}
              </Button>
              {txn.status !== STATUS.SETTLED ? (
                <Button onClick={settle}>{t('action.settle')}</Button>
              ) : null}
            </>
          ) : null
        }
      >
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label={t('filter.status')}>
            <StatusPill tone={meta.tone}>{meta.key ? t(meta.key) : meta.raw}</StatusPill>
          </Row>
          <Row label={t('col.date')}>{txn.date || '-'}</Row>
          <Row label={t('col.project')}>{projName(projects, txn.project)}</Row>
          <Row label={t('fac.type')}>
            {kindShort(facTypes, txn.facilityNo)} · {typeName(facTypes, txn.facilityNo)}
          </Row>
          <Row label={t('col.docNo')}>{txn.ref || '-'}</Row>
          <Row label={t('col.amountTHB')}>
            <span className="tabular font-bold">฿{money(txn.amount)}</span>
          </Row>
          <Row label={t('col.start')}>{txn.start || '-'}</Row>
          <Row label={t('col.due')}>
            {txn.due || '-'}
            {overdue > 0 && txn.status !== STATUS.SETTLED ? (
              <span className="ml-2 text-xs font-semibold text-danger dark:text-danger-dark">
                {overdue} {t('misc.days')}
              </span>
            ) : null}
          </Row>
          {overdue > 0 && txn.status !== STATUS.SETTLED ? (
            <Row label={t('plan.interest')}>
              {/* null means the facility's rate is not numeric — free text such
                  as "MLR ต่อปี". Saying so beats inventing a figure. */}
              {typeof interest === 'number' ? (
                <span className="tabular">
                  ฿{money(interest)} {t('misc.estimate')}
                </span>
              ) : (
                <span
                  className="text-ink-muted dark:text-ink-dark-muted"
                  title={t('misc.rateNotNumeric')}
                >
                  {t('misc.rateUnavailable')}
                </span>
              )}
            </Row>
          ) : null}
          <Row label={t('col.detailsBeneficiary')} full>
            {txn.desc || '-'}
          </Row>
          {txn.beneficiary ? <Row label={t('req.beneficiary')}>{txn.beneficiary}</Row> : null}
          {txn.costCategory ? <Row label={t('req.costCategory')}>{txn.costCategory}</Row> : null}
          <Row label={t('col.attachment')} full>
            {attachText(txn)}
          </Row>
          {txn.status === STATUS.SETTLED && txn.paidDate ? (
            <Row label={t('txn.settledOn')}>{txn.paidDate}</Row>
          ) : null}
          {txn.by ? <Row label="By">{txn.by}</Row> : null}
          {txn.note ? (
            <Row label={t('req.note')} full>
              {txn.note}
            </Row>
          ) : null}
        </dl>
      </Modal>

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

function Row({ label, children, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-semibold text-ink-muted dark:text-ink-dark-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink dark:text-ink-dark">{children}</dd>
    </div>
  );
}
