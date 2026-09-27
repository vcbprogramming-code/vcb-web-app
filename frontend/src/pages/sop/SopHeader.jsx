import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แถบหัวของโมดูล — ลอกโครงจากหน้าเว็บที่ลูกค้าใช้อยู่จริง
 *
 * แถบน้ำเงินเข้มเต็มความกว้าง ซ้ายเป็นชื่อกลุ่มบริษัทคั่นด้วยเส้นตั้งแล้วชื่อเอกสาร
 * ขวาเป็นช่องค้นหายาวกับปุ่มตั้งค่า ช่องค้นหาอยู่ที่เดียวและใช้กับทุกมุมมอง
 * (กรณีเฉพาะ · ผังกระบวนการ · วิธีเรียก Report) เหมือนของเขา
 *
 * เป็นแถบของโมดูลนี้เท่านั้น ไม่ได้แตะหัวเว็บรวมของระบบ (ModuleShell) ที่โมดูลอื่นใช้
 */
export default function SopHeader({ q, onQ, onSettings, searchLabel }) {
  const t = useT();
  return (
    <header className="rounded-2xl bg-navy px-4 py-3 text-white md:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-base font-extrabold tracking-tight">VCB Group</span>
          <span className="h-7 w-px shrink-0 bg-white/25" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
              Standard Operating Procedure
            </span>
            <span className="block truncate text-[11px] text-white/60">
              กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ระเบียบปฏิบัติงานมาตรฐาน
            </span>
          </span>
        </div>

        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-[340px] sm:flex-none lg:w-[420px]">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input type="search" value={q} onChange={(e) => onQ(e.target.value)}
              aria-label={searchLabel || t('ค้นหากรณีเฉพาะ')}
              placeholder={t('ค้นหา… น้ำมัน, Advance, PO, เช็ค, โอนเงิน')}
              className="w-full rounded-xl border border-white/15 bg-white/10 py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/40 focus:bg-white/15" />
          </div>
          <button type="button" onClick={onSettings} title={t('การตั้งค่า · Settings')}
            aria-label={t('การตั้งค่า · Settings')}
            className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white">
            <Icon name="settings" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
