import { useRef, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * §2 — bring the employee register in from a spreadsheet.
 *
 * The check runs first and writes nothing. An import that silently drops rows
 * is worse than typing them by hand, so the file is always parsed twice: once
 * to show exactly which rows will not make it and why, and again to write only
 * after someone has read that list.
 */
export default function ImportEmployees() {
  const t = useT();
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (dryRun) => {
    if (!file) { toast.error(t('ยังไม่ได้เลือกไฟล์')); return; }
    setBusy(true);
    try {
      const r = await perfApi.importEmployees(file, dryRun);
      setPreview({ ...r.data, dryRun });
      if (!dryRun) {
        toast.success(t('นำเข้าแล้ว {n} คน · ปรับปรุง {u} คน', { n: r.data.imported, u: r.data.updated }));
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const template = async () => {
    try {
      const url = await perfApi.importTemplateUrl();
      const a = document.createElement('a');
      a.href = url; a.download = 'employee-import-template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-bold text-slate-800">{t('นำเข้าทะเบียนพนักงานจาก Excel')}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {t('คอลัมน์ที่รองรับ: รหัสพนักงาน · ชื่อ-สกุล · โครงการ · ประเภท · แผนก · ตำแหน่ง · สถานะ — รหัสพนักงานที่มีอยู่แล้วจะถูกปรับปรุง ไม่สร้างซ้ำ')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx" aria-label={t('เลือกไฟล์ Excel')}
          onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}
          className="text-sm" />
        <button onClick={() => run(true)} disabled={!file || busy} className="btn-outline disabled:opacity-40">
          <Icon name="search" className="h-4 w-4" /> {t('ตรวจไฟล์ก่อน')}
        </button>
        <button onClick={() => run(false)} disabled={!file || busy} className="btn-primary disabled:opacity-40">
          <Icon name="upload" className="h-4 w-4" /> {t('นำเข้าจริง')}
        </button>
        <button onClick={template} className="btn-outline ml-auto">
          <Icon name="download" className="h-4 w-4" /> {t('ดาวน์โหลดไฟล์ตัวอย่าง')}
        </button>
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="chip bg-slate-100 text-slate-600">{t('ทั้งหมด')} {preview.total}</span>
            <span className="chip bg-emerald-50 text-emerald-700">{t('ผ่านเงื่อนไข')} {preview.accepted}</span>
            <span className="chip bg-rose-50 text-rose-700">{t('ไม่ผ่าน')} {preview.failedCount}</span>
            {!preview.dryRun && (
              <>
                <span className="chip bg-brand/10 text-brand">{t('เพิ่มใหม่')} {preview.imported}</span>
                <span className="chip bg-amber-50 text-amber-700">{t('ปรับปรุง')} {preview.updated}</span>
              </>
            )}
          </div>
          {preview.failed?.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-rose-200">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="tbl-th w-20">{t('แถวที่')}</th>
                    <th className="tbl-th">{t('ชื่อ-สกุล')}</th>
                    <th className="tbl-th">{t('เหตุผลที่ไม่ผ่าน')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.failed.map((f, i) => (
                    <tr key={i} className="tbl-row">
                      <td className="tbl-td tabular-nums text-slate-500">{f.row}</td>
                      <td className="tbl-td text-slate-800">{f.name || '—'}</td>
                      <td className="tbl-td text-sm text-rose-600">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.dryRun && preview.accepted > 0 && (
            <p className="text-sm text-slate-500">{t('ยังไม่ได้บันทึกลงระบบ — กด “นำเข้าจริง” เมื่อตรวจรายการข้างต้นแล้ว')}</p>
          )}
        </div>
      )}
    </div>
  );
}
