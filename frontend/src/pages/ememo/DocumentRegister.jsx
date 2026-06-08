import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ememoApi, STATUS_META, formatThaiDate } from '../../lib/ememo.js';
import AddDocumentModal from './AddDocumentModal.jsx';
import Icon from '../../components/Icon.jsx';

function ProjectChip({ code, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
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
  const pageSize = 25;

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
      {/* header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ทะเบียนเอกสาร · E-Memo</h2>
          <p className="text-sm text-slate-500">
            ติดตามสถานะเอกสารภายใน · กลุ่มวิจิตรภัณฑ์ก่อสร้าง
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-light"
        >
          <Icon name="plus" className="h-4 w-4" />
          เพิ่มเอกสาร
        </button>
      </div>

      {/* filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเอกสาร / เลขที่ / เรื่อง"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 text-sm text-slate-500 border-b border-slate-100">
          แสดง {docs.length} จาก {total} เอกสาร
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-white text-left text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-semibold w-12">#</th>
              <th className="px-5 py-3 font-semibold">วันที่</th>
              <th className="px-5 py-3 font-semibold">โครงการ</th>
              <th className="px-5 py-3 font-semibold">รหัส</th>
              <th className="px-5 py-3 font-semibold">เอกสาร</th>
              <th className="px-5 py-3 font-semibold">สถานะ</th>
              <th className="px-5 py-3 font-semibold text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">กำลังโหลด…</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">ไม่พบเอกสาร</td></tr>
            ) : (
              docs.map((d, i) => (
                <tr key={d.id} onClick={() => navigate(`/memos/${d.id}`)} className="hover:bg-blue-50 cursor-pointer">
                  <td className="px-5 py-4 text-slate-400">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{formatThaiDate(d.date_received)}</td>
                  <td className="px-5 py-4">
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-semibold text-white"
                      style={{ backgroundColor: d.project_color || '#64748b' }}
                    >
                      {d.project_code}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{d.doc_code}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">{d.doc_number}</div>
                    <div className="text-slate-500 line-clamp-1">{d.subject}</div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={d.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/memos/${d.id}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 whitespace-nowrap"
                    >
                      ดูรายละเอียด
                    </button>
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
