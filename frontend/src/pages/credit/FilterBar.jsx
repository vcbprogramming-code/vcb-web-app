import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import { TypeFilterOptions, projectLabel } from './shared.jsx';

/**
 * แถบตัวกรองชุดเดียวใช้ร่วมทุกแท็บ — เหมือนแถบ #bar ของระบบจริง
 *
 * เดิมแต่ละแท็บมีตัวกรองของตัวเอง กรองที่ตารางวงเงินแล้วสลับไปดูรายการสินเชื่อ
 * ตัวกรองก็หายไป ต้องตั้งใหม่ทุกครั้ง ทั้งที่คนกำลังไล่เรื่องเดียวกันอยู่ —
 * ตัวกรองจึงย้ายขึ้นไปอยู่ที่หน้าหลัก แล้วส่งลงมาให้ทุกแท็บใช้ค่าเดียวกัน
 *
 * ช่องสถานะโผล่เฉพาะแท็บรายการสินเชื่อ ตารางวงเงินไม่มีสถานะให้กรอง — ระบบจริง
 * ซ่อนช่องนี้ด้วยเงื่อนไขเดียวกัน (setView: fStatus แสดงเมื่อ v==='txn')
 *
 * ปุ่มอยู่บรรทัดล่างชิดขวา: สามปุ่มแรกเป็นงานที่เริ่มได้เลยโดยไม่ต้องเลือกแถวก่อน
 */
export default function FilterBar({
  filters, onChange, types, companies, projects, showStatus, showAddFacility,
  pendingCount = 0, exporting, onAddRequest, onAddDrawdown, onAddFacility, onExport,
}) {
  const t = useT();
  const set = (k) => (e) => onChange(k, e.target.value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filters.company} onChange={set('company')} className="field !w-auto" title={t('บริษัท')}>
          <option value="">{t('ทุกบริษัท')}</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.type} onChange={set('type')} className="field !w-auto" title={t('ประเภทวงเงิน')}>
          <TypeFilterOptions types={types} />
        </select>
        <select value={filters.projectId} onChange={set('projectId')} className="field !w-auto" title={t('โครงการ')}>
          <option value="">{t('ทุกโครงการ')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
        </select>
        {showStatus && (
          /* "รออนุมัติ (ใหม่/เสนอ)" ส่งสองสถานะไปพร้อมกัน — คนที่ตามงานค้างไม่ได้
             แยกในใจว่ายังไม่ยื่นกับยื่นแล้ว ทั้งสองคืองานที่ยังไม่จบ
             ไม่มี void ในช่องนี้: รายการที่ยกเลิกแล้วไม่ใช่สิ่งที่คนไล่หาทุกวัน */
          <select value={filters.status} onChange={set('status')} className="field !w-auto" title={t('สถานะ')}>
            <option value="">{t('ทุกสถานะ')}</option>
            <option value="คำขอใหม่,อยู่ระหว่างเสนออนุมัติ">{t('รออนุมัติ (ใหม่/เสนอ)')}</option>
            <option value="คำขอใหม่">{t('คำขอใหม่')}</option>
            <option value="อยู่ระหว่างเสนออนุมัติ">{t('อยู่ระหว่างเสนออนุมัติ')}</option>
            <option value="อนุมัติแล้ว">{t('อนุมัติแล้ว')}</option>
            <option value="ชำระแล้ว">{t('ชำระแล้ว')}</option>
          </select>
        )}
        <select value={filters.due} onChange={set('due')} className="field !w-auto" title={t('ระยะเวลา')}>
          <option value="">{t('ทุกระยะเวลา')}</option>
          <option value="due7">{t('ครบใน 7 วัน')}</option>
          <option value="thisMonth">{t('เดือนนี้')}</option>
          <option value="nextMonth">{t('เดือนหน้า')}</option>
          <option value="overdue">{t('เกินกำหนด')}</option>
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={set('search')} placeholder={t('ค้นหา…')}
            title={t('ค้นหา รหัส / รายละเอียด / ผู้รับเงิน')} className="field pl-9" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={onAddRequest} className="btn-primary !bg-amber-500 hover:!bg-amber-600">
          <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มคำขอสินเชื่อ')}
          {pendingCount ? (
            <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs font-semibold">{pendingCount}</span>
          ) : null}
        </button>
        {/* เบิกใช้วงเงินโดยเลือกโครงการกับประเภทในฟอร์ม — ไม่ต้องไปหาแถวในตารางก่อน */}
        <button onClick={onAddDrawdown} className="btn-outline">
          <Icon name="plus" className="h-4 w-4" /> {t('บันทึกการใช้วงเงิน')}
        </button>
        {showAddFacility && (
          <button onClick={onAddFacility} className="btn-outline">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มวงเงิน')}
          </button>
        )}
        <button onClick={onExport} disabled={exporting}
          className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-40"
          title={t('ดาวน์โหลดวงเงินทั้งหมดเป็นไฟล์ Excel')}>
          <Icon name="download" className="h-4 w-4" /> {exporting ? t('กำลังสร้างไฟล์…') : t('ส่งออก Excel')}
        </button>
      </div>
    </div>
  );
}
