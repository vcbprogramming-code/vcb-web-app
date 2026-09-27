import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { meetingsApi } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * ใครอ่านกลุ่มไหนได้ — สามระดับตามข้อกำหนดฟังก์ชัน §3.9
 *
 *   เปิด (public) ผู้ใช้ที่ลงชื่อเข้าใช้แล้วอ่านได้ทุกคน
 *   ล็อก (locked) เฉพาะผู้ดูแล ผู้แก้ไข และอีเมลที่ระบุชื่อไว้
 *
 * กลุ่มที่ล็อกจะ "หายไปจากรายการ" ของคนที่ไม่มีสิทธิ์ ไม่ใช่ขึ้นชื่อแล้วกดไม่ได้
 * เป็นหน้าเต็ม ไม่ใช่กล่องเล็ก เพราะจำนวนกลุ่ม × จำนวนอีเมลใส่ในกล่องไม่พอ
 */
export default function AccessPanel({ onClose }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('');
  const [copyFrom, setCopyFrom] = useState(null);   // กลุ่มต้นทางของการคัดลอกรายชื่อ

  // ผูกกับ toast ไม่ได้: มันเป็นออบเจ็กต์ใหม่ทุกเรนเดอร์ load จึงถูกสร้างใหม่
  // ทุกเรนเดอร์ เอฟเฟกต์ก็ทำงานซ้ำ และแผงนี้ยิงคำขอสองรอบทุกครั้งที่เปิด
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });
  const load = useCallback(() => {
    meetingsApi.access().then((r) => setRows(r.data || []))
      .catch((e) => { toastRef.current.error(e.message); setRows([]); });
  }, []);
  useEffect(load, [load]);

  // กรองด้วยชื่อโครงการหรืออีเมล — ค้นด้วยอีเมลเพราะคำถามที่ถูกถามจริงคือ
  // "คนนี้เข้าอะไรได้บ้าง" ไม่ใช่ "โครงการนี้มีใคร"
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((g) => String(g.name || '').toLowerCase().includes(q)
      || String(g.code || '').toLowerCase().includes(q)
      || (g.emails || []).some((e) => String(e).toLowerCase().includes(q)));
  }, [rows, filter]);

  const toggle = async (g) => {
    // ไม่สมมาตรโดยเจตนา: ปลดล็อกคือการเผยแพร่ทุกฉบับที่มีอยู่แล้วทันที ส่วนการ
    // ล็อกกลับแค่หยุดค่าเริ่มต้นในอนาคต ไม่ได้เรียกฉบับที่เผยแพร่ไปแล้วคืน
    if (g.visibility === 'locked') {
      const ok = await confirm({
        title: t('เปิดกลุ่มนี้ให้อ่านได้'),
        message: `${g.name}\n${t('รายงานทุกฉบับที่มีอยู่แล้วในกลุ่มนี้จะอ่านได้ทันที และการล็อกกลับภายหลังจะไม่เรียกคืน')}`,
        confirmLabel: t('เปิดให้อ่าน'), danger: false,
      });
      if (!ok) return;
    }
    setBusy(g.id);
    try {
      await meetingsApi.updateGroup(g.id, { visibility: g.visibility === 'public' ? 'locked' : 'public' });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const addGuests = async (g) => {
    const emails = (draft[g.id] || '').trim();
    if (!emails) return;
    setBusy(g.id);
    try {
      // เซิร์ฟเวอร์ปฏิเสธทั้งชุดถ้ามีอีเมลผิดแม้ตัวเดียว — คงข้อความไว้ในช่อง
      // ให้แก้ต่อได้ ไม่ใช่ล้างทิ้งแล้วให้พิมพ์ใหม่ทั้งหมด
      await meetingsApi.addGuests(g.id, emails);
      setDraft((d) => ({ ...d, [g.id]: '' }));
      toast.success(t('เพิ่มผู้อ่านแล้ว'));
      load();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const removeGuest = async (g, email) => {
    setBusy(g.id);
    try { await meetingsApi.removeGuest(g.id, email); load(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <Modal title={t('สิทธิ์การเข้าถึงรายงานการประชุม')} onClose={onClose} size="lg">
      {!rows ? <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div> : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {t('กลุ่มที่ล็อกจะไม่ปรากฏในรายการของผู้ที่ไม่มีสิทธิ์เลย — ไม่ใช่ขึ้นชื่อแล้วกดไม่ได้')}
          </p>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)}
              aria-label={t('กรองโครงการหรืออีเมล…')}
              placeholder={t('กรองโครงการหรืออีเมล…')} className="field !pl-9 !py-2 !text-sm" />
          </div>
          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
              {t('ไม่มีโครงการที่ตรงกับคำกรอง')}
            </p>
          )}
          {shown.map((g) => (
            <div key={g.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                <span className="font-medium text-slate-800">{g.name}</span>
                <button onClick={() => toggle(g)} disabled={busy === g.id}
                  className={`chip ${g.visibility === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} disabled:opacity-50`}>
                  {g.visibility === 'public' ? t('เปิดให้อ่าน') : t('ล็อก')}
                </button>
                {g.bare && (
                  <span className="chip bg-rose-50 text-rose-700" title={t('ล็อกไว้แต่ยังไม่มีใครถูกระบุชื่อ — ตอนนี้มีแต่ผู้ดูแลและผู้แก้ไขที่เข้าถึงได้')}>
                    <Icon name="bell" className="mr-1 h-3.5 w-3.5" /> {t('ยังไม่มีผู้อ่านที่ระบุชื่อ')}
                  </span>
                )}
              </div>

              {g.visibility === 'locked' && (
                <div className="mt-2 space-y-2 pl-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('ใครเห็นได้')} ({(g.emails || []).length})
                    </span>
                    {/* โครงการหลายโครงการมักมีผู้อ่านชุดเดียวกัน การพิมพ์อีเมล
                        ห้าตัวซ้ำทุกโครงการคือวิธีที่รายชื่อเริ่มไม่ตรงกันเงียบ ๆ */}
                    {(g.emails || []).length > 0 && (
                      <button onClick={() => setCopyFrom(g)} className="text-xs font-medium text-brand hover:underline">
                        {t('คัดลอกรายชื่อไปโครงการอื่น…')}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(g.emails || []).length === 0
                      ? <span className="text-xs text-slate-400">{t('ยังไม่มีใครถูกระบุชื่อ')}</span>
                      : g.emails.map((e) => (
                        <span key={e} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          {e}
                          <button onClick={() => removeGuest(g, e)} className="text-slate-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={draft[g.id] || ''} onChange={(ev) => setDraft((d) => ({ ...d, [g.id]: ev.target.value }))}
                      onKeyDown={(ev) => ev.key === 'Enter' && addGuests(g)}
                      placeholder={t('อีเมล — วางหลายรายการพร้อมกันได้')}
                      className="field flex-1 !py-1.5 !text-sm" />
                    <button onClick={() => addGuests(g)} disabled={busy === g.id}
                      className="btn-outline !py-1.5 !text-sm disabled:opacity-50">{t('เพิ่ม')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {copyFrom && (
        <CopyRoster
          from={copyFrom}
          targets={(rows || []).filter((g) => g.id !== copyFrom.id && g.visibility === 'locked')}
          onClose={() => setCopyFrom(null)}
          onDone={() => { setCopyFrom(null); load(); }}
        />
      )}
    </Modal>
  );
}

/**
 * คัดลอกรายชื่อผู้อ่านไปโครงการอื่น
 *
 * ของเขาถามเป็นตัวเลขในกล่อง prompt ("ใส่หมายเลข คั่นด้วยจุลภาค") — ที่นี่เป็น
 * ติ๊กถูก เพราะการอ่านเลขจากรายการแล้วพิมพ์เลขนั้นกลับไปเป็นงานที่ผิดได้ง่าย
 * โดยไม่มีอะไรบอก และคัดลอกเป็นการ "เพิ่ม" ไม่ใช่ "ทับ" — รายชื่อเดิมของโครงการ
 * ปลายทางไม่หายไป เพราะไม่มีใครขอให้เอาคนออก
 */
function CopyRoster({ from, targets, onClose, onDone }) {
  const t = useT();
  const toast = useToast();
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const emails = from.emails || [];

  // กล่องนี้อยู่ในกล่องสิทธิ์อีกชั้น และ Modal ทุกตัวฟัง keydown ที่ document
  // ตัวนอกลงทะเบียนก่อนจึงทำงานก่อน — Escape ทีเดียวปิดทั้งสองชั้นแล้วสิ่งที่
  // ติ๊กไว้หายหมด ดักในช่วง capture ที่มาก่อน bubble ของ document
  useEffect(() => {
    const guard = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!busy) onClose(); } };
    document.addEventListener('keydown', guard, true);
    return () => document.removeEventListener('keydown', guard, true);
  }, [busy, onClose]);

  const go = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      for (const id of picked) await meetingsApi.addGuests(id, emails.join(', '));
      toast.success(t('คัดลอกรายชื่อไป {n} โครงการแล้ว', { n: picked.length }));
      onDone();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={t('คัดลอกรายชื่อผู้อ่าน')} onClose={busy ? undefined : onClose} size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button type="button" onClick={go} disabled={busy || !picked.length} className="btn-primary disabled:opacity-50">
            {busy ? t('กำลังบันทึก…') : t('คัดลอก')}
          </button>
        </>
      )}>
      <p className="text-sm text-slate-600">
        {t('คัดลอกผู้อ่าน {n} รายจาก', { n: emails.length })} <b>{from.name}</b> {t('ไปยังโครงการที่เลือก (เพิ่มเข้าไป ไม่ทับของเดิม)')}
      </p>
      {targets.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          {t('ยังไม่มีโครงการที่ล็อกอื่นให้คัดลอกไป — คัดลอกได้เฉพาะโครงการที่ล็อก เพราะโครงการที่เปิดอ่านได้อยู่แล้วทุกคน')}
        </p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-auto">
          {targets.map((g) => (
            <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <input type="checkbox" checked={picked.includes(g.id)} className="h-4 w-4 rounded border-slate-300"
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))} />
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.color }} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{g.name}</span>
              <span className="text-xs text-slate-400">{(g.emails || []).length}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
