import { useState } from 'react';
import { meetingsApi } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Editor from './Editor.jsx';
import { useT } from '../../lib/i18n.jsx';

/** Create or edit one meeting. The body editor only appears once the meeting
 *  exists, because a picture has to hang off something before it can be
 *  uploaded — so a new meeting is saved first, then written into. */
export default function MeetingForm({ row, groups, defaultGroupId, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const editing = Boolean(row);
  const [form, setForm] = useState({
    groupId: row?.group_id || defaultGroupId || groups[0]?.id || '',
    title: row?.title || '',
    meetingDate: row?.meeting_date ? String(row.meeting_date).slice(0, 10) : '',
    timeLabel: row?.time_label || '',
    attendees: (row?.attendees || []).join(', '),
    visible: row?.visible ?? true,
    recordingUrl: row?.recording_url || '',
  });
  const [content, setContent] = useState(row?.content || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.groupId) { setError('กรุณาเลือกกลุ่ม'); return; }
    if (!form.title.trim()) { setError('กรุณากรอกชื่อเรื่อง'); return; }
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        meetingDate: form.meetingDate || null,
        timeLabel: form.timeLabel.trim(),
        attendees: form.attendees.split(',').map((s) => s.trim()).filter(Boolean),
        visible: form.visible,
        recordingUrl: form.recordingUrl.trim(),
        content,
      };
      if (editing) {
        await meetingsApi.update(row.id, body);
        toast.success(t('บันทึกแล้ว'));
        onSaved(row.id);
      } else {
        const r = await meetingsApi.create({ ...body, groupId: form.groupId });
        toast.success(t('เพิ่มรายงานแล้ว'));
        onSaved(r.data.id);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={editing ? 'แก้ไขรายงานการประชุม' : 'เพิ่มรายงานการประชุม'}
      onClose={busy ? undefined : onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button type="submit" form="mtg-form" disabled={busy} className="btn-primary">
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="mtg-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('กลุ่ม')} <span className="text-red-500">*</span></label>
            <select value={form.groupId} onChange={(e) => set('groupId', e.target.value)} disabled={editing} className="field disabled:opacity-60">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {editing && <p className="mt-1 text-xs text-slate-400">{t('ย้ายกลุ่มไม่ได้หลังสร้างแล้ว')}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่อเรื่อง')} <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder={t('เช่น ประชุมความก้าวหน้าโครงการ ครั้งที่ 12')} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('วันที่ประชุม')}</label>
            <input type="date" value={form.meetingDate} onChange={(e) => set('meetingDate', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('เวลา')}</label>
            <input value={form.timeLabel} onChange={(e) => set('timeLabel', e.target.value)}
              placeholder={t('เช่น 09:00 – 11:00')} className="field" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ผู้เข้าประชุม')}</label>
          <input value={form.attendees} onChange={(e) => set('attendees', e.target.value)}
            placeholder={t('คั่นชื่อด้วยเครื่องหมายจุลภาค เช่น ทนงศักดิ์, ชวิน, สุรวัจน์')} className="field" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ลิงก์ไฟล์บันทึกเสียง (ถ้ามี)')}</label>
          <input value={form.recordingUrl} onChange={(e) => set('recordingUrl', e.target.value)}
            placeholder="https://…" className="field" />
          <p className="mt-1 text-xs text-slate-400">
            {t('ใส่ลิงก์บันทึกจาก Fathom หรือ Transkriptor ได้ · รับเฉพาะลิงก์ที่ขึ้นต้นด้วย https://')}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          <span className="text-sm text-slate-700">{t('เผยแพร่ให้ผู้อื่นเห็น')}</span>
          <span className="text-xs text-slate-400">{t('— เอาติ๊กออกเพื่อเก็บเป็นฉบับร่างที่มีแต่ท่านเห็น')}</span>
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('เนื้อหา')}</label>
          {editing ? (
            <Editor meetingId={row.id} value={content} onChange={setContent} />
          ) : (
            <>
              <Editor meetingId={null} value={content} onChange={setContent} />
              <p className="mt-1 text-xs text-slate-400">
                {t('พิมพ์เนื้อหาได้เลย · การแทรกรูปทำได้หลังบันทึกครั้งแรก เพราะรูปต้องผูกกับรายงานที่มีอยู่จริง')}
              </p>
            </>
          )}
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  );
}
