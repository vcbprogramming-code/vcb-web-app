import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';

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
  const [rowKey, setRowKey] = useState(null); // `${action}:${id}` of a row action in flight
  const rowBusy = (id) => Boolean(rowKey && rowKey.endsWith(`:${id}`));

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
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id) => {
    setRowKey(`save:${id}`);
    try { await adminApi.updateDocType(id, { name: editName.trim() }); setEditId(null); toast.success('บันทึกแล้ว'); await load(); }
    catch (err) { toast.error(err.message); }
    finally { setRowKey(null); }
  };

  const remove = async (id, name) => {
    const ok = await confirm({ title: 'ลบประเภทเอกสาร', message: `ลบประเภทเอกสาร "${name}"?`, confirmLabel: 'ลบ' });
    if (!ok) return;
    setRowKey(`del:${id}`);
    try { await adminApi.deleteDocType(id); toast.success('ลบประเภทเอกสารแล้ว'); await load(); }
    catch (err) { toast.error(err.message); setRowKey(null); }
  };

  const field = 'field';

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={add} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อประเภทเอกสารใหม่" className={`${field} flex-1`} />
        <button type="submit" disabled={busy} className="btn-primary"><BusyLabel busy={busy} busyText="กำลังเพิ่ม…">+ เพิ่ม</BusyLabel></button>
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
                  <button onClick={() => saveEdit(t.id)} disabled={rowBusy(t.id)} className="text-emerald-600 hover:underline text-sm mr-3 disabled:opacity-50">
                    <BusyLabel busy={rowKey === `save:${t.id}`} busyText="กำลังบันทึก…">บันทึก</BusyLabel>
                  </button>
                  <button onClick={() => setEditId(null)} disabled={rowBusy(t.id)} className="text-slate-400 hover:underline text-sm disabled:opacity-50">ยกเลิก</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(t.id); setEditName(t.name); }} disabled={rowBusy(t.id)} className="text-blue-600 hover:underline text-sm mr-3 disabled:opacity-50">แก้ไข</button>
                  <button onClick={() => remove(t.id, t.name)} disabled={rowBusy(t.id)} className="text-red-500 hover:underline text-sm disabled:opacity-50">
                    <BusyLabel busy={rowKey === `del:${t.id}`} busyText="กำลังลบ…">ลบ</BusyLabel>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
