import { useCallback, useEffect, useState } from 'react';
import { creditApi, formatAmount } from '../../lib/modules.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';
import { monthOptions, thisMonth } from './tbar.js';

/**
 * ผลต่าง (แผน vs จริง)
 *
 * ตารางหัวสองชั้นตาม renderVariance ของระบบจริง: หนึ่งแถวต่อโครงการ สามกลุ่ม
 * รับเงิน (Received) · หักจ่าย (Deducted) · คงเหลือสุทธิ (Net) แต่ละกลุ่มแตกเป็น
 * แผน / จริง / ผลต่าง โดยผลต่าง = จริง − แผน และย้อมสีตามเครื่องหมายเท่านั้น
 * (ไม่ตีความว่าดีหรือแย่ เพราะแล้วแต่กลุ่ม — จ่ายมากกว่าแผนไม่ได้แปลว่าผิด)
 *
 * เกณฑ์การรวมยอดของหน้านี้ต่างจากการ์ด T-bar โดยเจตนา ตามซอร์สของเขา:
 * "รับเงิน" คือค่างานที่ส่ง (ไม่ใช่ P/N ที่ขาย) และ "หัก PN ขอเบิกใหม่" คิดจาก
 * รวม P/N ของทุกส่วน — ดู backend/src/services/creditTbar.js (varianceTotals)
 */

// ช่องว่างในตารางผลต่างคือศูนย์จริง (ยังไม่มีแผนหรือยังไม่มีของจริง = 0)
const money = (n) => `฿${formatAmount(n)}`;

/** สามช่อง แผน / จริง / ผลต่าง ของหนึ่งกลุ่ม */
function Group({ v }) {
  const d = Number(v?.diff || 0);
  const color = d < 0 ? 'text-red-600' : d > 0 ? 'text-emerald-600' : 'text-slate-400';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  return (
    <>
      <td className="tbl-td !px-3 !py-2.5 text-right tabular-nums">{money(v?.plan)}</td>
      <td className="tbl-td !px-3 !py-2.5 text-right tabular-nums">{money(v?.actual)}</td>
      <td className={`tbl-td !px-3 !py-2.5 text-right font-semibold tabular-nums ${color}`}>
        {sign}{money(Math.abs(d))}
      </td>
    </>
  );
}

export default function VarianceTab({ projects = [] }) {
  const t = useT();
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    setRows(null);
    creditApi.tbarVariance({ month })
      .then((r) => setRows(r.data || []))
      .catch((e) => { toast.error(e.message); setRows([]); });
  }, [month, toast]);
  useEffect(load, [load]);

  const nameOf = (r) => {
    const p = projects.find((x) => x.id === r.project_id);
    return p ? (p.name || '') : (r.project_name || '');
  };

  // .tbl-head บังคับตัวพิมพ์ใหญ่ทั้งแถว แต่หัวตารางของระบบจริงเขียน (Received)
  // ตามปกติ — หัวตารางนี้จึงยกเลิก uppercase เฉพาะจุด
  const sub = (label) => <th className="tbl-th normal-case !px-3 !py-1.5 text-right font-medium">{t(label)}</th>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('ผลต่าง (แผน vs จริง)')} · {t('เดือน')}
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="field !w-auto" title={t('เดือน')}>
          {monthOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>
      ) : rows.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">
          {t('ยังไม่มีข้อมูลแผน/จริงในเดือนนี้')}
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr className="tbl-head">
                <th className="tbl-th normal-case" rowSpan={2}>{t('โครงการ')}</th>
                <th className="tbl-th normal-case !py-2 border-l border-slate-200 text-center dark:border-slate-700" colSpan={3}>
                  {t('รับเงิน (Received)')}
                </th>
                <th className="tbl-th normal-case !py-2 border-l border-slate-200 text-center dark:border-slate-700" colSpan={3}>
                  {t('หักจ่าย (Deducted)')}
                </th>
                <th className="tbl-th normal-case !py-2 border-l border-slate-200 text-center dark:border-slate-700" colSpan={3}>
                  {t('คงเหลือสุทธิ (Net)')}
                </th>
              </tr>
              <tr className="tbl-head">
                {sub('แผน')}{sub('จริง')}{sub('ผลต่าง')}
                {sub('แผน')}{sub('จริง')}{sub('ผลต่าง')}
                {sub('แผน')}{sub('จริง')}{sub('ผลต่าง')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.project_id} className="tbl-row">
                  <td className="tbl-td !py-2.5 whitespace-nowrap">
                    <b className="text-slate-700 dark:text-slate-200">{r.project_code}</b>{' '}
                    <span className="text-xs text-slate-400">{nameOf(r)}</span>
                  </td>
                  <Group v={r.received} />
                  <Group v={r.deducted} />
                  <Group v={r.net} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
