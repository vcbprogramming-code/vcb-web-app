import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AddDocumentModal from './AddDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useHeaderSlot } from '../../components/HeaderSlot.jsx';

// English status labels for the "All statuses" dropdown (client's mockup uses EN)
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

function ProjectChip({ code, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-brand text-white border-brand'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
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

  // load reference data once
  useEffect(() => {
    Promise.all([ememoApi.listProjects(), ememoApi.listDocumentTypes()])
      .then(([p, t]) => {
        setProjects(p.data);
        setDocTypes(t.data);
      })
      .catch((e) => setError(e.message));
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

  const iso = (d) => d.toISOString().slice(0, 10);
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
        <div className="hidden rounded-lg bg-white/10 px-3.5 py-1.5 text-sm text-cyan-100/80 ring-1 ring-inset ring-white/15 md:block">
          <span className="font-bold text-white">{total}</span> documents
          <span className="mx-1.5 text-white/30">·</span>
          <span className="font-bold text-white">{total}</span> linked
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate('/memos-settings')}
            title="ตั้งค่า E-Memo (โครงการ / รหัส / สายอนุมัติ)"
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            <Icon name="settings" className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </button>
        )}
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          <Icon name="plus" className="h-4 w-4" /> <span className="hidden sm:inline">Add Document</span>
        </button>
      </>
    ),
    [total, isAdmin]
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* filter bar — search · type · status · project chips, then a date row */}
      <div className="card-sm !p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search document"
              className="field !py-1.5 pl-9"
            />
          </div>

          {/* All document types */}
          <FilterDropdown label="All document types" value={activeDocType?.name} active={!!docTypeId} width="w-56">
            {(close) => (
              <div className="max-h-72 overflow-auto">
                <button
                  onClick={() => { setDocTypeId(''); close(); }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${!docTypeId ? 'font-semibold text-brand' : 'text-slate-600'}`}
                >
                  All document types
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

          {/* All statuses */}
          <FilterDropdown label="All statuses" value={activeStatus?.label} active={!!status} width="w-48">
            {(close) => (
              <div>
                <button
                  onClick={() => { setStatus(''); close(); }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${!status ? 'font-semibold text-brand' : 'text-slate-600'}`}
                >
                  All statuses
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

          {/* project chips — shown inline (client's design) */}
          <ProjectChip code="All Projects" active={!projectId} onClick={() => setProjectId('')} />
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

        {/* date row (+ result count on the far right) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Date received:</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5" />
          <Icon name="arrowRight" className="h-3.5 w-3.5 text-slate-400" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5" />
          <button onClick={() => quickRange(7)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">Last 7 days</button>
          <button onClick={() => quickRange(30)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">Last 30 days</button>
          <button onClick={lastMonth} className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">Last month</button>
          {(from || to) && (
            <button onClick={clearDates} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"><Icon name="x" className="h-3.5 w-3.5" /> Clear dates</button>
          )}
          <span className="ml-auto italic text-slate-400">Showing {docs.length} of {total} documents</span>
        </div>
      </div>

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-300">
              <th className="tbl-th w-12 font-semibold">#</th>
              <th className="tbl-th font-semibold">วันที่</th>
              <th className="tbl-th font-semibold">เอกสาร</th>
              <th className="tbl-th font-semibold">สถานะ</th>
              <th className="tbl-th text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center"><span className="inline-flex justify-center"><Spinner label="กำลังโหลด…" /></span></td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">ไม่พบเอกสาร</td></tr>
            ) : (
              docs.map((d, i) => (
                <tr key={d.id} onClick={() => navigate(`/memos/${d.id}`)} className="tbl-row cursor-pointer">
                  <td className="tbl-td text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                  <td className="tbl-td whitespace-nowrap text-slate-600">{formatThaiDate(d.date_received)}</td>
                  <td className="tbl-td">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: d.project_color || '#64748b' }}
                        >
                          {d.project_code}
                        </span>
                        {/* doc code (รหัส) in front of the document number */}
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {d.doc_code}
                        </span>
                        <span className="font-semibold text-slate-800">{d.doc_number}</span>
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">{d.subject}</div>
                    </div>
                  </td>
                  <td className="tbl-td"><StatusBadge status={d.status} /></td>
                  <td className="tbl-td text-right">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/memos/${d.id}`); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-light"
                      >
                        ดูรายละเอียด <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm">
          <span className="text-slate-500">หน้า {page} / {totalPages}</span>
          <div className="flex gap-2">
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
          onCreated={() => {
            setShowAdd(false);
            loadDocs();
          }}
        />
      )}
    </div>
  );
}
