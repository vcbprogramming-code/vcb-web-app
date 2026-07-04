import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AddDocumentModal from './AddDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';

function ProjectChip({ code, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
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

/** A removable chip summarising one active filter, shown under the toolbar. */
function ActiveFilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 py-1 pl-3 pr-1.5 text-xs font-medium text-brand">
      {label}
      <button onClick={onClear} className="flex h-4 w-4 items-center justify-center rounded-full text-brand/70 transition hover:bg-brand/20 hover:text-brand" aria-label="ล้างตัวกรอง">
        <Icon name="x" className="h-3 w-3" />
      </button>
    </span>
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
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // filter popover (holds ประเภท / โครงการ / วันที่ so the toolbar stays 1 row)
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [filterOpen]);

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
      .listDocuments({ projectId, docTypeId, search, from, to, page, pageSize })
      .then((res) => {
        setDocs(res.data);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, docTypeId, search, from, to, page]);

  // debounce search; reload on filter change
  useEffect(() => {
    const t = setTimeout(loadDocs, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadDocs, search]);

  // reset to page 1 whenever a non-page filter changes
  useEffect(() => {
    setPage(1);
  }, [projectId, docTypeId, search, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clearDates = () => {
    setFrom('');
    setTo('');
  };

  const quickRange = (days) => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - days);
    const iso = (d) => d.toISOString().slice(0, 10);
    setFrom(iso(start));
    setTo(iso(today));
  };

  const activeProject = projects.find((p) => p.id === projectId);
  const activeDocType = docTypes.find((t) => t.id === docTypeId);
  const dateLabel = from && to ? `${formatThaiDate(from)} – ${formatThaiDate(to)}`
    : from ? `ตั้งแต่ ${formatThaiDate(from)}`
    : to ? `ถึง ${formatThaiDate(to)}` : null;
  const filterCount = (projectId ? 1 : 0) + (docTypeId ? 1 : 0) + (from || to ? 1 : 0);
  const resetFilters = () => { setProjectId(''); setDocTypeId(''); setFrom(''); setTo(''); };

  return (
    <div className="space-y-5">
      {/* compact masthead — single row: title + count (left) · settings (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
            <Icon name="document" className="h-5 w-5" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-base font-bold tracking-tight">ทะเบียนเอกสารภายใน</span>
            <span className="hidden text-xs text-white/55 sm:inline">กลุ่มวิจิตรภัณฑ์ก่อสร้าง</span>
          </div>
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-inset ring-white/10">
            <span className="text-sm font-bold leading-none">{total}</span>
            <span className="text-[11px] text-white/55">เอกสาร</span>
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate('/memos-settings')}
            title="ตั้งค่า E-Memo (โครงการ / รหัส / สายอนุมัติ)"
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
          >
            <Icon name="settings" className="h-4 w-4" /> ตั้งค่า
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        {/* toolbar — single row: search · filters popover · create button */}
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเอกสาร / เลขที่ / เรื่อง"
                className="field pl-9"
              />
            </div>

            {/* filters popover trigger */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                  filterCount > 0 || filterOpen
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="settings" className="h-4 w-4" /> ตัวกรอง
                {filterCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{filterCount}</span>
                )}
              </button>

              {filterOpen && (
                <div className="absolute right-0 z-30 mt-2 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">ตัวกรอง</h4>
                    {filterCount > 0 && (
                      <button onClick={resetFilters} className="text-xs font-medium text-slate-400 hover:text-slate-700">ล้างทั้งหมด</button>
                    )}
                  </div>

                  {/* ประเภทเอกสาร */}
                  <label className="mb-1 block text-xs font-medium text-slate-500">ประเภทเอกสาร</label>
                  <select value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)} className="field mb-3 w-full bg-white">
                    <option value="">ทุกประเภทเอกสาร</option>
                    {docTypes.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>

                  {/* โครงการ chips */}
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">โครงการ</label>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <ProjectChip code="ทุกโครงการ" active={!projectId} onClick={() => setProjectId('')} />
                    {projects.map((p) => (
                      <ProjectChip key={p.id} code={p.code} color={p.color} active={projectId === p.id} onClick={() => setProjectId(p.id)} />
                    ))}
                  </div>

                  {/* วันที่รับ */}
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">วันที่รับ</label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2" />
                    <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-400" />
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2" />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => quickRange(7)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">7 วันล่าสุด</button>
                    <button onClick={() => quickRange(30)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">30 วันล่าสุด</button>
                    {(from || to) && (
                      <button onClick={clearDates} className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"><Icon name="x" className="h-3.5 w-3.5" /> ล้างวันที่</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* create — sits right above the list */}
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-light"
            >
              <Icon name="plus" className="h-4 w-4" /> สร้างเอกสาร
            </button>
          </div>

          {/* active filter chips + result count */}
          {(filterCount > 0 || total > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {activeDocType && <ActiveFilterChip label={activeDocType.name} onClear={() => setDocTypeId('')} />}
              {activeProject && <ActiveFilterChip label={`โครงการ ${activeProject.code}`} onClear={() => setProjectId('')} />}
              {dateLabel && <ActiveFilterChip label={dateLabel} onClear={clearDates} />}
              <span className="ml-auto text-xs text-slate-400">แสดง {docs.length} จาก {total} เอกสาร</span>
            </div>
          )}
        </div>
        <table className="tbl">
          <thead>
            <tr className="bg-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-300">
              <th className="tbl-th w-12 font-semibold">#</th>
              <th className="tbl-th font-semibold">วันที่</th>
              <th className="tbl-th font-semibold">เอกสาร</th>
              <th className="tbl-th font-semibold">รหัส</th>
              <th className="tbl-th font-semibold">สถานะ</th>
              <th className="tbl-th text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">กำลังโหลด…</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">ไม่พบเอกสาร</td></tr>
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
                        <span className="font-semibold text-slate-800">{d.doc_number}</span>
                      </div>
                      <div className="line-clamp-1 text-xs text-slate-500">{d.subject}</div>
                    </div>
                  </td>
                  <td className="tbl-td text-slate-600">{d.doc_code}</td>
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
