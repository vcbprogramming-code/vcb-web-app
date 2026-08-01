import { useEffect, useState } from 'react';
import { sopApi, toneOf } from '../../lib/sop.js';
import Spinner from '../../components/Spinner.jsx';
import Swimlane from './Swimlane.jsx';

/** Process flows: pick a document on the left, read its swimlane on the right. */
export default function FlowsView({ module }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setErr(null); setList(null);
    return sopApi.flows({ module })
      .then((r) => {
        setList(r.data);
        // keep the current selection when it survives the filter
        setOpenId((prev) => (r.data.some((f) => f.id === prev) ? prev : r.data[0]?.id ?? null));
      })
      .catch((e) => setErr(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [module]);

  if (err) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {err}<button onClick={load} className="ml-2 font-semibold underline">ลองใหม่</button>
      </div>
    );
  }
  if (!list) return <div className="flex justify-center py-12"><Spinner label="กำลังโหลดผังกระบวนการ…" /></div>;
  if (list.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">ยังไม่มีผังกระบวนการในหมวดนี้</p>;
  }

  const flow = list.find((f) => f.id === openId) || list[0];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,300px)_1fr]">
      {/* below xl the sidebar of 33 flows would bury the diagram — pick from a
          dropdown instead */}
      <select value={flow.id} onChange={(e) => setOpenId(e.target.value)} aria-label="เลือกผังกระบวนการ" className="field xl:hidden">
        {list.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.title_th}</option>)}
      </select>

      <div className="hidden max-h-[70vh] space-y-1.5 overflow-y-auto pr-1 xl:block">
        {list.map((f) => (
          <button key={f.id} onClick={() => setOpenId(f.id)}
            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
              flow.id === f.id ? 'border-brand bg-brand-tint' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
            <span className={`chip ${toneOf(f.module)}`}>{f.id}</span>
            <div className="mt-1 text-sm font-medium text-slate-800">{f.title_th}</div>
            {f.title_en && <div className="truncate text-[11px] text-slate-500">{f.title_en}</div>}
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-3">
        <header>
          <span className={`chip ${toneOf(flow.module)}`}>{flow.id}</span>
          <h3 className="mt-2 text-lg font-bold text-slate-800">{flow.title_th}</h3>
          {flow.title_en && <p className="text-sm text-slate-500">{flow.title_en}</p>}
        </header>
        <Swimlane key={flow.id} flow={flow} />
      </div>
    </div>
  );
}
