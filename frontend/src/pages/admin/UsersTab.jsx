import { useEffect, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
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
  const [loginMethod, setLoginMethod] = useState(user?.login_method || 'email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isGoogle = loginMethod === 'google';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editing) {
        await adminApi.updateUser(user.id, { fullName, email, role, loginMethod });
        // password only applies to email accounts
        if (!isGoogle && password) await adminApi.resetPassword(user.id, password);
      } else {
        // email accounts require a password (standard email+password login)
        if (!isGoogle && !password) {
          setError('บัญชีแบบอีเมลต้องตั้งรหัสผ่าน');
          setBusy(false);
          return;
        }
        await adminApi.createUser({
          fullName, email, role, loginMethod,
          password: isGoogle ? undefined : password,
        });
      }
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
      <div className="bg-[#0f1b33] border border-white/10 rounded-2xl shadow-xl w-full max-w-md text-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icon name="x" className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">อีเมล <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            {isGoogle && <p className="mt-1 text-xs text-slate-400">ต้องเป็นอีเมล Google (Gmail/Workspace) ที่จะใช้ Sign in with Google</p>}
          </div>

          {/* login method — how this account signs in */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">วิธีเข้าสู่ระบบ <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setLoginMethod('email')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${loginMethod === 'email' ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                อีเมล
              </button>
              <button type="button" onClick={() => setLoginMethod('google')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${loginMethod === 'google' ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                Google
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {isGoogle ? 'บัญชีนี้จะเข้าได้เฉพาะปุ่ม “Sign in with Google” เท่านั้น' : 'บัญชีนี้จะเข้าด้วยการกรอกอีเมล (ไม่ใช้ Google)'}
            </p>
          </div>

          {/* password only for email accounts */}
          {!isGoogle && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {editing ? 'รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)' : <>รหัสผ่าน <span className="text-red-500">*</span></>}
              </label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? 'ไม่เปลี่ยน' : 'อย่างน้อย 6 ตัวอักษร'} className={field} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">บทบาท (Role) <span className="text-red-500">*</span></label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              <option value="hr">เจ้าหน้าที่ HR</option>
              <option value="executive">ผู้บริหาร</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersTab() {
  const { profile } = useAuth();
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

  const removeUser = async (u) => {
    if (!window.confirm(`ลบผู้ใช้ "${u.full_name}" (${u.email})?\nเอกสารที่เขาเคยสร้าง/อนุมัติจะยังอยู่ แต่จะไม่แสดงชื่อผู้ใช้นี้ · ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      await adminApi.deleteUser(u.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditUser(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มผู้ใช้</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">ชื่อ</th>
              <th className="tbl-th">อีเมล</th>
              <th className="tbl-th">เข้าระบบด้วย</th>
              <th className="tbl-th">บทบาท</th>
              <th className="tbl-th">สถานะ</th>
              <th className="tbl-th text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="tbl-row">
                <td className="tbl-td font-medium text-slate-800">{u.full_name}</td>
                <td className="tbl-td text-slate-600">{u.email}</td>
                <td className="tbl-td">
                  <span className={`chip ${u.login_method === 'google' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                    {u.login_method === 'google' ? 'Google' : 'อีเมล'}
                  </span>
                </td>
                <td className="tbl-td">
                  <span className={`chip ${ROLE_CHIP[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="tbl-td">
                  <span className={`chip ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setEditUser(u)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                  <button onClick={() => toggleActive(u)} className="text-slate-500 hover:underline text-sm mr-3">
                    {u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                  {/* can't delete your own account */}
                  {u.id !== profile?.id && (
                    <button onClick={() => removeUser(u)} className="text-sm text-red-500 hover:underline">ลบ</button>
                  )}
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
