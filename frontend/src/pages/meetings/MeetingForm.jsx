import { useEffect, useRef, useState } from 'react';
import { meetingsApi, dateFieldValue } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import Editor from './Editor.jsx';
import { useT } from '../../lib/i18n.jsx';

const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * ปฏิทินเล็กที่นับปีเป็นพุทธศักราช
 *
 * ช่อง <input type="date"> ของเบราว์เซอร์นับปีเป็นคริสต์ศักราชเสมอ แก้ไม่ได้ —
 * คนกรอกที่คิดเป็น 2569 ต้องบวกลบเองทุกครั้ง และเป็นที่มาของวันที่ผิดปีอยู่เรื่อย
 * เลือกแล้วเขียนกลับเป็น "21/05/2569" ซึ่งเป็นรูปแบบที่เซิร์ฟเวอร์อ่านออก
 * (parseDateLabel) และเป็นรูปแบบที่คนที่นี่เขียนกันอยู่แล้ว
 */
function ThaiCalendar({ value, onPick, onClose }) {
  const t = useT();
  const ref = useRef(null);
  const seed = (() => {
    const m = String(value || '').match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2500;
      if (y > 2400) y -= 543;
      return new Date(y, Number(m[2]) - 1, 1);
    }
    const iso = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, 1);
    return new Date();
  })();
  const [cursor, setCursor] = useState(seed);

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) => today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;

  return (
    <div ref={ref} className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label={t('เดือนก่อน')} onClick={() => setCursor(new Date(y, mo - 1, 1))}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <Icon name="arrowLeft" className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700">{TH_MONTHS_FULL[mo]} {y + 543}</span>
        <button type="button" aria-label={t('เดือนถัดไป')} onClick={() => setCursor(new Date(y, mo + 1, 1))}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400">
        {TH_DOW.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <button key={d} type="button"
            onClick={() => { onPick(`${d}/${String(mo + 1).padStart(2, '0')}/${y + 543}`); onClose(); }}
            className={`rounded-md py-1 text-xs transition ${
              isToday(d) ? 'bg-brand-tint font-bold text-brand' : 'text-slate-700 hover:bg-slate-100'}`}>
            {d}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => { onPick(''); onClose(); }}
        className="mt-1 w-full rounded-md py-1 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600">
        {t('ล้างวันที่')}
      </button>
    </div>
  );
}

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
    // ข้อความอิสระ ไม่ใช่ yyyy-mm-dd — เซิร์ฟเวอร์แปลงให้ และสิ่งที่พิมพ์ไว้
    // ถูกเก็บไว้ตามที่พิมพ์ (date_label) จึงเปิดกลับมาเจอของเดิม
    meetingDate: dateFieldValue(row),
    timeLabel: row?.time_label || '',
    attendees: (row?.attendees || []).join(', '),
    visible: row?.visible ?? true,
    recordingUrl: row?.recording_url || '',
    kind: row?.kind || 'meeting',
  });
  const [content, setContent] = useState(row?.content || '');
  const [cal, setCal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.groupId) { setError(t('กรุณาเลือกโครงการ')); return; }
    if (!form.title.trim()) { setError(t('กรุณากรอกชื่อเรื่อง')); return; }
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        meetingDate: form.meetingDate.trim(),
        timeLabel: form.timeLabel.trim(),
        attendees: form.attendees.split(',').map((s) => s.trim()).filter(Boolean),
        visible: form.visible,
        recordingUrl: form.recordingUrl.trim(),
        kind: form.kind,
        content,
      };
      if (editing) {
        // ย้ายโครงการได้ตอนแก้ไข — ของเขาย้ายได้ และกรอกผิดโครงการเป็นเรื่องปกติ
        await meetingsApi.update(row.id, { ...body, groupId: form.groupId });
        toast.success(t('บันทึกแล้ว'));
        onSaved(row.id);
      } else {
        const r = await meetingsApi.create({ ...body, groupId: form.groupId });
        toast.success(t('เพิ่มการประชุมแล้ว'));
        onSaved(r.data.id);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={editing ? t('แก้ไขรายงานการประชุม') : t('เพิ่มการประชุม')}
      onClose={busy ? undefined : onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button type="submit" form="mtg-form" disabled={busy} className="btn-primary">
            {busy ? t('กำลังบันทึก…') : t('บันทึก')}
          </button>
        </>
      }
    >
      <form id="mtg-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('โครงการ')} <span className="text-red-500">*</span></label>
            <select value={form.groupId} onChange={(e) => set('groupId', e.target.value)} className="field">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {editing && <p className="mt-1 text-xs text-slate-400">{t('เปลี่ยนโครงการที่นี่ได้ ถ้าบันทึกไว้ผิดที่')}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่อเรื่อง')} <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder={t('เช่น ประชุมความก้าวหน้าโครงการ ครั้งที่ 12')} className="field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              {t('วันที่ประชุม')} <span className="font-normal text-slate-400">{t('(เช่น 21/05/2569 หรือ 21 พ.ค. 2569)')}</span>
            </label>
            <div className="relative flex gap-1">
              <input value={form.meetingDate} onChange={(e) => set('meetingDate', e.target.value)}
                placeholder="21/05/2569" className="field" />
              <button type="button" onClick={() => setCal((v) => !v)} title={t('เลือกจากปฏิทิน')}
                aria-label={t('เลือกจากปฏิทิน')}
                className="shrink-0 rounded-xl border border-slate-200 px-2.5 text-slate-500 transition hover:bg-slate-50">
                <Icon name="calendar" className="h-4 w-4" />
              </button>
              {cal && (
                <ThaiCalendar value={form.meetingDate}
                  onPick={(v) => set('meetingDate', v)} onClose={() => setCal(false)} />
              )}
            </div>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ประเภท')}</label>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className="field">
              <option value="meeting">{t('การประชุมหนึ่งครั้ง')}</option>
              <option value="overview">{t('ภาพรวมโครงการ')}</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {t('ภาพรวมโครงการไม่ผูกกับวันประชุมวันใด จึงอยู่ท้ายรายการเสมอ')}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">{t('ลิงก์ไฟล์บันทึกเสียง (ถ้ามี)')}</label>
            <input value={form.recordingUrl} onChange={(e) => set('recordingUrl', e.target.value)}
              placeholder="https://…" className="field" />
            <p className="mt-1 text-xs text-slate-400">
              {t('ใส่ลิงก์บันทึกจาก Fathom หรือ Transkriptor ได้ · รับเฉพาะลิงก์ที่ขึ้นต้นด้วย https://')}
            </p>
          </div>
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
