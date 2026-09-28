import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sysmapApi, pick, SYSMAP_VERSION, SITE_DEPT, CANVAS, onColor, matchesFilters } from '../../lib/sysmap.js';
import { PageHeader } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import LangToggle from '../../components/LangToggle.jsx';
import LaneMap from './LaneMap.jsx';
import NodeDetail from './NodeDetail.jsx';
import FunctionsView from './FunctionsView.jsx';
import AiView from './AiView.jsx';
import DocFlow from './DocFlow.jsx';
import EditModal from './EditModal.jsx';
import FocusTrace from './FocusTrace.jsx';
import { pushTrail } from './trace.js';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * แผนผังการทำงานของระบบ — how the group actually works, as something you can
 * read and click.
 *
 * Three ways in: the process map itself, the register of what each department
 * does, and where automation was judged to pay off. The words on screen are the
 * client's own wherever their live system has a word for the same thing — this
 * map is read in meetings alongside theirs, and two vocabularies for one diagram
 * is a translation exercise nobody asked for.
 *
 * Language follows the app's switch rather than a setting of its own. It used to
 * be local to this page, which meant the data could be in English while every
 * label around it stayed Thai.
 */
const TABS = [
  { key: 'map', label: 'ผังกระบวนการ', icon: 'flow' },
  { key: 'functions', label: 'ทะเบียนฟังก์ชัน', icon: 'document' },
  { key: 'ai', label: 'โอกาสใช้ AI', icon: 'chart' },
];

