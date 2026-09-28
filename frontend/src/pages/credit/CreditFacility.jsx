import { Children, useEffect, useState, useCallback, useMemo } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { ememoApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import FacilitiesTab from './FacilitiesTab.jsx';
import LedgerTab from './LedgerTab.jsx';
import CashPlanTab from './CashPlanTab.jsx';
import CostSummaryTab from './CostSummaryTab.jsx';
import VarianceTab from './VarianceTab.jsx';
import RequestsPanel from './RequestsPanel.jsx';
import SettingsModal from './SettingsModal.jsx';
import CreditHeader from './CreditHeader.jsx';
import FilterBar from './FilterBar.jsx';
import DrawdownModal from './DrawdownModal.jsx';
import { GROUP_BG, GROUP_BE, useDashPrefs, typeParams } from './shared.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * ลำดับและชื่อแท็บเดียวกับระบบที่ลูกค้าใช้อยู่ — คนที่ย้ายมาจะหาของเจอที่เดิม
 *
 * ชื่อไทยพ่วงวงเล็บอังกฤษไว้เพราะคนในบริษัทเรียกแท็บพวกนี้ด้วยคำอังกฤษเวลาคุย
 * กับธนาคาร ("ส่งไฟล์ Credit Ledger มา") พอสลับภาษาเป็นอังกฤษ ชื่อไทยกลายเป็น
 * อังกฤษอยู่แล้ว วงเล็บจึงถูกซ่อน ไม่ให้อ่านว่า "Credit Ledger (Credit Ledger)"
 * — ยกเว้น (T-bar) ที่เป็นชื่อรูปแบบตาราง ไม่ใช่คำแปล จึงค้างไว้ทั้งสองภาษา
 */
const TABS = [
  { key: 'facilities', label: 'วงเงินสินเชื่อ', en: 'Facilities' },
  { key: 'ledger', label: 'รายการสินเชื่อ', en: 'Credit Ledger' },
  { key: 'costs', label: 'สรุปค่าใช้จ่าย', en: 'Cost summary' },
  { divider: true },
  { key: 'cashplan', label: 'แผนการเงิน', en: 'T-bar', keepEn: true },
  { key: 'actual', label: 'หักค่างานตามจริง' },
  { key: 'variance', label: 'ผลต่าง', en: 'Variance' },
];

// ชื่อย่อของวงเงินย่อยในกล่องที่พับรวม — ป้ายเดียวกับที่คนในฝ่ายการเงินเรียกกัน
// ไม่ใช่ชื่อเต็มตามทะเบียน ซึ่งยาวเกินกว่าจะอ่านในการ์ดสรุป
const PART_SHORT = {
  1: 'ค้ำสัญญา 5%', 2: 'ค้ำ Advance 15%', 3: 'ค้ำประกันผลงาน',
  5: 'L/G วัสดุ', 6: 'B/E', 9: 'DLC', 10: 'PN-post',
};

/**
 * กล่องวงเงินหนึ่งเส้น — กดแล้วไปดูว่ามาจากวงเงินก้อนไหน
 *
 * ตัวเลขใหญ่คือวงเงินคงเหลือ เหมือนการ์ดของระบบจริง — คำถามแรกของคนเปิดหน้านี้
 * คือยังเบิกได้อีกเท่าไร ไม่ใช่ใช้ไปแล้วเท่าไร
 */
function FacilityStat({ label, item, accent, tip, onOpen }) {
  const t = useT();
  const empty = !item || (!item.limit && !item.used);
  return (
    <button type="button" onClick={onOpen} title={tip}
      className="card-sm card-btn border-t-[3px] transition hover:border-brand/40"
      style={{ borderTopColor: accent }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <Icon name="arrowRight" className="h-4 w-4 text-slate-300" />
      </div>
      {/* ระบบจริงขึ้น "— ไม่มีข้อมูล" เมื่อทั้งวงเงินและยอดใช้เป็นศูนย์ */}
      {empty ? (
        <div className="mt-1 text-sm font-medium text-slate-300">— {t('ไม่มีข้อมูล')}</div>
      ) : (
        <>
          <div className={`mt-1 text-xl font-bold ${item.available < 0 ? 'text-red-600' : 'text-slate-900'}`}
            title={t('วงเงินคงเหลือ')}>{formatMoney(item.available)}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${item.pct >= 100 ? 'bg-red-500' : item.pct >= 80 ? 'bg-amber-400' : 'bg-brand'}`}
              style={{ width: `${Math.min(100, item.pct)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{t('ใช้ไปแล้ว')} {item.pct}%</div>
          {/* กล่องนี้อาจรวมวงเงินหลายประเภทที่ธนาคารให้เป็นก้อนเดียว — บอกว่ามาจากอะไรบ้าง
              ไม่งั้นยอดที่เห็นจะกระทบยอดกับเอกสารธนาคารไม่ได้ */}
          {(item.parts || []).length > 1 && (
            <ul className="mt-1.5 space-y-0.5 border-t border-dashed border-slate-200 pt-1.5">
              {item.parts.map((p) => (
                <li key={p.no ?? p.name} className="flex items-baseline justify-between gap-2 text-[11px] text-slate-400">
                  <span className="truncate">{PART_SHORT[p.no] || p.name}</span>
                  {/* ยอดเงินห้ามตกบรรทัด — ตัวเลขเก้าหลักที่ถูกหักครึ่งอ่านผิดได้ทันที */}
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-600">{t('ใช้')} {formatMoney(p.used)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </button>
  );
}

/**
 * การ์ดสรุปที่กดแล้วพาไปดูของจริง
 *
 * ตัวเลขบนการ์ดไม่มีประโยชน์ถ้าคนอ่านตามต่อไม่ได้ว่ามาจากรายการไหน — กดแล้ว
 * เปิดแท็บรายการสินเชื่อพร้อมกรองช่วงเวลานั้นให้เลย เหมือนปุ่ม "ดูรายการ →"
 * ของระบบที่เขาใช้อยู่
 */
function BucketStat({ label, bucket, accent, tip, onOpen, extra }) {
  const t = useT();
  return (
    <button type="button" onClick={onOpen} title={tip}
      className="card-sm card-btn border-t-[3px] transition hover:border-brand/40" style={{ borderTopColor: accent }}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{formatMoney(bucket?.amount || 0)}</div>
      <div className="mt-1 text-[11px] text-slate-400">
        {bucket?.count || 0} {t('รายการ')}{extra ? ` · ${extra}` : ''}
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
        {t('ดูรายการ')} <Icon name="arrowRight" className="h-3 w-3" />
      </div>
    </button>
  );
}

/** การ์ดสถานะ: นับจำนวนรายการเป็นตัวเลขใหญ่ ยอดเงินเป็นบรรทัดรอง */
function StatusStat({ label, count, amount, accent, tip, onOpen, countClass }) {
  const t = useT();
  return (
    <button type="button" onClick={onOpen} title={tip}
      className="card-sm card-btn border-t-[3px] transition hover:border-brand/40" style={{ borderTopColor: accent }}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${countClass || 'text-slate-900'}`}>{count || 0} {t('รายการ')}</div>
      <div className="mt-1 text-[11px] text-slate-400">{formatMoney(amount || 0)}</div>
      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand">
        {t('ดูรายการ')} <Icon name="arrowRight" className="h-3 w-3" />
      </div>
    </button>
  );
}

/**
 * จำนวนคอลัมน์ของกลุ่มการ์ด — เดินตามการ์ดที่แสดงจริง ไม่ใช่จำนวนที่เผื่อไว้
 *
 * กลุ่มวงเงินกู้ระยะยาวเผื่อช่องไว้สามใบ (T/L · BG · M/L) แต่ถ้าในการตั้งค่าปิด M/L
 * ไว้ กริดจะเหลือคอลัมน์ว่างทั้งคอลัมน์ (213px บนจอ 1440) และการ์ดถูกบีบให้แคบกว่า
 * การ์ดของกลุ่มที่อยู่ข้างกัน 107px ทั้งที่อยู่ในแถวเดียวกัน — บรรทัดย่อยในการ์ด BG
 * จึงถูกตัดคำ ("ค้ำ Advance 1…") บนจอ 1280–1440px · การ์ดครบกำหนดกับการ์ดสถานะ
 * ปิดรายใบได้เหมือนกัน จึงใช้กฎเดียวกันทั้งสามกลุ่ม
 *
 * ชื่อคลาสต้องเขียนเต็ม ไม่ใช่ต่อสตริงเอา เพราะ Tailwind อ่านชื่อคลาสจากซอร์สตรง ๆ
 */
const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3' };
const colsFor = (n, max = 3) => COLS[Math.min(max, Math.max(1, n))];

/** หัวข้อกลุ่มการ์ด — หายทั้งกลุ่มเมื่อพาเนลข้างในถูกปิดหมด */
function CardGroup({ title, cols = 2, children, show }) {
  if (!show) return null;
  const shown = Children.toArray(children).filter(Boolean).length;
  return (
    <div className="card">
      <h3 className="mb-3 font-bold text-slate-800">{title}</h3>
      <div className={`grid gap-3 ${colsFor(shown, cols)}`}>{children}</div>
    </div>
  );
}

export default function CreditFacility() {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('facilities');
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [showRequests, setShowRequests] = useState(0);   // 0=ปิด 1=เปิด 2=เปิดพร้อมฟอร์ม
  const [showSettings, setShowSettings] = useState(false);
  const [showDrawdown, setShowDrawdown] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { prefs, setPanel } = useDashPrefs();
  // set by the empty state so its button opens the add form, not just the tab
  const [openNew, setOpenNew] = useState(0);
  // ทะเบียนที่ทุกแท็บใช้ร่วมกัน โหลดครั้งเดียวที่นี่ ไม่ให้แต่ละแท็บยิงซ้ำ
  const [types, setTypes] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [costCategories, setCostCategories] = useState([]);

  /**
   * ตัวกรองชุดเดียวของทั้งโมดูล — เหมือนแถบ #bar ของระบบจริง
   *
   * เดิมตัวกรองอยู่ในแต่ละแท็บ กรองที่ตารางวงเงินแล้วสลับไปดูรายการสินเชื่อก็หาย
   * ต้องตั้งใหม่ ทั้งที่คนกำลังไล่เรื่องเดียวกันอยู่ และปุ่มส่งออกก็ไม่รู้ว่าตอนนี้
   * กรองอะไรค้างไว้ — ย้ายขึ้นมาไว้ที่เดียว ทุกแท็บและปุ่มส่งออกจึงอ่านค่าเดียวกัน
   */
  const [filters, setFilters] = useState({ company: '', type: '', projectId: '', status: '', due: '', search: '' });
  const setFilter = useCallback((k, v) => setFilters((f) => ({ ...f, [k]: v })), []);
  /** ล้างตัวกรองเจาะลึกทั้งหมด แต่คงโครงการที่ผู้ใช้เลือกไว้เอง (resetDrillFilters ของเขา) */
  const resetDrill = (next) => setFilters((f) => ({ ...f, type: '', status: '', due: '', search: '', ...next }));
  const openLedger = (next) => { resetDrill(next); setTab('ledger'); };
  const openFacilities = (type) => { resetDrill({ type }); setTab('facilities'); };

  const loadOverview = useCallback(() => {
    creditApi.overview().then((r) => setOverview(r.data)).catch((e) => setError(e.message));
  }, []);
  /** รายชื่อบริษัทอ่านจากวงเงินที่มีอยู่จริง — ไม่ต้องมีทะเบียนแยกให้ดูแลอีกชุด */
  const loadFacilities = useCallback(() => {
    creditApi.facilities({}).then((r) => setFacilities(r.data || [])).catch(() => setFacilities([]));
  }, []);

  useEffect(() => {
    loadOverview();
    loadFacilities();
    ememoApi.listProjects().then((r) => setProjects(r.data)).catch(() => {});
    creditApi.facilityTypes().then((r) => setTypes(r.data || [])).catch(() => setTypes([]));
    creditApi.costCategories().then((r) => setCostCategories(r.data || [])).catch(() => setCostCategories([]));
  }, [loadOverview, loadFacilities]);

  const companies = useMemo(
    () => [...new Set(facilities.map((f) => f.company).filter(Boolean))].sort(), [facilities]);
  const changed = useCallback(() => { loadOverview(); loadFacilities(); }, [loadOverview, loadFacilities]);

  const byType = Object.fromEntries((overview?.byType || []).map((row) => [row.type, row]));
  // Nothing has been entered yet. Four dashes and a row of ฿0 tell a first-time
  // user nothing about where to start, and Export would hand them an empty file.
  const empty = overview != null && (overview.byType || []).length === 0;

  /**
   * ส่งออก Excel ตามตัวกรองที่เห็นอยู่ — ถามก่อนเสมอ
   *
   * ไฟล์ที่ได้ต่างกันมากระหว่าง "ทั้งหมด" กับ "เฉพาะที่กรองไว้" และคนที่กดมัก
   * ไม่ได้มองว่าตอนนี้กรองอะไรค้างอยู่ ระบบจริงจึงถามยืนยันพร้อมบอกว่าใช้ตัวกรอง
   * ปัจจุบัน — ไม่ใช่กดแล้วได้ไฟล์ที่ไม่รู้ว่าครบหรือไม่ครบ
   */
  const handleExport = async () => {
    const ok = await confirm({
      title: t('ส่งออก Excel'),
      message: t('ส่งออกไฟล์ Excel ตามตัวกรองปัจจุบัน?'),
      confirmLabel: t('ส่งออก'), danger: false,
    });
    if (!ok) return;
    setExporting(true);
    try {
      const url = await creditApi.exportUrl({
        projectId: filters.projectId, company: filters.company, status: filters.status,
        due: filters.due, search: filters.search, ...typeParams(filters.type),
      });
      // ตั้งชื่อไฟล์ฝั่งนี้ด้วย เพราะ blob: URL ไม่พาชื่อจากเซิร์ฟเวอร์มา —
      // ไฟล์ที่ดาวน์โหลดแล้วต้องบอกได้เองว่าส่งออกเมื่อไร
      const p2 = (n) => String(n).padStart(2, '0');
      const d = new Date();
      const name = `CreditFacility_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.xlsx`;
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(t('ดาวน์โหลดไฟล์ Excel แล้ว'));
    } catch (e) {
      toast.error(`${t('ส่งออกไม่สำเร็จ')}: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  // แผนการเงินกับหักค่างานตามจริงใช้จอเดียวกัน ต่างกันที่ฉบับไหนเท่านั้น
  const TabComp = {
    facilities: FacilitiesTab, ledger: LedgerTab, costs: CostSummaryTab,
    cashplan: CashPlanTab, actual: CashPlanTab, variance: VarianceTab,
  }[tab] || FacilitiesTab;

  const bg = byType.BG;
  // คำอธิบายกล่อง BG กางให้เห็นว่ามาจากค้ำประกันใบไหนบ้าง — ยอดรวมเพียว ๆ
  // กระทบยอดกับหนังสือธนาคารไม่ได้
  const bgTip = (bg?.parts || []).length
    ? bg.parts.map((p) => `• ${PART_SHORT[p.no] || p.name}: ${t('คงเหลือ')} ${formatMoney(p.limit - p.used)}`
      + ` (${t('ใช้')} ${p.limit > 0 ? Math.min(100, Math.round((p.used / p.limit) * 100)) : (p.used > 0 ? 100 : 0)}%)`).join('\n')
    : t('ดูรายละเอียดวงเงิน BG');

  const showLines = (sec) => (sec === 'lt'
    ? prefs.lines.tl || prefs.lines.bg || prefs.lines.ml
    : prefs.lines.be || prefs.lines.pn);
  const showDue = prefs.due.week || prefs.due.this || prefs.due.next;
  const showStatusCards = prefs.status.new || prefs.status.proposed || prefs.status.approved;
  // แถบตัวกรองใช้กับสองแท็บที่เป็นตาราง ส่วนแท็บวางแผน/สรุปเป็นภาพรวมทั้งพอร์ต
  // ไม่มีอะไรให้กรอง — ระบบจริงซ่อนแถบทั้งแถบบนแท็บพวกนั้น (setView: showBar)
  const showBar = tab === 'facilities' || tab === 'ledger';

  return (
    <div className="space-y-5">
      <CreditHeader onSettings={() => setShowSettings(true)} />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{t(error)}</div>}

      {empty && (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
            <Icon name="card" className="h-6 w-6" />
          </span>
          <div>
            <h3 className="font-bold text-slate-800">{t('ยังไม่มีวงเงินสินเชื่อในระบบ')}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {t('เริ่มจากเพิ่มวงเงินที่ธนาคารอนุมัติให้แต่ละโครงการ แล้วจึงบันทึกการเบิกใช้ — ยอดคงเหลือและรายการครบกำหนดจะคำนวณให้เอง')}
            </p>
          </div>
          <button onClick={() => { setTab('facilities'); setOpenNew((n) => n + 1); }} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มวงเงินแรก')}
          </button>
        </div>
      )}

      {/* headline cards — เปิด-ปิดรายพาเนลได้ในจอตั้งค่า */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CardGroup title={t('วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)')} cols={3} show={showLines('lt')}>
          {/* ป้ายกล่องใช้ doc_kind ของทะเบียนประเภทวงเงิน ไม่ใช่ข้อความที่พิมพ์ไว้เอง */}
          {prefs.lines.tl && (
            <FacilityStat label="T/L" item={byType['T/L']} accent="#7FB069"
              tip={t('ดูรายละเอียดวงเงิน T/L')} onOpen={() => openFacilities('4')} />
          )}
          {prefs.lines.bg && (
            <FacilityStat label="BG" item={bg} accent="#B59FD6" tip={bgTip} onOpen={() => openFacilities(GROUP_BG)} />
          )}
          {prefs.lines.ml && (
            <FacilityStat label="M/L" item={byType['M/L']} accent="#9CCB7A"
              tip={t('ดูรายละเอียดวงเงิน M/L')} onOpen={() => openFacilities('8')} />
          )}
        </CardGroup>
        <CardGroup title={t('วงเงินสินเชื่อ (วงเงินหมุนเวียน)')} show={showLines('rev')}>
          {prefs.lines.be && (
            <FacilityStat label="B/E" item={byType['B/E']} accent="#F0A95F"
              tip={t('ดูรายละเอียดวงเงิน B/E (รวม L/G วัสดุ/สาธารณูปโภค + DLC + PN-post)')}
              onOpen={() => openFacilities(GROUP_BE)} />
          )}
          {prefs.lines.pn && (
            <FacilityStat label="P/N" item={byType['P/N']} accent="#6FC1E0"
              tip={t('ดูรายละเอียดวงเงิน P/N')} onOpen={() => openFacilities('7')} />
          )}
        </CardGroup>
        {showDue && (
          <div className="card">
            <h3 className="mb-3 font-bold text-slate-800">{t('ครบกำหนด')}</h3>
            <div className={`grid gap-3 ${colsFor([prefs.due.week, prefs.due.this, prefs.due.next].filter(Boolean).length)}`}>
              {/* "ครบใน 7 วัน" เป็นกลุ่มซ้อน ไม่ได้แย่งรายการกับเดือนนี้ */}
              {prefs.due.week && (
                <BucketStat label={t('ครบกำหนด — ภายใน 1 สัปดาห์')} bucket={overview?.buckets?.due7} accent="#E89A3C"
                  tip={t('ดูรายการครบกำหนดใน 7 วัน')} onOpen={() => openLedger({ due: 'due7' })} />
              )}
              {prefs.due.this && (
                <BucketStat
                  label={t('ครบกำหนด — เดือนนี้')} bucket={overview?.buckets?.thisMonth} accent="#F2D04A"
                  tip={t('ดูรายการครบกำหนดเดือนนี้')}
                  extra={overview?.buckets?.overdue?.amount
                    ? `${t('เกินกำหนดค้าง')} ${formatMoney(overview.buckets.overdue.amount)}` : ''}
                  onOpen={() => openLedger({ due: 'thisMonth' })} />
              )}
              {prefs.due.next && (
                <BucketStat label={t('ครบกำหนด — เดือนหน้า')} bucket={overview?.buckets?.nextMonth} accent="#E37D7D"
                  tip={t('ดูรายการครบกำหนดเดือนหน้า')} onOpen={() => openLedger({ due: 'nextMonth' })} />
              )}
            </div>
            {overview?.buckets?.overdue?.count ? (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {t('เกินกำหนด')} {overview.buckets.overdue.count} {t('รายการ')} · {formatMoney(overview.buckets.overdue.amount)}
                {overview.overdueInterest ? ` · ${t('ดอกเบี้ยเกินกำหนด')} ${formatMoney(overview.overdueInterest)}` : ''}
                {/* วงเงินที่หนังสือธนาคารเขียนว่า MLR ไม่มีตัวเลขให้คูณ — ปัดเป็น ฿0
                    จะอ่านเหมือนไม่มีดอกเบี้ยค้าง ซึ่งเป็นเงินจริงที่หายไปจากสายตา */}
                {overview.overdueRateUnknown ? (
                  <span title={t('อัตราดอกเบี้ยของวงเงินนี้ไม่ได้ระบุเป็นตัวเลข (เช่น MLR)')}>
                    {' · '}{overview.overdueRateUnknown} {t('รายการ')}{' '}{t('ระบุอัตราไม่ได้')}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        {showStatusCards && (
          <div className="card">
            <h3 className="mb-3 font-bold text-slate-800">{t('สถานะ')}</h3>
            <div className={`grid gap-3 ${colsFor([prefs.status.new, prefs.status.proposed, prefs.status.approved].filter(Boolean).length)}`}>
              {/* นับจำนวน + ยอดเงินตามสถานะของรายการ เหมือนการ์ดสถานะของระบบจริง */}
              {prefs.status.new && (
                <StatusStat label={t('คำขอใหม่')} count={overview?.newCount} amount={overview?.newAmount} accent="#6CA0F0"
                  tip={`${t('ดูรายการสถานะ')} ${t('คำขอใหม่')}`} onOpen={() => openLedger({ status: 'คำขอใหม่' })} />
              )}
              {/* คำขอที่รออนุมัติของเราอยู่คนละตารางกับรายการที่บันทึกแล้ว การ์ดนี้
                  จึงเปิดคิวอนุมัติ ซึ่งเป็นที่ที่ตัวเลขบนการ์ดมาจากจริง ๆ และเป็นที่
                  ที่กดอนุมัติได้ ไม่ใช่พาไปตารางที่นับไม่ครบ */}
              {prefs.status.proposed && (
                <StatusStat label={t('อยู่ระหว่างเสนออนุมัติ')} count={overview?.pendingCount} amount={overview?.pendingAmount}
                  accent="#E0B341" tip={`${t('ดูรายการสถานะ')} ${t('อยู่ระหว่างเสนออนุมัติ')}`}
                  onOpen={() => setShowRequests(1)} />
              )}
              {prefs.status.approved && (
                <StatusStat label={t('อนุมัติ')} count={overview?.approvedCount} amount={overview?.approvedAmount}
                  accent="#5BC279" countClass="text-emerald-600"
                  tip={`${t('ดูรายการสถานะ')} ${t('อนุมัติแล้ว')}`} onOpen={() => openLedger({ status: 'อนุมัติแล้ว' })} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* tabs */}
      {/* หกแท็บไม่พอดีจอโทรศัพท์ — ให้แถบแท็บเลื่อนในตัวเอง ไม่ใช่ดันทั้งหน้า */}
      <div className="flex items-stretch gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((it, i) => (it.divider ? (
          // เส้นคั่นแยกงานสองชนิด: ซ้ายคือทะเบียนวงเงินและรายการจริง ขวาคือการวางแผน
          <span key={`div-${i}`} aria-hidden="true" className="my-2 w-px shrink-0 self-center bg-slate-200" />
        ) : (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === it.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(it.label)}
            {it.en && (lang === 'th' || it.keepEn) ? <span className="font-normal opacity-70"> ({it.en})</span> : null}
          </button>
        )))}
      </div>

      {/* แถบตัวกรองชุดเดียว วางใต้แท็บเหมือนของเขา — ตารางอยู่ถัดลงไป */}
      {showBar && (
        <FilterBar
          filters={filters} onChange={setFilter}
          types={types} companies={companies} projects={projects}
          showStatus={tab === 'ledger'} showAddFacility={tab === 'facilities'}
          pendingCount={overview?.pendingCount || 0} exporting={exporting}
          onAddRequest={() => setShowRequests(2)}
          onAddDrawdown={() => setShowDrawdown(true)}
          onAddFacility={() => { setTab('facilities'); setOpenNew((n) => n + 1); }}
          onExport={handleExport}
        />
      )}

      <TabComp
        key={tab}
        projects={projects}
        filters={filters}
        types={types}
        costCategories={costCategories}
        onChanged={changed}
        openNew={openNew}
        canEdit={overview?.canEdit ?? true}
        kind={tab === 'actual' ? 'actual' : 'plan'}
      />

      {showRequests > 0 && (
        <RequestsPanel
          projects={projects}
          openAdd={showRequests === 2}
          onClose={() => setShowRequests(0)}
          onChanged={changed}
        />
      )}
      {showDrawdown && (
        <DrawdownModal
          facilities={facilities} projects={projects} types={types} costCategories={costCategories}
          onClose={() => setShowDrawdown(false)}
          onSaved={() => { setShowDrawdown(false); changed(); }}
        />
      )}
      {showSettings && (
        <SettingsModal
          prefs={prefs} onSetPanel={setPanel}
          onClose={() => setShowSettings(false)}
          onCategoriesSaved={() => { setCostCategories([]); creditApi.costCategories().then((r) => setCostCategories(r.data || [])).catch(() => {}); changed(); }}
        />
      )}
    </div>
  );
}
