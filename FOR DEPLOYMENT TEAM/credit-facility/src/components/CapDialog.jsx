// ตั้งงบหมวดค่าใช้จ่าย — set or clear a per-project cost-category budget.
//
// PUT /api/credit/category-caps. A blank amount sends null, which the route
// treats as "remove the budget" — and, when no row exists yet, as a no-op
// rather than inserting an empty budget.

import React, { useEffect, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { fmtMoneyStr, moneyVal } from '../lib/format.js';
import { Button, Field, Input, Modal, Textarea } from './ui.jsx';

export default function CapDialog({ cap, onClose }) {
  const t = useT();
  const { mutate, notify } = useData();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cap) return;
    setAmount(cap.cap ? fmtMoneyStr(String(cap.cap)) : '');
    setNote(cap.note || '');
  }, [cap]);

  if (!cap) return null;

  const save = async () => {
    const raw = String(amount).trim();
    if (raw !== '' && !Number.isFinite(moneyVal(raw))) {
      notify(t('cost.badBudget'));
      return;
    }
    const value = raw === '' ? null : moneyVal(raw);

    setBusy(true);
    try {
      await mutate(
        () => apiCredit.setCategoryCap(cap.project, cap.category, value, note),
        value === null ? t('cost.budgetRemoved') : t('cost.budgetSet')
      );
      onClose();
    } catch (err) {
      notify(t(`error.${err?.code}`) || t('misc.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(cap)}
      onClose={onClose}
      title={`${t('cost.setBudgetTitle')} — ${cap.category}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? t('common.saving') : t('action.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
          {t('col.project')}: {cap.project}
        </p>

        <Field label={t('cost.budgetTHB')} hint={t('cost.budgetBlankHint')}>
          <Input
            value={amount}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(e) => setAmount(fmtMoneyStr(e.target.value))}
          />
        </Field>

        <Field label={t('cost.noteSource')} hint={t('cost.optional')}>
          <Textarea
            rows={2}
            value={note}
            placeholder={t('cost.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
