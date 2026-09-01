// บันทึกการใช้วงเงิน — record a facility drawdown or a release.
//
// Posts to POST /api/credit/transactions. A NEGATIVE amount is meaningful and
// deliberate: it releases the facility (a repayment or a cancelled guarantee),
// which is why the amount field is free text rather than a min=0 number input.

import React, { useEffect, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { fmtMoneyStr, isoToDMY, moneyVal } from '../lib/format.js';
import { projName } from '../lib/lookups.js';
import { STATUS } from '../lib/domain.js';
import { Button, Field, Input, Modal, Select, Textarea } from './ui.jsx';

const BLANK = {
  project: '',
  facilityNo: '',
  amount: '',
  ref: '',
  desc: '',
  start: '',
  due: '',
  note: '',
};

export default function TxnDialog({ open, onClose }) {
  const t = useT();
  const { projects, facTypes, mutate, notify } = useData();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(BLANK);
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const amount = moneyVal(form.amount);
    if (!form.project || !form.facilityNo || !amount) {
      notify(t('req.fillRequired'));
      return;
    }

    setBusy(true);
    try {
      await mutate(
        () =>
          apiCredit.addTransaction({
            project: form.project,
            facilityNo: form.facilityNo,
            amount,
            ref: form.ref,
            desc: form.desc,
            start: isoToDMY(form.start),
            due: isoToDMY(form.due),
            note: form.note,
            // The route defaults to this same value; sent explicitly so the
            // status a recorded drawdown carries is visible here, not implied.
            status: STATUS.APPROVED,
          }),
        t('txn.saved')
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
      open={open}
      onClose={onClose}
      title={t('txn.record')}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('filter.project')} required>
            <Select value={form.project} onChange={(e) => set({ project: e.target.value })}>
              <option value="">{t('req.selectProject')}</option>
              {projects.map((p) => (
                <option key={p.code} value={p.code}>
                  {projName(projects, p.code)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('filter.facilityType')} required>
            <Select value={form.facilityNo} onChange={(e) => set({ facilityNo: e.target.value })}>
              <option value="">{t('req.selectType')}</option>
              {facTypes.map((ft) => (
                <option key={ft.no} value={String(ft.no)}>
                  {ft.no}. {ft.th}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('txn.amountNegHint')} required>
          <Input
            value={form.amount}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(e) => set({ amount: fmtMoneyStr(e.target.value) })}
          />
        </Field>

        <Field label={t('txn.refNo')}>
          <Input
            value={form.ref}
            placeholder={t('txn.refNoPlaceholder')}
            onChange={(e) => set({ ref: e.target.value })}
          />
        </Field>

        <Field label={t('txn.detailsParty')}>
          <Input value={form.desc} onChange={(e) => set({ desc: e.target.value })} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('req.startDate')}>
            <Input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label={t('req.dueDate')}>
            <Input type="date" value={form.due} onChange={(e) => set({ due: e.target.value })} />
          </Field>
        </div>

        <Field label={t('req.note')}>
          <Textarea
            rows={2}
            value={form.note}
            placeholder={t('req.notePlaceholder')}
            onChange={(e) => set({ note: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
