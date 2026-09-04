// ปรับวงเงิน / ใช้ไป — set a facility's limit, and pin or unpin its `used`.
//
// Two separate endpoints, because they are two different facts:
//   PUT /limits              the negotiated limit
//   PUT /limits/used-override  a manual pin over the derived figure
//
// Leaving `used` blank sends null, which clears the pin and hands the number
// back to the credit.facility_used view. That is why the field starts blank
// unless the row is already overridden — prefilling it with the derived value
// would silently pin whatever the view last computed.

import React, { useEffect, useState } from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import * as apiCredit from '../lib/api.js';
import { fmtMoneyStr, money, moneyVal } from '../lib/format.js';
import { kindShort, typeName } from '../lib/lookups.js';
import { Button, Field, Input, Modal } from './ui.jsx';

export default function LimitDialog({ facility, onClose }) {
  const t = useT();
  const { facTypes, mutate, notify } = useData();
  const [limit, setLimit] = useState('');
  const [used, setUsed] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!facility) return;
    setLimit(fmtMoneyStr(String(facility.limit ?? '')));
    setUsed(facility.usedOverridden ? fmtMoneyStr(String(facility.used ?? '')) : '');
  }, [facility]);

  if (!facility) return null;

  const save = async () => {
    const limRaw = String(limit).trim();
    if (limRaw === '' || !Number.isFinite(moneyVal(limRaw)) || moneyVal(limRaw) < 0) {
      notify(t('fac.badLimit'));
      return;
    }
    const usedRaw = String(used).trim();
    if (usedRaw !== '' && (!Number.isFinite(moneyVal(usedRaw)) || moneyVal(usedRaw) < 0)) {
      notify(t('fac.badUsed'));
      return;
    }

    setBusy(true);
    try {
      await mutate(async () => {
        await apiCredit.setLimit(facility.project, facility.facilityNo, moneyVal(limRaw));
        // Blank clears the pin. Sent unconditionally so clearing a previously
        // set override actually reaches the API.
        await apiCredit.setUsedOverride(
          facility.project,
          facility.facilityNo,
          usedRaw === '' ? null : moneyVal(usedRaw)
        );
      }, t('fac.adjusted'));
      onClose();
    } catch (err) {
      notify(t(`error.${err?.code}`) || t('misc.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(facility)}
      onClose={onClose}
      title={`${t('fac.adjust')} — ${facility.project} · ${kindShort(facTypes, facility.facilityNo)}`}
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
          {typeName(facTypes, facility.facilityNo)}
        </p>

        <Field label={t('fac.limitTHB')} required>
          <Input
            value={limit}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(e) => setLimit(fmtMoneyStr(e.target.value))}
          />
        </Field>

        <Field label={t('fac.usedTHB')} hint={t('fac.usedBlankHint')}>
          <Input
            value={used}
            inputMode="decimal"
            placeholder={money(facility.used)}
            onChange={(e) => setUsed(fmtMoneyStr(e.target.value))}
          />
        </Field>
      </div>
    </Modal>
  );
}
