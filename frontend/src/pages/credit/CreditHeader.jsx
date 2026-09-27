import { useAuth } from '../../auth/AuthContext.jsx';
import { roleLabels } from '../../config/nav.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แถบหัวของโมดูล — โครงเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่จริง
 *
 * แถบน้ำเงินเข้มเต็มความกว้าง ซ้ายเป็นชื่อกลุ่มบริษัทคั่นด้วยเส้นตั้งแล้วชื่อระบบ
 * เป็นตัวพิมพ์ใหญ่ ขวาเป็นปุ่มตั้งค่ากับชื่อคนที่กำลังใช้งานอยู่ — คนในฝ่ายการเงิน
 * เปิดหลายระบบพร้อมกันทั้งวัน แถบนี้คือสิ่งที่บอกว่ากำลังอยู่ในระบบไหน
 *
 * ใช้โครงเดียวกับ SopHeader และแถบหัวของรายงานการประชุม เพื่อให้สามโมดูลที่ลอก
 * มาจากระบบเดิมของเขาอ่านเป็นชุดเดียวกัน ไม่ใช่สามสไตล์
 *
 * เป็นแถบของโมดูลนี้เท่านั้น ไม่ได้แตะหัวเว็บรวมของระบบ (ModuleShell)
 */
export default function CreditHeader({ onSettings }) {
  const t = useT();
  const { profile, user } = useAuth();
  const role = profile?.role;
  return (
    <header className="rounded-2xl bg-navy px-4 py-3 text-white md:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-base font-extrabold tracking-tight">VCB Group</span>
          <span className="h-7 w-px shrink-0 bg-white/25" aria-hidden="true" />
          <span className="min-w-0">
            {/* ชื่อระบบเป็นอังกฤษตัวพิมพ์ใหญ่ทั้งสองภาษา — เป็นชื่อเฉพาะที่เขาใช้
                เรียกกันเองและใช้คุยกับธนาคาร ไม่ใช่ข้อความที่ต้องแปล */}
            <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
              Credit Facility Manager
            </span>
            <span className="block truncate text-[11px] text-white/60">
              {t('กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ติดตามวงเงินสินเชื่อทุกโครงการ')}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={onSettings} title={t('ตั้งค่า')} aria-label={t('ตั้งค่า')}
            className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white">
            <Icon name="settings" className="h-5 w-5" />
          </button>
          <span className="min-w-0 text-right leading-tight">
            <span className="block max-w-[180px] truncate text-sm font-medium text-white">
              {profile?.full_name || user?.email}
            </span>
            <span className="block text-[11px] text-white/55">{t(roleLabels[role] || role || '')}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
