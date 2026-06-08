import { useEffect, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

const ROLE_CHIP = {
  admin: 'bg-purple-50 text-purple-700',
  executive: 'bg-blue-50 text-blue-700',
  hr: 'bg-slate-100 text-slate-600',
};

function UserModal({ user, onClose, onSaved }) {
  const editing = Boolean(user);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'hr');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editing) {
        await adminApi.updateUser(user.id, { fullName, role });
        if (password) await adminApi.resetPassword(user.id, password);
      } else {
        await adminApi.createUser({ fullName, email, password, role });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อ-นามสกุล *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">อีเมล *</label>
            <input type="email" value={email} disabled={editing} onChange={(e) => setEmail(e.target.value)}
              className={`${field} ${editing ? 'bg-slate-50 text-slate-400' : ''}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {editing ? 'รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)' : 'รหัสผ่าน *'}
            </label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? 'ไม่เปลี่ยน' : 'อย่างน้อย 6 ตัวอักษร'} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">บทบาท (Role) *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              <option value="hr">เจ้าหน้าที่ HR</option>
              <option value="executive">ผู้บริหาร</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(undefined); // undefined=closed, null=new, obj=edit

  const load = () => adminApi.listUsers().then((r) => setUsers(r.data)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    try {
      await adminApi.updateUser(u.id, { isActive: !u.is_active });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditUser(null)} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">+ เพิ่มผู้ใช้</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-5 py-3 font-semibold">ชื่อ</th>
              <th className="px-5 py-3 font-semibold">อีเมล</th>
              <th className="px-5 py-3 font-semibold">บทบาท</th>
              <th className="px-5 py-3 font-semibold">สถานะ</th>
              <th className="px-5 py-3 font-semibold text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_CHIP[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditUser(u)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                  <button onClick={() => toggleActive(u)} className="text-slate-500 hover:underline text-sm">
                    {u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser !== undefined && (
        <UserModal user={editUser} onClose={() => setEditUser(undefined)} onSaved={() => { setEditUser(undefined); load(); }} />
      )}
    </div>
  );
}
