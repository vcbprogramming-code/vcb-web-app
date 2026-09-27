import { useEffect, useMemo, useState } from 'react';
import { sopApi, toneOf, titlePair, dotOf, FLOW_MODULE_ORDER } from '../../lib/sop.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import Swimlane from './Swimlane.jsx';
import ShareButton from './ShareButton.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/** ผังกระบวนการ: เลือกผังทางซ้าย อ่านผังทางขวา — ค้นหาจากแถบหัวโมดูลอันเดียว */
export default function FlowsView({ module, q = '', sharedId, total, modules = [] }) {
  const t = useT();
  const { lang } = useLang();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  // a ?flow=ID link lands on that diagram; an id that no longer exists just
  // falls through to the first flow rather than showing an empty pane
  const [openId, setOpenId] = useState(sharedId || null);

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

  // ค้นหาในผังทำฝั่งหน้าจอ — ข้อมูลทั้ง 33 ผังโหลดมาแล้วทั้งก้อน
  const shown = useMemo(() => {
    if (!list) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((f) => [
      f.id, f.title_th, f.title_en, (f.narrative || []).join(' '),
      (f.nodes || []).map((n) => n.label).join(' '),
    ].join(' ').toLowerCase().includes(needle));
  }, [list, q]);

  if (err) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {err}<button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!shown) return <div className="flex justify-center py-12"><Spinner label={t('กำลังโหลดผังกระบวนการ…')} /></div>;

  const flow = shown.find((f) => f.id === openId) || shown[0];
  // 33 ผังในรายการเดียวอ่านไม่ออก ระบบจริงคั่นหัวข้อหมวดไว้ตามลำดับที่งานเดินจริง
  // (BD ก่อน เพราะเริ่มจากงบประมาณ) แล้วต่อด้วยหมวดที่ไม่อยู่ในลำดับนั้น
  const nameOf = new Map(modules.map((m) => [m.code, m]));
  const groups = (() => {
    const bucket = new Map();
    for (const f of shown) {
      if (!bucket.has(f.module)) bucket.set(f.module, []);
      bucket.get(f.module).push(f);
    }
    const codes = [
      ...FLOW_MODULE_ORDER.filter((c) => bucket.has(c)),
      ...[...bucket.keys()].filter((c) => !FLOW_MODULE_ORDER.includes(c)),
    ];
    return codes.map((c) => ({ code: c, mod: nameOf.get(c), items: bucket.get(c) }));
  })();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-lg font-bold text-slate-800">
          <Icon name="flow" className="h-5 w-5 text-slate-400" /> {t('ผังกระบวนการ · Process Flows')}
          <span className="text-sm font-normal text-slate-500">
            · {t('แสดง {n} จาก {total} ผัง', { n: shown.length, total: total ?? shown.length })}
          </span>
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {t('แผนผังขั้นตอนการทำงานในระบบ ERP แยกตามโมดูล เลือกผังจากรายการเพื่อดูลำดับขั้นตอนและผู้รับผิดชอบในแต่ละขั้น')}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          {t('ไม่พบรายการที่ค้นหา')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {/* below xl the sidebar of 33 flows would bury the diagram — pick from a
              dropdown instead */}
          <select value={flow.id} onChange={(e) => setOpenId(e.target.value)} aria-label={t('เลือกผังกระบวนการ')} className="field xl:hidden">
            {shown.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.title_th}</option>)}
          </select>

          <div className="hidden max-h-[74vh] space-y-1.5 overflow-y-auto pr-1 xl:block">
            {groups.map((g) => (
              <div key={g.code} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotOf(g.code)}`} />
                  {g.code} · {g.mod?.name_th_short || ''}
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                {g.items.map((f) => {
                  const name = titlePair(lang, f.title_th, f.title_en);
                  return (
                    <button key={f.id} onClick={() => setOpenId(f.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        flow.id === f.id ? 'border-navy ring-1 ring-navy/30' : 'border-slate-200 hover:border-slate-300'
                      } bg-white`}>
                      <span className={`chip font-semibold ${toneOf(f.module)}`}>{f.id}</span>
                      <div className="mt-1 text-sm font-bold leading-snug text-slate-800">{name.primary}</div>
                      {name.secondary && <div className="truncate text-[11px] text-slate-500">{name.secondary}</div>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <span className={`chip font-semibold ${toneOf(flow.module)}`}>{flow.id}</span>
                {(() => {
                  const name = titlePair(lang, flow.title_th, flow.title_en);
                  return (
                    <>
                      <h3 className="mt-2 text-lg font-bold text-slate-800">{name.primary}</h3>
                      {name.secondary && <p className="text-sm text-slate-500">{name.secondary}</p>}
                    </>
                  );
                })()}
              </div>
              <ShareButton param="flow" value={flow.id} className="shrink-0" />
            </header>
            <Swimlane key={flow.id} flow={flow} />
          </div>
        </div>
      )}
    </div>
  );
}
