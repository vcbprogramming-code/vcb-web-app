import { useEffect, useState } from 'react';
import { sopApi } from '../../lib/sop.js';
import { PageHeader } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import ScenariosView from './ScenariosView.jsx';
import FlowsView from './FlowsView.jsx';
import ReportsView from './ReportsView.jsx';

/**
 * Module 5 — SOP (คู่มือปฏิบัติงาน). Three views over the same manual:
 * case studies ("when X, do Y"), swimlane process flows, and the report-menu
 * register. Editors (sop.edit) can maintain all of it in place.
 */
const TABS = [
  { key: 'cases', label: 'กรณีศึกษา', icon: 'document' },
  { key: 'flows', label: 'ผังกระบวนการ', icon: 'flow' },
  { key: 'reports', label: 'เมนูรายงาน', icon: 'chart' },
];

export default function Sop() {
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('cases');
  const [module, setModule] = useState(''); // '' = ทุกหมวด

  const load = () => {
    setError(null);
    return sopApi.bootstrap().then((r) => setBoot(r.data)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-2 font-semibold underline">ลองใหม่</button>
      </div>
    );
  }
  if (!boot) return <div className="flex justify-center py-16"><Spinner label="กำลังโหลดคู่มือ…" /></div>;

  const { modules, meta, counts, canEdit } = boot;
  // the chips filter whatever tab is open, so they count that tab's content
  const perModule = tab === 'flows' ? counts.flows : counts.scenarios;
  const countFor = (code) => perModule[code] || 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={meta?.title || 'คู่มือปฏิบัติงาน (SOP)'}
        subtitle={meta ? `${meta.subtitle || ''} · ${meta.version || ''} · มีผล ${meta.effective || '—'}` : undefined}
      />

      {meta?.purpose && (
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            วัตถุประสงค์ · ขอบเขต · หมายเหตุ
          </summary>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <p className="whitespace-pre-line">{meta.purpose}</p>
            {meta.scope && <p><b>ขอบเขต:</b> {meta.scope}</p>}
            {meta.manual && <p><b>อ้างอิง:</b> {meta.manual}</p>}
            {Array.isArray(meta.notes) && meta.notes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {meta.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        </details>
      )}

      {/* view switch */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => {
            setTab(t.key);
            // don't carry a filter into a tab where that module has nothing
            const next = t.key === 'flows' ? counts.flows : counts.scenarios;
            if (module && !next[module]) setModule('');
          }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            <Icon name={t.icon} className="h-4 w-4" /> {t.label}
            <span className="ml-1 text-xs text-slate-400">
              {t.key === 'cases' ? Object.values(counts.scenarios).reduce((a, b) => a + b, 0)
                : t.key === 'flows' ? Object.values(counts.flows).reduce((a, b) => a + b, 0)
                : counts.reports}
            </span>
          </button>
        ))}
      </div>

      {/* module filter — shared by the case + flow views */}
      {tab !== 'reports' && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setModule('')}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              module === '' ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}>
            ทุกหมวด
          </button>
          {modules.map((m) => {
            const n = countFor(m.code);
            return (
              <button key={m.code} onClick={() => setModule(m.code)} disabled={n === 0}
                title={m.name_th || m.name_th_short}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                  module === m.code ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                }`}>
                {m.code} · {m.name_th_short}
                <span className="ml-1 text-xs opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'cases' && <ScenariosView modules={modules} module={module} canEdit={canEdit} onChanged={load} />}
      {tab === 'flows' && <FlowsView module={module} />}
      {tab === 'reports' && <ReportsView canEdit={canEdit} onChanged={load} />}
    </div>
  );
}
