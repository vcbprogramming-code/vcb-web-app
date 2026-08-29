import { useCallback, useEffect, useMemo, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แรงงาน-วัน — the measure the acceptance criteria are written in.
 *
 * The diary grid answers "what did this person do"; this screen answers "how
 * much labour did this project spend, on what". They sit side by side on
 * purpose: the diary is what the site already fills in every day, and forcing
 * man-days into the same cell would have made both harder to key.
 */
const STATUSES = ['ปกติ', 'ล่วงเวลา', 'Standby', 'ลา', 'ขาดงาน'];
const STATE_CHIP = {
  editable: 'bg-emerald-50 text-emerald-700',
  'due-soon': 'bg-amber-50 text-amber-700',
  locked: 'bg-slate-100 text-slate-500',
  closed: 'bg-rose-50 text-rose-700',
};
const STATE_TH = { editable: 'แก้ไขได้', 'due-soon': 'ใกล้ครบกำหนด', locked: 'ล็อกแล้ว', closed: 'ปิดงวดแล้ว' };

export default function MandayView({ site, month, canEdit, isAdmin }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState('');
  const [closes, setCloses] = useState([]);

  const load = useCallback(() => {
    if (!site) return;
    const [Y, M] = month.split('-').map(Number);
    perfApi.siteMonth(site, Y, M).then(setData).catch((e) => toast.error(e.message));
    perfApi.periodCloses(site).then((r) => setCloses(r.data || [])).catch(() => setCloses([]));
  }, [site, month, toast]);
  useEffect(load, [load]);

  const dayState = useMemo(() => {
    const d = (data?.days || []).find((x) => x.date === date);
    return d?.state || 'editable';
  }, [data, date]);
  const locked = dayState === 'locked' || dayState === 'closed';
  const rows = data?.employees || [];
  const entriesFor = (eid) => data?.entries?.[eid]?.[date] || {};

  const save = async (eid, patch) => {
    const cur = entriesFor(eid);
    const body = { site, eid, date, manDay: patch.manDay ?? cur.manDay ?? null, workStatus: patch.workStatus ?? cur.workStatus ?? null };
    if (locked) {
      const reason = window.prompt(t('วันนี้ล็อกแล้ว — ระบุเหตุผลในการแก้ไขย้อนหลัง'));
      if (!reason) return;
      body.adminUnlock = true; body.reason = reason;
    }
    setBusy(eid);
    try { await perfApi.saveDay(body); toast.success(t('บันทึกแล้ว')); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  };

  const verify = async (undo) => {
    try {
      const r = await perfApi.verify(site, date, date, undo);
      const n = r.data?.verified ?? 0;
      const own = r.data?.skippedOwn ?? 0;
      toast.success(undo ? t('ยกเลิกการยืนยันแล้ว') : t('ยืนยันข้อมูลแล้ว {n} รายการ', { n }));
      if (own) toast.info(t('ข้าม {n} รายการที่ท่านเป็นผู้บันทึกเอง — ผู้บันทึกยืนยันงานตัวเองไม่ได้', { n: own }));
      load();
    } catch (e) { toast.error(e.message); }
  };

  const closePeriod = async () => {
    const ym = date.slice(0, 7);
    const ok = await confirm({
      title: t('ปิดงวด {ym}', { ym }),
      message: t('เมื่อปิดงวดแล้ว ข้อมูลของเดือนนี้จะแก้ไขไม่ได้อีก'),
      confirmLabel: t('ปิดงวด'),
    });
    if (!ok) return;
    try { await perfApi.closePeriod(site, ym); toast.success(t('ปิดงวดแล้ว')); load(); }
    catch (e) { toast.error(e.message); }
  };
  const openPeriod = async (ym) => {
    const reason = window.prompt(t('การเปิดงวดที่ปิดแล้วต้องระบุเหตุผล'));
    if (!reason) return;
    try { await perfApi.openPeriod(site, ym, reason); toast.success(t('เปิดงวดแล้ว')); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (!site) return <div className="card py-10 text-center text-sm text-slate-500">{t('เลือกไซต์งานด้านบนก่อน')}</div>;
  if (!data) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const closedThis = closes.find((c) => c.ym === date.slice(0, 7));
  const total = rows.reduce((a, e) => a + Number(entriesFor(e.id).manDay || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card-sm flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600">{t('วันที่ปฏิบัติงาน')}</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field !w-auto" />
        <span className={`chip ${STATE_CHIP[dayState]}`}>{t(STATE_TH[dayState] || dayState)}</span>
        <span className="text-sm text-slate-500">{t('รวมวันนี้')} <b className="tabular-nums text-slate-800">{total.toFixed(2)}</b> {t('แรงงาน-วัน')}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => verify(false)} className="btn-outline">
            <Icon name="check" className="h-4 w-4" /> {t('ยืนยันข้อมูลของวันนี้')}
          </button>
          <button onClick={() => verify(true)} className="btn-outline">{t('ยกเลิกการยืนยัน')}</button>
          {isAdmin && (closedThis
            ? <button onClick={() => openPeriod(closedThis.ym)} className="btn-outline">{t('เปิดงวด')} {closedThis.ym}</button>
            : <button onClick={closePeriod} className="btn-outline">{t('ปิดงวด')} {date.slice(0, 7)}</button>)}
        </div>
      </div>

      <div className="card overflow-hidden !p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th className="tbl-th">{t('รหัสพนักงาน')}</th>
              <th className="tbl-th">{t('ชื่อ-สกุล')}</th>
              <th className="tbl-th w-40">{t('แรงงาน-วัน')}</th>
              <th className="tbl-th w-48">{t('สถานะการทำงาน')}</th>
              <th className="tbl-th">{t('บันทึกเมื่อ')}</th>
              <th className="tbl-th">{t('การยืนยัน')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">{t('ยังไม่มีพนักงานในไซต์นี้')}</td></tr>
            )}
            {rows.map((e) => {
              const cur = entriesFor(e.id);
              return (
                <tr key={e.id} className="tbl-row">
                  <td className="tbl-td text-slate-500">{e.employee_code || '—'}</td>
                  <td className="tbl-td font-medium text-slate-800">{e.full_name}</td>
                  <td className="tbl-td">
                    <input
                      type="number" step="0.25" min="0" max="1" defaultValue={cur.manDay ?? ''}
                      disabled={!canEdit || busy === e.id}
                      onBlur={(ev) => {
                        const v = ev.target.value === '' ? null : Number(ev.target.value);
                        if (v !== (cur.manDay ?? null)) save(e.id, { manDay: v });
                      }}
                      className="field !w-28 tabular-nums" />
                  </td>
                  <td className="tbl-td">
                    <select value={cur.workStatus || ''} disabled={!canEdit || busy === e.id}
                      onChange={(ev) => save(e.id, { workStatus: ev.target.value || null })} className="field !w-40">
                      <option value="">{t('— ไม่ระบุ —')}</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                  </td>
                  <td className="tbl-td text-xs text-slate-400">
                    {cur.entryAt ? new Date(cur.entryAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '—'}
                  </td>
                  <td className="tbl-td">
                    {cur.verifiedAt
                      ? <span className="chip bg-emerald-50 text-emerald-700">{t('ยืนยันแล้ว')}</span>
                      : <span className="chip bg-slate-100 text-slate-500">{t('บันทึกแล้ว')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        {t('แรงงาน-วันต่อคนต่อวันสูงสุด 1 · ระบบคำนวณชั่วโมงให้จากแรงงาน-วัน (8 ชั่วโมง = 1) · ผู้บันทึกยืนยันงานของตนเองไม่ได้')}
      </p>
    </div>
  );
}
