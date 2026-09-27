import { useCallback, useEffect, useMemo, useState } from 'react';
import { creditApi, formatMoney } from '../../lib/modules.js';
import { Modal } from '../../components/ui/index.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';
import { projectLabel } from './shared.jsx';

const NO_CATEGORY = '(ไม่ระบุหมวด)';

/** ป้ายสถานะงบ — ไอคอนเตือนเส้นเดียว ไม่ใช่อีโมจิ */
function StatusChip({ kind, children }) {
  const cls = {
    bad: 'bg-red-50 text-red-700', warn: 'bg-amber-50 text-amber-700',
    muted: 'bg-slate-100 text-slate-600', ok: 'bg-emerald-50 text-emerald-700',
  }[kind] || 'bg-slate-100 text-slate-600';
  const icon = kind === 'bad' || kind === 'warn' ? 'warning' : kind === 'ok' ? 'check' : null;
  return (
    <span className={`chip ${cls}`}>
      {icon && <Icon name={icon} className="mr-1 inline h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/** ป้ายสรุปของกองหนึ่ง (ทั้งพอร์ตหรือรายโครงการ) — ลำดับเดียวกับระบบจริง */
function StatusChips({ over, near, none, ok }) {
  const t = useT();
  if (over || near || none) {
    return (
      <>
        {over > 0 && <StatusChip kind="bad">{over} {t('เกินงบ')}</StatusChip>}
        {near > 0 && <StatusChip kind="warn">{near} {t('ใกล้เต็ม')}</StatusChip>}
        {none > 0 && <StatusChip kind="muted">{none} {t('ยังไม่ตั้งงบ')}</StatusChip>}
      </>
    );
  }
  return ok > 0 ? <StatusChip kind="ok">{t('ในงบ')}</StatusChip> : null;
}

/**
 * ตั้งงบหมวดค่าใช้จ่าย
 *
 * งบที่ตั้งไว้คือตัวเลขจาก cashflow ที่ส่งธนาคารตอนขอวงเงิน — ช่องหมายเหตุมีไว้
 * บอกว่ามาจากเอกสารฉบับไหน ไม่งั้นอีกหกเดือนไม่มีใครตอบได้ว่าเลขนี้มาจากไหน
 *
 * ช่องงบเว้นว่าง = ยกเลิกงบ ไม่ใช่ตั้งเป็นศูนย์ — ศูนย์กับ "ไม่ได้ตั้ง" อ่านต่างกัน
 * บนหน้าสรุป (ศูนย์ทำให้ทุกบาทเกินงบ)
 */
function CapModal({ target, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const [cap, setCap] = useState(target.cap == null ? '' : String(target.cap));
  const [note, setNote] = useState(target.note || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const raw = String(cap).trim();
    const v = raw === '' ? 0 : Number(raw.replace(/,/g, ''));
    if (raw !== '' && (Number.isNaN(v) || v < 0)) { toast.error(t('กรอกงบให้ถูกต้อง')); return; }
    setBusy(true);
    try {
      await creditApi.setCategoryCap({
        projectId: target.projectId, costCategory: target.costCategory,
        cap: v, note: note.trim() || null,
      });
      // งบศูนย์/เว้นว่างคือการล้างงบ ฝั่งเซิร์ฟเวอร์ลบแถวให้ — ข้อความจึงต่างกัน
      toast.success(raw === '' || v === 0 ? t('ยกเลิกงบแล้ว') : t('ตั้งงบแล้ว'));
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={t('ตั้งงบหมวดค่าใช้จ่าย')}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? t('กำลังบันทึก…') : t('บันทึก')}</button>
        </>
      }
    >
      <p className="text-sm text-slate-500">
        <b className="text-slate-700">{target.projectCode}</b> · {target.projectName} · {t('หมวด')}{' '}
        <b className="text-slate-700">{target.costCategory}</b>
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {t('งบประมาณ (บาท)')}{' '}
          <span className="text-xs font-normal text-slate-400">{t('— เว้นว่างเพื่อยกเลิกงบ')}</span>
        </label>
        <input type="number" value={cap} onChange={(e) => setCap(e.target.value)} className="field" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">
          {t('หมายเหตุ (ที่มา / cashflow)')}{' '}
          <span className="text-xs font-normal text-slate-400">{t('— ไม่บังคับ')}</span>
        </label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="field"
          placeholder={t('เช่น cashflow ที่ส่งธนาคารตอนขอวงเงิน')} />
      </div>
    </Modal>
  );
}

/**
 * สรุปค่าใช้จ่าย — เงินที่เบิกไปแล้วเทียบกับงบที่ตั้งไว้
 *
 * งบตั้งเป็นคู่ (โครงการ × หมวดค่าใช้จ่าย) เหมือนระบบที่ลูกค้าใช้อยู่ หมวดที่
 * ยังไม่ได้ตั้งงบไม่ถูกซ่อน เพราะเงินก้อนนั้นออกไปจริงและต้องกระทบยอดได้ —
 * หน้าจอบอกตรง ๆ ว่า "ยังไม่ได้ตั้งงบ" แทนที่จะเว้นว่าง
 *
 * แต่ละโครงการยุบ-กางได้ เพราะพอร์ตมีหลายสิบโครงการ × สิบแปดหมวด กางหมดแล้ว
 * ไม่มีใครหาโครงการของตัวเองเจอ — แถบ meter บนหัวจึงต้องอ่านได้ทั้งที่ยังยุบอยู่
 */
export default function CostSummaryTab({ projects = [], canEdit }) {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [project, setProject] = useState('');
  const [editing, setEditing] = useState(null);   // { projectId, costCategory, cap, note, … }
  const [collapsed, setCollapsed] = useState({}); // project_id → true เมื่อยุบ

  const load = useCallback(() => {
    creditApi.costSummary(project ? { projectId: project } : {})
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(e.message); setData({ projects: [] }); });
  }, [project, toast]);
  useEffect(load, [load]);

  const rows = useMemo(() => data?.projects || [], [data]);

  /** หมวดที่ยังไม่ระบุไม่มีตัวตนให้ตั้งงบ — ต้องแก้ที่คำขอก่อน */
  const openCap = (g, l) => {
    if (l.cost_category === NO_CATEGORY) {
      toast.error(t('รายการกลุ่มนี้ยังไม่ได้ระบุหมวด — แก้คำขอให้กรอกหมวดก่อน แล้วค่อยตั้งงบ'));
      return;
    }
    setEditing({ projectId: g.project_id, projectCode: g.project_code, projectName: g.project_name,
      costCategory: l.cost_category, cap: l.cap, note: l.note ?? '' });
  };

  if (!data) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลด…')} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-2 font-bold text-slate-800">{t('สรุปหมวดค่าใช้จ่าย')}</h3>
        <select value={project} onChange={(e) => setProject(e.target.value)} className="field !w-auto" title={t('โครงการ')}>
          <option value="">{t('ทุกโครงการ')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
        </select>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <StatusChips over={data.overCount} near={data.nearCount} none={data.noBudgetCount}
            ok={rows.reduce((a, g) => a + (g.okCount || 0), 0)} />
        </span>
      </div>

      {rows.length === 0 && (
        <div className="card py-12 text-center text-sm text-slate-500">
          {t('ยังไม่มีข้อมูลค่าใช้จ่าย')}
        </div>
      )}

      {rows.map((g) => {
        const shut = collapsed[g.project_id];
        // ขอบซ้ายบอกสถานะที่แย่ที่สุดของโครงการ — มองแถบเดียวรู้ว่าต้องเปิดอันไหน
        const border = g.overCount ? 'border-l-red-500' : g.nearCount ? 'border-l-amber-400'
          : g.noBudgetCount ? 'border-l-slate-300' : 'border-l-emerald-500';
        const pct = g.pct ?? 0;
        const meterColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-brand';
        const pctText = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-brand';
        return (
          <div key={g.project_id} className={`card !p-0 overflow-hidden border-l-[3px] ${border}`}>
            <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [g.project_id]: !shut }))}
              className="flex w-full flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50/60"
              aria-expanded={!shut}>
              <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition ${shut ? '-rotate-90' : ''}`} />
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold tracking-wide text-white">{g.project_code}</span>
              <span className="text-xs text-slate-500">{g.project_name}</span>
              <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                <StatusChips over={g.overCount} near={g.nearCount} none={g.noBudgetCount} ok={g.okCount} />
              </span>
              {/* ยอดรวมหัวโครงการนับเฉพาะหมวดที่ตั้งงบไว้ — เหมือนระบบจริง
                  เงินในหมวดที่ไม่มีงบไม่มีอะไรให้เทียบ ถ้ารวมเข้าไปจะได้ % เกินจริง */}
              {g.cap > 0 ? (
                <span className="flex w-full items-center gap-2 sm:w-auto" title={t('รวมเฉพาะหมวดที่ตั้งงบไว้')}>
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 sm:w-40">
                    <span className={`block h-full rounded-full ${meterColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${pctText}`}>{pct}%</span>
                  <span className="text-xs tabular-nums text-slate-400">{formatMoney(g.spent)} / {formatMoney(g.cap)}</span>
                </span>
              ) : (
                <span className="w-full text-xs italic text-slate-400 sm:w-auto">— {t('ยังไม่มีงบที่ตั้งไว้ในโครงการนี้')} —</span>
              )}
            </button>
            {!shut && (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="tbl-th">{t('หมวดค่าใช้จ่าย')}</th>
                      <th className="tbl-th w-24 text-right">{t('# รายการ')}</th>
                      <th className="tbl-th w-36 text-right">{t('ใช้ไป')}</th>
                      <th className="tbl-th w-36 text-right">{t('งบประมาณ')}</th>
                      <th className="tbl-th w-20 text-right">{t('% ใช้')}</th>
                      <th className="tbl-th w-36 text-right">{t('คงเหลือ')}</th>
                      {canEdit && <th className="tbl-th w-20" />}
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.cost_category} className="tbl-row">
                        <td className="tbl-td text-slate-800">
                          {l.cost_category}
                          {l.note && <div className="text-[11px] text-slate-400">{l.note}</div>}
                        </td>
                        <td className="tbl-td text-right tabular-nums text-slate-500">{l.items}</td>
                        <td className="tbl-td text-right tabular-nums">{formatMoney(l.spent)}</td>
                        <td className="tbl-td text-right tabular-nums text-slate-500">
                          {l.cap == null ? <span className="text-amber-700">— {t('ไม่ได้ตั้ง')}</span> : formatMoney(l.cap)}
                        </td>
                        <td className={`tbl-td text-right tabular-nums font-medium ${l.over ? 'text-red-600' : l.near ? 'text-amber-600' : 'text-slate-600'}`}>
                          {l.pct == null ? '—' : `${l.pct.toFixed(1)}%`}
                        </td>
                        <td className={`tbl-td text-right tabular-nums ${l.remaining == null ? 'text-slate-400' : l.remaining < 0 ? 'font-semibold text-red-600' : l.near ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {l.remaining == null ? '—' : l.remaining < 0 ? `−${formatMoney(-l.remaining)}` : formatMoney(l.remaining)}
                        </td>
                        {canEdit && (
                          <td className="tbl-td text-right">
                            <button
                              onClick={() => openCap(g, l)}
                              title={t('ตั้ง/แก้ไขงบประมาณ')} aria-label={t('ตั้ง/แก้ไขงบประมาณ')}
                              className="text-slate-400 hover:text-slate-700">
                              <Icon name="edit" className="inline h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <CapModal target={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
