import { useEffect, useState, useCallback } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { ememoApi } from '../../lib/ememo.js';
import { PageHeader } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import FacilitiesTab from './FacilitiesTab.jsx';
import LedgerTab from './LedgerTab.jsx';
import CashPlanTab from './CashPlanTab.jsx';
import RequestsPanel from './RequestsPanel.jsx';

const TABS = [
  { key: 'facilities', label: 'วงเงินสินเชื่อ (Facilities)' },
  { key: 'ledger', label: 'รายการสินเชื่อ (Credit Ledger)' },
  { key: 'cashplan', label: 'วางแผนสินเชื่อ (Cash Plan)' },
];

// type → which group it belongs to in the headline cards
const LONG_TERM = ['T/L', 'L/G (BG)', 'LGM (L/G)'];

function FacilityStat({ label, item }) {
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
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${item.pct >= 90 ? 'bg-red-500' : item.pct >= 70 ? 'bg-amber-400' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, item.pct)}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">ใช้ไปแล้ว {item.pct}% · วงเงิน {formatMoney(item.limit)}</div>
    </div>
  );
}

function BucketStat({ label, bucket, accent }) {
  return (
    <div className="card-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent || 'text-slate-900'}`}>{formatMoney(bucket?.amount || 0)}</div>
      <div className="mt-1 text-[11px] text-slate-400">{bucket?.count || 0} รายการ</div>
    </div>
  );
}

export default function CreditFacility() {
  const [tab, setTab] = useState('facilities');
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [showRequests, setShowRequests] = useState(false);

  const loadOverview = useCallback(() => {
    creditApi.overview().then((r) => setOverview(r.data)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadOverview();
    ememoApi.listProjects().then((r) => setProjects(r.data)).catch(() => {});
  }, [loadOverview]);

  const byType = Object.fromEntries((overview?.byType || []).map((t) => [t.type, t]));

  const handleExport = async () => {
    try {
      const url = await creditApi.exportUrl({});
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  };

  const TabComp = { facilities: FacilitiesTab, ledger: LedgerTab, cashplan: CashPlanTab }[tab];

  return (
    <div className="space-y-5">
      <PageHeader
        title="บริหารวงเงินสินเชื่อโครงการ"
        subtitle="ติดตามวงเงินสินเชื่อทุกโครงการ · Credit Facility Manager"
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRequests(true)} className="btn-outline">
              <Icon name="inbox" className="h-4 w-4" /> คำขอใช้วงเงิน
              {overview?.pendingCount ? (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">{overview.pendingCount}</span>
              ) : null}
            </button>
            <button onClick={handleExport} className="btn-outline">
              <Icon name="download" className="h-4 w-4" /> Export Excel
            </button>
          </div>
        }
      />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* headline cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)</h3>
          <div className="grid grid-cols-2 gap-3">
            <FacilityStat label="T/L" item={byType['T/L']} />
            <FacilityStat label="L/G (BG)" item={byType['L/G (BG)']} />
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">วงเงินสินเชื่อ (วงเงินหมุนเวียน)</h3>
          <div className="grid grid-cols-2 gap-3">
            <FacilityStat label="B/E (AVAL)" item={byType['B/E (AVAL)']} />
            <FacilityStat label="P/N" item={byType['P/N']} />
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">ครบกำหนด</h3>
          <div className="grid grid-cols-2 gap-3">
            <BucketStat label="ครบกำหนด — เดือนนี้" bucket={overview?.buckets?.thisMonth} accent="text-amber-600" />
            <BucketStat label="ครบกำหนด — เดือนหน้า" bucket={overview?.buckets?.nextMonth} />
          </div>
          {overview?.buckets?.overdue?.count ? (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              เกินกำหนด {overview.buckets.overdue.count} รายการ · {formatMoney(overview.buckets.overdue.amount)}
              {overview.overdueInterest ? ` · ดอกเบี้ยเกินกำหนด ${formatMoney(overview.overdueInterest)}` : ''}
            </div>
          ) : null}
        </div>
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">สถานะคำขอ</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">อยู่ระหว่างเสนออนุมัติ</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{overview?.pendingCount || 0} รายการ</div>
              <div className="mt-1 text-[11px] text-slate-400">{formatMoney(overview?.pendingAmount || 0)}</div>
            </div>
            <div className="card-sm">
              <div className="text-xs font-semibold text-slate-500">อนุมัติแล้ว (คำขอ)</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">{overview?.approvedCount || 0} รายการ</div>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TabComp projects={projects} onChanged={loadOverview} />

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
