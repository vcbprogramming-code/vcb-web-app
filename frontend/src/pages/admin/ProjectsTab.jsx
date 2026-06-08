import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const COLORS = ['#2563eb', '#db2777', '#9333ea', '#0891b2', '#65a30d', '#7c3aed', '#16a34a', '#ea580c', '#dc2626', '#0d9488'];

function ProjectModal({ project, onClose, onSaved }) {
  const editing = Boolean(project);
  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [docPrefix, setDocPrefix] = useState(project?.doc_prefix || '');
  const [color, setColor] = useState(project?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { code, name, docPrefix, color };
      if (editing) await adminApi.updateProject(project.id, body);
      else await adminApi.createProject(body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'field';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขโครงการ' : 'เพิ่มโครงการ'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">รหัสโครงการ *</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น BT1" className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Prefix เลขเอกสาร *</label>
              <input value={docPrefix} onChange={(e) => setDocPrefix(e.target.value)} placeholder="เช่น BT" className={field} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อโครงการ *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">สีประจำโครงการ</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="mt-2 text-sm text-slate-500">ตัวอย่าง: <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: color }}>{code || 'CODE'}</span></div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(undefined);

  const load = () => adminApi.listProjects().then((r) => setProjects(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleActive = async (p) => {
    try { await adminApi.updateProject(p.id, { isActive: !p.is_active }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEdit(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มโครงการ</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">โครงการ</th>
              <th className="tbl-th">ชื่อ</th>
              <th className="tbl-th">Prefix</th>
              <th className="tbl-th">สถานะ</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id} className="tbl-row">
                <td className="tbl-td">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: p.color || '#64748b' }}>{p.code}</span>
                </td>
                <td className="tbl-td text-slate-700">{p.name}</td>
                <td className="tbl-td text-slate-600">{p.doc_prefix}</td>
                <td className="tbl-td">
                  <span className={`chip ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{p.is_active ? 'ใช้งาน' : 'ปิด'}</span>
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setEdit(p)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                  <button onClick={() => toggleActive(p)} className="text-slate-500 hover:underline text-sm">{p.is_active ? 'ปิด' : 'เปิด'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit !== undefined && (
        <ProjectModal project={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); load(); }} />
      )}
    </div>
  );
}
