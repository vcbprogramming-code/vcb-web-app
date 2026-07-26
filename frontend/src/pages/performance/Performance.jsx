import { useEffect, useState } from 'react';
import { perfApi } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Spinner, { BusyLabel } from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import EntryView from './EntryView.jsx';
import Dashboard from './Dashboard.jsx';
import WorkIndex from './WorkIndex.jsx';
import SettingsView from './SettingsView.jsx';

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const monthLabel = ({ y, m }) => `${THAI_MONTHS[m - 1]} ${y + 543}`;
const shift = ({ y, m }, delta) => { const d = new Date(y, m - 1 + delta, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };

export default function Performance() {
  const now = new Date();
  const toast = useToast();
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('entry'); // entry | dashboard | index | settings
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [siteKey, setSiteKey] = useState('');
  const [exporting, setExporting] = useState(false);

  const downloadExcel = async () => {
    if (!siteKey) return;
    setExporting(true);
    try {
      const url = await perfApi.exportUrl(siteKey, cur.y, cur.m);
      const a = document.createElement('a');
      a.href = url; a.download = `worklog-${siteKey}-${cur.y}-${String(cur.m).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e.message || 'ส่งออกไม่สำเร็จ'); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    perfApi.bootstrap()
      .then((r) => { setBoot(r); if (r.sites?.length) setSiteKey(r.sites[0].key); if (!r.canEntry) setView('dashboard'); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!boot) return <div className="flex justify-center py-16"><Spinner label="กำลังโหลด…" /></div>;

  const tabs = [
    { key: 'dashboard', label: 'ภาพรวม', show: true },
    { key: 'entry', label: 'บันทึกงาน', show: boot.canEntry },
    { key: 'index', label: 'ทะเบียนงาน', show: boot.isAdmin },
    { key: 'settings', label: 'ตั้งค่า', show: boot.isAdmin },
  ].filter((t) => t.show);

  return (
    <div className="space-y-4">
      <PageHeader
        title="รายงานการปฏิบัติงาน"
        subtitle="บันทึกกิจกรรมงานรายวันของพนักงานแต่ละไซต์ พร้อมภาพรวมความครบถ้วน"
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setCur(shift(cur, -1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><Icon name="arrowLeft" className="h-4 w-4" /></button>
            <span className="chip bg-brand/10 text-brand min-w-[130px] justify-center">{monthLabel(cur)}</span>
            <button onClick={() => setCur(shift(cur, 1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><Icon name="arrowRight" className="h-4 w-4" /></button>
          </div>
        }
      />

      {/* view tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${view === t.key ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {t.label}
          </button>
        ))}
        {/* site picker + export (entry view) */}
        {view === 'entry' && boot.sites.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={downloadExcel} disabled={exporting || !siteKey} className="btn-outline !py-1.5 !text-sm disabled:opacity-50" title="ส่งออกเป็น Excel">
              <BusyLabel busy={exporting} busyText="กำลังส่งออก…"><Icon name="download" className="h-4 w-4" /> Excel</BusyLabel>
            </button>
            <select value={siteKey} onChange={(e) => setSiteKey(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              {boot.sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {view === 'dashboard' && (
        <Dashboard cur={cur} onOpenSite={(key) => { setSiteKey(key); setView('entry'); }} />
      )}

      {view === 'entry' && (
        boot.sites.length === 0
          ? <div className="card text-center text-sm text-slate-400">ยังไม่มีไซต์งานในขอบเขตของคุณ</div>
          : <EntryView siteKey={siteKey} siteName={boot.sites.find((s) => s.key === siteKey)?.name} cur={cur} canEdit={boot.canEntry} isAdmin={boot.isAdmin} />
      )}

      {view === 'index' && <WorkIndex />}

      {view === 'settings' && (
        <SettingsView
          sites={boot.sites}
          onSitesChange={(key, lockDays) => setBoot((b) => ({ ...b, sites: b.sites.map((s) => (s.key === key ? { ...s, lockDays } : s)) }))}
        />
      )}
    </div>
  );
}
