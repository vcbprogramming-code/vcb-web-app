import { useCallback, useEffect, useState } from 'react';
import { sopApi } from '../../lib/sop.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

const thTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/**
 * ประวัติเวอร์ชันของคู่มือ — ทุกการแก้ไขเก็บภาพเอกสารทั้งฉบับไว้ก่อนเขียนทับ
 *
 * การกู้คืนเองก็นับเป็นการแก้ไขครั้งหนึ่ง จึงถูกเก็บภาพไว้ด้วย กดกู้คืนผิด
 * เวอร์ชันก็ย้อนกลับได้อีก — บอกเรื่องนี้ไว้บนหน้าจอ เพราะปุ่มที่เขียนทับคู่มือ
 * ทั้งฉบับดูน่ากลัวกว่าที่มันเป็นจริง
 */
export default function VersionsView({ canEdit, onRestored }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    sopApi.versions().then((r) => setRows(r.data || [])).catch((e) => { toast.error(e.message); setRows([]); });
  }, [toast]);
  useEffect(load, [load]);

  if (!canEdit) {
    return (
      <div className="card py-12 text-center text-sm text-slate-500">
        {t('ประวัติเวอร์ชันเปิดให้เฉพาะผู้มีสิทธิ์แก้ไขคู่มือ')}
      </div>
    );
  }
  if (!rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const restore = async (v) => {
    const ok = await confirm({
      title: t('กู้คืนคู่มือกลับไปเป็นเวอร์ชันนี้'),
      message: `${thTime(v.taken_at)} · ${v.note || ''}\n${t('ระบบจะเก็บภาพของฉบับปัจจุบันไว้ก่อน จึงย้อนกลับได้อีกถ้ากู้ผิดเวอร์ชัน')}`,
      confirmLabel: t('กู้คืน'), danger: false,
    });
    if (!ok) return;
    setBusy(v.id);
    try {
      await sopApi.restoreVersion(v.id);
      toast.success(t('กู้คืนคู่มือแล้ว'));
      load();
      onRestored?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {t('ทุกครั้งที่มีการแก้ไขคู่มือ ระบบจะเก็บภาพของฉบับก่อนหน้าไว้ที่นี่ กู้คืนได้ทุกเวอร์ชัน และการกู้คืนก็ย้อนกลับได้')}
      </p>
      {rows.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">{t('ยังไม่มีการแก้ไขคู่มือ จึงยังไม่มีเวอร์ชันย้อนหลัง')}</div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th className="tbl-th w-44">{t('เมื่อ')}</th>
                <th className="tbl-th">{t('การแก้ไข')}</th>
                <th className="tbl-th">{t('โดย')}</th>
                <th className="tbl-th text-right">{t('เนื้อหาในเวอร์ชันนั้น')}</th>
                <th className="tbl-th w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="tbl-row">
                  <td className="tbl-td whitespace-nowrap text-slate-500">{thTime(v.taken_at)}</td>
                  <td className="tbl-td text-slate-800">{t(v.note || '—')}</td>
                  <td className="tbl-td text-slate-600">{v.taken_by_name || '—'}</td>
                  <td className="tbl-td text-right tabular-nums text-slate-500">
                    {v.scenarios} {t('กรณี')} · {v.reports} {t('รายงาน')}
                  </td>
                  <td className="tbl-td text-right">
                    <button onClick={() => restore(v)} disabled={busy === v.id}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline disabled:opacity-50">
                      <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {t('กู้คืน')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
