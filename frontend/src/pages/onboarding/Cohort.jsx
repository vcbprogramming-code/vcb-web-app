import { useEffect, useState } from 'react';
import { programApi } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ภาพรวมพนักงานที่อยู่ในโปรแกรม (เฉพาะผู้ดูแล)
 *
 * ตัวหารนับเฉพาะรายการที่ระดับของแต่ละคนมองเห็น มิฉะนั้นพนักงานระดับต้นจะดู
 * เหมือนทำไม่เสร็จตลอดไป ทั้งที่รายการระดับอาวุโสไม่ใช่ของเขาตั้งแต่แรก
 */
export default function Cohort() {
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    programApi.cohort().then((r) => setRows(r.data || []))
      .catch((e) => { toast.error(e.message); setRows([]); });
  }, [toast]);

  if (!rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;
  if (!rows.length) return <div className="card py-12 text-center text-sm text-slate-500">{t('ยังไม่มีพนักงานเข้าโปรแกรม')}</div>;

  return (
    <div className="card overflow-hidden !p-0">
      <table className="tbl">
        <thead>
          <tr>
            <th className="tbl-th">{t('ชื่อ')}</th>
            <th className="tbl-th">{t('แผนก')}</th>
            <th className="tbl-th">{t('ระดับ')}</th>
            <th className="tbl-th">{t('เอกสาร')}</th>
            <th className="tbl-th">{t('ความคืบหน้า')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profileId} className="tbl-row">
              <td className="tbl-td">
                <div className="font-medium text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-400">{r.email}</div>
              </td>
              <td className="tbl-td text-slate-600">{r.department || '—'}</td>
              <td className="tbl-td text-slate-600">{r.track === 'senior' ? t('อาวุโส') : t('ต้น')}</td>
              <td className="tbl-td">
                <span className={`chip ${r.docsComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {r.docsComplete ? t('ครบ') : t('ยังไม่ครบ')}
                </span>
              </td>
              <td className="tbl-td">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${r.allComplete ? 'bg-emerald-500' : 'bg-brand'}`}
                      style={{ width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%` }} />
                  </div>
                  <span className="tabular-nums text-sm text-slate-600">{r.done}/{r.total}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
