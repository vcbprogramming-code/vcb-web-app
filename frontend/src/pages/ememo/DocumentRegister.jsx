import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AddDocumentModal from './AddDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useHeaderSlot } from '../../components/HeaderSlot.jsx';
import { useToast } from '../../components/Toast.jsx';

// Status options driven from the SAME source as the table chips (STATUS_META),
// so the filter vocabulary and the rows always match (Thai, single source).
const STATUS_OPTIONS = ['draft', 'pending', 'approved', 'rejected', 'returned', 'cancelled']
  .map((value) => ({ value, label: STATUS_META[value].label }));

function ProjectChip({ code, color, active, onClick, subtle }) {
  // `subtle` = the "ทุกโครงการ" (no-filter) chip: its active state is the DEFAULT,
  // so a loud solid-blue pill misreads as "a filter is applied". Use a soft tint
  // instead; real project chips keep their bold colored active state.
  const activeClass = subtle
    ? 'bg-brand/10 text-brand border-brand/30'
    : 'bg-brand text-white border-brand';
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? activeClass
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
      style={active && !subtle && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {code}
    </button>
  );
}

/**
 * A compact toolbar filter dropdown: a button showing "label · value" that
 * opens a small panel (its `children`). Closes on outside-click / Esc. When
 * `active` the button gets the brand accent so it's clear a filter is applied.
 */
function FilterDropdown({ label, value, active, icon = 'chevronDown', align = 'left', width = 'w-64', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          active
            ? 'border-brand bg-brand/5 text-brand'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className={active ? 'font-semibold' : ''}>{label}</span>
        {value && <span className="max-w-[120px] truncate text-slate-400">· {value}</span>}
        <Icon name="chevronDown" className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-2 ${width} rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.chip}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  );
}

