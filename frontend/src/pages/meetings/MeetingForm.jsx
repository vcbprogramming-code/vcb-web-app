import { useState } from 'react';
import { meetingsApi } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Editor from './Editor.jsx';

/** Create or edit one meeting. The body editor only appears once the meeting
 *  exists, because a picture has to hang off something before it can be
 *  uploaded — so a new meeting is saved first, then written into. */
export default function MeetingForm({ row, groups, defaultGroupId, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(row);
  const [form, setForm] = useState({
    groupId: row?.group_id || defaultGroupId || groups[0]?.id || '',
    title: row?.title || '',
    meetingDate: row?.meeting_date ? String(row.meeting_date).slice(0, 10) : '',
    timeLabel: row?.time_label || '',
    attendees: (row?.attendees || []).join(', '),
    visible: row?.visible ?? true,
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
        content,
      };
      if (editing) {
        await meetingsApi.update(row.id, body);
        toast.success('บันทึกแล้ว');
        onSaved(row.id);
      } else {
        const r = await meetingsApi.create({ ...body, groupId: form.groupId });
        toast.success('เพิ่มรายงานแล้ว');
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
          <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button type="submit" form="mtg-form" disabled={busy} className="btn-primary">
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="mtg-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">กลุ่ม <span className="text-red-500">*</span></label>
            <select value={form.groupId} onChange={(e) => set('groupId', e.target.value)} disabled={editing} className="field disabled:opacity-60">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {editing && <p className="mt-1 text-xs text-slate-400">ย้ายกลุ่มไม่ได้หลังสร้างแล้ว</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อเรื่อง <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="เช่น ประชุมความก้าวหน้าโครงการ ครั้งที่ 12" className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">วันที่ประชุม</label>
            <input type="date" value={form.meetingDate} onChange={(e) => set('meetingDate', e.target.value)} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">เวลา</label>
            <input value={form.timeLabel} onChange={(e) => set('timeLabel', e.target.value)}
              placeholder="เช่น 09:00 – 11:00" className="field" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ผู้เข้าประชุม</label>
          <input value={form.attendees} onChange={(e) => set('attendees', e.target.value)}
            placeholder="คั่นชื่อด้วยเครื่องหมายจุลภาค เช่น ทนงศักดิ์, ชวิน, สุรวัจน์" className="field" />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={form.visible} onChange={(e) => set('visible', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300" />
          <span className="text-sm text-slate-700">เผยแพร่ให้ผู้อื่นเห็น</span>
          <span className="text-xs text-slate-400">— เอาติ๊กออกเพื่อเก็บเป็นฉบับร่างที่มีแต่ท่านเห็น</span>
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">เนื้อหา</label>
          {editing ? (
            <Editor meetingId={row.id} value={content} onChange={setContent} />
          ) : (
            <>
              <Editor meetingId={null} value={content} onChange={setContent} />
              <p className="mt-1 text-xs text-slate-400">
                พิมพ์เนื้อหาได้เลย · การแทรกรูปทำได้หลังบันทึกครั้งแรก เพราะรูปต้องผูกกับรายงานที่มีอยู่จริง
              </p>
            </>
          )}
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  );
}
