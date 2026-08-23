import { useCallback, useEffect, useState } from 'react';
import { meetingsApi, thaiDate } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/** One meeting: the body, what was attached, what the team said, and what it
 *  used to say before somebody changed it. */
export default function MeetingDetail({ id, canEdit, groups = [], onClose, onEdit, onDelete, onChanged }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState(null); // an older version being read
  const [filing, setFiling] = useState(false);

  const load = useCallback(() => { setM(null); setError(null);
    return meetingsApi.get(id).then((r) => setM(r.data)).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!m) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); onChanged?.(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const openFile = async (a) => {
    try {
      const url = await meetingsApi.fileUrl(m.id, a.id);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await meetingsApi.comment(m.id, text.trim()); setText(''); await load(); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const dropComment = async (c) => {
    const ok = await confirm({ title: t('ลบความเห็น'), message: t('ลบความเห็นนี้?'), confirmLabel: t('ลบ'), danger: true });
    if (ok) act(() => meetingsApi.removeComment(m.id, c.id), 'ลบแล้ว');
  };

  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip" style={{ backgroundColor: `${m.group_color}1a`, color: m.group_color }}>{m.group_name}</span>
            {m.pinned && <span className="chip bg-amber-50 text-amber-700">{t('ปักหมุด')}</span>}
            {!m.visible && <span className="chip bg-slate-100 text-slate-500">{t('ยังไม่เผยแพร่')}</span>}
          </div>
          <h2 className="mt-2 text-lg font-bold text-slate-800">{m.title}</h2>
          <p className="text-sm text-slate-500">
            {thaiDate(m.meeting_date)}{m.time_label ? ` · ${m.time_label}` : ''}
            {m.created_by_name ? ` · บันทึกโดย ${m.created_by_name}` : ''}
          </p>
          {(m.attendees || []).length > 0 && (
            <p className="mt-1 text-xs text-slate-500">ผู้เข้าประชุม: {(m.attendees || []).join(' · ')}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {m.versions?.length > 0 && (
            <button onClick={() => setHistory(true)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Icon name="clock" className="inline h-4 w-4" /> {t('ประวัติ')} {m.versions.length}
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => act(() => meetingsApi.togglePin(m.id), m.pinned ? 'เอาหมุดออกแล้ว' : 'ปักหมุดแล้ว')}
                disabled={busy} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {m.pinned ? 'เอาหมุดออก' : 'ปักหมุด'}
              </button>
              <button onClick={() => onEdit(m)} className="text-sm font-medium text-brand hover:underline">{t('แก้ไข')}</button>
              <button onClick={() => onDelete(m)} className="ml-1 text-sm text-rose-500 hover:underline">{t('ลบ')}</button>
            </>
          )}
          <button onClick={onClose} title={t('ปิด')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      </header>

      {m.recording_url && (
        <a href={m.recording_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-brand hover:bg-slate-50">
          <Icon name="link" className="h-4 w-4" /> {t('เปิดไฟล์บันทึกเสียง')}
        </a>
      )}

      {/* Where this recording has been filed. It stays in its inbox either way —
          filing adds a place to find it, it does not move it out of the archive. */}
      {(m.is_inbox || (m.tags || []).length > 0) && (
        <section className="rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">{t('จัดเก็บเข้ากลุ่ม:')}</span>
            {(m.tags || []).length === 0 && <span className="text-xs text-slate-400">{t('ยังไม่ได้จัดเก็บ')}</span>}
            {(m.tags || []).map((tag) => (
              <span key={tag.id} className="chip inline-flex items-center gap-1"
                style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}>
                {tag.name}
                {canEdit && (
                  <button onClick={() => act(() => meetingsApi.untag(m.id, tag.id), 'เอาออกจากกลุ่มแล้ว')}
                    title={t('เอาออกจากกลุ่มนี้')} className="opacity-60 hover:opacity-100">
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {canEdit && (
              filing ? (
                <select autoFocus defaultValue="" disabled={busy}
                  onChange={(e) => { const v = e.target.value; setFiling(false);
                    if (v) act(() => meetingsApi.tag(m.id, v), 'จัดเก็บเข้ากลุ่มแล้ว'); }}
                  onBlur={() => setFiling(false)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
                  <option value="">{t('— เลือกกลุ่มปลายทาง —')}</option>
                  {groups.filter((g) => !g.is_inbox && g.id !== m.group_id
                    && !(m.tags || []).some((tag) => tag.id === g.id))
                    .map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              ) : (
                <button onClick={() => setFiling(true)} className="text-xs font-medium text-brand hover:underline">
                  {t('+ จัดเก็บเข้ากลุ่ม')}
                </button>
              )
            )}
          </div>
          {m.is_inbox && (
            <p className="mt-1 text-[11px] text-slate-400">
              {t('บันทึกนี้อยู่ในกล่องรอจัดเก็บถาวร การจัดเก็บเป็นการเพิ่มที่ให้หาเจอ ไม่ได้ย้ายออกจากกล่อง')}
            </p>
          )}
        </section>
      )}

      {m.content
        ? <div className="mtg-body border-t border-slate-100 pt-4 text-[15px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: m.content }} />
        : <p className="border-t border-slate-100 pt-4 text-sm text-slate-400">{t('ยังไม่มีเนื้อหา')}</p>}

      {m.attachments?.length > 0 && (
        <section className="border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ไฟล์แนบ')}</h3>
          <div className="flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <button key={a.id} onClick={() => openFile(a)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <Icon name="paperclip" className="h-4 w-4 text-slate-400" /> {a.file_name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-slate-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          ความเห็น {m.comments?.length ? `(${m.comments.length})` : ''}
        </h3>
        <div className="space-y-2">
          {(m.comments || []).length === 0 && <p className="text-sm text-slate-400">{t('ยังไม่มีความเห็น')}</p>}
          {(m.comments || []).map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">{c.author_name || 'ไม่ระบุ'}</span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {thaiDate(c.created_at)}
                  {(c.author_id === profile?.id || profile?.role === 'admin') && (
                    <button onClick={() => dropComment(c)} className="text-rose-400 hover:text-rose-600">{t('ลบ')}</button>
                  )}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-slate-700">{c.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label={t('เขียนความเห็น')}
            placeholder={t('เขียนความเห็น…')} className="field flex-1" />
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary disabled:opacity-50">{t('ส่ง')}</button>
        </form>
      </section>

      {history && (
        <Modal title={t('ประวัติการแก้ไข')} onClose={() => setHistory(false)} size="md"
          footer={<button onClick={() => setHistory(false)} className="btn-outline">{t('ปิด')}</button>}>
          <p className="mb-3 text-xs text-slate-500">
            {t('ทุกครั้งที่แก้ ระบบเก็บของเดิมไว้พร้อมชื่อเรื่องและวันที่ ณ ขณะนั้น กดดูได้ว่าตอนนั้นเขียนไว้ว่าอย่างไร')}
          </p>
          <div className="space-y-2">
            {m.versions.map((v) => (
              <button key={v.seq} onClick={async () => {
                try { const r = await meetingsApi.version(m.id, v.seq); setPreview(r.data); setHistory(false); }
                catch (e) { toast.error(e.message); }
              }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-slate-400">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{v.title || m.title}</span>
                  <span className="block text-xs text-slate-500">
                    ก่อนแก้ครั้งที่ {v.seq} · {thaiDate(v.saved_at)}{v.saved_by_name ? ` · ${v.saved_by_name}` : ''}
                  </span>
                </span>
                <Icon name="eye" className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title={`ฉบับก่อนแก้ครั้งที่ ${preview.seq}`} onClose={() => setPreview(null)} size="lg"
          footer={<button onClick={() => setPreview(null)} className="btn-outline">{t('ปิด')}</button>}>
          <p className="mb-3 text-sm text-slate-600">
            <b className="text-slate-800">{preview.title}</b>
            <span className="text-slate-500"> · {thaiDate(preview.meeting_date)}{preview.time_label ? ` · ${preview.time_label}` : ''}</span>
          </p>
          <div className="mtg-body rounded-xl border border-slate-200 p-4 text-[15px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: preview.content }} />
        </Modal>
      )}
    </article>
  );
}
