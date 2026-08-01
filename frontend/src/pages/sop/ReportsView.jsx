import { useEffect, useMemo, useState } from 'react';
import { sopApi } from '../../lib/sop.js';
import { Modal } from '../../components/ui/index.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

/**
 * "อยากได้รายงานแบบนี้ ต้องไปเมนูไหน" — the report-menu register.
 * Each row is a question plus the ERP menu path that answers it.
 */
export default function ReportsView({ canEdit, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit

  const load = () => {
    setErr(null);
    return sopApi.reports().then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.scenario_text} ${r.report_path}`.toLowerCase().includes(needle));
  }, [rows, q]);

  const remove = async (r) => {
    const ok = await confirm({ title: 'ลบรายการ', message: `ลบ "${r.scenario_text}"?`, confirmLabel: 'ลบ', danger: true });
    if (!ok) return;
    try {
      await sopApi.deleteReport(r.id);
      toast.success('ลบรายการแล้ว');
      load(); onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหารายงาน"
            placeholder="ค้นหาจากสิ่งที่อยากรู้ หรือชื่อรายงาน…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
        {canEdit && (
          <button onClick={() => setEdit(null)} className="btn-primary !py-2 !text-sm">
            <Icon name="plus" className="h-4 w-4" /> เพิ่มรายการ
          </button>
        )}
      </div>

      {err ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}<button onClick={load} className="ml-2 font-semibold underline">ลองใหม่</button>
        </div>
      ) : !shown ? (
        <div className="flex justify-center py-12"><Spinner label="กำลังโหลดเมนูรายงาน…" /></div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          {q ? `ไม่พบรายการที่ตรงกับ “${q}”` : 'ยังไม่มีรายการ'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr className="tbl-head">
                <th className="tbl-th w-14">ลำดับ</th>
                <th className="tbl-th">ต้องการทราบ</th>
                <th className="tbl-th">เมนูรายงานในระบบ</th>
                {canEdit && <th className="tbl-th w-28 text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.id} className="tbl-row">
                  <td className="tbl-td tabular-nums text-slate-400">{r.case_no ?? '—'}</td>
                  <td className="tbl-td font-medium text-slate-800">{r.scenario_text}</td>
                  <td className="tbl-td font-mono text-[12px] text-slate-600">{r.report_path}</td>
                  {canEdit && (
                    <td className="tbl-td whitespace-nowrap text-right">
                      <button onClick={() => setEdit(r)} className="text-sm font-medium text-brand hover:underline">แก้ไข</button>
                      <button onClick={() => remove(r)} className="ml-3 text-sm text-rose-500 hover:underline">ลบ</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit !== undefined && (
        <ReportModal item={edit} onClose={() => setEdit(undefined)}
          onSaved={() => { setEdit(undefined); load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function ReportModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(item?.id);
  const [scenarioText, setScenarioText] = useState(item?.scenario_text || '');
  const [reportPath, setReportPath] = useState(item?.report_path || '');
  const [caseNo, setCaseNo] = useState(item?.case_no ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    if (!scenarioText.trim() || !reportPath.trim()) { toast.error('กรุณากรอกให้ครบ'); return; }
    setBusy(true);
    try {
      const body = {
        scenarioText: scenarioText.trim(),
        reportPath: reportPath.trim(),
        caseNo: caseNo === '' ? null : Number(caseNo),
      };
      if (editing) await sopApi.updateReport(item.id, body);
      else await sopApi.createReport(body);
      toast.success(editing ? 'บันทึกแล้ว' : 'เพิ่มรายการแล้ว');
      onSaved();
      return;
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  };

  return (
    <Modal title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'} onClose={onClose} size="lg"
      footer={<>
        <button onClick={onClose} className="btn-outline">ยกเลิก</button>
        <button onClick={save} disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังบันทึก…">บันทึก</BusyLabel></button>
      </>}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ต้องการทราบอะไร *</label>
          <textarea value={scenarioText} onChange={(e) => setScenarioText(e.target.value)} rows={2}
            placeholder="เช่น ตรวจสอบยอดหนี้คงค้างในระบบ" className="field resize-y" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">เมนูรายงานในระบบ *</label>
          <input value={reportPath} onChange={(e) => setReportPath(e.target.value)}
            placeholder="เช่น AP -&gt; Report -&gt; 10.2.1 (AP Aging Report)" className="field font-mono text-[13px]" />
        </div>
        <div className="sm:w-40">
          <label className="mb-1 block text-sm font-medium text-slate-600">ลำดับที่</label>
          <input type="number" min={1} value={caseNo} onChange={(e) => setCaseNo(e.target.value)}
            placeholder="ต่อจากรายการสุดท้าย" className="field tabular-nums" />
        </div>
      </form>
    </Modal>
  );
}
