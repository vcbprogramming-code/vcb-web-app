import { useEffect, useMemo, useRef, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ประวัติการแก้ไข — overlay กว้างแบบระบบที่ลูกค้าใช้อยู่
 *
 * ตารางนี้เคยอยู่ในแท็บ "รายงาน" ซึ่งปิดด้วยธงฟีเจอร์ตลอด แปลว่าไม่มีใครเข้าถึง
 * ประวัติได้เลย ทั้งที่มันคือสิ่งเดียวที่ตอบได้ว่าตัวเลขเปลี่ยนเพราะใคร — จึงย้าย
 * ทางเข้ามาไว้ที่หน้า ตั้งค่า เหมือนเขา และไม่ผูกกับธงใด ๆ
 *
 * ใช้เชลล์เดียวกับ components/ui/Modal ทุกอย่าง (ฉากหลัง มุมโค้ง หัวติดด้านบน
 * Escape ปิด ล็อกการเลื่อนพื้นหลัง) ต่างกันแค่ความกว้าง เพราะตารางมีแปดคอลัมน์
 * และ Modal กว้างสุดแค่ max-w-2xl
 */
const pad2 = (n) => String(n).padStart(2, '0');

/** เวลาที่คนอ่านออก ตามเขตเวลาไทย */
const fmtTime = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });
  } catch { return String(v).slice(0, 16).replace('T', ' '); }
};
const fmtYmd = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * ช่องไหนที่เปลี่ยน — ระบบจริงเก็บชื่อช่องมาตรง ๆ (work / PM / note) ของเรา
 * เก็บเป็นก้อน JSON ก่อน-หลัง จึงต้องเทียบเอาเองว่าคีย์ไหนต่าง
 * team/detail/pm = งาน · note = หมายเหตุ คีย์อื่นถือเป็น "งาน" เหมือนแถวรุ่นเก่าของเขา
 */
const WORK_KEYS = ['team', 'detail', 'pm'];
function diffOf(row) {
  const b = row.before_val || {};
  const a = row.after_val || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const changed = keys.filter((k) => String(b[k] ?? '') !== String(a[k] ?? ''));
  const pickKeys = changed.length ? changed : keys;
  const field = pickKeys.includes('note') && !pickKeys.some((k) => WORK_KEYS.includes(k)) ? 'note' : 'work';
  const val = (o) => pickKeys.map((k) => o[k]).filter((v) => v != null && v !== '').join(' · ');
  return { field, oldVal: val(b), newVal: val(a) };
}

export default function EditHistory({ sites = [], onClose }) {
  const t = useT();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [site, setSite] = useState('');
  const [field, setField] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // 1000 แถวเท่าระบบจริง (api_auditLog[1000])
    perfApi.workAudit({ limit: 1000 })
      .then((r) => !cancelled && setRows(r.data || []))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const all = useMemo(() => (rows || []).map((r) => ({ ...r, ...diffOf(r) })), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      if (site && r.site !== site) return false;
      if (field && r.field !== field) return false;
      if (!needle) return true;
      const hay = [r.actor_label, r.emp_name, r.oldVal, r.newVal, r.site_name].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [all, q, site, field]);

  const dash = (v) => (v === '' || v == null ? <span className="text-slate-300">—</span> : v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} role="dialog" aria-modal="true">
      <div ref={panelRef} tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-bold text-slate-800">{t('ประวัติการแก้ไข')}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={t('ปิด')}>
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ค้นหา อีเมล / ชื่อ / ค่า')}
            className="field !w-auto min-w-[15rem] flex-1" />
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label={t('หน่วยงาน')} className="field !w-auto">
            <option value="">{t('ทุกหน่วยงาน')}</option>
            {sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
          <select value={field} onChange={(e) => setField(e.target.value)} aria-label={t('ช่อง')} className="field !w-auto">
            <option value="">{t('ทุกช่อง')}</option>
            <option value="work">{t('งาน')}</option>
            <option value="note">{t('หมายเหตุ')}</option>
          </select>
          <span className="text-sm tabular-nums text-slate-400">{shown.length} / {all.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <p className="px-6 py-10 text-center text-sm text-red-700">{t('โหลดไม่สำเร็จ')}</p>
          ) : !rows ? (
            <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>
          ) : !all.length ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">{t('ยังไม่มีประวัติการแก้ไข')}</p>
          ) : !shown.length ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">{t('ไม่พบรายการ')}</p>
          ) : (
            <table className="tbl">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="tbl-th">{t('เวลา')}</th>
                  <th className="tbl-th">{t('ผู้แก้ไข')}</th>
                  <th className="tbl-th">{t('หน่วยงาน')}</th>
                  <th className="tbl-th">{t('พนักงาน')}</th>
                  <th className="tbl-th">{t('วันที่')}</th>
                  <th className="tbl-th">{t('ช่อง')}</th>
                  <th className="tbl-th">{t('เดิม')}</th>
                  <th className="tbl-th">{t('ใหม่')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => (
                  <tr key={r.id} className="tbl-row align-top">
                    <td className="tbl-td whitespace-nowrap text-xs text-slate-500">{fmtTime(r.created_at)}</td>
                    <td className="tbl-td text-slate-700">{dash(r.actor_label)}</td>
                    <td className="tbl-td text-slate-500">{dash(r.site_name)}</td>
                    <td className="tbl-td text-slate-700">{dash(r.emp_name)}</td>
                    <td className="tbl-td whitespace-nowrap text-slate-500">{fmtYmd(r.ymd)}</td>
                    <td className="tbl-td text-slate-500">{r.field === 'note' ? t('หมายเหตุ') : t('งาน')}</td>
                    <td className="tbl-td max-w-[14rem] break-words text-xs text-slate-600">{dash(r.oldVal)}</td>
                    <td className="tbl-td max-w-[14rem] break-words text-xs font-medium text-slate-800">{dash(r.newVal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
