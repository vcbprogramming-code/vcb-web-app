import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  meetingsApi, thaiDate, thaiDateTime, meetingDateText, meetingTimeText,
  fileSize, isAiSourced, sourceLabel,
} from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import MeetingPaper from './MeetingPaper.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One meeting: the body, what was attached, what the team said, and what it
 *  used to say before somebody changed it. */
export default function MeetingDetail({
  id, canEdit, groups = [], readingSize = 'normal', refresh = 0,
  onClose, onEdit, onDelete, onChanged,
}) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [activity, setActivity] = useState(false);   // ลิ้นชักประวัติการทำงาน
  const [preview, setPreview] = useState(null);      // an older version being read
  const [filing, setFiling] = useState(false);
  const [note, setNote] = useState('');              // ความเห็นที่เขียนในลิ้นชัก
  const [paper, setPaper] = useState(false);         // ตัวอย่างหน้ากระดาษ A4 ก่อนพิมพ์

  // ลิ้นชักไม่ได้ใช้ Modal (มันเป็นแถบข้างขวา ไม่ใช่กล่องกลางจอ) จึงไม่ได้ปุ่ม
  // Escape มาฟรี ๆ — ต้องดักเอง ไม่อย่างนั้นเปิดแล้วปิดด้วยแป้นพิมพ์ไม่ได้เลย
  useEffect(() => {
    if (!activity) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setActivity(false); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [activity]);

  // refresh อยู่ในรายการพึ่งพาโดยเจตนา: หน้าแม่เพิ่มค่านี้หลังกล่องแก้ไขบันทึกสำเร็จ
  // ซึ่งเป็นกรณีเดียวที่เนื้อหาเปลี่ยนโดยที่ id ไม่เปลี่ยน — ถ้าไม่มี เอกสารบนจอจะ
  // ค้างอยู่ที่ข้อความก่อนแก้จนกว่าผู้ใช้จะปิดแล้วเปิดใหม่
  const load = useCallback(() => { setM(null); setError(null);
    return meetingsApi.get(id).then((r) => setM(r.data)).catch((e) => setError(e.message)); }, [id, refresh]);
  useEffect(() => { load(); }, [load]);

  /** สิ่งที่เกิดกับเอกสารโดยไม่ได้แก้เนื้อหา เล่าเป็นภาษาคน ไม่ใช่ชื่อ action ดิบ
   *  อยู่ในคอมโพเนนต์เพราะต้องแปลที่จุดที่เรนเดอร์ ไม่ใช่รับฟังก์ชันแปลเป็นอาร์กิวเมนต์ */
  const auditLabel = (a) => {
    const g = a.details?.group || a.details?.to || '';
    const f = a.details?.file || '';
    switch (a.action) {
      case 'pin': return t('ปักหมุด');
      case 'unpin': return t('เอาหมุดออก');
      case 'publish': return t('เผยแพร่');
      case 'unpublish': return t('เก็บเป็นฉบับร่าง');
      case 'tag': return `${t('จัดเก็บเข้าโครงการ')}${g ? ` · ${g}` : ''}`;
      case 'untag': return `${t('เอาออกจากโครงการ')}${g ? ` · ${g}` : ''}`;
      case 'attach': return `${t('แนบไฟล์')}${f ? ` · ${f}` : ''}`;
      case 'detach': return `${t('ลบไฟล์แนบ')}${f ? ` · ${f}` : ''}`;
      case 'move': return `${t('ย้ายโครงการ')}${g ? ` · ${g}` : ''}`;
      // การกู้คืนต้องบอกว่ากู้มาจากครั้งที่เท่าไร ไม่ใช่แค่ว่า "กู้คืน" — คนอ่าน
      // ประวัติกำลังตามว่าข้อความชุดไหนกลับมา
      case 'restore': return `${t('กู้คืนเนื้อหา')}${a.details?.seq ? ` · ${t('จากฉบับก่อนแก้ครั้งที่')} ${a.details.seq}` : ''}`;
      default: return a.action;
    }
  };

  /**
   * สายเวลาเดียว: การแก้เนื้อหา ความเห็น และสิ่งที่เกิดกับเอกสาร เรียงเก่า→ใหม่
   *
   * ทั้งสามมาจากสามตาราง (mtg_versions / mtg_comments / mtg_audit) ซึ่งเป็นเหตุ
   * ที่เคยแยกกันอยู่สามที่ — แต่สิ่งที่ทำให้มันมีความหมายคือลำดับเวลา อ่านว่า
   * "แก้แล้วมีคนค้าน" ต่างจาก "มีคนค้านแล้วจึงแก้" คนละเรื่องกันเลย
   */
  const stream = useMemo(() => {
    if (!m) return [];
    const out = [
      ...(m.versions || []).map((v) => ({
        kind: 'edit', when: v.saved_at, who: v.saved_by_name, seq: v.seq,
        label: t('แก้ไขเนื้อหา'),
      })),
      ...(m.comments || []).map((c) => ({
        kind: 'comment', when: c.created_at, who: c.author_name, id: c.id,
        label: t('ความเห็น'), body: c.body, authorId: c.author_id,
      })),
      ...(m.audit || []).map((a) => ({
        kind: 'act', when: a.created_at, who: a.actor_name, label: auditLabel(a),
      })),
    ];
    return out.sort((a, b) => new Date(a.when) - new Date(b.when));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, t]);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!m) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); onChanged?.(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const openFile = async (a) => {
    // ไฟล์แนบที่นำเข้ามาจากระบบเดิมอยู่บน Google Drive ไม่ใช่ในที่เก็บของเรา —
    // เปิดลิงก์ตรง ๆ การดึงเป็น blob ผ่าน API จะตายที่ CORS ของ Drive
    if (a.external_url) { window.open(a.external_url, '_blank', 'noopener'); return; }
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
    try { await meetingsApi.comment(m.id, text.trim()); setText(''); await load(); onChanged?.(); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const dropComment = async (c) => {
    const ok = await confirm({ title: t('ลบความเห็น'), message: t('ลบความเห็นนี้?'), confirmLabel: t('ลบ'), danger: true });
    if (ok) act(() => meetingsApi.removeComment(m.id, c.id), 'ลบแล้ว');
  };

  /** ลิงก์ของเอกสารฉบับนี้ — ?meeting=<id> ชี้ฉบับเดียวตายตัว */
  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?meeting=${encodeURIComponent(m.id)}`;
    try { await navigator.clipboard.writeText(link); toast.success(t('คัดลอกลิงก์แล้ว')); }
    catch { toast.error(link); }
  };

  /**
   * เผยแพร่ / เก็บเป็นฉบับร่าง
   *
   * ของเขามีคำสั่งนี้แยกเป็นของตัวเอง (setVisibility) ส่วนของเราเคยมีแค่ช่องติ๊ก
   * ในกล่องแก้ไข ซึ่งบังคับให้คนที่อยากเผยแพร่อย่างเดียวต้องเปิดฟอร์มแก้ไขทั้งฉบับ
   * แล้วกดบันทึก — และการกดบันทึกฟอร์มแก้ไขเป็นเส้นทางที่เก็บเวอร์ชันได้ด้วย
   * การเผยแพร่จึงไปปนกับประวัติการแก้เนื้อหาโดยไม่มีใครตั้งใจ
   */
  const togglePublish = () => act(
    () => meetingsApi.update(m.id, { visible: !m.visible }),
    m.visible ? 'เก็บเป็นฉบับร่างแล้ว' : 'เผยแพร่แล้ว'
  );

  /** กู้คืนเนื้อหาจากเวอร์ชันเก่า — ถามก่อน เพราะมันเขียนทับสิ่งที่อยู่บนจอ
   *  (แต่เขียนทับแบบที่กู้กลับได้ เนื้อหาปัจจุบันถูกเก็บเป็นเวอร์ชันก่อนเสมอ) */
  const restoreVersion = async (seq) => {
    const ok = await confirm({
      title: t('กู้คืนเนื้อหา'),
      message: `${t('นำเนื้อหาของฉบับก่อนแก้ครั้งที่')} ${seq} ${t('กลับมาเป็นเนื้อหาปัจจุบัน?')}\n${t('เนื้อหาปัจจุบันจะถูกเก็บเป็นเวอร์ชันไว้ก่อน จึงกู้คืนกลับได้อีก · ชื่อเรื่องและวันที่ไม่ถูกเปลี่ยน')}`,
      confirmLabel: t('กู้คืน'),
    });
    if (!ok) return;
    setPreview(null);
    await act(() => meetingsApi.restore(m.id, seq), 'กู้คืนเนื้อหาแล้ว');
  };

  const attach = async (file) => {
    if (!file) return;
    setBusy(true);
    try { await meetingsApi.attach(m.id, file, 'file'); toast.success(t('แนบไฟล์แล้ว')); await load(); onChanged?.(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const dropFile = async (a) => {
    const ok = await confirm({ title: t('ลบไฟล์แนบ'), message: `${t('ลบไฟล์')} "${a.file_name}"?`, confirmLabel: t('ลบ'), danger: true });
    if (ok) act(() => meetingsApi.removeFile(m.id, a.id), 'ลบแล้ว');
  };

  const tool = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50';
  const toolPrimary = 'inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-2.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50';
  const src = sourceLabel(m);
  const canFile = canEdit && (m.is_inbox || isAiSourced(m));
  const attendees = (m.attendees || []).filter(Boolean);
  const atts = m.attachments || [];

  return (
    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip" style={{ backgroundColor: `${m.group_color}1a`, color: m.group_color }}>{m.group_name}</span>
          {m.pinned && <span className="chip bg-amber-50 text-amber-700">{t('ปักหมุด')}</span>}
          {!m.visible && <span className="chip bg-slate-100 text-slate-500">{t('ยังไม่เผยแพร่')}</span>}
          {m.kind === 'overview' && <span className="chip bg-indigo-50 text-indigo-600">{t('ภาพรวม')}</span>}
          {src && <span className="chip bg-slate-100 text-slate-600">{src}</span>}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800">{m.title}</h2>
            <p className="text-sm text-slate-500">
              {meetingDateText(m, lang, t('ภาพรวม'))}{meetingTimeText(m) ? ` · ${meetingTimeText(m)}` : ''}
              {m.created_by_name ? ` · บันทึกโดย ${m.created_by_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} title={t('ปิด')} aria-label={t('ปิดเอกสาร')}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* แถบเครื่องมือครบชุดตามของเขา: ทุกอย่างที่ทำกับเอกสารได้อยู่ในแถวเดียว
            ไม่ใช่ปุ่มเปลือยกระจายอยู่ตามหน้า */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          {canEdit && (
            <button onClick={() => act(() => meetingsApi.togglePin(m.id), m.pinned ? 'เอาหมุดออกแล้ว' : 'ปักหมุดแล้ว')}
              disabled={busy} className={tool}>
              <Icon name="pin" className={`h-4 w-4 ${m.pinned ? 'text-amber-500' : ''}`} />
              {m.pinned ? t('เอาหมุดออก') : t('ปักหมุด')}
            </button>
          )}
          {canFile && (
            <button onClick={() => setFiling(true)} disabled={busy} className={toolPrimary}>
              <Icon name="layers" className="h-4 w-4" /> {t('จัดเก็บเข้าโครงการ…')}
            </button>
          )}
          {m.recording_url && (
            <a href={m.recording_url} target="_blank" rel="noopener noreferrer" className={tool}>
              <Icon name="arrowUpRight" className="h-4 w-4" /> {t('เปิดไฟล์บันทึกเสียง')}
            </a>
          )}
          {/* ฉบับที่นำเข้ามาจากระบบเดิมมีต้นฉบับอยู่ใน Google Docs ของโครงการ และ
              ต้นฉบับนั้นยังถูกแก้ต่อที่นั่น ทางกลับไปหามันจึงต้องมี */}
          {m.source_url && (
            <a href={m.source_url} target="_blank" rel="noopener noreferrer" className={tool}>
              <Icon name="document" className="h-4 w-4" /> {t('เปิดเอกสารต้นฉบับ')}
            </a>
          )}
          {canEdit && (
            <button onClick={() => onEdit(m)} className={tool}>
              <Icon name="edit" className="h-4 w-4" /> {t('แก้ไข')}
            </button>
          )}
          <button onClick={() => setActivity(true)} className={tool} title={t('การแก้ไข ความเห็น และสิ่งที่เกิดกับเอกสาร เรียงตามเวลา')}>
            <Icon name="clock" className="h-4 w-4" /> {t('ประวัติการทำงาน')}
            {stream.length > 0 && <span className="text-xs text-slate-400">{stream.length}</span>}
          </button>
          <button onClick={copyLink} className={tool}>
            <Icon name="link" className="h-4 w-4" /> {t('คัดลอกลิงก์')}
          </button>
          {/* เปิดตัวอย่างหน้ากระดาษ A4 จริงก่อน ไม่ยิงกล่องพิมพ์ของระบบทันที: เอกสาร
              ที่ออกจากที่นี่ไปถึงคนนอกองค์กร คนกดควรเห็นว่าหน้าตกที่ไหน หัวจดหมาย
              และ QR อยู่ตรงไหน ก่อนจะเสียกระดาษหรือส่งไฟล์ออกไป */}
          <button onClick={() => setPaper(true)} className={tool}>
            <Icon name="document" className="h-4 w-4" /> {t('พิมพ์ / PDF')}
          </button>
          {canEdit && (
            <button onClick={togglePublish} disabled={busy} className={tool}
              title={m.visible ? t('ซ่อนจากผู้อื่น เก็บไว้เป็นฉบับร่าง') : t('เผยแพร่ให้ผู้ที่เข้าถึงโครงการนี้อ่านได้')}>
              <Icon name="eye" className="h-4 w-4" /> {m.visible ? t('เก็บเป็นฉบับร่าง') : t('เผยแพร่')}
            </button>
          )}
          {canEdit && (
            <button onClick={() => onDelete(m)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-rose-500 transition hover:bg-rose-50">
              <Icon name="trash" className="h-4 w-4" /> {t('ลบ')}
            </button>
          )}
        </div>
      </header>

      {/* Where this recording has been filed. It stays in its inbox either way —
          filing adds a place to find it, it does not move it out of the archive.
          แสดงกับทุกฉบับที่ผู้ใช้แก้ไขได้ ไม่ใช่เฉพาะที่มาจากกล่องรอจัดเก็บ: เซิร์ฟเวอร์
          ของเรารับการจัดเก็บฉบับใดก็ได้อยู่แล้ว แต่หน้าจอเคยซ่อนทางเข้าไว้ ฉบับที่
          คนพิมพ์เองในโครงการหนึ่งจึงไม่มีวิธีจัดเก็บเข้าโครงการที่สองเลย ทั้งที่การ
          ประชุมที่เกี่ยวกับสองโครงการเป็นเรื่องปกติ (ของเขาจำกัดไว้เพราะการจัดเก็บ
          คือขั้นตอน "เผยแพร่" ออกจากกล่องส่วนตัว ซึ่งไม่ใช่กรณีของฉบับที่อยู่ใน
          โครงการอยู่แล้ว) */}
      {(canEdit || m.is_inbox || (m.tags || []).length > 0) && (
        <section className="rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">{t('จัดเก็บเข้าโครงการ:')}</span>
            {(m.tags || []).length === 0 && <span className="text-xs text-slate-400">{t('ยังไม่ได้จัดเก็บ')}</span>}
            {(m.tags || []).map((tag) => (
              <span key={tag.id} className="chip inline-flex items-center gap-1"
                style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}>
                {tag.name}
                {canEdit && (
                  <button onClick={() => act(() => meetingsApi.untag(m.id, tag.id), 'เอาออกจากโครงการแล้ว')}
                    title={t('เอาออกจากโครงการนี้')} className="opacity-60 hover:opacity-100">
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {canEdit && !filing && (
              <button onClick={() => setFiling(true)} className="text-xs font-medium text-brand hover:underline">
                {t('+ จัดเก็บเข้าโครงการ')}
              </button>
            )}
            {filing && (
              <select autoFocus defaultValue="" disabled={busy}
                onChange={(e) => { const v = e.target.value; setFiling(false);
                  if (v) act(() => meetingsApi.tag(m.id, v), 'จัดเก็บเข้าโครงการแล้ว'); }}
                onBlur={() => setFiling(false)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
                <option value="">{t('— เลือกโครงการปลายทาง —')}</option>
                {groups.filter((g) => !g.is_inbox && g.id !== m.group_id
                  && !(m.tags || []).some((tag) => tag.id === g.id))
                  .map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          {m.is_inbox && (
            <p className="mt-1 text-[11px] text-slate-400">
              {t('บันทึกนี้อยู่ในกล่องรอจัดเก็บถาวร การจัดเก็บเป็นการเพิ่มที่ให้หาเจอ ไม่ได้ย้ายออกจากกล่อง')}
            </p>
          )}
        </section>
      )}

      {/* ปุ่มจัดเก็บเป็นปุ่มหลักในแถบเครื่องมือ แต่ถ้ายังไม่มีกล่องด้านบนให้เลือก
          ก็ต้องมี select ให้กดตรงนี้ ไม่ใช่กดปุ่มแล้วไม่เกิดอะไรขึ้น */}
      {filing && !(canEdit || m.is_inbox || (m.tags || []).length > 0) && (
        <select autoFocus defaultValue="" disabled={busy}
          onChange={(e) => { const v = e.target.value; setFiling(false);
            if (v) act(() => meetingsApi.tag(m.id, v), 'จัดเก็บเข้าโครงการแล้ว'); }}
          onBlur={() => setFiling(false)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
          <option value="">{t('— เลือกโครงการปลายทาง —')}</option>
          {groups.filter((g) => !g.is_inbox && g.id !== m.group_id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}

      {attendees.length > 0 && (
        <section className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('ผู้เข้าประชุม')} · {attendees.length}
          </span>
          {attendees.map((a) => {
            const isMail = EMAIL.test(a);
            const shown = isMail ? a.split('@')[0].replace(/[._]/g, ' ') : a;
            const chip = (
              <>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold uppercase text-slate-600">
                  {String(a).charAt(0)}
                </span>
                <span className="truncate">{shown}</span>
              </>
            );
            return isMail ? (
              <a key={a} href={`mailto:${a}`} title={a}
                className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-slate-200 py-0.5 pl-0.5 pr-2.5 text-xs text-slate-700 transition hover:border-brand hover:text-brand">
                {chip}
              </a>
            ) : (
              <span key={a} className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-slate-200 py-0.5 pl-0.5 pr-2.5 text-xs text-slate-700">
                {chip}
              </span>
            );
          })}
        </section>
      )}

      {/* คำเตือนสรุปจาก AI — แสดงบนจอเท่านั้น ไม่เคยเขียนลงเนื้อหาจริง ถ้าเก็บลง
          ฐานข้อมูลมันจะกินสรุปย่อ (200 ตัวแรกของเนื้อความ) และทำให้ทุกฉบับที่มา
          จาก Fathom ค้นเจอด้วยคำว่า "สรุป" หรือ "AI" เหมือนกันหมด */}
      {isAiSourced(m) && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>{t('สรุปที่สร้างโดย AI:')}</b>{' '}
            {t('สรุปนี้สร้างโดยอัตโนมัติ อาจมีข้อผิดพลาด โปรดอ่านที่ประเด็นหลักของการหารือ และตรวจสอบรายละเอียดที่สำคัญเมื่อจำเป็น')}
          </span>
        </p>
      )}

      {/* data-size = ขนาดตัวอักษรที่เลือกในแผงตั้งค่า มีผลเฉพาะกล่องเนื้อหานี้
          (กฎอยู่ใน index.css) ไม่ใช่ทั้งหน้า — ถ้าขยายทั้งหน้า สามคอลัมน์จะล้นจอ */}
      {m.content
        ? <div data-size={readingSize} data-testid="mtg-content"
            className="mtg-body border-t border-slate-100 pt-4 text-[15px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: m.content }} />
        : <p className="border-t border-slate-100 pt-4 text-sm text-slate-400">{t('ยังไม่มีเนื้อหา')}</p>}

      {(atts.length > 0 || canEdit) && (
        <section className="border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('ไฟล์แนบ')}{atts.length ? ` · ${atts.length}` : ''}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {atts.length === 0 && <span className="text-sm text-slate-400">{t('ยังไม่มีไฟล์แนบ')}</span>}
            {atts.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 pl-3 pr-1.5 text-sm text-slate-700">
                <button onClick={() => openFile(a)} className="inline-flex items-center gap-1.5 py-1.5 hover:text-brand">
                  <Icon name="paperclip" className="h-4 w-4 text-slate-400" />
                  <span className="max-w-[16rem] truncate">{a.file_name}</span>
                  {/* ขนาดไฟล์อยู่ตรงนี้เพราะคนตัดสินใจว่าจะกดตอนนี้หรือไว้ค่อยกด
                      จากขนาด ไม่ใช่จากชื่อ */}
                  <span className="text-xs text-slate-400">{fileSize(a.size_bytes)}</span>
                </button>
                {canEdit && (
                  <button onClick={() => dropFile(a)} title={t('ลบไฟล์แนบ')}
                    className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            ))}
            {/* แนบไฟล์ได้จากหน้าอ่าน ไม่ต้องเข้าโหมดแก้ไขทั้งฉบับก่อน — คนที่ได้
                เอกสารแนบมาหลังประชุมไม่ได้กำลังแก้บันทึก เขาแค่เอาไฟล์มาวาง */}
            {canEdit && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:border-brand hover:text-brand">
                <Icon name="plus" className="h-4 w-4" />
                {busy ? t('กำลังอัปโหลด…') : t('แนบไฟล์')}
                <input type="file" className="hidden" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; attach(f); }} />
              </label>
            )}
          </div>
        </section>
      )}

      <section className="border-t border-slate-100 pt-4">
        <h3 className="mb-2 flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{t('ความเห็น')} {m.comments?.length ? `(${m.comments.length})` : ''}</span>
          <button onClick={() => setActivity(true)} className="text-[11px] font-medium normal-case tracking-normal text-brand hover:underline">
            {t('ดูเรียงตามเวลาใน “ประวัติการทำงาน”')}
          </button>
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

      {/* ── ลิ้นชักประวัติการทำงาน ───────────────────────────────────────────
          เป็นแถบข้างขวา ไม่ใช่กล่องกลางจอ: มันคือของที่อ่าน "ควบคู่" กับบันทึก
          กล่องกลางจอปิดทับเอกสารที่กำลังพูดถึงอยู่ */}
      {activity && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActivity(false); }}
          role="dialog" aria-modal="true" aria-label={t('ประวัติการทำงาน')}>
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="font-bold text-slate-800">{t('ประวัติการทำงาน')}</h3>
              <button onClick={() => setActivity(false)} aria-label={t('ปิด')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-3">
              {/* ฉบับแรกปักไว้บนสุดในฐานะเหตุการณ์แรกสุด มันมีเวลาที่ถูกต้องแน่นอน
                  (created_at) จึงไม่ต้องไปเดาจากแถวประวัติ */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-slate-200 pb-3 text-sm">
                <span>
                  <b className="text-slate-800">{t('ฉบับแรก')}</b>
                  <span className="block text-[11px] text-slate-400">
                    {t('สร้างเมื่อ')} {thaiDateTime(m.created_at)}
                    {m.created_by_name ? ` · ${m.created_by_name}` : ''}
                  </span>
                </span>
                {m.versions?.length > 0 && (
                  <span className="flex shrink-0 gap-1">
                    <button onClick={() => viewVersion(m.versions[m.versions.length - 1].seq)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {t('ดูฉบับแรก')}
                    </button>
                    {canEdit && (
                      <button onClick={() => restoreVersion(m.versions[m.versions.length - 1].seq)}
                        title={t('นำเนื้อหาของฉบับแรกกลับมา')}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        {t('กู้คืน')}
                      </button>
                    )}
                  </span>
                )}
              </div>

              {stream.length === 0
                ? <p className="py-6 text-center text-sm text-slate-400">{t('ยังไม่มีประวัติการทำงาน')}</p>
                : stream.map((e, i) => (
                  <div key={`${e.kind}-${e.id || e.seq || i}`} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 text-sm">
                    <span className="min-w-0">
                      <b className="text-slate-800">
                        {e.kind === 'comment' && <Icon name="chat" className="mr-1 inline h-3.5 w-3.5 text-slate-400" />}
                        {e.label}
                      </b>
                      {e.who ? <span className="text-slate-500"> · {e.who}</span> : null}
                      {e.body && <span className="mt-0.5 block whitespace-pre-line text-slate-700">{e.body}</span>}
                      <span className="block text-[11px] text-slate-400">{thaiDateTime(e.when)}</span>
                    </span>
                    {e.kind === 'edit' && (
                      <span className="flex shrink-0 gap-1">
                        <button onClick={() => viewVersion(e.seq)}
                          title={t('ดูว่าก่อนแก้ครั้งนี้เขียนไว้ว่าอย่างไร')}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          {t('ดู')}
                        </button>
                        {canEdit && (
                          <button onClick={() => restoreVersion(e.seq)}
                            title={t('นำเนื้อหาของฉบับนี้กลับมาเป็นเนื้อหาปัจจุบัน')}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                            {t('กู้คืน')}
                          </button>
                        )}
                      </span>
                    )}
                    {e.kind === 'comment' && (e.authorId === profile?.id || profile?.role === 'admin') && (
                      <button onClick={() => dropComment({ id: e.id })}
                        className="shrink-0 rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500" title={t('ลบความเห็น')}>
                        <Icon name="x" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* ช่องเขียนอยู่ล่างสุด เพราะสายเวลาไล่จากเก่าลงมาใหม่ — ความเห็นใหม่
                จะไปโผล่ตรงที่กำลังพิมพ์อยู่ เหมือนห้องสนทนาทุกห้อง */}
            <form className="flex gap-2 border-t-2 border-slate-200 px-5 py-4"
              onSubmit={async (ev) => {
                ev.preventDefault();
                if (!note.trim()) return;
                setBusy(true);
                try { await meetingsApi.comment(m.id, note.trim()); setNote(''); await load(); onChanged?.(); }
                catch (err) { toast.error(err.message); }
                finally { setBusy(false); }
              }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('เขียนความเห็น')}
                placeholder={t('เขียนความเห็น…')} className="field flex-1 !py-2 !text-sm" />
              <button type="submit" disabled={busy || !note.trim()} className="btn-primary !py-2 !text-sm disabled:opacity-50">
                {t('ส่ง')}
              </button>
            </form>
          </aside>
        </div>
      )}

      {preview && (
        <Modal title={`${t('ฉบับก่อนแก้ครั้งที่')} ${preview.seq}`} onClose={() => setPreview(null)} size="lg"
          footer={(
            <>
              {/* ปุ่มกู้คืนอยู่ตรงนี้ด้วย เพราะนี่คือจุดที่คนตัดสินใจ: เขาเพิ่งอ่าน
                  ข้อความเก่าจบและรู้ว่าต้องการมันกลับ ไม่ควรต้องปิดกล่องแล้วไปหา
                  ปุ่มในลิ้นชักอีกรอบ */}
              {canEdit && (
                <button onClick={() => restoreVersion(preview.seq)} disabled={busy} className="btn-outline disabled:opacity-50">
                  {t('กู้คืนเนื้อหานี้')}
                </button>
              )}
              <button onClick={() => setPreview(null)} className="btn-outline">{t('ปิด')}</button>
            </>
          )}>
          <p className="mb-3 text-sm text-slate-600">
            <b className="text-slate-800">{preview.title}</b>
            <span className="text-slate-500"> · {meetingDateText(preview, lang)}{preview.time_label ? ` · ${preview.time_label}` : ''}</span>
          </p>
          <div data-size={readingSize}
            className="mtg-body rounded-xl border border-slate-200 p-4 text-[15px] leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: preview.content }} />
        </Modal>
      )}

      {paper && <MeetingPaper meeting={m} onClose={() => setPaper(false)} />}
    </article>
  );

  async function viewVersion(seq) {
    try { const r = await meetingsApi.version(m.id, seq); setPreview(r.data); setActivity(false); }
    catch (e) { toast.error(e.message); }
  }
}
