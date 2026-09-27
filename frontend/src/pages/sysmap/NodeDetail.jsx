import { useEffect, useMemo, useRef, useState } from 'react';
import { pick, connMeta, NODE_KIND, deptOf, CANVAS } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

const IMPACT_TH = { High: 'สูง', Medium: 'ปานกลาง', Low: 'ต่ำ' };

/**
 * What one box is, what it connects to, and whether automation was judged worth
 * it here.
 *
 * Tabbed, the way their panel is. Flat, everything was on screen at once and the
 * description — the part people came for — was pushed under two lists of edges;
 * on a box with a dozen connections it was below the fold.
 */
export default function NodeDetail({
  node, nodes, conns, depts, modules, lang, aiOpp,
  relatedFns = [], relatedForms = [], functionAi = [],
  onSelect, onClose, onEdit, onOpenFunction,
}) {
  const t = useT();
  const [pane, setPane] = useState('steps');
  const boxRef = useRef(null);
  const nameOf = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const aiOf = useMemo(() => new Map(functionAi.map((a) => [a.code, a])), [functionAi]);

  // Their panel is a drawer pinned over the map, so it is in view the moment you
  // click. Ours sits under a map ten lanes tall, which on a laptop means clicking
  // a box looks like it did nothing. Bring the panel to the reader instead.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight - 120 || r.bottom < 0) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [node.id]);
  const dept = deptOf(depts, node.dept);
  const dept2 = node.dept2 ? deptOf(depts, node.dept2) : null;
  const mod = modules.find((m) => m.code === node.module);
  const inn = conns.filter((c) => c.to_node === node.id);
  const out = conns.filter((c) => c.from_node === node.id);
  const items = (lang === 'th' && node.items_th?.length ? node.items_th : node.items_en) || [];

  const tabs = [
    { key: 'steps', label: `${t('ขั้นตอน', null, 'sysmap')} (${items.length})` },
    { key: 'conns', label: t('การเชื่อมต่อ') },
    ...(aiOpp ? [{ key: 'ai', label: t('โอกาส AI') }] : []),
  ];
  // ปิดแท็บ AI ไปแล้วถ้ากล่องใหม่ไม่มีข้อเสนอ — อย่าให้แผงว่างเปล่า
  const active = tabs.some((x) => x.key === pane) ? pane : 'steps';

  const Link = ({ id, c, dir }) => {
    const other = nameOf.get(id);
    const m = connMeta(c.conn_type);
    const otherDept = other ? deptOf(depts, other.dept) : null;
    return (
      <button onClick={() => onSelect(id)}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5">
        <Icon name={dir === 'in' ? 'arrowLeft' : 'arrowRight'} className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
        <span className="min-w-0 flex-1">
          <span className="block whitespace-pre-line text-sm" style={{ color: CANVAS.text }}>
            {other ? pick(lang, other.label_th, other.label_en) : id}
            {otherDept && (
              <span className="ml-1.5 text-[11px]" style={{ color: otherDept.color }}>
                {pick(lang, otherDept.name_th, otherDept.name_en)}
              </span>
            )}
          </span>
          {c.label && <span className="mt-0.5 block text-[11px] leading-relaxed" style={{ color: CANVAS.muted }}>{c.label}</span>}
          <span className="mt-1 inline-flex flex-wrap items-center gap-1">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${m.color}26`, color: m.color }}>{t(m.label)}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
              {dir === 'in' ? t('← เข้า') : t('ออก →')}
            </span>
            {c.feedback && (
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                {t('เส้นย้อนกลับ / วนกลับ')}
              </span>
            )}
          </span>
        </span>
      </button>
    );
  };

  const Stat = ({ label, value, tone }) => (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: CANVAS.border }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: CANVAS.faint }}>{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${tone}`}>{value}</div>
    </div>
  );

  return (
    <aside ref={boxRef} className="space-y-4 rounded-2xl border p-4"
      style={{ borderColor: CANVAS.border, background: CANVAS.panel, color: CANVAS.text }}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {dept && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${dept.color}33`, color: CANVAS.text, border: `1px solid ${dept.color}` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dept.color }} />
                {pick(lang, dept.name_th, dept.name_en)}
              </span>
            )}
            {dept2 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${dept2.color}26`, color: CANVAS.muted, border: `1px solid ${dept2.color}80` }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dept2.color }} />
                {pick(lang, dept2.name_th, dept2.name_en)} · {t('ร่วมตรวจ')}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              node.node_type === 'erp' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
              {t(node.node_type === 'erp' ? NODE_KIND.erp : NODE_KIND.manual)}
            </span>
            {node.at_site && <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-[11px] font-semibold text-orange-200">{t('ทำที่หน้างาน')}</span>}
            {node.unverified && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">{t('ยังไม่ยืนยัน')}</span>}
          </div>
          <h3 className="mt-2 whitespace-pre-line text-lg font-bold leading-snug" style={{ color: CANVAS.text }}>
            {pick(lang, node.label_th, node.label_en)}
          </h3>
          {pick(lang, node.sub_th, node.sub_en) && (
            <p className="text-sm" style={{ color: CANVAS.muted }}>{pick(lang, node.sub_th, node.sub_en)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onEdit && (
            <button onClick={() => onEdit(node)} className="text-sm font-medium text-sky-300 hover:underline">{t('แก้ไข')}</button>
          )}
          <button onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-sm font-medium text-slate-300 transition hover:border-white/60 hover:text-white">
            <Icon name="x" className="h-3.5 w-3.5" /> {t('ปิด')}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-white/15">
        {tabs.map((x) => (
          <button key={x.key} onClick={() => setPane(x.key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition ${
              active === x.key ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
            {x.label}
          </button>
        ))}
      </div>

      {active === 'steps' && (
        <div className="space-y-3">
          {pick(lang, node.desc_th, node.desc_en) && (
            <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: CANVAS.text }}>
              {pick(lang, node.desc_th, node.desc_en)}
            </p>
          )}
          {(mod || dept) && (
            <div className="grid grid-cols-2 gap-2">
              {mod && <Stat label={t('โมดูล')} value={mod.code} tone="text-slate-100" />}
              {dept && <Stat label={t('แผนก')} value={pick(lang, dept.name_th, dept.name_en)} tone="text-slate-100" />}
            </div>
          )}
          {mod && mod.purpose && (
            <p className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{ background: CANVAS.panelSoft, color: CANVAS.muted }}>
              <b style={{ color: CANVAS.text }}>{mod.name}</b> — {mod.purpose}
            </p>
          )}
          {items.length > 0 && (
            <ol className="space-y-1.5 text-sm" style={{ color: CANVAS.text }}>
              {items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/25 text-[10px] font-bold text-emerald-200">{i + 1}</span>
                  <span className="leading-relaxed">{it}</span>
                </li>
              ))}
            </ol>
          )}

          {/* หน้าที่ที่เกี่ยวข้อง — รหัสในทะเบียนที่ทำงานอยู่ในกล่องนี้ กดแล้ว
              เปิดทะเบียนไปที่แถวนั้นเลย เป็นสะพานข้ามระหว่างผังกับทะเบียนที่
              ก่อนหน้านี้ผู้อ่านต้องเดาเอาเองว่าอันไหนคู่กับอันไหน */}
          {relatedFns.length > 0 && (
            <section>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: CANVAS.faint }}>
                {t('หน้าที่ที่เกี่ยวข้อง')}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {relatedFns.map((f) => {
                  const ai = aiOf.get(f.code);
                  return (
                    <button key={f.code} type="button"
                      onClick={() => onOpenFunction?.(f.code)}
                      title={`${pick(lang, f.name_th, f.name_en)}${ai ? ` — AI: ${pick(lang, ai.desc_th, ai.desc_en)}` : ''}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold transition ${
                        ai?.in_registry
                          ? 'border-violet-400/60 bg-violet-400/15 text-violet-200 hover:bg-violet-400/25'
                          : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                      {f.code}
                      {ai?.in_registry && <Icon name="chart" className="h-2.5 w-2.5" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* แบบฟอร์มที่เกี่ยวข้อง — เอกสารหน้างานของแผนกเดียวกับกล่องนี้ */}
          {relatedForms.length > 0 && (
            <section>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: CANVAS.faint }}>
                {t('แบบฟอร์มที่เกี่ยวข้อง')}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {relatedForms.map((d) => (
                  <span key={d.id}
                    title={pick(lang, d.label_th, d.label_en).replace(/\n/g, ' ')}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 bg-cyan-400/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                    {t('เอกสาร')} {d.code}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {active === 'conns' && (
        <div>
          {inn.length === 0 && out.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: CANVAS.muted }}>
              {t('ไม่มีการเชื่อมต่อข้ามสายงาน โหนดนี้เชื่อมตามลำดับภายในเลน')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: CANVAS.faint }}>
                  {t('สิ่งที่ป้อนข้อมูลเข้าโหนดนี้')} ({inn.length})
                </h4>
                {inn.map((c) => <Link key={c.id} id={c.from_node} c={c} dir="in" />)}
              </div>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: CANVAS.faint }}>
                  {t('โหนดนี้เชื่อมไปยัง')} ({out.length})
                </h4>
                {out.map((c) => <Link key={c.id} id={c.to_node} c={c} dir="out" />)}
              </div>
            </div>
          )}
        </div>
      )}

      {active === 'ai' && aiOpp && (
        <div className="space-y-3">
          <div className="rounded-xl border border-violet-400/40 bg-violet-400/10 p-3">
            <h4 className="text-sm font-bold text-violet-100">{pick(lang, aiOpp.title_th, aiOpp.title_en)}</h4>
            {pick(lang, aiOpp.desc_th, aiOpp.desc_en) && (
              <p className="mt-1 text-sm leading-relaxed text-violet-100/85">{pick(lang, aiOpp.desc_th, aiOpp.desc_en)}</p>
            )}
            {aiOpp.tool && (
              <span className="mt-2 inline-block rounded-full border border-violet-400/60 bg-violet-400/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
                {aiOpp.tool}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('ผลกระทบทางธุรกิจ')}
              value={lang === 'th' ? (IMPACT_TH[aiOpp.impact] || aiOpp.impact) : aiOpp.impact}
              tone="text-violet-300" />
            <Stat label={t('ความยากในการนำไปใช้')}
              value={lang === 'th' ? (IMPACT_TH[aiOpp.effort] || aiOpp.effort) : aiOpp.effort}
              tone="text-slate-200" />
          </div>
        </div>
      )}
    </aside>
  );
}
