import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';

export default function DocTypesTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = () => { setLoading(true); return adminApi.listDocTypes().then((r) => setTypes(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.createDocType({ name: newName.trim() });
      setNewName('');
      toast.success('เพิ่มประเภทเอกสารแล้ว');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id) => {
    try { await adminApi.updateDocType(id, { name: editName.trim() }); setEditId(null); toast.success('บันทึกแล้ว'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const remove = async (id, name) => {
    const ok = await confirm({ title: 'ลบประเภทเอกสาร', message: `ลบประเภทเอกสาร "${name}"?`, confirmLabel: 'ลบ' });
    if (!ok) return;
    try { await adminApi.deleteDocType(id); toast.success('ลบประเภทเอกสารแล้ว'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const field = 'field';

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อประเภทเอกสารใหม่" className={`${field} flex-1`} />
        <button type="submit" disabled={busy} className="btn-primary">+ เพิ่ม</button>
      </form>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {loading ? (
          <p className="text-sm text-slate-400 p-5">กำลังโหลด…</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">ยังไม่มีประเภทเอกสาร — เพิ่มด้านบนได้เลย</p>
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
                  <button onClick={() => remove(t.id, t.name)} className="text-red-500 hover:underline text-sm">ลบ</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
