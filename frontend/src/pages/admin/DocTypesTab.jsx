import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';

export default function DocTypesTab() {
  const [types, setTypes] = useState([]);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = () => adminApi.listDocTypes().then((r) => setTypes(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.createDocType({ name: newName.trim() });
      setNewName('');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id) => {
    try { await adminApi.updateDocType(id, { name: editName.trim() }); setEditId(null); load(); }
    catch (err) { setError(err.message); }
  };

  const remove = async (id) => {
    try { await adminApi.deleteDocType(id); load(); }
    catch (err) { setError(err.message); }
  };

  const field = 'px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อประเภทเอกสารใหม่" className={`${field} flex-1`} />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">+ เพิ่ม</button>
      </form>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {types.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">ยังไม่มีประเภทเอกสาร</p>
        ) : types.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-5 py-3">
            {editId === t.id ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`${field} flex-1 mr-3`} autoFocus />
            ) : (
              <span className="text-slate-800">{t.name}</span>
            )}
            <div className="whitespace-nowrap">
              {editId === t.id ? (
                <>
                  <button onClick={() => saveEdit(t.id)} className="text-emerald-600 hover:underline text-sm mr-3">บันทึก</button>
                  <button onClick={() => setEditId(null)} className="text-slate-400 hover:underline text-sm">ยกเลิก</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(t.id); setEditName(t.name); }} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                  <button onClick={() => remove(t.id)} className="text-red-500 hover:underline text-sm">ลบ</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
