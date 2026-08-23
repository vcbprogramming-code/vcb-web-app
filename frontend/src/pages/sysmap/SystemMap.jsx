import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sysmapApi, pick, CONN_META } from '../../lib/sysmap.js';
import { PageHeader } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import LaneMap from './LaneMap.jsx';
import NodeDetail from './NodeDetail.jsx';
import FunctionsView from './FunctionsView.jsx';
import AiView from './AiView.jsx';
import EditModal from './EditModal.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * แผนผังระบบ — how the group actually works, as something you can read and click.
 *
 * Three ways in: the process map itself, the register of what each department
 * does, and where automation was judged to pay off. Bilingual because the data
 * carries both languages already and the people who read it work in Thai.
 */
const TABS = [
  { key: 'map', label: 'ผังกระบวนการ', icon: 'flow' },
  { key: 'functions', label: 'ทะเบียนฟังก์ชัน', icon: 'document' },
  { key: 'ai', label: 'โอกาสใช้ AI', icon: 'chart' },
];

export default function SystemMap() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [fns, setFns] = useState(null);
  const [ai, setAi] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(sp.get('tab') || 'map');
  const [lang, setLang] = useState(() => localStorage.getItem('sysmap_lang') || 'th');
  const [dept, setDept] = useState('');
  const [layer, setLayer] = useState('all'); // all | erp | manual
  const [selected, setSelected] = useState(sp.get('node') || null);
  const [edit, setEdit] = useState(null); // { kind, row }

  const load = () => {
    setError(null);
    return Promise.all([sysmapApi.bootstrap(), sysmapApi.functions(), sysmapApi.ai()])
      .then(([b, f, a]) => { setBoot(b.data); setFns(f.data); setAi(a.data); })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem('sysmap_lang', lang); }, [lang]);

  // keep the shared link honest: what you see is what a copied URL reopens
  useEffect(() => {
    const next = {};
    if (tab !== 'map') next.tab = tab;
    if (selected) next.node = selected;
    setSp(next, { replace: true });
  }, [tab, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const node = useMemo(
    () => (boot && selected ? boot.nodes.find((n) => n.id === selected) : null),
    [boot, selected]
  );

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}<button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!boot || !fns || !ai) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดแผนผัง…')} /></div>;

  const { depts, modules, lanes, nodes, conns, canEdit, counts } = boot;
  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('แผนผังระบบ')}
        subtitle={`กระบวนการทำงานของกลุ่มบริษัท · ${counts.lanes} เลน · ${counts.nodes} ขั้นตอน · ${counts.conns} เส้นเชื่อม`}
        right={
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
            {[['th', 'ไทย'], ['en', 'EN']].map(([k, l]) => (
              <button key={k} onClick={() => setLang(k)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${lang === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {l}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => { setTab(tab.key); if (tab.key !== 'map') setSelected(null); }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === tab.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon name={tab.icon} className="h-4 w-4" /> {tab.label}
            <span className="ml-1 text-xs text-slate-400">
              {tab.key === 'map' ? counts.nodes : tab.key === 'functions' ? fns.length : ai.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setDept('')} className={chip(dept === '')}>{t('ทุกแผนก')}</button>
            {depts.map((d) => (
              <button key={d.key} onClick={() => setDept(dept === d.key ? '' : d.key)} className={chip(dept === d.key)}>
                {pick(lang, d.name_th, d.name_en)}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {[['all', 'ทั้งหมด'], ['erp', 'เฉพาะที่อยู่ใน ERP'], ['manual', 'เฉพาะที่ทำมือ']].map(([k, l]) => (
              <button key={k} onClick={() => setLayer(k)} className={chip(layer === k)}>{l}</button>
            ))}
            {canEdit && (
              <div className="ml-auto flex gap-2">
                <button onClick={() => setEdit({ kind: 'lane' })} className="btn-outline !py-1.5 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('เลน')}</button>
                <button onClick={() => setEdit({ kind: 'node' })} className="btn-primary !py-1.5 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('กล่องงาน')}</button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {t('กดที่กล่องงานเพื่อดูรายละเอียดและเส้นทางที่เชื่อมกับกล่องนั้น — เส้นทั้ง')} {counts.conns} {t('เส้นถ้าวาดพร้อมกันจะอ่านไม่ออก จึงแสดงเฉพาะของกล่องที่เลือก')}
          </p>

          <LaneMap
            lanes={lanes} nodes={nodes} conns={conns} depts={depts} lang={lang}
            selected={selected} onSelect={setSelected} filterDept={dept} layer={layer}
          />

          {node && (
            <NodeDetail
              node={node} nodes={nodes} conns={conns} depts={depts} modules={modules} lang={lang}
              onSelect={setSelected} onClose={() => setSelected(null)}
              onEdit={canEdit ? (n) => setEdit({ kind: 'node', row: n }) : null}
            />
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{t('ความหมายของเส้น:')}</span>
            {Object.entries(CONN_META).map(([k, m]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: m.color }} /> {m.label}
              </span>
            ))}
          </div>
        </>
      )}

      {tab === 'functions' && (
        <FunctionsView rows={fns} depts={depts} lang={lang} canEdit={canEdit}
          onEdit={(r) => setEdit({ kind: 'fn', row: r })} onNew={() => setEdit({ kind: 'fn' })} />
      )}

      {tab === 'ai' && (
        <AiView rows={ai} lang={lang} canEdit={canEdit}
          onEdit={(r) => setEdit({ kind: 'ai', row: r })} onNew={() => setEdit({ kind: 'ai' })} />
      )}

      {edit && (
        <EditModal
          kind={edit.kind} row={edit.row} lanes={lanes} depts={depts} modules={modules}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); if (edit.row && edit.kind === 'node') setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
