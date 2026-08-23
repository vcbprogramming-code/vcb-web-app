import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ememoApi,
  STATUS_META,
  formatThaiDate,
  formatThaiLongDate,
  formatThaiDateTime,
} from '../lib/ememo.js';
import Icon from '../components/Icon.jsx';
import { StatCard } from '../components/ui/index.js';
import { TrendChart, BarList } from '../components/Charts.jsx';
import { useT } from '../lib/i18n.jsx';

const STATUS_ORDER = ['pending', 'approved', 'returned', 'rejected', 'draft', 'cancelled'];

const AGING = {
  '0-3': 'ไม่เกิน 3 วัน',
  '4-7': '4–7 วัน',
  '8-14': '8–14 วัน',
  '15+': 'เกิน 14 วัน',
};

/** Local YYYY-MM-DD. toISOString() shifts a UTC+7 date back a day. */
const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * An approver with no full_name on file falls back to their address, which reads
 * like a mailbox dump on an executive screen — so show just the part before the
 * @. But two accounts can share that part (c.chavananand@gmail vs @vcb-con), and
 * trimming both would silently merge two different people on the chart. When
 * that happens, keep the full address for the ones that collide.
 */
function approverLabel(name, all) {
  if (!name.includes('@')) return name;
  const short = name.split('@')[0];
  const clashes = all.filter((o) => o.name !== name && o.name.split('@')[0] === short).length > 0;
  return clashes ? name : short;
}

const RANGES = [
  { key: 'all', label: 'ทั้งหมด', range: () => ({}) },
  { key: 'month', label: 'เดือนนี้', range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) }; } },
  { key: 'q', label: '3 เดือนล่าสุด', range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth() - 2, 1)), to: iso(n) }; } },
  { key: 'year', label: 'ปีนี้', range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(n) }; } },
];

/**
 * Admin overview. Every number here is a way INTO the register, not a dead end:
 * the filters at the top scope the whole page, and clicking any bar, status or
 * month opens the matching slice of the document register.
 */
