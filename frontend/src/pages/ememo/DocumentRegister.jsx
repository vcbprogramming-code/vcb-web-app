import { useEffect, useState, useCallback } from 'react';
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

  return (
    <div className="space-y-5">
      {/* formal masthead — corporate document-control banner */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
              <Icon name="document" className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                Document Control · E-Memo
              </div>
              <div className="text-xl font-bold tracking-tight">ทะเบียนเอกสารภายใน</div>
              <div className="text-xs text-white/60">กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ติดตามสถานะเอกสาร</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-inset ring-white/10 sm:flex">
              <span className="text-lg font-bold leading-none">{total}</span>
              <span className="text-[11px] text-white/55">เอกสารทั้งหมด</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/memos-settings')}
                title="ตั้งค่า E-Memo (โครงการ / รหัส / สายอนุมัติ)"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
              >
                <Icon name="settings" className="h-4 w-4" /> ตั้งค่า
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Icon name="plus" className="h-4 w-4" /> สร้างเอกสาร
            </button>
          </div>
        </div>
      </div>

      {/* filter bar */}
      <div className="card-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเอกสาร / เลขที่ / เรื่อง"
              className="field pl-9"
            />
          </div>
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className="field !w-auto bg-white"
          >
            <option value="">ทุกประเภทเอกสาร</option>
            {docTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* project chips */}
        <div className="flex flex-wrap gap-2">
          <ProjectChip code="ทุกโครงการ" active={!projectId} onClick={() => setProjectId('')} />
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

        {/* date filters */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500">วันที่รับ:</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200" />
          <Icon name="arrowRight" className="h-4 w-4 text-slate-400" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200" />
          <button onClick={() => quickRange(7)} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">7 วันล่าสุด</button>
          <button onClick={() => quickRange(30)} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">30 วันล่าสุด</button>
          {(from || to) && (
            <button onClick={clearDates} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"><Icon name="x" className="h-4 w-4" /> ล้างวันที่</button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* table */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-800">รายการเอกสาร</h3>
          <span className="text-sm text-slate-400">แสดง {docs.length} จาก {total} เอกสาร</span>
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
