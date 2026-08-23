import { useMemo, useState } from 'react';
import { Modal } from './ui/index.js';
import { useToast } from './Toast.jsx';
import { BusyLabel } from './Spinner.jsx';
import { portalApi } from '../lib/portal.js';
import { apps } from '../config/nav.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../lib/i18n.jsx';

/** "Help / report an issue" — a short message emailed to the admins. */
export default function HelpModal({ onClose }) {
  const t = useT();
  const toast = useToast();
  const { profile } = useAuth();
  const [area, setArea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const field = 'field';

  // only offer modules this user can actually reach — otherwise the picker leaks
  // the existence of restricted/disabled modules to everyone
  const areaOptions = useMemo(() => {
    const role = profile?.role;
    const eff = profile?.effective_permissions;
    return apps.filter((a) => (!a.roles || (role && a.roles.includes(role)))
      && (!a.perm || !eff || eff[a.perm[0]]?.[a.perm[1]] === true)
      && a.enabled !== false);
  }, [profile]);

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) { toast.error(t('กรุณากรอกข้อความ')); return; }
    setBusy(true);
    try {
      await portalApi.sendSupport({ area: area || 'ทั่วไป', message: message.trim() });
      toast.success(t('ส่งเรื่องถึงผู้ดูแลระบบแล้ว ขอบคุณครับ'));
      onClose();
    } catch (err) {
      toast.error(err.message || 'ส่งไม่สำเร็จ');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={t('ช่วยเหลือ / แจ้งปัญหา')} onClose={onClose} size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ปิด')}</button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            <BusyLabel busy={busy} busyText="กำลังส่ง…">{t('ส่งเรื่อง')}</BusyLabel>
          </button>
        </>
      }>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('พบปัญหาการใช้งานหรือมีข้อสงสัย ส่งข้อความถึงผู้ดูแลระบบได้ที่นี่')}</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('ส่วนที่เกี่ยวข้อง')}</label>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={field}>
            <option value="">{t('— เลือกส่วนที่เกี่ยวข้อง —')}</option>
            {areaOptions.map((a) => <option key={a.to} value={a.title}>{t(a.title)}</option>)}
            <option value="อื่น ๆ">{t('อื่น ๆ')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('รายละเอียด')}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000}
            placeholder={t('อธิบายปัญหาหรือข้อสงสัย…')} className={`${field} resize-none`} />
          <div className="mt-1 text-right text-[11px] text-slate-400">{message.length}/2000</div>
        </div>
      </form>
    </Modal>
  );
}
