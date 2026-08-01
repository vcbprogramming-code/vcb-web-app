import { useEffect, useState } from 'react';
import { portalApi } from '../../lib/portal.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
import { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

const LEVELS = { info: 'ทั่วไป', warning: 'เตือน', success: 'สำเร็จ' };
// explicit dark variants: the global .dark remaps recolour the *backgrounds* but
// not these 700-weight text colours, which would leave dark-on-dark chips
const LEVEL_CHIP = {
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
};
const field = 'field';

function AnnouncementModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const editing = item && item.id;
  const [form, setForm] = useState({
    title: item?.title || '', body: item?.body || '', level: item?.level || 'info',
    isActive: item?.is_active ?? true, pinned: item?.pinned ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('กรุณากรอกหัวข้อ'); return; }
    setBusy(true);
    try {
      const body = { title: form.title.trim(), body: form.body.trim() || null, level: form.level, isActive: form.isActive, pinned: form.pinned };
      if (editing) await portalApi.updateAnnouncement(item.id, body);
      else await portalApi.createAnnouncement(body);
      toast.success(editing ? 'บันทึกประกาศแล้ว' : 'เพิ่มประกาศแล้ว');
      onSaved(); // unmounts this modal — don't setBusy afterwards
      return;
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  };

  return (
    <Modal title={editing ? 'แก้ไขประกาศ' : 'เพิ่มประกาศ'} onClose={onClose} size="lg"
      footer={<>
        <button onClick={onClose} className="btn-outline">ยกเลิก</button>
        <button onClick={save} disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังบันทึก…">บันทึก</BusyLabel></button>
      </>}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">หัวข้อ *</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="เช่น ปิดปรับปรุงระบบ" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">รายละเอียด</label>
          <textarea value={form.body} onChange={(e) => set('body', e.target.value)} rows={3} className={`${field} resize-none`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ระดับ</label>
            <select value={form.level} onChange={(e) => set('level', e.target.value)} className={field}>
              {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> แสดงผล</label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} /> ปักหมุด</label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function AnnouncementsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(undefined); // undefined=closed, null=new, obj=edit

  const load = () => portalApi.allAnnouncements().then((r) => setList(r.data)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const remove = async (a) => {
    if (!(await confirm({ title: 'ลบประกาศ', message: `ลบ "${a.title}" หรือไม่?`, confirmLabel: 'ลบ', danger: true }))) return;
    try { await portalApi.deleteAnnouncement(a.id); toast.success('ลบแล้ว'); load(); } catch (e) { toast.error(e.message); }
  };
  const toggleActive = async (a) => {
    try {
      await portalApi.updateAnnouncement(a.id, { isActive: !a.is_active });
      toast.success(a.is_active ? 'ซ่อนประกาศแล้ว' : 'แสดงประกาศแล้ว');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มประกาศ</button>
      </div>

      {!list ? <div className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</div>
        : list.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">ยังไม่มีประกาศ — กด “เพิ่มประกาศ”</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="tbl min-w-[560px]">
              <thead><tr className="tbl-head"><th className="tbl-th">หัวข้อ</th><th className="tbl-th">ระดับ</th><th className="tbl-th">สถานะ</th><th className="tbl-th text-right">จัดการ</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((a) => (
                  <tr key={a.id} className="tbl-row">
                    <td className="tbl-td">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        {a.pinned && <Icon name="pin" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}{a.title}
                      </div>
                      {a.body && <div className="truncate text-xs text-slate-400">{a.body}</div>}
                    </td>
                    <td className="tbl-td"><span className={`chip ${LEVEL_CHIP[a.level] || LEVEL_CHIP.info}`}>{LEVELS[a.level] || a.level}</span></td>
                    <td className="tbl-td">
                      <button onClick={() => toggleActive(a)} title="สลับการแสดงผล"
                        className={`chip inline-flex items-center gap-1 ${a.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                        {a.is_active ? 'แสดง' : 'ซ่อน'} <Icon name="undo" className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="tbl-td text-right">
                      <button onClick={() => setEdit(a)} className="mr-3 text-sm text-brand hover:underline">แก้ไข</button>
                      <button onClick={() => remove(a)} className="text-sm text-rose-500 hover:underline">ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {edit !== undefined && <AnnouncementModal item={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); load(); }} />}
    </div>
  );
}
