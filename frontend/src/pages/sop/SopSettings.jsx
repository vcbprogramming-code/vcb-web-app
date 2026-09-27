import { useState } from 'react';
import { Modal } from '../../components/ui/index.js';
import LangToggle from '../../components/LangToggle.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { readDefaultView, SOP_ALL_CASES } from '../../lib/sop.js';
import { useT } from '../../lib/i18n.jsx';

/**
 * การตั้งค่าในโมดูล — ชุดเดียวกับเมนูตั้งค่าของหน้าเว็บที่ลูกค้าใช้อยู่จริง
 *
 * โหมดกลางคืนของเขาไม่ได้ทำไว้ที่นี่ โมดูลนี้ของเราเป็นธีมสว่างทั้งหมด และตัวสลับ
 * ธีมที่มีอยู่ผูกกับ E-Memo/Admin — เปิดปุ่มไว้ตรงนี้จะกลายเป็นปุ่มที่กดแล้วไม่มีอะไร
 * เปลี่ยน หรือแย่กว่านั้นคือไปเปลี่ยนโมดูลอื่นให้คนที่ไม่ได้ขอ
 */
export default function SopSettings({ modules, counts, onClose, onDefaultView }) {
  const t = useT();
  const { profile, user } = useAuth();
  // ยังไม่เคยตั้งค่าก็ต้องขึ้นตัวเลือกที่ระบบพาไปจริง ไม่ใช่ช่องว่าง
  const [defaultView, setDefaultView] = useState(() => readDefaultView() || 'flows');

  const pick = (code) => {
    setDefaultView(code);
    onDefaultView?.(code);
  };

  return (
    <Modal title={t('การตั้งค่า · Settings')} onClose={onClose} size="lg"
      footer={<button onClick={onClose} className="btn-primary">{t('ปิด')}</button>}>
      <div className="space-y-5">
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('เข้าใช้งานในชื่อ · SIGNED IN AS')}
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-sm font-medium text-slate-800">{profile?.full_name || user?.email || '—'}</div>
            {user?.email && <div className="text-xs text-slate-500">{user.email}</div>}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('การแสดงผล · DISPLAY')}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-700">{t('ภาษา · Language')}</label>
            <LangToggle />
          </div>

          <div>
            <label htmlFor="sop-default-view" className="mb-1 block text-sm font-medium text-slate-700">
              {t('หน้าเริ่มต้น · Default view')}
            </label>
            {/* ตัวเลือกชุดเดียวกับระบบจริง: ผังกระบวนการ · ทั้งหมด · แต่ละหมวด ·
                วิธีเรียก Report — เดิมมีแต่หมวด คนที่เปิดมาใช้ผังหรือตารางรายงาน
                เป็นหลักจึงตั้งค่าไม่ได้ */}
            <select id="sop-default-view" value={defaultView} onChange={(e) => pick(e.target.value)} className="field">
              <option value="flows">{t('ผังกระบวนการ')}</option>
              <option value={SOP_ALL_CASES}>{t('ทั้งหมด')}</option>
              {modules.map((m) => (
                <option key={m.code} value={m.code} disabled={!counts?.[m.code]}>
                  {m.code} · {m.name_th_short}
                </option>
              ))}
              <option value="reports">{t('วิธีเรียก Report')}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">{t('เลือกหมวดที่จะเปิดโดยอัตโนมัติเมื่อเข้าใช้งานครั้งถัดไป')}</p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
