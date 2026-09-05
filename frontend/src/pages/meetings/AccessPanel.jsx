import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(() => {
    meetingsApi.access().then((r) => setRows(r.data || [])).catch((e) => { toast.error(e.message); setRows([]); });
  }, [toast]);
  useEffect(load, [load]);

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
          {rows.map((g) => (
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
    </Modal>
  );
}
