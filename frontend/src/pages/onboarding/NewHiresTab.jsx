import { useEffect, useState, useCallback } from 'react';
import { onboardingApi } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import { Modal, Avatar } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import JourneyDetail from './JourneyDetail.jsx';

const STATUS_CHIP = {
  active: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  left: 'bg-slate-100 text-slate-400',
};
const STATUS_LABEL = { active: 'กำลังติดตาม', completed: 'ผ่านทดลองงาน', left: 'พ้นสภาพ' };

function AddHireModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: '', position: '', startDate: new Date().toISOString().slice(0, 10), email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.addJourney(form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="เพิ่มพนักงานใหม่"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'สร้างแผนติดตาม'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อ-นามสกุล *</label>
          <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className="field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ตำแหน่ง</label>
            <input value={form.position} onChange={(e) => set('position', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วันเริ่มงาน *</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="field" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">อีเมล</label>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">เบอร์โทร</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="field" />
          </div>
        </div>
        <p className="text-xs text-slate-400">แผนงาน 30-60-90 วันจะถูกสร้างจากเทมเพลตที่ใช้งานอยู่ให้อัตโนมัติ</p>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
      </form>
    </Modal>
  );
}

export default function NewHiresTab() {
  const [journeys, setJourneys] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    onboardingApi.journeys().then((r) => setJourneys(r.data)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (openId) {
    return <JourneyDetail journeyId={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มพนักงานใหม่</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {journeys.length === 0 ? (
        <div className="card text-center text-slate-400">ยังไม่มีพนักงานใหม่ในระบบติดตาม</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {journeys.map((j) => (
            <button key={j.id} onClick={() => setOpenId(j.id)} className="card text-left transition hover:border-brand/40 hover:shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar icon="user" color="bg-brand/10 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-800">{j.full_name}</div>
                  <div className="truncate text-xs text-slate-500">{j.position || 'พนักงานใหม่'}</div>
                </div>
                <span className={`chip ${STATUS_CHIP[j.status]}`}>{STATUS_LABEL[j.status]}</span>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>ความคืบหน้า {j.tasks_done}/{j.tasks_total}</span>
                  <span>{j.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${j.progress}%` }} />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">เริ่มงาน {formatThaiDate(j.start_date)}</div>
            </button>
          ))}
        </div>
      )}

      {adding && <AddHireModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}
