// เพิ่มคำขอสินเชื่อ / แก้ไขคำขอ.
//
// Posts to POST /api/credit/requests — the REQUESTS table, not transactions.
// The old mock wrote requests into the transactions array, which is why a
// created request could never be approved; see views/RequestsView.jsx.
//
// The three date fields interlock exactly as onStart/onDays/onMat did in
// legacy.js: editing any two recomputes the third, so a 120-day note can be
// entered either as "start + 120 days" or as "start + maturity".

import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import {
  daysFromStartMat,
  dmyToISO,
  fmtMoneyStr,
  isDMYOrBlank,
  isoToDMY,
  matFromStartDays,
  money,
  moneyVal,
  startFromMatDays,
} from '../lib/format.js';
import { projCompany, projName } from '../lib/lookups.js';
import { STATUS, facAvail } from '../lib/domain.js';
import { Button, Field, Input, Modal, Select, Textarea } from './ui.jsx';
import CostCategoryPicker from './CostCategoryPicker.jsx';

const BLANK = {
  project: '',
  facilityNo: '',
  amount: '',
  start: '',
  days: '',
  maturity: '',
  beneficiary: '',
  ref: '',
  refDocFrom: '',
  refDocTo: '',
  source: '',
  costCategory: '',
  docFrom: '',
  docTo: '',
  status: STATUS.NEW,
  note: '',
  purpose: '',
};

