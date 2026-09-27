import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  pick, connMeta, CONN_META, FEEDBACK_COLOR, DIRECT_COLOR, INDIRECT_COLOR,
  NODE_KIND, deptOf, CANVAS, onColor,
} from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * The process map: one row per lane, boxes left to right in sequence, drawn on
 * the dark canvas their own system uses.
 *
 * Two ways to read it. Click a box and only its own lines are drawn — what feeds
 * it and what it feeds — which is the question most people bring here. Or turn
 * on "แสดงทุกเส้นเชื่อม" and the whole web of 129 appears at once, the way the
 * reference app draws it, for someone reading the shape of the whole process
 * rather than following one thread.
 *
 * Line style carries meaning, as it does in their system: direct flow is solid
 * and blue, conditional / deferred dashed and amber, and a feedback edge — work
 * going back the way it came — is drawn apart from both, under the row.
 */
export default function LaneMap({
  lanes, nodes, conns, depts, lang, selected, onSelect,
  filterDept, layer, onlySite, showAll, showDirect = true, showIndirect = true, aiByNode = [],
}) {
  const t = useT();
  const wrapRef = useRef(null);
  const boxRefs = useRef(new Map());
  const [edges, setEdges] = useState([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [keyOpen, setKeyOpen] = useState(false);

  const deptMap = useMemo(() => new Map(depts.map((d) => [d.key, d])), [depts]);
  const aiNodes = useMemo(
    () => new Set(aiByNode.filter((a) => a.node_id).map((a) => a.node_id)),
    [aiByNode]
  );
  const byLane = useMemo(() => {
    const m = new Map(lanes.map((l) => [l.id, []]));
    for (const n of nodes) if (m.has(n.lane_id)) m.get(n.lane_id).push(n);
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [lanes, nodes]);

  const dimmed = (n) => (filterDept && n.dept !== filterDept && n.dept2 !== filterDept)
    || (layer !== 'all' && n.node_type !== layer)
    || (onlySite && !n.at_site);

  /** เส้นที่ผู้อ่านปิดไว้ ไม่ต้องวาด */
  const wanted = (c) => {
    if (c.feedback) return showIndirect || showDirect;
    return connMeta(c.conn_type).kind === 'direct' ? showDirect : showIndirect;
  };

  // which boxes are on the selected box's path — used to keep them lit while
  // everything else fades back
  const related = useMemo(() => {
    if (!selected) return null;
    const inn = conns.filter((c) => c.to_node === selected);
    const out = conns.filter((c) => c.from_node === selected);
    return {
      inn, out,
      ids: new Set([selected, ...inn.map((c) => c.from_node), ...out.map((c) => c.to_node)]),
    };
  }, [selected, conns]);

  // Measure after paint: the boxes are laid out by flexbox, so their positions
  // are only known once the browser has done it.
  useLayoutEffect(() => {
    if (!showAll && (!selected || !related)) { setEdges([]); return undefined; }
    const draw = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const w = wrap.getBoundingClientRect();
      setBox({ w: wrap.scrollWidth, h: wrap.scrollHeight });
      const at = (id) => {
        const el = boxRefs.current.get(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left - w.left + wrap.scrollLeft,
          right: r.right - w.left + wrap.scrollLeft,
          top: r.top - w.top + wrap.scrollTop,
          bottom: r.bottom - w.top + wrap.scrollTop,
          mid: r.top - w.top + wrap.scrollTop + r.height / 2,
        };
      };
      const made = [];
      // เส้นที่จะวาด: ทั้งหมด หรือเฉพาะของกล่องที่เลือก
      const list = (showAll ? conns : [...related.inn, ...related.out]).filter(wanted);
      for (const c of list) {
        const from = at(c.from_node);
        const to = at(c.to_node);
        if (!from || !to) continue;
        const meta = connMeta(c.conn_type);
        // leave from whichever side faces the target so lines don't cross the box
        const forward = from.right <= to.left;
        const x1 = forward ? from.right : from.left;
        const x2 = forward ? to.left : to.right;
        const midX = (x1 + x2) / 2;
        let d = `M ${x1} ${from.mid} C ${midX} ${from.mid}, ${midX} ${to.mid}, ${x2} ${to.mid}`;
        if (c.feedback) {
          // วนกลับ: ออกใต้กล่องต้นทาง ลอดใต้แถว แล้วเข้าใต้กล่องปลายทาง — คนละ
          // ทางกับเส้นไปข้างหน้า จะได้ไม่อ่านสลับกัน
          const fx = (from.left + from.right) / 2;
          const tx = (to.left + to.right) / 2;
          const lane = Math.max(from.bottom, to.bottom) + 14;
          d = `M ${fx} ${from.bottom} L ${fx} ${lane} L ${tx} ${lane} L ${tx} ${to.bottom}`;
        }
        made.push({
          id: c.id,
          faded: showAll && selected && c.from_node !== selected && c.to_node !== selected,
          d,
          color: c.feedback ? FEEDBACK_COLOR : meta.color,
          dashed: c.feedback ? '2 4' : (meta.kind === 'indirect' ? '6 5' : undefined),
          label: c.label,
        });
      }
      setEdges(made);
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', draw);
    return () => { ro.disconnect(); window.removeEventListener('resize', draw); };
  }, [selected, related, showAll, showDirect, showIndirect, conns, lanes, nodes, filterDept, layer, onlySite, lang]);

  const KeyRow = ({ mark, children }) => (
    <span className="inline-flex items-center gap-1.5">{mark}{children}</span>
  );
  const line = (color, dash) => (
    <span className="inline-block h-0 w-5 rounded"
      style={{ borderTopWidth: 2, borderTopStyle: dash ? 'dashed' : 'solid', borderTopColor: color }} />
  );

  return (
    <div className="relative">
      {/* พื้นเข้มเป็นของกรอบชั้นนอก ที่นี่โปร่งใส จะได้ไล่เฉดต่อเนื่องกับแถบตัวกรอง
          ผังเลื่อนอยู่ในกรอบความสูงจำกัดอย่างระบบจริง ไม่ใช่ยืดยาวลงไปทั้งหน้า —
          ปุ่มคำอธิบายสัญลักษณ์ที่ปักมุมซ้ายล่างจึงกดถึงเสมอ ไม่ต้องเลื่อนไปสุดผัง
          และเส้นเชื่อมยังวาดในพิกัดของพื้นที่เลื่อน จึงเลื่อนไปพร้อมกล่อง */}
      <div ref={wrapRef} className="relative max-h-[72vh] overflow-auto p-3">
        {edges.length > 0 && (
          <svg className="pointer-events-none absolute left-0 top-0" width={box.w} height={box.h} aria-hidden="true">
            {edges.map((e) => (
              <path key={e.id} d={e.d} fill="none" stroke={e.color}
                strokeWidth={e.faded ? 1 : 2}
                strokeDasharray={e.dashed}
                opacity={e.faded ? 0.18 : 0.85} />
            ))}
          </svg>
        )}

        <div className="relative flex min-w-max flex-col gap-2">
          {lanes.map((lane) => {
            const list = byLane.get(lane.id) || [];
            return (
              <div key={lane.id} className="flex items-stretch gap-3">
                <div className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center rounded-xl px-3 py-2"
                  style={{ background: CANVAS.panelSoft }}>
                  <span className="whitespace-pre-line text-[11px] font-semibold uppercase leading-tight tracking-wide"
                    style={{ color: CANVAS.muted }}>
                    {pick(lang, lane.label_th, lane.label_en)}
                  </span>
                </div>
                <div className="flex gap-3">
                  {list.length === 0 && (
                    <span className="self-center text-xs" style={{ color: CANVAS.faint }}>
                      {t('ยังไม่มีกล่องงานในเลนนี้')}
                    </span>
                  )}
                  {list.map((n) => {
                    const d = deptMap.get(n.dept);
                    const off = dimmed(n) || (related && !related.ids.has(n.id));
                    const isSel = selected === n.id;
                    const erp = n.node_type === 'erp';
                    const color = d?.color || '#475569';
                    // ERP = กล่องทึบสีประจำแผนก · งานด้วยมือ = กรอบเส้นประสีเดียวกัน
                    // บนพื้นเข้ม อย่างระบบจริง แยกออกได้ตั้งแต่ยังไม่อ่านตัวหนังสือ
                    const ink = erp ? onColor(color) : CANVAS.text;
                    const soft = erp ? `${ink}b3` : CANVAS.muted;
                    // สีตัวอักษรตั้งที่ตัวกล่อง ไม่ใช่เฉพาะที่ span ข้างใน — อะไรที่ลืม
                    // ระบุสีจะได้สืบทอดสีที่อ่านออก ไม่ใช่สีเข้มบนพื้นเข้ม
                    const skin = erp
                      ? {
                        backgroundColor: color, color: ink,
                        borderColor: isSel ? '#ffffff' : color, borderStyle: 'solid',
                      }
                      : {
                        backgroundColor: CANVAS.panel, color: ink,
                        borderColor: isSel ? '#ffffff' : `${color}aa`,
                        borderStyle: 'dashed',
                      };
                    return (
                      <button
                        key={n.id}
                        /* ชื่อจุดยึดของกล่องบนผัง — "แสดงบนผังใหญ่" ในผังไล่เส้นทาง
                           เลื่อนหน้ามาหากล่องนี้ด้วย id นี้ */
                        id={`sysmap-node-${n.id}`}
                        ref={(el) => { if (el) boxRefs.current.set(n.id, el); else boxRefs.current.delete(n.id); }}
                        onClick={() => onSelect(isSel ? null : n.id)}
                        aria-pressed={isSel}
                        className={`relative w-[176px] shrink-0 rounded-xl border-2 p-2.5 text-left transition ${
                          isSel ? 'ring-2 ring-white/70' : 'hover:brightness-110'
                        } ${off ? 'opacity-20' : ''}`}
                        style={skin}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 flex-1 whitespace-pre-line text-[13px] font-semibold leading-snug"
                            style={{ color: ink }}>
                            {pick(lang, n.label_th, n.label_en)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {aiNodes.has(n.id) && (
                              <Icon name="chart" className="h-3 w-3" style={{ color: erp ? ink : '#c4b5fd' }}
                                title={t('มีโอกาสใช้ AI')} />
                            )}
                            {n.at_site && (
                              <Icon name="pin" className="h-3 w-3" style={{ color: erp ? ink : '#fb923c' }}
                                title={t('ทำที่หน้างาน')} />
                            )}
                            {erp && (
                              <span className="rounded px-1 py-px text-[9px] font-bold tracking-wide"
                                style={{ backgroundColor: `${ink}26`, color: ink }}>ERP</span>
                            )}
                          </span>
                        </div>
                        {pick(lang, n.sub_th, n.sub_en) ? (
                          <div className="mt-0.5 truncate text-[11px]" style={{ color: soft }}>
                            {pick(lang, n.sub_th, n.sub_en)}
                          </div>
                        ) : (
                          !erp && <div className="mt-0.5 truncate text-[11px]" style={{ color: CANVAS.faint }}>
                            {t(NODE_KIND.manual)}
                          </div>
                        )}
                        {n.dept2 && deptOf(depts, n.dept2) && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px]" style={{ color: soft }}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: erp ? ink : deptOf(depts, n.dept2).color }} />
                            {pick(lang, deptOf(depts, n.dept2).name_th, deptOf(depts, n.dept2).name_en)}
                          </div>
                        )}
                        {n.unverified && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium"
                            style={{ color: erp ? ink : '#fbbf24' }}>
                            <Icon name="warning" className="h-3 w-3" /> {t('ยังไม่ยืนยัน')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* คำอธิบายสัญลักษณ์ — มุมซ้ายล่างของผังอย่างของเขา พับเก็บได้ สีเส้น
          บอกความสัมพันธ์ กล่องทึบ/เส้นประบอกว่าอยู่ใน ERP หรือทำด้วยมือ
          ถ้าไม่บอกไว้ ผู้อ่านต้องเดาจากสีเอง
          วางต่อท้ายผังในสายงานปกติ ไม่ลอยทับ: ผังสูงกว่าจอ ปุ่มที่ปักมุมล่าง
          แบบ absolute จะตกอยู่นอกสายตาและกดไม่ถึงจนกว่าจะเลื่อนสุด */}
      <div className="m-3 inline-block max-w-[min(94%,680px)] rounded-xl border align-top"
        style={{ borderColor: CANVAS.border, background: 'rgba(11,18,32,0.92)' }}>
        <button type="button" onClick={() => setKeyOpen((v) => !v)}
          aria-expanded={keyOpen}
          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: CANVAS.muted }}>
          <Icon name="chevronDown" className={`h-3.5 w-3.5 transition ${keyOpen ? '' : '-rotate-90'}`} />
          {t('คำอธิบายสัญลักษณ์')}
        </button>
        {keyOpen && (
          <div className="space-y-1.5 border-t px-3 py-2 text-[11px]"
            style={{ borderColor: CANVAS.border, color: CANVAS.muted }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium" style={{ color: CANVAS.text }}>{t('ประเภทโหนด')}</span>
              <KeyRow mark={<span className="inline-block h-2.5 w-4 rounded" style={{ background: '#00695C' }} />}>
                {t('ขั้นตอน Mango ERP')}
              </KeyRow>
              <KeyRow mark={<span className="inline-block h-2.5 w-4 rounded border border-dashed"
                style={{ borderColor: CANVAS.muted, background: CANVAS.panel }} />}>
                {t('งานด้วยมือ (ช่องว่าง)')}
              </KeyRow>
              <KeyRow mark={<Icon name="pin" className="h-3 w-3" style={{ color: '#fb923c' }} />}>{t('ทำที่หน้างาน')}</KeyRow>
              <KeyRow mark={<Icon name="warning" className="h-3 w-3" style={{ color: '#fbbf24' }} />}>{t('ยังไม่ยืนยัน')}</KeyRow>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium" style={{ color: CANVAS.text }}>{t('ความหมายของเส้น')}</span>
              {Object.entries(CONN_META).map(([k, m]) => (
                <KeyRow key={k} mark={line(m.color, m.kind === 'indirect')}>{t(m.legend)}</KeyRow>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <KeyRow mark={line(DIRECT_COLOR, false)}>{t('เส้นตรง')}</KeyRow>
              <KeyRow mark={line(INDIRECT_COLOR, true)}>{t('เส้นมีเงื่อนไข')}</KeyRow>
              <KeyRow mark={<Icon name="undo" className="h-3 w-3" style={{ color: FEEDBACK_COLOR }} />}>
                {t('เส้นย้อนกลับ / วนกลับ')}
              </KeyRow>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