export default function DocumentRegister() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === 'admin';
  const [projects, setProjects] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  // filters
  const [projectId, setProjectId] = useState('');
  const [docTypeId, setDocTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // documents awaiting the logged-in user's approval — the home alert (#8)
  const [awaiting, setAwaiting] = useState({ count: 0, items: [] });
  // #5: on the free hosting tier the API sleeps when idle and the first request
  // wakes it (~30s). Show a "warming up" hint if loading drags so the user knows
  // it isn't frozen (and understands the one-time first-load delay).
  const [wakeHint, setWakeHint] = useState(false);
  useEffect(() => {
    if (!loading) { setWakeHint(false); return; }
    const t = setTimeout(() => setWakeHint(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  // load reference data once
  useEffect(() => {
    Promise.all([ememoApi.listProjects(), ememoApi.listDocumentTypes()])
      .then(([p, t]) => {
        setProjects(p.data);
        setDocTypes(t.data);
      })
      .catch((e) => setError(e.message));
    ememoApi.awaitingMe().then((r) => setAwaiting(r.data)).catch(() => {});
  }, []);

  const loadDocs = useCallback(() => {
    setLoading(true);
    ememoApi
      .listDocuments({ projectId, docTypeId, status, search, from, to, page, pageSize })
      .then((res) => {
        setDocs(res.data);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, docTypeId, status, search, from, to, page]);

  // debounce search; reload on filter change
  useEffect(() => {
    const t = setTimeout(loadDocs, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadDocs, search]);

  // reset to page 1 whenever a non-page filter changes
  useEffect(() => {
    setPage(1);
  }, [projectId, docTypeId, status, search, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clearDates = () => {
    setFrom('');
    setTo('');
  };
  // is any filter narrowing the list? (drives the "clear all" control + empty state)
  const anyFilter = Boolean(projectId || docTypeId || status || search.trim() || from || to);
  const clearAllFilters = () => {
    setProjectId(''); setDocTypeId(''); setStatus(''); setSearch(''); setFrom(''); setTo(''); setPage(1);
  };
  // "แสดง 1–10 จาก 45 ฉบับ" range for the pager
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // local date, not UTC — toISOString() shifts to the previous day for UTC+7 users,
  // which made "Last month"/"Last N days" drop the last day and add an extra earlier day
  const iso = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const quickRange = (days) => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - days);
    setFrom(iso(start));
    setTo(iso(today));
  };
  // "Last month" = the previous calendar month (1st → last day)
  const lastMonth = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    setFrom(iso(first));
    setTo(iso(last));
  };

  const activeDocType = docTypes.find((t) => t.id === docTypeId);
  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status);

  // Inject the register's stats + actions into the shared top bar (no 2nd banner).
  useHeaderSlot(
    (
      <>
        {/* #2: informational "awaiting me" count — clicking clears filters so the
            pinned (top-sorted) awaiting rows are guaranteed visible on page 1. */}
        {awaiting.count > 0 && (
          <button
            onClick={() => { setStatus(''); setProjectId(''); setDocTypeId(''); setSearch(''); setFrom(''); setTo(''); setPage(1); }}
            title="เอกสารที่รอการอนุมัติจากคุณ — จัดเรียงไว้บนสุดของตาราง"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-2 text-sm font-bold text-white ring-1 ring-inset ring-amber-300/40 transition hover:bg-amber-500"
          >
            <Icon name="clock" className="h-4 w-4" /> รออนุมัติ {awaiting.count}
          </button>
        )}
        <div className="hidden rounded-lg bg-white/10 px-3.5 py-1.5 text-sm text-cyan-100/80 ring-1 ring-inset ring-white/15 md:block">
          <span className="font-bold text-white">{total}</span> เอกสาร
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate('/memos-settings')}
            title="ตั้งค่า E-Memo (โครงการ / รหัส / สายอนุมัติ)"
            aria-label="ตั้งค่า E-Memo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-cyan-100 ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            <Icon name="settings" className="h-4 w-4" />
          </button>
        )}
        {/* #4: the primary "add document" action — made prominent (bright + ring)
            and set apart from the secondary buttons so it isn't hit by accident. */}
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-300 transition hover:bg-cyan-300"
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> เพิ่มเอกสาร
        </button>
      </>
    ),
    [total, isAdmin, awaiting.count]
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* #2: the single-action alert was replaced by a per-row "รออนุมัติจากคุณ"
          marker + server-side sort that floats those docs to the TOP of the table,
          so a reviewer can pick which one to open (no forced first-doc redirect). */}

      {/* filter bar — search · type · status · project chips, then a date row */}
      <div className="card-sm !p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่ / เรื่อง / รหัสเอกสาร"
              className="field !py-1.5 pl-9"
            />
          </div>

          {/* ประเภทเอกสาร */}
          <FilterDropdown label="ทุกประเภทเอกสาร" value={activeDocType?.name} active={!!docTypeId} width="w-56">
            {(close) => (
              <div className="max-h-72 overflow-auto">
                <button
                  onClick={() => { setDocTypeId(''); close(); }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${!docTypeId ? 'font-semibold text-brand' : 'text-slate-600'}`}
                >
                  ทุกประเภทเอกสาร
                </button>
                {docTypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setDocTypeId(t.id); close(); }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${docTypeId === t.id ? 'font-semibold text-brand' : 'text-slate-600'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </FilterDropdown>

          {/* สถานะ */}
          <FilterDropdown label="ทุกสถานะ" value={activeStatus?.label} active={!!status} width="w-48">
            {(close) => (
              <div>
                <button
                  onClick={() => { setStatus(''); close(); }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${!status ? 'font-semibold text-brand' : 'text-slate-600'}`}
                >
                  ทุกสถานะ
                </button>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { setStatus(s.value); close(); }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${status === s.value ? 'font-semibold text-brand' : 'text-slate-600'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </FilterDropdown>

          {/* project chips — scroll horizontally on narrow screens instead of walling up */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5">
            <ProjectChip code="ทุกโครงการ" subtle active={!projectId} onClick={() => setProjectId('')} />
            {projects.map((p) => (
              <ProjectChip
                key={p.id}
                code={p.code}
                color={p.color}
                active={projectId === p.id}
                onClick={() => setProjectId(p.id)}
              />
            ))}
          </div>

          {anyFilter && (
            <button
              onClick={clearAllFilters}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <Icon name="x" className="h-3.5 w-3.5" /> ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>

        {/* date row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">วันที่รับ (ค.ศ.):</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5" />
          <Icon name="arrowRight" className="h-3.5 w-3.5 text-slate-400" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5" />
          <button onClick={() => quickRange(7)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">7 วันล่าสุด</button>
          <button onClick={() => quickRange(30)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">30 วันล่าสุด</button>
          <button onClick={lastMonth} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">เดือนก่อน</button>
          {(from || to) && (
            <>
              <span className="text-slate-400">(พ.ศ. {from ? formatThaiDate(from) : '…'} – {to ? formatThaiDate(to) : '…'})</span>
              <button onClick={clearDates} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"><Icon name="x" className="h-3.5 w-3.5" /> ล้างวันที่</button>
            </>
          )}
        </div>
      </div>

      {/* table — wraps in an x-scroll container so it never clips on mobile */}
      <div className="card !p-0">
        <div className="overflow-x-auto">
        <table className="tbl min-w-[700px]">
          <thead>
            <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-300">
              <th className="tbl-th w-12 font-semibold">#</th>
              <th className="tbl-th font-semibold">วันที่</th>
              <th className="tbl-th font-semibold">รหัส</th>
              <th className="tbl-th font-semibold">เอกสาร</th>
              <th className="tbl-th font-semibold">สถานะ</th>
              <th className="tbl-th text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // skeleton rows — keep the layout stable instead of a jumping spinner
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td className="tbl-td"><div className="h-3 w-5 rounded bg-slate-100" /></td>
                  <td className="tbl-td"><div className="h-3 w-20 rounded bg-slate-100" /></td>
                  <td className="tbl-td"><div className="h-4 w-12 rounded bg-slate-100" /></td>
                  <td className="tbl-td"><div className="h-4 w-56 max-w-full rounded bg-slate-100" /></td>
                  <td className="tbl-td"><div className="h-5 w-16 rounded-full bg-slate-100" /></td>
                  <td className="tbl-td text-right"><div className="ml-auto h-6 w-24 rounded-lg bg-slate-100" /></td>
                </tr>
              ))
            ) : docs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-14 text-center">
                {anyFilter ? (
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <Icon name="search" className="h-9 w-9 text-slate-300" />
                    <p className="text-sm text-slate-500">ไม่พบเอกสารที่ตรงกับตัวกรอง{search.trim() ? ` “${search.trim()}”` : ''}</p>
                    <button onClick={clearAllFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      <Icon name="x" className="h-4 w-4" /> ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <Icon name="document" className="h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">ยังไม่มีเอกสารในระบบ — เริ่มสร้างเอกสารฉบับแรกได้เลย</p>
                    <button onClick={() => setShowAdd(true)} className="btn-primary">
                      <Icon name="plus" className="h-4 w-4" strokeWidth={2.5} /> เพิ่มเอกสาร
                    </button>
                  </div>
                )}
              </td></tr>
            ) : (
              docs.map((d, i) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/memos/${d.id}`)}
                  className={`tbl-row cursor-pointer ${d.is_awaiting_me ? 'bg-amber-50/70 hover:bg-amber-50' : ''}`}
                >
                  <td className={`tbl-td text-slate-400 ${d.is_awaiting_me ? 'border-l-4 border-amber-400' : ''}`}>{(page - 1) * pageSize + i + 1}</td>
                  <td className="tbl-td whitespace-nowrap text-slate-600">{formatThaiDate(d.date_received)}</td>
                  {/* รหัส — its own column, before เอกสาร */}
                  <td className="tbl-td">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {d.doc_code}
                    </span>
                  </td>
                  <td className="tbl-td">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: d.project_color || '#64748b' }}
                        >
                          {d.project_code}
                        </span>
                        <span className="font-semibold text-slate-800">{d.doc_number}</span>
                        {/* #2: "รออนุมัติจากคุณ" marker right beside the doc number */}
                        {d.is_awaiting_me && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            <Icon name="clock" className="h-3 w-3" /> รออนุมัติจากคุณ
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">{d.subject}</div>
                    </div>
                  </td>
                  <td className="tbl-td"><StatusBadge status={d.status} /></td>
                  <td className="tbl-td text-right">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/memos/${d.id}`); }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition ${d.is_awaiting_me ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand hover:bg-brand-light'}`}
                      >
                        {d.is_awaiting_me ? 'อนุมัติ' : 'ดูรายละเอียด'} <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {wakeHint && loading && (
          <p className="border-t border-slate-100 px-5 py-2 text-center text-xs text-slate-400">
            เซิร์ฟเวอร์กำลังเริ่มทำงาน (โหมดประหยัดพลังงาน) — การโหลดครั้งแรกหลังพักอาจใช้เวลาสักครู่ ครั้งต่อไปจะเร็วขึ้น
          </p>
        )}

        {/* pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 text-sm">
          <span className="text-slate-500">
            {total > 0 ? <>แสดง <span className="font-medium text-slate-700">{rangeStart}–{rangeEnd}</span> จาก {total} ฉบับ</> : 'ไม่มีเอกสาร'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">หน้า {page} / {totalPages}</span>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">ก่อนหน้า</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">ถัดไป</button>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddDocumentModal
          projects={projects}
          docTypes={docTypes}
          onClose={() => setShowAdd(false)}
          onCreated={(newId, meta) => {
            setShowAdd(false);
            loadDocs();
            if (meta?.emailFailed) toast.error('บันทึกเอกสารแล้ว แต่ส่งอีเมลแจ้งผู้อนุมัติไม่สำเร็จ — กรุณาแจ้งผู้อนุมัติด้วยตนเอง');
            else toast.success('บันทึกเอกสารเรียบร้อยแล้ว');
            if (newId) navigate(`/memos/${newId}`);
          }}
        />
      )}
    </div>
  );
}
