import { useEffect, useState, useCallback } from 'react';
import { onboardingApi } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';

const CATEGORIES = ['นโยบาย', 'สวัสดิการ', 'คู่มือ', 'เอกสารลงนาม', 'สื่อแนะนำ'];
const CAT_CHIP = {
  'นโยบาย': 'bg-blue-50 text-blue-700',
  'สวัสดิการ': 'bg-emerald-50 text-emerald-700',
  'คู่มือ': 'bg-violet-50 text-violet-700',
  'เอกสารลงนาม': 'bg-amber-50 text-amber-700',
  'สื่อแนะนำ': 'bg-pink-50 text-pink-700',
};

function AddResourceModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', category: CATEGORIES[0], description: '', link: '', requiresSignature: false });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.addResource(file, {
        title: form.title,
        category: form.category,
        description: form.description || '',
        link: form.link || '',
        requiresSignature: String(form.requiresSignature),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="เพิ่มข้อมูลพนักงานใหม่"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อเรื่อง <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className="field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">หมวด</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="field">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.requiresSignature} onChange={(e) => set('requiresSignature', e.target.checked)} /> ต้องลงนาม
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">รายละเอียด</label>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ลิงก์ภายนอก (ถ้ามี)</label>
          <input value={form.link} onChange={(e) => set('link', e.target.value)} className="field" placeholder="https://…" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">แนบไฟล์ (ถ้ามี)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

export default function ResourcesTab() {
  const [resources, setResources] = useState([]);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    onboardingApi.resources(category).then((r) => setResources(r.data)).catch((e) => setError(e.message));
  }, [category]);
  useEffect(() => { load(); }, [load]);

  const open = async (id) => {
    try { const url = await onboardingApi.resourceBlobUrl(id); window.open(url, '_blank'); }
    catch (e) { setError(e.message); }
  };
  const remove = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return;
    try { await onboardingApi.deleteResource(id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="field !w-auto">
          <option value="">ทุกหมวด</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setAdding(true)} className="btn-primary ml-auto"><Icon name="plus" className="h-4 w-4" /> เพิ่มข้อมูล</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {resources.length === 0 ? (
        <div className="card text-center text-slate-400">ยังไม่มีข้อมูลในคลัง</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {resources.map((r) => (
            <div key={r.id} className="card-sm flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`chip ${CAT_CHIP[r.category] || 'bg-slate-100 text-slate-600'}`}>{r.category}</span>
                  {r.requires_signature && <span className="chip bg-amber-50 text-amber-700">ต้องลงนาม</span>}
                </div>
                <div className="mt-1.5 font-semibold text-slate-800">{r.title}</div>
                {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
                <div className="mt-2 flex gap-3 text-sm">
                  {r.has_file && <button onClick={() => open(r.id)} className="text-brand hover:underline">เปิดไฟล์</button>}
                  {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="text-brand hover:underline">ลิงก์</a>}
                </div>
              </div>
              <button onClick={() => remove(r.id)} className="shrink-0 text-slate-300 hover:text-red-600"><Icon name="trash" className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {adding && <AddResourceModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}
