import { useEffect, useState } from 'react';
import { sopApi } from '../../lib/sop.js';
import { Modal } from '../../components/ui/index.js';
import { useToast } from '../../components/Toast.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';

// stable per-row id so removable step rows key by identity, not index
const rid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'r' + Math.random().toString(36).slice(2));

/** Create / edit one SOP case: header fields, ordered steps, extra module tags. */
export default function ScenarioModal({ item, modules, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(item?.no);
  const [form, setForm] = useState({
    module: item?.module || modules[0]?.code || '',
    titleTh: item?.title_th || '',
    titleEn: item?.title_en || '',
    problem: item?.problem || '',
    ref: item?.ref || '',
    note: item?.note || '',
  });
  const [steps, setSteps] = useState([{ _id: rid(), text: '', isSubstep: false }]);
  const [extra, setExtra] = useState(item?.extra_modules || []);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // editing: pull the full case (list rows carry no steps)
  useEffect(() => {
    if (!editing) return;
    sopApi.scenario(item.no).then((r) => {
      const s = (r.data.steps || []).map((x) => ({ _id: rid(), text: x.text, isSubstep: x.is_substep }));
      setSteps(s.length ? s : [{ _id: rid(), text: '', isSubstep: false }]);
      setExtra(r.data.extra_modules || []);
    }).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, item?.no]);

  const setStep = (i, patch) => setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((p) => [...p, { _id: rid(), text: '', isSubstep: false }]);
  const removeStep = (i) => setSteps((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const moveStep = (i, d) => setSteps((p) => {
    const j = i + d;
    if (j < 0 || j >= p.length) return p;
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const save = async (e) => {
    e?.preventDefault();
    if (!form.titleTh.trim()) { toast.error('กรุณากรอกชื่อกรณีศึกษา'); return; }
    if (!form.module) { toast.error('กรุณาเลือกหมวดงาน'); return; }
    setBusy(true);
    try {
      const body = {
        module: form.module,
        titleTh: form.titleTh.trim(),
        titleEn: form.titleEn.trim() || null,
        problem: form.problem.trim(),
        ref: form.ref.trim() || null,
        note: form.note.trim() || null,
        steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), isSubstep: s.isSubstep })),
        extraModules: extra,
      };
      let created = null;
      if (editing) await sopApi.updateScenario(item.no, body);
      else created = (await sopApi.createScenario(body)).data?.no ?? null;
      toast.success(editing ? 'บันทึกกรณีศึกษาแล้ว' : 'เพิ่มกรณีศึกษาแล้ว');
      onSaved(created);
      return;
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  };

  return (
    <Modal title={editing ? `แก้ไขกรณีศึกษา ${item.display_no || ''}` : 'เพิ่มกรณีศึกษา'} onClose={onClose} size="2xl"
      footer={<>
        <button onClick={onClose} className="btn-outline">ยกเลิก</button>
        <button onClick={save} disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังบันทึก…">บันทึก</BusyLabel></button>
      </>}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">หมวดงาน *</label>
            <select value={form.module} onChange={(e) => set('module', e.target.value)} className="field">
              {modules.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name_th_short}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อกรณีศึกษา (ไทย) *</label>
            <input value={form.titleTh} onChange={(e) => set('titleTh', e.target.value)} placeholder="เช่น กรณีการทำใบลดยอด PO…" className="field" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อภาษาอังกฤษ</label>
          <input value={form.titleEn} onChange={(e) => set('titleEn', e.target.value)} placeholder="เช่น PO Decrement" className="field" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ปัญหา / สถานการณ์ (เมื่อไรจึงใช้)</label>
          <textarea value={form.problem} onChange={(e) => set('problem', e.target.value)} rows={4} className="field resize-y" />
        </div>

        {/* steps */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-600">ขั้นตอนการปฏิบัติ</label>
            <span className="text-xs text-slate-500">ติ๊ก “ย่อย” เพื่อให้เป็นข้อย่อย (»)</span>
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s._id} className={`flex items-start gap-2 ${s.isSubstep ? 'pl-6' : ''}`}>
                <span className="mt-2.5 w-5 shrink-0 text-center text-xs text-slate-500">{s.isSubstep ? '»' : i + 1}</span>
                <textarea value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} rows={2}
                  placeholder="อธิบายสิ่งที่ต้องทำ…" className="field flex-1 resize-y" />
                <div className="flex shrink-0 flex-col gap-1 pt-1">
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="checkbox" checked={s.isSubstep} onChange={(e) => setStep(i, { isSubstep: e.target.checked })} /> ย่อย
                  </label>
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} title="เลื่อนขึ้น"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                      <Icon name="arrowLeft" className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} title="เลื่อนลง"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                      <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-90" />
                    </button>
                    <button type="button" onClick={() => removeStep(i)} disabled={steps.length === 1} title="ลบขั้นตอน"
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 text-sm font-medium text-brand hover:underline">+ เพิ่มขั้นตอน</button>
        </div>

        {/* extra module tags */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            แสดงในหมวดอื่นด้วย <span className="text-xs font-normal text-slate-500">(เลขที่ยังนับจากหมวดหลัก)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {modules.filter((m) => m.code !== form.module).map((m) => {
              const on = extra.includes(m.code);
              return (
                <button key={m.code} type="button"
                  onClick={() => setExtra((p) => (on ? p.filter((x) => x !== m.code) : [...p, m.code]))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}>
                  {m.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">อ้างอิงคู่มือ</label>
            <input value={form.ref} onChange={(e) => set('ref', e.target.value)} placeholder="เช่น ERP Manual 14.3.68 — บทที่ 4 (PO)" className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">หมายเหตุ [!]</label>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="ข้อควรระวังเพิ่มเติม" className="field" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
