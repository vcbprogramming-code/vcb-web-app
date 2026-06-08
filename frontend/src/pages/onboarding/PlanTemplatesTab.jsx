import { useEffect, useState, useCallback } from 'react';
import { onboardingApi } from '../../lib/modules.js';
import Icon from '../../components/Icon.jsx';

const PHASES = [30, 60, 90];

export default function PlanTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ 30: '', 60: '', 90: '' });

  const load = useCallback(() => {
    onboardingApi.templates().then((r) => setTemplates(r.data)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (phase) => {
    const title = draft[phase].trim();
    if (!title) return;
    try {
      await onboardingApi.addTemplate({ phase, title });
      setDraft((d) => ({ ...d, [phase]: '' }));
      load();
    } catch (e) { setError(e.message); }
  };
  const remove = async (id) => {
    try { await onboardingApi.deleteTemplate(id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">เทมเพลตงานในแต่ละช่วง — เมื่อเพิ่มพนักงานใหม่ ระบบจะคัดลอกรายการเหล่านี้เป็นแผนติดตามให้อัตโนมัติ</p>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PHASES.map((phase) => {
          const items = templates.filter((t) => t.phase === phase);
          return (
            <div key={phase} className="card">
              <h3 className="mb-3 font-bold text-slate-800">{phase} วัน <span className="text-xs font-normal text-slate-400">({items.length})</span></h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-700">{t.title}</span>
                    <button onClick={() => remove(t.id)} className="text-slate-300 hover:text-red-600"><Icon name="trash" className="h-4 w-4" /></button>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-slate-400">ยังไม่มีรายการ</p>}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); add(phase); }} className="mt-3 flex gap-2">
                <input value={draft[phase]} onChange={(e) => setDraft((d) => ({ ...d, [phase]: e.target.value }))} placeholder="เพิ่มงาน…" className="field text-sm" />
                <button type="submit" className="btn-primary shrink-0 !px-3"><Icon name="plus" className="h-4 w-4" /></button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