export default function RequestDialog({ open, request, onClose }) {
  const t = useT();
  const { projects, facTypes, facilities, costCategories, mutate, notify } = useData();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const editing = Boolean(request?.id);

  useEffect(() => {
    if (!open) return;
    if (request) {
      setForm({
        ...BLANK,
        project: request.project || '',
        facilityNo: String(request.facilityNo ?? ''),
        amount: fmtMoneyStr(String(request.amount ?? '')),
        maturity: dmyToISO(request.maturity),
        beneficiary: request.beneficiary || '',
        source: request.source || '',
        docFrom: request.docFrom || '',
        docTo: request.docTo || '',
        status: request.status || STATUS.NEW,
        note: request.note || '',
        purpose: request.purpose || '',
      });
    } else {
      setForm(BLANK);
    }
  }, [open, request]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  /* --- the start / days / maturity interlock --- */

  const onStart = (v) => {
    const next = { start: v };
    if (form.days) next.maturity = matFromStartDays(v, form.days);
    else if (form.maturity) next.days = daysFromStartMat(v, form.maturity);
    set(next);
  };

  const onDays = (v) => {
    const next = { days: v };
    if (form.start) next.maturity = matFromStartDays(form.start, v);
    else if (form.maturity) next.start = startFromMatDays(form.maturity, v);
    set(next);
  };

  const onMaturity = (v) => {
    const next = { maturity: v };
    if (form.start) next.days = daysFromStartMat(form.start, v);
    else if (form.days) next.start = startFromMatDays(v, form.days);
    set(next);
  };

  /* --- the availability hint --- */

  const avail = useMemo(() => {
    if (!form.project || !form.facilityNo) return null;
    return facAvail(facilities, form.project, form.facilityNo);
  }, [facilities, form.project, form.facilityNo]);

  const amountNum = moneyVal(form.amount);
  const after = avail == null ? null : avail - amountNum;

  const save = async () => {
    if (!form.project || !form.facilityNo || !amountNum || !form.beneficiary.trim()) {
      notify(t('req.fillRequired'));
      return;
    }
    if (!isDMYOrBlank(form.docFrom) || !isDMYOrBlank(form.docTo)) {
      notify(t('req.attachDateFormat'));
      return;
    }
    if (!isDMYOrBlank(form.refDocFrom) || !isDMYOrBlank(form.refDocTo)) {
      notify(t('req.refDateFormat'));
      return;
    }

    // The wire format is dd/mm/yyyy — the API's toDate() parses it and dmy()
    // renders it back. The <input type="date"> values are ISO, so convert.
    const payload = {
      project: form.project,
      company: projCompany(projects, form.project),
      facilityNo: form.facilityNo,
      amount: amountNum,
      purpose: form.purpose || form.note || '',
      beneficiary: form.beneficiary.trim(),
      note: form.note,
      maturity: isoToDMY(form.maturity),
      source: form.source,
      docFrom: form.docFrom,
      docTo: form.docTo,
      status: form.status,
    };

    setBusy(true);
    try {
      await mutate(
        () =>
          editing
            ? apiCredit.updateRequest(request.id, payload)
            : apiCredit.addRequest(payload),
        editing ? t('req.updated') : t('req.saved')
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
      wide
      bodyMaxHeight="min(78vh, 46rem)"
      title={editing ? t('req.edit') : t('req.add')}
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
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t('filter.project')} required className="sm:col-span-2">
            <Select value={form.project} onChange={(e) => set({ project: e.target.value })}>
              <option value="">{t('req.selectProject')}</option>
              {projects.map((p) => (
                <option key={p.code} value={p.code}>
                  {projName(projects, p.code)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('filter.company')} className="sm:col-span-2">
            {/* Derived from the project, exactly as reqProjChange() did — the
                company is a property of the project, not a free choice. */}
            <Input value={projCompany(projects, form.project)} disabled readOnly />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t('req.creditType')} required className="sm:col-span-2">
            <Select value={form.facilityNo} onChange={(e) => set({ facilityNo: e.target.value })}>
              <option value="">{t('req.selectType')}</option>
              {facTypes.map((ft) => (
                <option key={ft.no} value={String(ft.no)}>
                  {ft.no}. {ft.th}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('req.amountTHB')} required className="sm:col-span-2">
            <Input
              value={form.amount}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(e) => set({ amount: fmtMoneyStr(e.target.value) })}
            />
          </Field>
        </div>

        {avail != null ? (
          <div
            className={
              'rounded-control px-3 py-2 text-xs font-semibold ' +
              (after != null && after < 0
                ? 'bg-danger-bg text-danger-fg dark:bg-danger/20 dark:text-danger-dark'
                : 'bg-info-bg text-info-fg dark:bg-brand-900/50 dark:text-info-dark')
            }
          >
            {t('fac.available')} ฿{money(avail)}
            {amountNum > 0 ? (
              <>
                {' · '}
                {after < 0 ? t('req.overLimit') : t('req.afterThis')} ฿{money(after)}
              </>
            ) : null}
          </div>
        ) : form.project && form.facilityNo ? (
          <div className="rounded-control bg-surface-sunken px-3 py-2 text-xs text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
            {t('req.noAvailData')}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('req.startDate')}>
            <Input type="date" value={form.start} onChange={(e) => onStart(e.target.value)} />
          </Field>
          <Field label={t('req.days')}>
            <Input
              type="number"
              min="0"
              placeholder={t('req.daysPlaceholder')}
              value={form.days}
              onChange={(e) => onDays(e.target.value)}
            />
          </Field>
          <Field label={t('req.dueDate')}>
            <Input type="date" value={form.maturity} onChange={(e) => onMaturity(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('req.beneficiary')} required>
            <Input
              value={form.beneficiary}
              placeholder={t('req.beneficiaryPlaceholder')}
              onChange={(e) => set({ beneficiary: e.target.value })}
            />
          </Field>
          <Field label={t('req.refDocNo')}>
            <Input
              value={form.ref}
              placeholder={t('req.refDocNoPlaceholder')}
              onChange={(e) => set({ ref: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('req.refDocRange')}>
            <Input
              value={form.refDocFrom}
              placeholder="dd/mm/yyyy"
              onChange={(e) => set({ refDocFrom: e.target.value })}
            />
          </Field>
          <Field label="&nbsp;">
            <Input
              value={form.refDocTo}
              placeholder={t('req.dmyTo')}
              onChange={(e) => set({ refDocTo: e.target.value })}
            />
          </Field>
        </div>

        <fieldset className="rounded-card border border-line p-3 dark:border-line-dark">
          <legend className="px-1 text-xs font-bold text-ink-muted dark:text-ink-dark-muted">
            {t('req.attachStatus')}
          </legend>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('req.attachment')} className="sm:col-span-2">
              <Input
                value={form.source}
                placeholder={t('req.attachmentPlaceholder')}
                onChange={(e) => set({ source: e.target.value })}
              />
            </Field>
            <Field label={t('req.attachRange')}>
              <Input
                value={form.docFrom}
                placeholder="dd/mm/yyyy"
                onChange={(e) => set({ docFrom: e.target.value })}
              />
            </Field>
            <Field label="&nbsp;">
              <Input
                value={form.docTo}
                placeholder={t('req.dmyTo')}
                onChange={(e) => set({ docTo: e.target.value })}
              />
            </Field>
          </div>

          {/* The list is credit.cost_categories, editable in Settings. A
              free-typed value is still allowed — the column is plain text —
              but the two-column panel makes picking one a click instead of a
              full retype. */}
          <div className="mt-3">
            <Field label={t('req.costCategory')}>
              <CostCategoryPicker
                value={form.costCategory}
                onChange={(v) => set({ costCategory: v })}
                categories={costCategories}
                placeholder={t('req.costCategoryPlaceholder')}
              />
            </Field>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('filter.status')}>
            <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value={STATUS.NEW}>{t('status.newOpt')}</option>
              <option value={STATUS.PENDING}>{t('status.pendingOpt')}</option>
              <option value={STATUS.APPROVED}>{t('status.approvedOpt')}</option>
              <option value={STATUS.SETTLED}>{t('status.settledOpt')}</option>
            </Select>
          </Field>
          <Field label={t('req.note')}>
            <Textarea
              rows={1}
              value={form.note}
              placeholder={t('req.notePlaceholder')}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
