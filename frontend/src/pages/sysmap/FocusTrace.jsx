import { useEffect, useMemo, useRef, useState } from 'react';
import {
  pick, deptOf, CANVAS, onColor, DIRECT_COLOR, INDIRECT_COLOR, FEEDBACK_COLOR,
} from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import LangToggle from '../../components/LangToggle.jsx';
import { useT } from '../../lib/i18n.jsx';
import { layoutTrace, MAX_HOPS, GEO } from './trace.js';

/**
 * ไล่เส้นทางของกล่องงานหนึ่ง — ผังเชิงเส้น
 *
 * The question people actually bring to a swimlane of ten lanes and 129 lines is
 * never "show me everything"; it is "where does THIS come from and where does it
 * go". The big map answers that by lighting one box's own edges, which is one hop.
 * This answers it to the end of the line: the focused box in the middle, whatever
 * flows into it stacked to the left, whatever it feeds to the right, up to five
 * hops each way, and click any box on the way to carry on from there.
 *
 * Behaviour is their Trace overlay's, not their stylesheet's — same five-hop cap,
 * same seven-step click history (a re-visited step MOVES to the end rather than
 * truncating what follows it; see pushTrail), same "click any box to re-trace",
 * same hover-to-isolate-one-box's-lines. The colours are ours, from the legend
 * under the big map, so one vocabulary covers both views: solid blue = เส้นตรง,
 * dashed amber = มีเงื่อนไข, dashed gold = เส้นย้อนกลับ.
 */
