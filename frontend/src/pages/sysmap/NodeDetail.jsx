import { useMemo } from 'react';
import { pick, connMeta } from '../../lib/sysmap.js';
import Icon from '../../components/Icon.jsx';

/** What one box is, and what it connects to in both directions. */
export default function NodeDetail({ node, nodes, conns, depts, modules, lang, onSelect, onClose, onEdit }) {
  const nameOf = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const dept = depts.find((d) => d.key === node.dept);
  const mod = modules.find((m) => m.code === node.module);
  const inn = conns.filter((c) => c.to_node === node.id);
  const out = conns.filter((c) => c.from_node === node.id);
  const items = (lang === 'th' && node.items_th?.length ? node.items_th : node.items_en) || [];

  const Link = ({ id, c, dir }) => {
    const other = nameOf.get(id);
    const m = connMeta(c.conn_type);
    return (
      <button onClick={() => onSelect(id)}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
        <Icon name={dir === 'in' ? 'arrowRight' : 'arrowRight'} className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
        <span className="min-w-0">
          <span className="block whitespace-pre-line text-sm text-slate-800">
            {other ? pick(lang, other.label_th, other.label_en) : id}
          </span>
          <span className="text-[11px]" style={{ color: m.color }}>{m.label}{c.label ? ` · ${c.label}` : ''}</span>
        </span>
      </button>
    );
  };

  return (
    <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {dept && (
              <span className="chip" style={{ backgroundColor: `${dept.color}1a`, color: dept.color }}>
                {pick(lang, dept.name_th, dept.name_en)}
              </span>
            )}
            <span className={`chip ${node.node_type === 'erp' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {node.node_type === 'erp' ? 'อยู่ใน ERP' : 'ทำมือ'}
            </span>
            {node.at_site && <span className="chip bg-sky-50 text-sky-700">ทำที่หน้างาน</span>}
            {node.unverified && <span className="chip bg-amber-50 text-amber-700">ยังไม่ยืนยัน</span>}
          </div>
          <h3 className="mt-2 whitespace-pre-line text-lg font-bold leading-snug text-slate-800">
            {pick(lang, node.label_th, node.label_en)}
          </h3>
          {pick(lang, node.sub_th, node.sub_en) && (
            <p className="text-sm text-slate-500">{pick(lang, node.sub_th, node.sub_en)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button onClick={() => onEdit(node)} className="text-sm font-medium text-brand hover:underline">แก้ไข</button>
          )}
          <button onClick={onClose} title="ปิด" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      </header>

      {mod && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <b className="text-slate-700">โมดูล {mod.code}</b> · {mod.name}{mod.purpose ? ` — ${mod.purpose}` : ''}
        </p>
      )}

      {pick(lang, node.desc_th, node.desc_en) && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {pick(lang, node.desc_th, node.desc_en)}
        </p>
      )}

      {items.length > 0 && (
        <section>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">สิ่งที่ทำในขั้นนี้</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            รับงานมาจาก ({inn.length})
          </h4>
          {inn.length === 0
            ? <p className="px-2 text-sm text-slate-400">— เป็นจุดเริ่มต้น</p>
            : inn.map((c) => <Link key={c.id} id={c.from_node} c={c} dir="in" />)}
        </div>
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ส่งงานต่อไปที่ ({out.length})
          </h4>
          {out.length === 0
            ? <p className="px-2 text-sm text-slate-400">— เป็นปลายทาง</p>
            : out.map((c) => <Link key={c.id} id={c.to_node} c={c} dir="out" />)}
        </div>
      </section>
    </aside>
  );
}
