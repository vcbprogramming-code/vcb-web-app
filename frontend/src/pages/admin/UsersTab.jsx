import { useEffect, useRef, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
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
  const [created, setCreated] = useState(null); // { email, password } → credential hand-off panel
  const errRef = useRef(null);

  const isGoogle = loginMethod === 'google';

  useEffect(() => { if (error) errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [error]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    // client-side validation with clear Thai messages (no server round-trip)
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!email.trim()) { setError('กรุณากรอกอีเมล'); return; }
    if (!isGoogle && !editing && password.trim().length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (!isGoogle && editing && password && password.trim().length < 6) { setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setBusy(true);
    try {
      if (editing) {
        await adminApi.updateUser(user.id, { fullName, email, role, loginMethod });
        if (!isGoogle && password) await adminApi.resetPassword(user.id, password);
        onSaved();
      } else {
        await adminApi.createUser({
          fullName, email, role, loginMethod,
          password: isGoogle ? undefined : password,
        });
        // hand off the credentials for a NEW email account (admin must relay them)
        if (!isGoogle) setCreated({ email: email.trim(), password });
        else onSaved();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'field';

  // credential hand-off after creating a new email account
  if (created) {
    const copy = () => navigator.clipboard?.writeText(`อีเมล: ${created.email}\nรหัสผ่าน: ${created.password}`).catch(() => {});
    return (
      <Modal title="สร้างบัญชีเรียบร้อย" onClose={onSaved} size="md"
        footer={<button onClick={onSaved} className="btn-primary">เสร็จสิ้น</button>}>
        <p className="text-sm text-slate-600">ส่งข้อมูลเข้าสู่ระบบให้ผู้ใช้ (รหัสผ่านนี้แสดงครั้งเดียว):</p>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div><span className="text-slate-500">อีเมล:</span> <span className="font-medium text-slate-800">{created.email}</span></div>
          <div><span className="text-slate-500">รหัสผ่านชั่วคราว:</span> <span className="font-mono font-medium text-slate-800">{created.password}</span></div>
        </div>
        <button onClick={copy} className="btn-outline w-full"><Icon name="document" className="h-4 w-4" /> คัดลอกอีเมล + รหัสผ่าน</button>
      </Modal>
    );
  }

  return (
    <Modal
      title={editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
      onClose={busy ? undefined : onClose}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-outline">ยกเลิก</button>
          <button type="submit" form="user-form" disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </>
      }
    >
        <form id="user-form" onSubmit={submit} className="space-y-4">
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
            <label className="block text-sm font-medium text-slate-600 mb-1">บทบาท <span className="text-red-500">*</span></label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              <option value="hr">เจ้าหน้าที่ HR</option>
              <option value="executive">ผู้บริหาร</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>

          {error && <div ref={errRef} className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        </form>
    </Modal>
  );
}

export default function UsersTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(undefined); // undefined=closed, null=new, obj=edit

  const load = () => { setLoading(true); return adminApi.listUsers().then((r) => setUsers(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    if (u.is_active) {
      const ok = await confirm({ title: 'ปิดใช้งานผู้ใช้', message: `ปิดใช้งาน "${u.full_name}"?\nผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง`, confirmLabel: 'ปิดใช้งาน' });
      if (!ok) return;
    }
    try {
      await adminApi.updateUser(u.id, { isActive: !u.is_active });
      toast.success(u.is_active ? 'ปิดใช้งานผู้ใช้แล้ว' : 'เปิดใช้งานผู้ใช้แล้ว');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const removeUser = async (u) => {
    const ok = await confirm({ title: 'ลบผู้ใช้', message: `ลบผู้ใช้ "${u.full_name}" (${u.email})?\nเอกสารที่เขาเคยสร้าง/อนุมัติจะยังอยู่ แต่จะไม่แสดงชื่อผู้ใช้นี้ · ลบแล้วกู้คืนไม่ได้`, confirmLabel: 'ลบผู้ใช้' });
    if (!ok) return;
    try {
      await adminApi.deleteUser(u.id);
      toast.success('ลบผู้ใช้แล้ว');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditUser(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> เพิ่มผู้ใช้</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-x-auto">
        <table className="tbl min-w-[720px]">
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
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">กำลังโหลด…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">ยังไม่มีผู้ใช้ — กด “เพิ่มผู้ใช้” เพื่อเริ่ม</td></tr>
            ) : users.map((u) => (
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
        <UserModal user={editUser} onClose={() => setEditUser(undefined)} onSaved={() => { setEditUser(undefined); toast.success('บันทึกผู้ใช้แล้ว'); load(); }} />
      )}
    </div>
  );
}