export default function Dashboard() {
  const t = useT();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reloading, setReloading] = useState(false);

  // filters — one row, above everything, scoping every tile and chart below
  const [rangeKey, setRangeKey] = useState('all');
  const [projectId, setProjectId] = useState('');
  const range = RANGES.find((r) => r.key === rangeKey).range();
  const filters = { ...range, projectId: projectId || undefined };
  const filterKey = JSON.stringify(filters);

  const firstLoad = useRef(true);
  const load = useCallback(() => {
    setError(null);
    if (!firstLoad.current) setReloading(true);
    ememoApi.stats(filters)
      .then((r) => { setStats(r.data); setFetchedAt(new Date()); })
      .catch((e) => setError(e.message))
      .finally(() => { firstLoad.current = false; setReloading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { ememoApi.listProjects().then((r) => setProjects(r.data)).catch(() => {}); }, []);
  // keep a screen left open in a meeting room honest
  useEffect(() => {
    const timer = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  /** Open the register already filtered to whatever was clicked. */
  const drill = (extra = {}) => {
    const q = new URLSearchParams();
    if (filters.from) q.set('from', filters.from);
    if (filters.to) q.set('to', filters.to);
    if (projectId) q.set('projectId', projectId);
    Object.entries(extra).forEach(([k, v]) => v && q.set(k, v));
    navigate(`/memos?${q.toString()}`);
  };

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const url = await ememoApi.exportUrl(filters);
      const now = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear() + 543}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
      const parts = [t('ทะเบียนเอกสาร')];
      const proj = projects.find((x) => x.id === projectId);
      if (proj) parts.push(proj.code);
      const a = document.createElement('a');
      a.href = url; a.download = `${parts.join('-')}-${stamp}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setError(e.message); } finally { setExporting(false); }
  };

  const s = stats;
  const overdue = s?.aging?.find((a) => a.bucket === '15+')?.count || 0;

  return (
    <div className="space-y-5">
      {/* ── filter row — scopes everything below ─────────────────────────── */}
      <div className="card-sm !p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{t('ช่วงเวลา:')}</span>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                rangeKey === r.key ? 'bg-brand text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t(r.label)}
            </button>
          ))}

          <span className="ml-3 text-slate-500">{t('โครงการ:')}</span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setProjectId('')}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                !projectId ? 'bg-slate-800 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >{t('ทุกโครงการ')}</button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setProjectId(projectId === p.id ? '' : p.id)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition"
                style={{ backgroundColor: projectId === p.id ? (p.color || '#64748b') : 'transparent',
                  color: projectId === p.id ? '#fff' : '#475569',
                  border: `1px solid ${projectId === p.id ? (p.color || '#64748b') : '#e2e8f0'}` }}
              >{p.code}</button>
            ))}
          </div>

          <button
            onClick={downloadExcel}
            disabled={exporting || !s?.total}
            title={!s?.total ? t('ไม่มีเอกสารให้ส่งออก') : t('ดาวน์โหลดทะเบียน {n} ฉบับตามตัวกรองนี้เป็นไฟล์ Excel', { n: s.total })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {exporting
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" /> {t('กำลังเตรียมไฟล์…')}</>
              : <><Icon name="download" className="h-3.5 w-3.5" /> {t('ดาวน์โหลด Excel')}</>}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {t('ตัวเลขทุกตัวกดเพื่อดูรายการจริงได้ · ข้อมูลตามตัวกรองด้านบน')}
        </span>
        <span className="flex items-center gap-3">
          {fetchedAt && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex">
              <Icon name="clock" className="h-4 w-4" /> {t('อัปเดต:')} {formatThaiDateTime(fetchedAt)}
            </span>
          )}
          <span className="chip bg-brand/10 text-brand">{formatThaiLongDate(new Date())}</span>
        </span>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{t('โหลดภาพรวมไม่สำเร็จ:')} {error}</span>
          <button onClick={load} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">{t('ลองใหม่')}</button>
        </div>
      )}

      {!s ? (
        !error && <div className="text-slate-400">{t('กำลังโหลดภาพรวม…')}</div>
      ) : (
        // holds the previous render at reduced opacity while refetching — no
        // skeleton flash, no layout jump
        <div className={`space-y-5 transition-opacity ${reloading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <button onClick={() => drill()} className="text-left">
              <StatCard label={t('เอกสารทั้งหมด')} value={s.total} icon="document" iconColor="bg-brand/10 text-brand" />
            </button>
            <button onClick={() => drill()} className="text-left">
              <StatCard label={t('รับเข้าเดือนนี้')} value={s.thisMonth} accent="text-blue-600" icon="calendar" iconColor="bg-blue-50 text-blue-600" />
            </button>
            <button onClick={() => drill({ status: 'pending' })} className="text-left">
              <StatCard label={t('รออนุมัติ')} value={s.byStatus.pending || 0} accent="text-amber-600" icon="clock" iconColor="bg-amber-50 text-amber-600" />
            </button>
            <button onClick={() => drill({ status: 'pending' })} className="text-left">
              <StatCard label={t('ค้างเกิน 14 วัน')} value={overdue} accent={overdue ? 'text-rose-600' : 'text-emerald-600'}
                icon={overdue ? 'warning' : 'check'} iconColor={overdue ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'} />
            </button>
          </div>

          {/* trend — the one chart that needs the full width */}
          <div className="card">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-bold text-slate-800">{t('แนวโน้มจำนวนเอกสาร 12 เดือน')}</h3>
              <span className="text-xs text-slate-400">{t('กดที่เดือนเพื่อดูเอกสารของเดือนนั้น')}</span>
            </div>
            <TrendChart
              data={s.monthly}
              onPick={(m) => {
                const [y, mm] = m.split('-').map(Number);
                navigate(`/memos?from=${iso(new Date(y, mm - 1, 1))}&to=${iso(new Date(y, mm, 0))}${projectId ? `&projectId=${projectId}` : ''}`);
              }}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {/* aging — the actionable one, so it goes first */}
            <div className="card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-slate-800">{t('เอกสารรออนุมัติ ค้างมานานแค่ไหน')}</h3>
                <span className="text-xs text-slate-400">{t('นับจากวันที่รับเอกสาร')}</span>
              </div>
              <BarList
                unit={` ${t("ฉบับ")}`}
                emphasisKey="15+"
                rows={s.aging.map((a) => ({ key: a.bucket, label: t(AGING[a.bucket]), value: a.count }))}
                onPick={() => drill({ status: 'pending' })}
              />
              {overdue > 0 && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <Icon name="warning" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('มี')} {overdue} {t('ฉบับค้างเกิน 14 วัน — ควรตามผู้อนุมัติที่ค้างอยู่')}
                </p>
              )}
            </div>

            {/* who is slow */}
            <div className="card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold text-slate-800">{t('เวลาพิจารณาเฉลี่ย รายผู้อนุมัติ')}</h3>
                <span className="text-xs text-slate-400">{t('นับจากที่ถึงคิวของแต่ละคน')}</span>
              </div>
              {s.turnaround.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">{t('ยังไม่มีการอนุมัติในช่วงที่เลือก')}</div>
              ) : (
                <BarList
                  unit={` ${t("วัน")}`}
                  emphasisKey={s.turnaround[0]?.name}
                  rows={s.turnaround.map((row) => ({
                    key: row.name,
                    label: approverLabel(row.name, s.turnaround),
                    value: row.avg_days,
                    hint: t('({n} ครั้ง)', { n: row.steps }),
                  }))}
                />
              )}
            </div>

            {/* status — labels always visible, colour is never the only cue */}
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('สถานะเอกสาร')}</h3>
              <BarList
                unit={` ${t("ฉบับ")}`}
                rows={STATUS_ORDER.filter((st) => s.byStatus[st]).map((st) => ({
                  key: st,
                  label: t(STATUS_META[st]?.label || st, null, 'status'),
                  value: s.byStatus[st] || 0,
                  hint: s.total ? `(${Math.round(((s.byStatus[st] || 0) / s.total) * 100)}%)` : '',
                  color: st === 'approved' ? '#15803d' : st === 'pending' ? '#b45309'
                    : st === 'rejected' ? '#be123c' : st === 'returned' ? '#c2410c' : '#94a3b8',
                }))}
                onPick={(r) => drill({ status: r.key })}
              />
            </div>

            {/* by project — each keeps its own colour AND its code as a label */}
            <div className="card">
              <h3 className="mb-3 font-bold text-slate-800">{t('เอกสารแยกตามโครงการ')}</h3>
              <BarList
                unit={` ${t("ฉบับ")}`}
                rows={s.byProject.filter((p) => p.count > 0).map((p) => ({
                  key: p.code, label: p.code, chip: p.code, value: p.count, color: p.color || '#64748b',
                }))}
                onPick={(r) => {
                  const proj = projects.find((x) => x.code === r.key);
                  if (proj) navigate(`/memos?projectId=${proj.id}`);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{t('เอกสารล่าสุด')}</h3>
                <button onClick={() => drill()} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  {t('ดูทั้งหมด')} <Icon name="arrowRight" className="h-4 w-4" />
                </button>
              </div>
              {s.recent.length === 0 ? (
                <p className="text-sm text-slate-400">{t('ยังไม่มีเอกสาร')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {s.recent.map((d) => (
                    <li key={d.id} onClick={() => navigate(`/memos/${d.id}`)}
                      className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                      <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: d.project_color || '#64748b' }}>{d.project_code}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">{d.doc_number}</div>
                        <div className="truncate text-xs text-slate-500">{d.subject}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${(STATUS_META[d.status] || STATUS_META.pending).chip}`}>
                        {t((STATUS_META[d.status] || STATUS_META.pending).label, null, 'status')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-slate-800">
                  <Icon name="inbox" className="h-5 w-5 text-amber-500" />
                  {t('รออนุมัตินานที่สุด')}
                </h3>
                <button onClick={() => drill({ status: 'pending' })} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  {t('ดูทั้งหมด')} <Icon name="arrowRight" className="h-4 w-4" />
                </button>
              </div>
              {s.pending.length === 0 ? (
                <p className="text-sm text-slate-400">{t('ไม่มีเอกสารรออนุมัติ')}</p>
              ) : (
                <ul className="space-y-3">
                  {s.pending.map((d) => {
                    const days = Math.max(0, Math.round((Date.now() - new Date(d.date_received).getTime()) / 86400000));
                    return (
                      <li key={d.id} onClick={() => navigate(`/memos/${d.id}`)}
                        className="cursor-pointer rounded-xl border border-slate-100 p-3 hover:border-amber-300 hover:bg-amber-50">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: d.project_color || '#64748b' }}>{d.project_code}</span>
                          <span className="text-xs text-slate-400">{formatThaiDate(d.date_received)}</span>
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${days > 14 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                            {t('ค้าง')} {days} {t('วัน')}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-slate-800">{d.doc_number}</div>
                        <div className="line-clamp-2 text-xs text-slate-500">{d.subject}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
