import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { pick } from '../../lib/onboardingProgram.js';
import { useT } from '../../lib/i18n.jsx';
import { chrome } from '../../lib/onboardingChrome.js';

/**
 * ผังองค์กร + โครงสร้างกลุ่มบริษัท — สองมุมมองในหนึ่ง section
 *
 * ตามของเขา: เป็น section เดียว ("Company Structure" ในหน้าแรก) ที่สลับสองมุมมอง
 * ด้วยปุ่มคู่ ไม่ใช่สองหน้าแยก มุมมองแรกเป็น "คนและตำแหน่งภายในวิจิตรภัณฑ์"
 * มุมมองที่สองเป็น "ตำแหน่งของวิจิตรภัณฑ์ในกลุ่มบริษัท" — ถามคนละคำถาม
 *
 * กลไกคลิกของเขาคือ drill-down ในที่: คลิกทีม → รายชื่อไหลลงมาใต้ปุ่มนั้น
 * คลิกคน → หน้าที่ของคนนั้นกางออกใต้ชื่อ ของเราทำแบบเดียวกันด้วย state ไม่ใช่
 * class + max-height เพราะเราไม่ได้ยัด innerHTML เหมือนเขา
 *
 * ชื่อคนทั้ง 184 คนในผังนี้เป็นชื่อสมมติ (ต้นฉบับเขียนไว้ชัดว่าถอดชื่อจริงออก
 * ตามที่ลูกค้าขอ ตำแหน่งยังเป็นของจริง) และเป็นอังกฤษล้วนทั้งในโหมดไทยของเขา —
 * ห้ามแปล ดูเหตุผลเต็มใน Sections.jsx
 */

