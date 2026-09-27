import { READING_SIZES, MTG_NAVY } from '../../lib/meetings.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * แผงตั้งค่าของโมดูลประชุม — ตามแผงที่เปิดจากปุ่มเฟืองในระบบจริงของลูกค้า
 *
 * รายการของเขา (พจนานุกรมใน JavaScript.html) มีหกหัวข้อ เราทำห้าหัวข้อที่มีค่าจริง
 * กับระบบเรา และเว้น "โหมดสี / Theme" ไว้ด้วยเหตุผลเดียว: โมดูลนี้เป็นธีมสว่างล้วน
 * เหมือน SOP ตัวสลับสว่าง/มืดของแอปผูกอยู่กับ E-Memo ซึ่งห้ามแตะ ปุ่มที่กดแล้วไม่
 * เกิดอะไรขึ้นแย่กว่าไม่มีปุ่ม
 *
 * และไม่มี "ออกจากระบบ" ในแผงนี้ ของเขาจำเป็นเพราะแอปเขาไม่มีแถบผู้ใช้ของตัวเอง
 * ส่วนของเรามีเมนูผู้ใช้อยู่บนหัวแอปทุกหน้าแล้ว ทางออกสองทางที่ทำเรื่องเดียวกัน
 * คือสองที่ที่ต้องดูแลให้ตรงกัน
 */
export default function SettingsPanel({ size, onSize, canManage, onAccess, onClose }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { profile } = useAuth();

  const SIZE_LABEL = { small: 'เล็ก', normal: 'ปกติ', large: 'ใหญ่' };

  const seg = (on) => `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    on ? 'text-white' : 'text-slate-600 hover:bg-white'}`;
  const segStyle = (on) => (on ? { background: MTG_NAVY } : undefined);

  const head = (s) => (
    <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{s}</p>
  );

  return (
    <Modal title={t('ตั้งค่า')} onClose={onClose} size="md"
      footer={<button onClick={onClose} className="btn-outline">{t('ปิด')}</button>}>
      <div className="space-y-4">
        {/* เข้าสู่ระบบโดย — ของเขาวางไว้บนสุด เพราะคำถามแรกของคนที่เปิดแผงนี้คือ
            "ระบบคิดว่าฉันเป็นใคร" ซึ่งเป็นต้นเหตุของเรื่อง "ฉันเปิดไม่ได้" เกือบทุกครั้ง */}
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('เข้าสู่ระบบโดย')}</p>
          <p className="truncate text-sm font-semibold text-slate-800">{profile?.full_name || '—'}</p>
          <p className="truncate text-xs text-slate-500">{profile?.email || ''}</p>
        </div>

        {head(t('การแสดงผล'))}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{t('ภาษา')}</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setLang('th')} style={segStyle(lang === 'th')} className={seg(lang === 'th')}>
              ไทย
            </button>
            <button type="button" onClick={() => setLang('en')} style={segStyle(lang === 'en')} className={seg(lang === 'en')}>
              English
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{t('ขนาดตัวอักษร')}</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" data-testid="mtg-size">
            {READING_SIZES.map((s) => (
              <button key={s} type="button" onClick={() => onSize(s)}
                style={segStyle(size === s)} className={seg(size === s)}>
                {t(SIZE_LABEL[s])}
              </button>
            ))}
          </div>
          {/* บอกขอบเขตไว้ ไม่อย่างนั้นคนจะคาดว่าทั้งหน้าจะขยายตาม แล้วคิดว่าพัง */}
          <span className="mt-1 block text-[11px] text-slate-400">
            {t('มีผลกับเนื้อหาบันทึกการประชุมเท่านั้น และจำไว้เฉพาะเครื่องนี้')}
          </span>
        </label>

        {canManage && (
          <button onClick={() => { onAccess(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand">
            <Icon name="lock" className="h-4 w-4 text-slate-400" />
            <span className="flex-1">{t('สิทธิ์โครงการ')}</span>
            <Icon name="arrowRight" className="h-4 w-4 text-slate-300" />
          </button>
        )}

        {head(t('เกี่ยวกับ'))}
        <dl className="space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t('เวอร์ชัน')}</dt>
            {/* อ่านจากไฟล์ที่กำลังทำงานอยู่จริง ไม่ใช่เลขที่ต้องมาแก้ด้วยมือทุกครั้ง
                แล้วค้างอยู่ผิดรุ่น — เลขที่ผิดแย่กว่าไม่มีเลข */}
            <dd className="font-mono text-xs text-slate-700">{buildId()}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{t('ผู้ดูแล')}</dt>
            <dd className="text-right text-slate-700">
              {profile?.role === 'admin'
                ? t('บัญชีนี้เป็นผู้ดูแลระบบ')
                : t('ติดต่อผู้ดูแลระบบได้จากปุ่มช่วยเหลือบนหัวแอป')}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

/**
 * รหัสรุ่นของไฟล์ที่กำลังทำงานอยู่
 *
 * ตอนสร้างชุดส่งจริง Vite ตั้งชื่อไฟล์เป็น index-<hash>.js โดย hash เปลี่ยนทุกครั้ง
 * ที่โค้ดเปลี่ยน — มันจึงเป็นรหัสรุ่นที่จริงอยู่แล้วและไม่ต้องดูแล ตอนพัฒนายังไม่มี
 * hash จึงตอบว่า dev ตรง ๆ
 */
function buildId() {
  try {
    for (const s of document.querySelectorAll('script[src]')) {
      const hit = String(s.getAttribute('src') || '').match(/-([0-9a-zA-Z_]{8})\.js/);
      if (hit) return hit[1];
    }
  } catch { /* ไม่รู้ก็บอกว่าไม่รู้ */ }
  return 'dev';
}