export default function SystemMap() {
  const t = useT();
  const { lang } = useLang();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [fns, setFns] = useState(null);
  const [ai, setAi] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(sp.get('tab') || 'map');
  const [dept, setDept] = useState('');
  const [layer, setLayer] = useState('all'); // all | erp | manual
  const [onlySite, setOnlySite] = useState(false);
  // ดูทั้งผังทีเดียว หรือไล่ทีละกล่อง — เอกสารข้อกำหนดฟังก์ชันวาดครบทั้ง 129 เส้น
  /**
   * เปิดมาเห็นเส้นเชื่อมทั้งผังเลย เหมือนระบบจริงของเขา
   *
   * ระบบจริงวาด CROSS_CONNS ทุกเส้นทุกครั้งใน drawArrows() การเลือกกล่องเป็นแค่
   * การเน้น/หรี่ ไม่ใช่เงื่อนไขว่าจะวาดหรือไม่วาด · ของเราเคยเริ่มที่ "ไม่วาดเลย
   * จนกว่าจะเลือกกล่อง" สวิตช์ "เส้นตรง / เส้นมีเงื่อนไข" บนแถบตัวกรองจึงกดแล้ว
   * ไม่มีอะไรเกิดขึ้น เพราะยังไม่มีเส้นให้ซ่อนหรือแสดงตั้งแต่แรก
   */
  const [showAll, setShowAll] = useState(true);
  // เส้นตรงกับเส้นมีเงื่อนไขปิดแยกกันได้ อย่างระบบจริง — ผังเต็มอ่านยากเพราะ
  // เส้นเงื่อนไขทับกันเต็มจอ ปิดข้างหนึ่งแล้วอีกข้างอ่านออกทันที
  const [showDirect, setShowDirect] = useState(true);
  const [showIndirect, setShowIndirect] = useState(true);
  // ลิงก์ที่เปิดผังไล่เส้นทางมาเลย ให้กล่องนั้นเป็นกล่องที่เลือกไว้ด้วย อย่าง
  // openFocus ของระบบจริงที่เปิดแผงรายละเอียดควบไปเสมอ — ปิดผังไล่เส้นทางแล้ว
  // ต้องเจอรายละเอียดของกล่องเดิมรออยู่ ไม่ใช่ผังเปล่าที่ไม่รู้ว่าเพิ่งดูอะไรไป
  const [selected, setSelected] = useState(sp.get('node') || sp.get('trace') || null);
  // กดชิปรหัสหน้าที่บนแผงกล่องงานแล้วเปิดทะเบียนไปเน้นแถวนั้น — ส่งรหัสข้ามแท็บ
  const [fnFocus, setFnFocus] = useState('');
  const [edit, setEdit] = useState(null); // { kind, row }
  // ไล่เส้นทางของกล่องหนึ่งเป็นผังเชิงเส้น อย่างปุ่ม Trace ของระบบจริง — traceId คือ
  // กล่องที่กำลังไล่ trail คือขั้นที่กดมา (เจ็ดขั้นล่าสุด ดู pushTrail)
  const [traceId, setTraceId] = useState(sp.get('trace') || null);
  const [trail, setTrail] = useState(sp.get('trace') ? [sp.get('trace')] : []);

  const load = () => {
    setError(null);
    return Promise.all([sysmapApi.bootstrap(), sysmapApi.functions(), sysmapApi.ai()])
      .then(([b, f, a]) => { setBoot(b.data); setFns(f.data); setAi(a.data); })
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  /** เปิดหรือไล่ต่อจากกล่องหนึ่ง — กดกล่องในผังเชิงเส้นแล้วไล่ต่อได้เรื่อย ๆ */
  const openTrace = (id) => {
    if (!id) return;
    setTraceId(id);
    setTrail((cur) => pushTrail(cur, id));
    setSelected(id);
  };
  const closeTrace = () => { setTraceId(null); setTrail([]); };

  // Esc ปิดสิ่งที่เปิดทับอยู่ชั้นในสุดก่อน: ผังไล่เส้นทางกางเต็มจอ ปิดมันก่อนแผง
  // รายละเอียดที่อยู่ข้างใต้ ไม่งั้นกด Esc ทีเดียวปิดทั้งสองชั้นพร้อมกัน
  useEffect(() => {
    if (!selected && !traceId) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (traceId) closeTrace();
      else setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, traceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the shared link honest: what you see is what a copied URL reopens
  useEffect(() => {
    const next = {};
    if (tab !== 'map') next.tab = tab;
    if (selected) next.node = selected;
    if (traceId) next.trace = traceId;
    setSp(next, { replace: true });
  }, [tab, selected, traceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const node = useMemo(
    () => (boot && selected ? boot.nodes.find((n) => n.id === selected) : null),
    [boot, selected]
  );
  /** ข้อเสนอ AI ของกล่องที่เลือก — ผูกด้วย node_id ไม่ใช่เดาจากชื่อ */
  const nodeAi = useMemo(
    () => (ai && selected ? ai.find((a) => a.node_id === selected) || null : null),
    [ai, selected]
  );
  /** หน้าที่ที่เกี่ยวข้อง — รหัสในทะเบียนที่กล่องนี้อ้างถึง ตามลำดับที่เขาเรียงไว้ */
  const relatedFns = useMemo(() => {
    if (!boot || !fns || !selected) return [];
    const byCode = new Map(fns.map((f) => [f.code, f]));
    return (boot.nodeFns || [])
      .filter((r) => r.node_id === selected)
      .map((r) => byCode.get(r.code))
      .filter(Boolean);
  }, [boot, fns, selected]);
  /** แบบฟอร์มที่เกี่ยวข้อง — เขาไม่ได้เก็บเป็นข้อมูล แต่หยิบจากแผนกของกล่อง */
  const relatedForms = useMemo(
    () => (boot && node ? (boot.docNodes || []).filter((d) => d.dept && d.dept === node.dept) : []),
    [boot, node]
  );

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}<button onClick={load} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!boot || !fns || !ai) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดแผนผัง…')} /></div>;

  const { depts, modules, lanes, nodes, conns, canEdit, counts, functionAi = [], docNodes = [] } = boot;
  // ชิปบนแถบตัวกรองอยู่บนพื้นเข้ม จึงเป็นคนละชุดกับชิปในทะเบียนที่ยังสว่าง
  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-white bg-white text-slate-900'
       : 'border-white/20 bg-white/5 text-slate-300 hover:border-white/50 hover:text-white'}`;
  /** ชิปแผนกระบายสีประจำแผนกของตัวเองเสมอ อย่างของเขา — ชิปกับกล่องบนผังจึงเป็น
   *  สีชุดเดียวกัน ที่ยังไม่ได้เลือกจะหรี่ลง ไม่ใช่เปลี่ยนเป็นสีอื่น
   *  สีตัวอักษรคำนวณจากความสว่างของสีแผนก ไม่ได้ฝังขาวไว้ตายตัว (ดู onColor) */
  const deptChip = (d, on) => ({
    className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      on ? 'ring-2 ring-white/80' : 'opacity-75 hover:opacity-100'}`,
    style: { backgroundColor: d.color, borderColor: d.color, color: onColor(d.color) },
  });

  const rowLabel = 'shrink-0 text-[11px] font-semibold uppercase tracking-wider';

  // ตัวกรองที่เปิดอยู่ตรงกับกี่กล่อง — นับด้วยกฎเดียวกับที่ผังใช้หรี่กล่อง
  const anyFilter = Boolean(dept) || onlySite || layer !== 'all';
  const shown = anyFilter ? nodes.filter((n) => matchesFilters(n, { dept, layer, onlySite })).length : nodes.length;
  const clearFilters = () => {
    setDept(''); setOnlySite(false); setLayer('all');
    setShowDirect(true); setShowIndirect(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">System Operating Map</p>
        <PageHeader
          title={t('แผนผังการทำงานของระบบ')}
          subtitle={`${t('กระบวนการทำงานของกลุ่มบริษัท')} · ${counts.lanes} ${t('เลน')} · ${counts.nodes} ${t('ขั้นตอน', null, 'sysmap')} · ${counts.conns} ${t('เส้นเชื่อม')}`}
          right={<LangToggle />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {TABS.map((it) => (
          <button key={it.key} onClick={() => { setTab(it.key); if (it.key !== 'map') { setSelected(null); closeTrace(); } }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === it.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon name={it.icon} className="h-4 w-4" /> {t(it.label)}
            <span className="ml-1 text-xs text-slate-400">
              {it.key === 'map' ? counts.nodes : it.key === 'functions' ? fns.length : ai.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'map' && (
        /* ผืนผังเป็นพื้นเข้มทั้งผืน — แถบตัวกรอง ผัง และแผงรายละเอียดอยู่ในกรอบ
           เดียวกัน อย่างระบบจริง ส่วนที่เหลือของแอปยังเป็นธีมสว่างตามเดิม */
        <div data-surface="dark" className="overflow-hidden rounded-2xl shadow-sm" style={{ background: CANVAS.bg }}>
          <div className="space-y-2 border-b px-3 py-3" style={{ borderColor: CANVAS.border }}>
          {/* เลเยอร์ — ทั้งหมด / ERP / Manual แล้วต่อด้วยสวิตช์ชนิดเส้น */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={rowLabel} style={{ color: CANVAS.faint }}>{t('เลเยอร์')}</span>
            {[['all', 'ทั้งหมด'], ['erp', 'ERP เท่านั้น'], ['manual', 'Manual เท่านั้น']].map(([k, l]) => (
              <button key={k} onClick={() => setLayer(k)} className={chip(layer === k)}>{t(l)}</button>
            ))}
            <span className="mx-1 h-5 w-px bg-white/15" />
            <button onClick={() => setShowDirect((v) => !v)} className={chip(showDirect)}
              title={t('เส้นกระตุ้นและเส้นป้อนข้อมูล')}>
              <span className="mr-1.5 font-mono">—</span>{t('เส้นตรง')}
            </button>
            <button onClick={() => setShowIndirect((v) => !v)} className={chip(showIndirect)}
              title={t('เส้นเลื่อนและเส้นเงื่อนไข')}>
              <span className="mr-1.5 font-mono">╌</span>{t('เส้นมีเงื่อนไข')}
            </button>
            <span className="mx-1 h-5 w-px bg-white/15" />
            <button onClick={() => setShowAll((v) => !v)} className={chip(showAll)}>
              {t('แสดงทุกเส้นเชื่อม')}
            </button>
            {canEdit && (
              <div className="ml-auto flex gap-2">
                <button onClick={() => setEdit({ kind: 'lane' })} className="btn-outline !py-1.5 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('เลน')}</button>
                <button onClick={() => setEdit({ kind: 'node' })} className="btn-primary !py-1.5 !text-sm"><Icon name="plus" className="h-4 w-4" /> {t('กล่องงาน')}</button>
              </div>
            )}
          </div>

          {/* แผนก — สีชิปคือสีที่กล่องงานของแผนกนั้นใช้บนผัง */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={rowLabel} style={{ color: CANVAS.faint }}>{t('แผนก')}</span>
            <button onClick={() => setDept('')} className={chip(dept === '')}>{t('ทุกแผนก')}</button>
            {depts.map((d) => {
              const on = dept === d.key;
              const a = deptChip(d, on);
              return (
                <button key={d.key} onClick={() => setDept(on ? '' : d.key)} className={a.className} style={a.style}>
                  <span className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: on ? '#fff' : d.color }} />
                  {pick(lang, d.name_th, d.name_en)}
                </button>
              );
            })}
            {(() => {
              const a = deptChip(SITE_DEPT, onlySite);
              return (
                <button onClick={() => setOnlySite((v) => !v)} className={a.className} style={a.style}
                  title={t('เฉพาะขั้นตอนที่ทำที่หน้างาน')}>
                  <Icon name="building" className="h-3.5 w-3.5" /> {t('เฉพาะหน้างาน')}
                </button>
              );
            })()}
            {(dept || onlySite || layer !== 'all' || !showDirect || !showIndirect) && (
              /* ล้างทุกอย่างที่ผู้อ่านตั้งไว้ รวมสวิตช์ชนิดเส้นด้วย อย่างปุ่ม ✕ ของเขา —
                 ปิดเส้นไว้แล้วกดล้างตัวกรองแต่เส้นยังไม่กลับมา คือกดแล้วเหมือนไม่ครบ */
              <button onClick={clearFilters}
                title={t('ล้างตัวกรอง')}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-white/50 hover:text-white">
                <Icon name="x" className="h-3.5 w-3.5" /> {t('ล้างตัวกรอง')}
              </button>
            )}
            {/* ป้ายเวอร์ชันชุดข้อมูล — มุมขวาของแถบ อย่างระบบจริง */}
            <span className="ml-auto shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] font-semibold"
              style={{ color: CANVAS.muted }}>
              {SYSMAP_VERSION}
            </span>
          </div>
          </div>

          {/* ผลของตัวกรองเป็นตัวเลข — ผังบอกด้วยความจาง ซึ่งอ่านไม่ออกว่ากรองติดแล้ว
              หรือยัง โดยเฉพาะตอนเลือกกล่องไว้ (ผังจางอยู่ก่อนแล้ว) และถ้ากรองจน
              ไม่เหลือสักกล่อง ผังจะจางทั้งหน้าโดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น */}
          {anyFilter && (
            <p className={`px-4 pt-3 text-xs font-medium ${shown ? '' : 'text-amber-300'}`}
              style={shown ? { color: CANVAS.text } : undefined}>
              {shown
                ? <>{t('ตัวกรองที่เลือกไว้ตรงกับ')} {shown} {t('จาก')} {nodes.length} {t('ขั้นตอน', null, 'sysmap')}</>
                : <>{t('ไม่มีขั้นตอนไหนตรงกับตัวกรองที่เลือกไว้')}{' '}
                  <button onClick={clearFilters} className="underline underline-offset-2 hover:text-white">
                    {t('ล้างตัวกรอง')}
                  </button>
                </>}
            </p>
          )}

          <p className="px-4 pt-3 text-xs" style={{ color: CANVAS.muted }}>
            {showAll
              ? <>{t('กำลังแสดงเส้นเชื่อมทั้งหมด')} {counts.conns} {t('เส้น — กดที่กล่องงานเพื่อเน้นเฉพาะเส้นของกล่องนั้น')}</>
              : <>{t('กดที่กล่องงานเพื่อดูรายละเอียดและเส้นทางที่เชื่อมกับกล่องนั้น หรือกด “แสดงทุกเส้นเชื่อม” เพื่อดูภาพรวมทั้ง')} {counts.conns} {t('เส้นพร้อมกัน')}</>}
          </p>

          {/* จอกว้างวางแผงรายละเอียดไว้ข้างผังแบบลิ้นชักของเขา (sticky ไม่ใช่ overlay
              ลอย จึงไม่ต้องดักโฟกัสหรือล็อกสกรอลล์) จอแคบวางต่อใต้ผังตามเดิม */}
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <LaneMap
                lanes={lanes} nodes={nodes} conns={conns} depts={depts} lang={lang}
                selected={selected} onSelect={setSelected} filterDept={dept} layer={layer}
                onlySite={onlySite} showAll={showAll}
                showDirect={showDirect} showIndirect={showIndirect}
                aiByNode={ai}
              />
            </div>

            <aside className="p-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:border-l"
              style={{ borderColor: CANVAS.border }}>
              {/* แผงขวาของเขาไม่เคยว่างเปล่า — ถ้ายังไม่ได้เลือกกล่อง มันบอกว่ากดได้
                  และกดแล้วจะเห็นอะไร ของเราเคยไม่มีอะไรเลยตรงนี้ */}
              {!node && (
                <div className="flex items-start gap-3 rounded-2xl border border-dashed px-4 py-6"
                  style={{ borderColor: CANVAS.border, background: CANVAS.panelSoft }}>
                  <Icon name="flow" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: CANVAS.faint }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: CANVAS.text }}>{t('คลิกโหนดใดก็ได้')}</p>
                    <p className="mt-0.5 text-sm leading-relaxed" style={{ color: CANVAS.muted }}>
                      {t('ขั้นตอน ERP แสดงรายละเอียดโมดูล และ Manual nodes แสดงงานที่คั่นระหว่าง ERP')}
                    </p>
                  </div>
                </div>
              )}

              {node && (
                <NodeDetail
                  node={node} nodes={nodes} conns={conns} depts={depts} modules={modules} lang={lang}
                  aiOpp={nodeAi} relatedFns={relatedFns} relatedForms={relatedForms} functionAi={functionAi}
                  onSelect={setSelected} onClose={() => setSelected(null)}
                  onTrace={() => openTrace(node.id)}
                  /* กล่องที่เลือกไว้ไม่ถูกปิด — กดกลับมาแท็บผังแล้วยังอยู่ที่เดิม
                     แบบระบบจริงที่ทะเบียนเปิดทับผังไว้ ไม่ได้แทนที่ */
                  onOpenFunction={(code) => { setFnFocus(code); setTab('functions'); }}
                  onEdit={canEdit ? (n) => setEdit({ kind: 'node', row: n }) : null}
                />
              )}
            </aside>
          </div>

          {docNodes.length > 0 && <DocFlow rows={docNodes} depts={depts} lang={lang} />}
        </div>
      )}

      {tab === 'functions' && (
        <FunctionsView rows={fns} depts={depts} lang={lang} canEdit={canEdit} functionAi={functionAi}
          focusCode={fnFocus} onFocusUsed={() => setFnFocus('')}
          onEdit={(r) => setEdit({ kind: 'fn', row: r })} onNew={() => setEdit({ kind: 'fn' })} />
      )}

      {tab === 'ai' && (
        <AiView rows={ai} nodes={nodes} lang={lang} canEdit={canEdit}
          onOpenNode={(id) => { setTab('map'); setSelected(id); }}
          onEdit={(r) => setEdit({ kind: 'ai', row: r })} onNew={() => setEdit({ kind: 'ai' })} />
      )}

      {/* ผังไล่เส้นทาง — กางเต็มจอทับผังใหญ่ อย่างชั้น focus ของระบบจริง กล่องที่
          ไล่อยู่ยังเป็นกล่องที่เลือกไว้ในผังใหญ่ด้วย ปิดแล้วจึงกลับมาเจอที่เดิม */}
      {traceId && nodes.some((n) => n.id === traceId) && (
        <FocusTrace
          focusId={traceId} trail={trail}
          lanes={lanes} nodes={nodes} conns={conns} depts={depts} lang={lang} aiByNode={ai}
          onFocus={openTrace}
          onBack={() => { const prev = trail[trail.length - 2]; if (prev) openTrace(prev); }}
          onShowOnMap={() => {
            const id = traceId;
            closeTrace();
            setSelected(id);
            requestAnimationFrame(() => {
              document.getElementById(`sysmap-node-${id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            });
          }}
          onClose={closeTrace}
        />
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