/** คนหนึ่งคน — คลิกเพื่อกางหน้าที่ออกมาใต้ชื่อ */
function Person({ lang, person, tone = 'office' }) {
  const [open, setOpen] = useState(false);
  const role = pick(lang, person.role, person.role_th);
  const ring = tone === 'offsite' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white';
  return (
    <li className={`rounded-lg border ${ring}`}>
      <button type="button" onClick={() => role && setOpen((v) => !v)}
        aria-expanded={role ? open : undefined}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{person.name}</span>
        {role && <Icon name="chevronDown" className={`h-3 w-3 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && role && (
        <p className="border-t border-slate-100 px-2.5 py-1.5 text-xs leading-relaxed text-slate-500">{role}</p>
      )}
    </li>
  );
}

/** กล่องทีมหนึ่งกล่อง — คลิกหัวเพื่อกางรายชื่อ */
function TeamNode({ lang, node, tone = 'office', forceOpen }) {
  const [open, setOpen] = useState(false);
  const shown = forceOpen ?? open;
  const label = pick(lang, node.label, node.label_th);
  const branches = node.branches || null;
  const count = branches
    ? branches.reduce((a, b) => a + (b.members?.length || 0), 0)
    : (node.members?.length || 0);
  return (
    <div className={`rounded-xl border ${tone === 'offsite' ? 'border-amber-300' : 'border-slate-200'} bg-slate-50/60`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={shown}
        className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span>
        <Icon name="chevronDown" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${shown ? 'rotate-180' : ''}`} />
      </button>
      {shown && (
        <div className="space-y-2 border-t border-slate-200 p-2.5">
          {branches
            ? branches.map((b) => (
              <div key={b.id} className={`rounded-lg border p-2 ${b.offsite ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-xs font-bold text-slate-700">{pick(lang, b.label, b.label_th)}</span>
                  {b.location && <span className="chip bg-amber-100 text-amber-800">{b.location}</span>}
                </div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {(b.members || []).map((m) => (
                    <Person key={m.name + m.role} lang={lang} person={m} tone={b.offsite ? 'offsite' : 'office'} />
                  ))}
                </ul>
              </div>
            ))
            : (
              <ul className="grid gap-1 sm:grid-cols-2">
                {(node.members || []).map((m) => <Person key={m.name + m.role} lang={lang} person={m} tone={tone} />)}
              </ul>
            )}
        </div>
      )}
    </div>
  );
}

/** ฝ่ายบริหารสูงสุด — สามชั้นจริงตามผังของบริษัท ไม่ใช่รายชื่อแบนเหมือนฝ่ายอื่น */
function LeadershipNode({ lang, leadership }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border-2 border-brand/30 bg-brand/5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 px-3 py-2.5">
        <span className="text-sm font-bold text-slate-800">{pick(lang, leadership.label, leadership.label_th)}</span>
        <Icon name="chevronDown" className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-brand/20 p-2.5">
          {(leadership.levels || []).map((lv) => (
            <div key={lv.heading} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-brand">
                {pick(lang, lv.heading, lv.heading_th)}
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {(lv.members || []).map((m) => <Person key={m.name + m.role} lang={lang} person={m} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ไซต์งานหนึ่งโครงการ — สองสายงานที่รายงานไม่เหมือนกัน
 *
 * Site Operations รายงานต่อผู้จัดการโครงการตามลำดับขั้นปกติ ส่วน Site
 * Administration เป็นสายรายงานแบบเมทริกซ์: นั่งอยู่ที่ไซต์ แต่รายงานต่อฝ่ายที่
 * สำนักงานใหญ่ตามหน้าที่ของตัวเอง (hqDept) — ป้าย "Reports to …" จึงต้องขึ้นตาม
 * ฝ่ายนั้น ไม่ใช่ตามผู้จัดการโครงการ
 */
function ProjectNode({ lang, project, deptLabel }) {
  const [open, setOpen] = useState(false);
  const group = (heading, list, withHq) => (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{heading}</div>
      {list.map((d) => (
        <div key={d.label} className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <span className="text-xs font-bold text-slate-700">{pick(lang, d.label, d.label_th)}</span>
            {withHq && d.hqDept && (
              <span className="chip bg-slate-100 text-slate-600">Reports to {deptLabel(d.hqDept)}</span>
            )}
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {[d.lead, ...(d.staff || [])].filter(Boolean).map((m) => (
              <Person key={m.name + m.role} lang={lang} person={m} tone={withHq ? 'office' : 'offsite'} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/40">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{pick(lang, project.label, project.label_th)}</span>
        <Icon name="chevronDown" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-amber-300 p-2.5">
          <ul className="grid gap-1 sm:grid-cols-2">
            <Person lang={lang} person={project.lead} tone="offsite" />
          </ul>
          {group('Site Operations', project.opsDepartments || [], false)}
          {group('Site Administration', project.adminDepartments || [], true)}
        </div>
      )}
    </div>
  );
}

/** การ์ดบริษัทหนึ่งใบในมุมมองโครงสร้างกลุ่ม */
function EntityCard({ lang, entity, emphasis = false, tag }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? 'border-brand/40 bg-brand/5' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2">
        <Icon name="building" className={`mt-0.5 h-4 w-4 shrink-0 ${emphasis ? 'text-brand' : 'text-slate-400'}`} />
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">{pick(lang, entity.label, entity.label_th)}</div>
          {tag && <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tag}</div>}
          {entity.sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{pick(lang, entity.sub, entity.sub_th)}</p>}
        </div>
      </div>
    </div>
  );
}

/** กิจการร่วมค้า — ย่ออยู่แค่รหัสย่อ คลิกจึงเห็นบริษัทที่ร่วมถือหุ้น */
function JvCard({ lang, jv }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">{pick(lang, jv.label, jv.label_th)}</span>
        <Icon name="chevronDown" className={`h-3 w-3 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-slate-100 px-3 py-2">
          {(jv.parents || []).map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
              <Icon name="arrowUp" className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" /> {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrgChart({ lang, section }) {
  const t = useT();
  const d = section.data || {};
  const [view, setView] = useState('chart');
  const [expandAll, setExpandAll] = useState({ office: undefined, sites: undefined });

  const departments = d.departments || [];
  const deptLabel = (id) => {
    const found = departments.find((x) => x.id === id) || (d.administration?.id === id ? d.administration : null);
    return found ? pick(lang, found.label, found.label_th) : id;
  };
  const gs = d.groupStructure || null;
  const family = gs?.familyCompanies || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-800">{pick(lang, section.heading, section.heading_th)}</h3>
        {/* ปุ่มคู่สลับมุมมอง — ทั้งสองมุมมองไม่ได้โหลดใหม่ แค่สลับว่าจะวาดอันไหน */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label={t('มุมมองโครงสร้างบริษัท')}>
          {[['chart', chrome(lang, 'Org Chart')], ['group', chrome(lang, 'Group Structure')]].map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v}
              data-org-view={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm font-semibold transition ${
                view === v ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' && (
        <div className="card space-y-4" data-org-panel="chart">
          {d.chartSubheading && (
            <p className="text-sm text-slate-500">{pick(lang, d.chartSubheading, d.chartSubheading_th)}</p>
          )}
          {d.leadership && <LeadershipNode lang={lang} leadership={d.leadership} />}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-brand">Head Office</span>
              <button type="button"
                onClick={() => setExpandAll((s) => ({ ...s, office: s.office ? undefined : true }))}
                className="text-xs font-semibold text-slate-500 hover:text-brand">
                {expandAll.office ? t('ย่อทั้งหมด') : t('กางทั้งหมด')}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {departments.map((dep) => (
                <TeamNode key={dep.id} lang={lang} node={dep} forceOpen={expandAll.office} />
              ))}
              {d.administration && <TeamNode lang={lang} node={d.administration} forceOpen={expandAll.office} />}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Project Sites</span>
              <span className="text-xs text-slate-400">
                {t('{n} โครงการ', { n: (d.projectManagers?.projects || []).length })}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(d.projectManagers?.projects || []).map((p) => (
                <ProjectNode key={p.id} lang={lang} project={p} deptLabel={deptLabel} />
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'group' && gs && (
        <div className="card space-y-4" data-org-panel="group">
          {d.groupSubheading && (
            <p className="text-sm text-slate-500">{pick(lang, d.groupSubheading, d.groupSubheading_th)}</p>
          )}
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-3">
            {gs.groupName && (
              <div className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                {pick(lang, gs.groupName, gs.groupName_th)}
              </div>
            )}
            {/* ผู้ถือหุ้นอยู่ "เหนือ" วิจิตรภัณฑ์ — เป็นผู้ถือ ไม่ใช่ผู้ถูกถือ */}
            {(gs.shareholders || []).length > 0 && (
              <div className="mx-auto mb-3 max-w-sm space-y-1">
                <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Shareholders
                </div>
                {gs.shareholders.map((s) => <EntityCard key={s.id} lang={lang} entity={s} />)}
              </div>
            )}
            {/* แถวเดียวกัน: บริษัทของตระกูลที่ไม่ได้อยู่ในโครงสร้าง VCB + VCB เอง */}
            <div className="grid gap-2 lg:grid-cols-3">
              {family[0] && <EntityCard lang={lang} entity={family[0]} tag="Family-owned" />}
              {gs.parent && <EntityCard lang={lang} entity={gs.parent} emphasis />}
              {family[1] && <EntityCard lang={lang} entity={family[1]} tag="Family-owned" />}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-brand">
                  {chrome(lang, 'Subsidiaries')}
                </div>
                {(gs.subsidiaries || []).map((s) => (
                  <EntityCard key={s.id} lang={lang} entity={s} tag={chrome(lang, 'Subsidiary')} />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-brand">
                  {chrome(lang, 'Joint Ventures')}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(gs.jvs || []).map((jv) => <JvCard key={jv.id} lang={lang} jv={jv} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