export default function FocusTrace({
  focusId, trail, lanes, nodes, conns, depts, lang, aiByNode = [],
  onFocus, onBack, onShowOnMap, onClose,
}) {
  const t = useT();
  const scrollRef = useRef(null);
  const [hover, setHover] = useState(null);

  const plan = useMemo(
    () => layoutTrace({ lanes, nodes, conns, focusId }),
    [lanes, nodes, conns, focusId]
  );
  const aiNodes = useMemo(
    () => new Set(aiByNode.filter((a) => a.node_id).map((a) => a.node_id)),
    [aiByNode]
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // เปิดมาแล้วต้องเห็นกล่องที่กำลังไล่ทันที พร้อมทางเข้าหนึ่งคอลัมน์ทางซ้ายให้รู้ว่า
  // มีของอยู่ทางนั้น — ผังกว้างกว่าจอเสมอ ถ้าไม่เลื่อนให้ ผู้อ่านจะเห็นแต่ขอบซ้ายว่าง
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !plan) return;
    const me = plan.boxes.find((b) => b.isFocus);
    if (!me) return;
    const id = requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, me.x - (GEO.COLW + 24));
      el.scrollTop = Math.max(0, me.y - 24);
    });
    return () => cancelAnimationFrame(id);
  }, [plan, focusId]);

  if (!plan) return null;

  const focusNode = byId.get(focusId);
  const label = (n) => pick(lang, n?.label_th, n?.label_en).replace(/\n/g, ' ');
  const edgeColor = (e) => (e.fb ? FEEDBACK_COLOR : e.cond ? INDIRECT_COLOR : e.hot ? DIRECT_COLOR : '#334155');

  /** เส้นและกล่องที่เกี่ยวกับกล่องที่ชี้อยู่ — ชี้แล้วเหลือเฉพาะเส้นของกล่องนั้น */
  const linked = useMemo(() => {
    if (!hover) return null;
    const ids = new Set([hover]);
    for (const e of plan.edges) {
      if (e.a === hover) ids.add(e.b);
      if (e.b === hover) ids.add(e.a);
    }
    return ids;
  }, [hover, plan]);

  const headBtn = 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition';

  return (
    <div
      data-trace-layer="1"
      data-surface="dark" className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#0a0f1e', color: CANVAS.text }}
    >
      {/* หัวแถบ — ชื่อกล่องที่กำลังไล่ แล้วปุ่มทางขวา บนจอแคบให้ห่อลงบรรทัดใหม่ได้
          ไม่ใช่ดันปุ่มออกนอกจอ */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5"
        style={{ borderColor: CANVAS.border }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon name="flow" className="h-4 w-4 shrink-0" style={{ color: '#fbbf24' }} />
            <h2 className="min-w-0 truncate text-[15px] font-bold" style={{ color: CANVAS.text }}>
              {label(focusNode)}
            </h2>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: CANVAS.faint }}>
            {t('เส้นทางเข้าและออกทั้งหมด · กดกล่องไหนก็ไล่ต่อจากกล่องนั้น')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* สลับภาษาได้ทั้งที่ผังไล่เส้นทางกางอยู่ — ชั้นนี้กางเต็มจอ ปุ่มภาษาของ
              หน้าจึงอยู่ข้างใต้และกดไม่ถึง ของเขาชั้น focus เริ่มใต้แถบหัวพอดี
              ปุ่มภาษาบนแถบหัวจึงยังกดได้ตลอด ผลลัพธ์ต้องเท่ากัน */}
          <LangToggle dark />
          {/* ย้อนกลับไปกล่องที่ไล่ก่อนหน้านี้ — ของเขาต้องกดที่ขั้นในแถบ breadcrumb
              เท่านั้น ซึ่งบนโทรศัพท์แถบนั้นเลื่อนหลุดไปทางซ้ายจนกดไม่ถึง */}
          {trail.length > 1 && (
            <button type="button" onClick={onBack} className={headBtn}
              style={{ borderColor: CANVAS.border, color: CANVAS.muted }}>
              <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {t('ย้อนกลับ')}
            </button>
          )}
          <button type="button" onClick={onShowOnMap} className={headBtn}
            style={{ borderColor: CANVAS.border, color: CANVAS.muted }}>
            <Icon name="layers" className="h-3.5 w-3.5" /> {t('แสดงบนผังใหญ่')}
          </button>
          <button type="button" onClick={onClose} className={headBtn}
            style={{ borderColor: CANVAS.border, color: CANVAS.muted }}>
            <Icon name="x" className="h-3.5 w-3.5" /> {t('ปิด')}
          </button>
        </div>
      </div>

      {/* ขั้นที่ไล่มา — ขวาสุดคือกล่องที่กำลังดู เก็บไว้เจ็ดขั้นล่าสุด */}
      <nav aria-label={t('ขั้นที่ไล่มา')}
        className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b px-4 py-1.5 text-xs"
        style={{ borderColor: CANVAS.border }}>
        {trail.map((id, i) => {
          const n = byId.get(id);
          if (!n) return null;
          const cur = id === focusId;
          return (
            <span key={id} className="flex shrink-0 items-center">
              {i > 0 && <span className="px-0.5" style={{ color: CANVAS.faint }}>›</span>}
              <button type="button" data-crumb={id} disabled={cur}
                onClick={() => !cur && onFocus(id)}
                className={`max-w-[46vw] truncate rounded-md border px-2 py-1 transition sm:max-w-none ${
                  cur ? 'cursor-default border-transparent font-bold' : 'border-transparent hover:bg-white/5'}`}
                style={{ color: cur ? '#fbbf24' : CANVAS.muted }}>
                {label(n)}
              </button>
            </span>
          );
        })}
      </nav>

      {/* ผืนผัง — เลื่อนอยู่ในกรอบนี้เท่านั้น หน้าเว็บด้านหลังไม่เลื่อนซ้ายขวาตาม */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        {plan.isolated ? (
          /* กล่องที่ไม่มีเส้นเชื่อมเข้าหรือออกเลย ระบบจริงขึ้นกล่องเดียวโดด ๆ บนพื้น
             ว่างไม่บอกอะไร ซึ่งอ่านได้ว่าโปรแกรมค้าง — บอกไปตรง ๆ ว่าไม่มีเส้นทาง */
          <div className="px-4 py-4">
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm"
              style={{ borderColor: CANVAS.border, background: CANVAS.panelSoft, color: CANVAS.muted }}>
              {t('กล่องนี้ไม่มีเส้นเชื่อมเข้าหรือออก จึงไม่มีเส้นทางให้ไล่')}
            </p>
          </div>
        ) : null}
        <div className="relative" style={{ width: plan.W, height: plan.H, minWidth: '100%' }}>
          <svg width={plan.W} height={plan.H} className="pointer-events-none absolute left-0 top-0"
            style={{ overflow: 'visible' }} aria-hidden="true">
            <defs>
              {[['tr-a', '#334155'], ['tr-hot', DIRECT_COLOR], ['tr-ind', INDIRECT_COLOR], ['tr-fb', FEEDBACK_COLOR]]
                .map(([id, c]) => (
                  <marker key={id} id={id} markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill={c} />
                  </marker>
                ))}
            </defs>
            {plan.edges.map((e) => {
              const c = edgeColor(e);
              const on = !linked || e.a === hover || e.b === hover;
              const mk = e.fb ? 'tr-fb' : e.cond ? 'tr-ind' : e.hot ? 'tr-hot' : 'tr-a';
              return (
                <path key={`${e.a}>${e.b}`} d={e.d} fill="none" stroke={c}
                  data-edge={`${e.a}>${e.b}`}
                  strokeWidth={on && linked ? e.width + 1.4 : e.width}
                  strokeDasharray={e.fb ? '5 4' : e.cond ? '6 4' : undefined}
                  markerEnd={`url(#${mk})`}
                  style={{ opacity: on ? (e.hot || e.fb || linked ? 1 : 0.5) : 0.07, transition: 'opacity .12s' }} />
              );
            })}
          </svg>

          {plan.boxes.map((b) => {
            const n = b.node;
            const erp = n.node_type === 'erp';
            const dept = deptOf(depts, n.dept);
            const color = dept?.color || '#334155';
            const ink = erp ? onColor(color) : CANVAS.text;
            const dim = linked && !linked.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                data-trace-node={b.id}
                data-hop={b.hop}
                data-focus={b.isFocus ? '1' : '0'}
                onMouseEnter={() => setHover(b.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(b.id)}
                onBlur={() => setHover(null)}
                onClick={() => !b.isFocus && onFocus(b.id)}
                title={label(n)}
                className="absolute rounded-xl border-2 p-2 text-left transition hover:z-10 hover:scale-[1.04]"
                style={{
                  left: b.x, top: b.y, width: GEO.CW, minHeight: GEO.CH,
                  backgroundColor: erp ? color : CANVAS.panel,
                  color: ink,
                  borderColor: erp ? color : `${color}aa`,
                  borderStyle: erp ? 'solid' : 'dashed',
                  outline: b.isFocus ? '3px solid #fbbf24' : undefined,
                  outlineOffset: 2,
                  opacity: dim ? 0.4 : 1,
                  cursor: b.isFocus ? 'default' : 'pointer',
                }}
              >
                <span className="flex items-start gap-1">
                  <span className="min-w-0 flex-1 whitespace-pre-line text-[12px] font-bold leading-tight">
                    {pick(lang, n.label_th, n.label_en)}
                  </span>
                  {aiNodes.has(b.id) && (
                    <Icon name="chart" className="mt-px h-2.5 w-2.5 shrink-0"
                      style={{ color: erp ? ink : '#c4b5fd' }} title={t('มีโอกาสใช้ AI')} />
                  )}
                </span>
                {pick(lang, n.sub_th, n.sub_en) && (
                  <span className="mt-0.5 block truncate text-[9px]"
                    style={{ color: erp ? `${ink}b3` : CANVAS.muted }}>
                    {pick(lang, n.sub_th, n.sub_en)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* คำอธิบายท้ายแถบ — อย่างของเขา แล้วต่อด้วยสิ่งที่ของเขาไม่ได้บอก: เพดานห้าช่วง
          และเส้นทางตันด้านไหน ซึ่งไม่งั้นผู้อ่านจะคิดว่าผังแสดงไม่ครบ */}
      <div className="shrink-0 border-t px-4 py-2 text-[11px] leading-relaxed"
        style={{ borderColor: CANVAS.border, color: CANVAS.faint }}>
        {t('ผังเชิงเส้น — กล่องที่กำลังไล่ (ขอบเหลือง) พร้อมทุกอย่างที่ไหลเข้า (ซ้าย) และไหลออก (ขวา) ชี้ที่กล่องเพื่อเน้นเฉพาะเส้นของกล่องนั้น')}
        {' '}
        <span data-trace-depth="1">
          {t('ไล่ให้ไม่เกิน {n} ช่วงต่อข้าง', { n: MAX_HOPS })}
        </span>
        {!plan.isolated && plan.maxHop === 0 && (
          <span data-trace-dead="out"> · {t('กล่องนี้เป็นปลายทาง ไม่มีอะไรไหลออกต่อ')}</span>
        )}
        {!plan.isolated && plan.minHop === 0 && (
          <span data-trace-dead="in"> · {t('กล่องนี้เป็นต้นทาง ไม่มีอะไรไหลเข้ามา')}</span>
        )}
      </div>
    </div>
  );
}
