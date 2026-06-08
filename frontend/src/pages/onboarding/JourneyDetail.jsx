import { useEffect, useState } from 'react';
import { onboardingApi } from '../../lib/modules.js';
import { formatThaiDate } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const PHASES = [30, 60, 90];
const RESULT_LABEL = { pass: 'ผ่านทดลองงาน', extend: 'ขยายเวลา', fail: 'ไม่ผ่าน' };
const CRITERIA = ['คุณภาพงาน', 'ความรับผิดชอบ', 'การทำงานเป็นทีม', 'การปรับตัว', 'ทัศนคติ'];

export default function JourneyDetail({ journeyId, onBack }) {
  const [j, setJ] = useState(null);
  const [error, setError] = useState(null);
  const [review, setReview] = useState({ reviewer: '', scores: {}, strengths: '', improvements: '', result: '', note: '' });
  const [savingReview, setSavingReview] = useState(false);

  const load = () => onboardingApi.journey(journeyId).then((r) => {
    setJ(r.data);
    if (r.data.review) {
      setReview({
        reviewer: r.data.review.reviewer || '',
        scores: r.data.review.scores || {},
        strengths: r.data.review.strengths || '',
        improvements: r.data.review.improvements || '',
        result: r.data.review.result || '',
        note: r.data.review.note || '',
      });
    }
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [journeyId]);

  const toggleTask = async (taskId, done) => {
    try { const r = await onboardingApi.toggleTask(journeyId, taskId, done); setJ(r.data); }
    catch (e) { setError(e.message); }
  };

  const saveReview = async () => {
    setSavingReview(true);
    try {
      const body = { ...review, result: review.result || null };
      const r = await onboardingApi.saveReview(journeyId, body);
      setJ(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingReview(false);
    }
  };

  if (error) return <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>;
  if (!j) return <div className="text-slate-400">กำลังโหลด…</div>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="arrowLeft" className="h-4 w-4" /> กลับรายชื่อพนักงานใหม่
      </button>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{j.full_name}</h2>
          <p className="text-sm text-slate-500">{j.position || 'พนักงานใหม่'} · เริ่มงาน {formatThaiDate(j.start_date)}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-brand">{j.progress}%</div>
          <div className="text-xs text-slate-400">{j.tasks_done}/{j.tasks_total} งาน</div>
        </div>
      </div>

      {/* 30-60-90 task checklist */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PHASES.map((phase) => {
          const tasks = j.tasks.filter((t) => t.phase === phase);
          const done = tasks.filter((t) => t.done).length;
          return (
            <div key={phase} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{phase} วัน</h3>
                <span className="text-xs text-slate-400">{done}/{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400">ไม่มีรายการ</p>
                ) : tasks.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" checked={t.done} onChange={(e) => toggleTask(t.id, e.target.checked)} className="mt-0.5" />
                    <span className={t.done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      {t.title}
                      {t.owner && <span className="ml-1 text-[11px] text-slate-400">({t.owner})</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* probation review */}
      <div className="card space-y-4">
        <h3 className="font-bold text-slate-800">แบบประเมินทดลองงาน</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ผู้ประเมิน</label>
            <input value={review.reviewer} onChange={(e) => setReview({ ...review, reviewer: e.target.value })} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ผลการประเมิน</label>
            <select value={review.result} onChange={(e) => setReview({ ...review, result: e.target.value })} className="field">
              <option value="">— ยังไม่สรุป —</option>
              <option value="pass">ผ่านทดลองงาน</option>
              <option value="extend">ขยายเวลาทดลองงาน</option>
              <option value="fail">ไม่ผ่าน</option>
            </select>
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-600">คะแนนรายด้าน (1–5)</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <div key={c} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-600">{c}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReview({ ...review, scores: { ...review.scores, [c]: n } })}
                      className={`h-6 w-6 rounded text-xs font-semibold ${
                        (review.scores[c] || 0) >= n ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">จุดเด่น</label>
            <textarea rows={2} value={review.strengths} onChange={(e) => setReview({ ...review, strengths: e.target.value })} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">สิ่งที่ควรพัฒนา</label>
            <textarea rows={2} value={review.improvements} onChange={(e) => setReview({ ...review, improvements: e.target.value })} className="field" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          {j.review?.result && (
            <span className="text-sm text-slate-500">ผลล่าสุด: <b>{RESULT_LABEL[j.review.result]}</b></span>
          )}
          <button onClick={saveReview} disabled={savingReview} className="btn-primary ml-auto">
            {savingReview ? 'กำลังบันทึก…' : 'บันทึกผลประเมิน'}
          </button>
        </div>
      </div>
    </div>
  );
}
