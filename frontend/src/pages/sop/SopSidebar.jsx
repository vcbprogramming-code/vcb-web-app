import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { dotOf } from '../../lib/sop.js';
import { useT } from '../../lib/i18n.jsx';

/** หัวกลุ่มเมนู: ชื่อไทยตัวหนา คำบรรยายอังกฤษบรรทัดล่าง จำนวนอยู่ในวงกลมชิดขวา */
function GroupRow({ title, desc, count, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        active ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-slate-500'}`}>{desc}</span>
      </span>
      <span className={`flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
      }`}>{count}</span>
    </button>
  );
}

/**
 * เมนูซ้ายของโมดูล — โครงเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่จริง
 *
 * กลุ่ม "กรณีเฉพาะ" กางเป็นรายการหมวด (จุดสี + รหัส + ชื่อไทย + จำนวน) ตามด้วย
 * กลุ่มผังกระบวนการและวิธีเรียก Report แล้วปิดท้ายด้วยข้อมูลฉบับเอกสารตัวเล็ก
 * ประวัติเวอร์ชันเป็นของระบบเรา วางไว้ท้ายสุดและเห็นเฉพาะผู้มีสิทธิ์แก้ไข
 */
export default function SopSidebar({
  modules, counts, meta, tab, module, canEdit, onPick,
}) {
  const t = useT();
  const perModule = tab === 'flows' ? counts.flows : counts.scenarios;
  const allCount = tab === 'flows' ? counts.flowTotal : counts.scenarioTotal;

  return (
    <aside className="space-y-2">
      <GroupRow title={t('กรณีเฉพาะ')} desc={t('Case Studies · ตามหมวด')} count={counts.scenarioTotal}
        active={tab === 'cases' && module === ''} onClick={() => onPick('cases', '')} />

      {/* รายการหมวด — ใช้ได้ทั้งมุมมองกรณีเฉพาะและผังกระบวนการ */}
      <div className="space-y-1 pl-1">
        <button type="button" onClick={() => onPick(tab === 'flows' ? 'flows' : 'cases', '')}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${
            module === '' && tab !== 'reports' && tab !== 'versions' ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-100'
          }`}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('ทั้งหมด')}</span>
          <span className="shrink-0 text-xs text-slate-400">{allCount}</span>
        </button>
        {modules.map((m) => {
          const n = perModule[m.code] || 0;
          const on = module === m.code && tab !== 'reports' && tab !== 'versions';
          return (
            <button key={m.code} type="button" disabled={n === 0} data-mod={m.code} data-count={n}
              onClick={() => onPick(tab === 'flows' ? 'flows' : 'cases', m.code)}
              title={`${m.name_th || m.name_th_short}${m.desc_th ? `\n${m.desc_th}` : ''}`}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition disabled:opacity-35 ${
                on ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotOf(m.code)}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">{m.code}</span>
                <span className="block truncate text-[11px] leading-tight text-slate-500">{m.name_th_short}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-400">{n}</span>
            </button>
          );
        })}
      </div>

      <GroupRow title={t('ผังกระบวนการ')} desc={t('Process Flow ทุกขั้นตอน')} count={counts.flowTotal}
        active={tab === 'flows'} onClick={() => onPick('flows', '')} />
      <GroupRow title={t('วิธีเรียก Report')} desc={t('เมนูเรียกรายงานสำคัญ')} count={counts.reports}
        active={tab === 'reports'} onClick={() => onPick('reports', '')} />
      {/* ประวัติเวอร์ชันเป็นของระบบเรา ไม่ใช่ของเขา — เปิดให้เฉพาะผู้แก้ไขคู่มือ */}
      {canEdit && (
        <button type="button" onClick={() => onPick('versions', '')}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
            tab === 'versions' ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}>
          <Icon name="clock" className="h-4 w-4" /> {t('ประวัติเวอร์ชัน')}
        </button>
      )}

      {/* ข้อมูลฉบับเอกสาร — ท้ายเมนูเหมือนของเขา */}
      <div className="space-y-0.5 px-2 pt-3 text-[11px] leading-relaxed text-slate-400">
        {meta?.version && <p>{t('เวอร์ชัน:')} {meta.version} · {t('มีผล:')} {meta.effective || '—'}</p>}
        {meta?.scope && <p>{t('ขอบเขต:')} {meta.scope}</p>}
        {meta?.manual && <p>{meta.manual}</p>}
      </div>

      <Link to="/" className="inline-flex items-center gap-1.5 px-2 pt-1 text-xs font-medium text-slate-500 hover:text-brand">
        <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {t('กลับไปหน้าหลัก VCB Connect')}
      </Link>
    </aside>
  );
}
