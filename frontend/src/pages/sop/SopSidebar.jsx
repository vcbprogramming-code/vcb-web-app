import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { dotOf, FLOW_MODULE_ORDER } from '../../lib/sop.js';
import { useT } from '../../lib/i18n.jsx';

/**
 * หัวกลุ่มเมนู: ไอคอน ชื่อไทยตัวหนา คำบรรยายบรรทัดล่าง จำนวน และลูกศรบอกว่ากางอยู่ไหม
 *
 * ลูกศรหมุนลงเมื่อกางและหมุนไปทางซ้ายเมื่อพับ แบบเดียวกับของเขา — เมนูที่พับได้แต่
 * ไม่มีอะไรบอกสถานะทำให้คนกดหาของที่หายไป
 */
function GroupRow({ icon, title, desc, count, active, open, hasChildren, onClick, attr }) {
  return (
    <button type="button" onClick={onClick} {...attr}
      aria-expanded={hasChildren ? open : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
        active ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}>
      <Icon name={icon} className={`h-4 w-4 shrink-0 ${active ? 'text-white/80' : 'text-slate-400'}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-slate-500'}`}>{desc}</span>
      </span>
      <span className={`flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
      }`}>{count}</span>
      {hasChildren && (
        <Icon name="chevronDown"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'} ${
            active ? 'text-white/70' : 'text-slate-400'}`} />
      )}
    </button>
  );
}

/**
 * แถวหมวดในเมนูย่อย — จุดสีประจำหมวด รหัส ชื่อย่อ และจำนวน
 *
 * หมวดที่ยังไม่มีกรณีก็ยังกดได้ (หรี่ลงเท่านั้น) แบบระบบจริง — เดิมเราปิดปุ่มไว้
 * คนจึงกดเข้าไปดูไม่ได้เลยว่าหมวดนั้นว่าง และไม่มีทางเห็นข้อความ
 * "ยังไม่มีกรณีเฉพาะในหมวดนี้" ที่เขียนไว้
 */
function ModuleRow({ mod, count, active, onClick, attr }) {
  return (
    <button type="button" onClick={onClick} {...attr} data-count={count}
      title={`${mod.name_th || mod.name_th_short}${mod.desc_th ? `\n${mod.desc_th}` : ''}`}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${
        active ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-100'
      } ${count === 0 ? 'opacity-55' : ''}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotOf(mod.code)}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">{mod.code}</span>
        <span className="block truncate text-[11px] leading-tight text-slate-500">{mod.name_th_short}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-slate-400">{count}</span>
    </button>
  );
}

/**
 * เมนูซ้ายของโมดูล — โครงเดียวกับหน้าเว็บที่ลูกค้าใช้อยู่จริง
 *
 * สามกลุ่ม และแต่ละกลุ่มมีรายการหมวดของตัวเอง: "กรณีเฉพาะ" กางเป็น 11 หมวด
 * ส่วน "ผังกระบวนการ" กางเป็นหมวดที่มีผังจริงเท่านั้น (8 หมวด เรียงตามลำดับที่เขา
 * กำหนดไว้ ไม่ใช่ลำดับหมวดของกรณี) เดิมเราใช้รายการหมวดชุดเดียวร่วมกันทั้งสองกลุ่ม
 * ตัวเลขบนชิปจึงเปลี่ยนความหมายเมื่อสลับกลุ่ม และหมวดที่ไม่มีผังขึ้นเลข 0 ค้างไว้
 *
 * ประวัติเวอร์ชันเป็นของระบบเรา วางไว้ท้ายสุดและเห็นเฉพาะผู้มีสิทธิ์แก้ไข
 */
export default function SopSidebar({
  modules, counts, meta, tab, module, canEdit, onPick, onEditMeta,
}) {
  const t = useT();
  // หมวดที่มีผังจริง เรียงตามลำดับของเขา แล้วต่อด้วยหมวดอื่นที่โผล่มาภายหลัง
  const byCode = new Map(modules.map((m) => [m.code, m]));
  const flowMods = [
    ...FLOW_MODULE_ORDER.filter((c) => counts.flows[c] > 0),
    ...Object.keys(counts.flows).filter((c) => counts.flows[c] > 0 && !FLOW_MODULE_ORDER.includes(c)),
  ].map((c) => byCode.get(c)).filter(Boolean);

  // กางได้ทีละกลุ่ม: กลุ่มที่กำลังดูอยู่เท่านั้นที่กางหมวดของตัวเอง และกดหัวกลุ่ม
  // ที่กางอยู่แล้วคือพับเก็บ (ไม่ใช่เปลี่ยนหน้า) เหมือน selectFlows/selectCaseStudies
  // ของเขา · บนโทรศัพท์เปิดมาแบบพับไว้ ไม่ต้องเลื่อนผ่านเมนูทั้งแผงก่อนถึงเนื้อหา
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.matchMedia('(max-width: 1023px)').matches; } catch { return false; }
  });
  const groupClick = (key) => {
    if (tab === key && module === '' && !collapsed) { setCollapsed(true); return; }
    setCollapsed(false);
    onPick(key, '');
  };
  const pickMod = (key, code) => { setCollapsed(false); onPick(key, code); };
  const flowsOpen = tab === 'flows' && !collapsed;
  const casesOpen = tab === 'cases' && !collapsed;
  // หมวดในกลุ่มที่กางอยู่ — บนจอเล็กเรียงสองคอลัมน์แบบของเขา ไม่ใช่รายการยาวแถวเดียว
  const kids = 'grid grid-cols-2 gap-1 lg:block lg:space-y-1 lg:border-l-2 lg:border-slate-100 lg:pl-2 lg:ml-2.5';

  return (
    <aside className="space-y-2">
      {/* ลำดับกลุ่มตามระบบจริงของลูกค้า (build 34 · 2026-08-29): กรณีเฉพาะมาก่อน
          แล้วจึงผังกระบวนการ — สแนปช็อตโค้ดเก่าในรีโปเรียงกลับกัน ของจริงที่เขาใช้
          อยู่ตอนนี้เรียงแบบนี้ ยึดของจริงเป็นหลัก */}
      <GroupRow icon="book" title={t('กรณีเฉพาะ')} desc={t('Case Studies · ตามหมวด')}
        count={counts.scenarioTotal} attr={{ 'data-group': 'cases' }}
        active={tab === 'cases' && module === ''} open={casesOpen} hasChildren
        onClick={() => groupClick('cases')} />

      {casesOpen && (
        <div className={kids}>
          {modules.map((m) => (
            <ModuleRow key={m.code} mod={m} count={counts.scenarios[m.code] || 0}
              attr={{ 'data-mod': m.code }}
              active={tab === 'cases' && module === m.code}
              onClick={() => pickMod('cases', m.code)} />
          ))}
        </div>
      )}

      <GroupRow icon="flow" title={t('ผังกระบวนการ')} desc={t('Process Flow ทุกขั้นตอน')}
        count={counts.flowTotal} attr={{ 'data-group': 'flows' }}
        active={tab === 'flows' && module === ''} open={flowsOpen} hasChildren
        onClick={() => groupClick('flows')} />

      {/* หมวดของผัง — ชุดคนละชุดกับหมวดของกรณี ใช้ data-flowmod เพื่อไม่ให้ทับกัน */}
      {flowsOpen && (
        <div className={kids}>
          {flowMods.map((m) => (
            <ModuleRow key={m.code} mod={m} count={counts.flows[m.code] || 0}
              attr={{ 'data-flowmod': m.code }}
              active={tab === 'flows' && module === m.code}
              onClick={() => pickMod('flows', m.code)} />
          ))}
        </div>
      )}

      <GroupRow icon="document" title={t('วิธีเรียก Report')} desc={t('เมนูเรียกรายงานสำคัญ')}
        count={counts.reports} attr={{ 'data-group': 'reports' }}
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

      {/* ข้อมูลฉบับเอกสาร — ท้ายเมนูเหมือนของเขา พร้อมทางเข้าแก้ไขหัวเอกสารสำหรับผู้แก้ไข */}
      <div className="space-y-0.5 px-2 pt-3 text-[11px] leading-relaxed text-slate-400">
        {meta?.version && <p>{t('เวอร์ชัน:')} {meta.version} · {t('มีผล:')} {meta.effective || '—'}</p>}
        {meta?.scope && <p>{t('ขอบเขต:')} {meta.scope}</p>}
        {meta?.manual && <p>{meta.manual}</p>}
        {canEdit && (
          <button type="button" onClick={onEditMeta}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand">
            <Icon name="edit" className="h-3 w-3" /> {t('แก้ไขหัวเอกสาร')}
          </button>
        )}
      </div>

      <Link to="/" className="inline-flex items-center gap-1.5 px-2 pt-1 text-xs font-medium text-slate-500 hover:text-brand">
        <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {t('กลับไปหน้าหลัก VCB Connect')}
      </Link>
    </aside>
  );
}
