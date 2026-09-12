import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { ememoApi } from '../../lib/ememo.js';
import { PageHeader } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import FacilitiesTab from './FacilitiesTab.jsx';
import LedgerTab from './LedgerTab.jsx';
import CashPlanTab from './CashPlanTab.jsx';
import CostSummaryTab from './CostSummaryTab.jsx';
import VarianceTab from './VarianceTab.jsx';
import RequestsPanel from './RequestsPanel.jsx';
import { useT } from '../../lib/i18n.jsx';

// ลำดับแท็บเดียวกับระบบที่ลูกค้าใช้อยู่ — คนที่ย้ายมาจะหาของเจอที่เดิม
const TABS = [
  { key: 'facilities', label: 'วงเงินสินเชื่อ' },
  { key: 'ledger', label: 'รายการสินเชื่อ' },
  { key: 'costs', label: 'สรุปค่าใช้จ่าย' },
  { key: 'cashplan', label: 'แผนการเงิน' },
  { key: 'actual', label: 'หักค่างานตามจริง' },
  { key: 'variance', label: 'ผลต่าง' },
];

function FacilityStat({ label, item }) {
  const t = useT();
  if (!item) {
    return (
      <div className="card-sm">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-bold text-slate-300">—</div>
      </div>
    );
  }
  return (
    <div className="card-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <Icon name="arrowRight" className="h-4 w-4 text-slate-300" />
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{formatMoney(item.used)}</div>
      {/* กล่องนี้อาจรวมวงเงินหลายประเภทที่ธนาคารให้เป็นก้อนเดียว — บอกว่ามาจากอะไรบ้าง
          ไม่งั้นยอดที่เห็นจะกระทบยอดกับเอกสารธนาคารไม่ได้ */}
      {(item.parts || []).length > 1 && (
        <ul className="mt-1.5 space-y-0.5">
          {item.parts.map((p) => (
            <li key={p.no} className="flex items-baseline justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">{p.name}</span>
              <span className="tabular-nums">{formatMoney(p.used)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${item.pct >= 90 ? 'bg-red-500' : item.pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, item.pct)}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{t('ใช้ไปแล้ว')} {item.pct}{t('% · วงเงิน')} {formatMoney(item.limit)}</div>
    </div>
  );
}

/**
 * การ์ดสรุปที่กดแล้วพาไปดูของจริง
 *
 * ตัวเลขบนการ์ดไม่มีประโยชน์ถ้าคนอ่านตามต่อไม่ได้ว่ามาจากรายการไหน — กดแล้ว
 * เปิดแท็บรายการสินเชื่อพร้อมกรองช่วงเวลานั้นให้เลย เหมือนปุ่ม "ดูรายการ →"
 * ของระบบที่เขาใช้อยู่
 */
function BucketStat({ label, bucket, accent, onOpen, extra }) {
  const t = useT();
  return (
    <div className="card-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent || 'text-slate-900'}`}>{formatMoney(bucket?.amount || 0)}</div>
      <div className="mt-1 text-[11px] text-slate-400">
        {bucket?.count || 0} {t('รายการ')}{extra ? ` · ${extra}` : ''}
      </div>
      {onOpen && (
        <button onClick={onOpen} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline">
          {t('ดูรายการ')} <Icon name="arrowRight" className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function CreditFacility() {
  const t = useT();
  const [tab, setTab] = useState('facilities');
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [showRequests, setShowRequests] = useState(false);
  // set by the empty state so its button opens the add form, not just the tab
  const [openNew, setOpenNew] = useState(0);

  const loadOverview = useCallback(() => {
    creditApi.overview().then((r) => setOverview(r.data)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadOverview();
    ememoApi.listProjects().then((r) => setProjects(r.data)).catch(() => {});
  }, [loadOverview]);

  const byType = Object.fromEntries((overview?.byType || []).map((row) => [row.type, row]));
  // Nothing has been entered yet. Four dashes and a row of ฿0 tell a first-time
  // user nothing about where to start, and Export would hand them an empty file.
  const empty = overview != null && (overview.byType || []).length === 0;

  const handleExport = async () => {
    try {
      const url = await creditApi.exportUrl({});
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  };

  // แผนการเงินกับหักค่างานตามจริงใช้จอเดียวกัน ต่างกันที่ฉบับไหนเท่านั้น
  const TabComp = {
    facilities: FacilitiesTab, ledger: LedgerTab, costs: CostSummaryTab,
    cashplan: CashPlanTab, actual: CashPlanTab, variance: VarianceTab,
  }[tab] || FacilitiesTab;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('บริหารวงเงินสินเชื่อโครงการ')}
        subtitle={t('ติดตามวงเงินสินเชื่อทุกโครงการ · Credit Facility Manager')}
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRequests(true)} className="btn-outline">
              <Icon name="inbox" className="h-4 w-4" /> {t('คำขอใช้วงเงิน')}
              {overview?.pendingCount ? (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">{overview.pendingCount}</span>
              ) : null}
            </button>
            <button onClick={handleExport} disabled={empty} className="btn-outline disabled:opacity-40"
              title={empty ? t('ยังไม่มีวงเงินให้ส่งออก') : t('ดาวน์โหลดวงเงินทั้งหมดเป็นไฟล์ Excel')}>
              <Icon name="download" className="h-4 w-4" /> {t('ส่งออก Excel')}
            </button>
          </div>
        }
      />

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

      {/* headline cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">{t('วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* ป้ายกล่องใช้ doc_kind ของทะเบียนประเภทวงเงิน ไม่ใช่ข้อความที่พิมพ์ไว้เอง */}
            <FacilityStat label="T/L" item={byType['T/L']} />
            <FacilityStat label="BG" item={byType.BG} />
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">{t('วงเงินสินเชื่อ (วงเงินหมุนเวียน)')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FacilityStat label="B/E" item={byType['B/E']} />
            <FacilityStat label="P/N" item={byType['P/N']} />
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">{t('ครบกำหนด')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <BucketStat
              label={t('ครบกำหนด — เดือนนี้')} bucket={overview?.buckets?.thisMonth} accent="text-amber-600"
              extra={overview?.buckets?.overdue?.amount
                ? `${t('เกินกำหนดค้าง')} ${formatMoney(overview.buckets.overdue.amount)}` : ''}
              onOpen={() => setTab('ledger')} />
            <BucketStat label={t('ครบกำหนด — เดือนหน้า')} bucket={overview?.buckets?.nextMonth}
              onOpen={() => setTab('ledger')} />
          </div>
          {overview?.buckets?.overdue?.count ? (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {t('เกินกำหนด')} {overview.buckets.overdue.count} {t('รายการ')} · {formatMoney(overview.buckets.overdue.amount)}
              {overview.overdueInterest ? ` · ${t('ดอกเบี้ยเกินกำหนด')} ${formatMoney(overview.overdueInterest)}` : ''}
            </div>
          ) : null}
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">{t('สถานะคำขอ')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">{t('อยู่ระหว่างเสนออนุมัติ')}</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{overview?.pendingCount || 0} {t('รายการ')}</div>
              <div className="mt-1 text-[11px] text-slate-400">{formatMoney(overview?.pendingAmount || 0)}</div>
            </div>
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">{t('อนุมัติแล้ว (คำขอ)')}</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">{overview?.approvedCount || 0} {t('รายการ')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((it) => (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === it.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(it.label)}
          </button>
        ))}
      </div>

      <TabComp
        projects={projects}
        onChanged={loadOverview}
        openNew={openNew}
        canEdit={overview?.canEdit ?? true}
        kind={tab === 'actual' ? 'actual' : 'plan'}
      />

      {showRequests && (
        <RequestsPanel
          projects={projects}
          onClose={() => setShowRequests(false)}
          onChanged={loadOverview}
        />
      )}
    </div>
  );
}
