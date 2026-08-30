import { useEffect, useRef, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { BusyLabel } from '../../components/Spinner.jsx';
import UserPermissions from './UserPermissions.jsx';
import { useT } from '../../lib/i18n.jsx';

const ROLE_CHIP = {
  admin: 'bg-purple-50 text-purple-700',
  executive: 'bg-blue-50 text-blue-700',
  hr: 'bg-slate-100 text-slate-600',
  recorder: 'bg-emerald-50 text-emerald-700',
  verifier: 'bg-amber-50 text-amber-700',
};

/**
 * The five levels the work-log acceptance criteria name, in the order an
 * administrator thinks about them: who keys the day, who signs it off, then the
 * office roles. This list is the one place the choice is defined — the labels
 * come from nav.js so the menu, the chips and this picker can never drift apart.
 */
const ROLE_OPTIONS = ['recorder', 'verifier', 'hr', 'executive', 'admin'];

/** One line on what each level may do, so the choice is not a guess. */
const ROLE_HINT = {
  recorder: 'บันทึกงานรายวันของไซต์ที่รับผิดชอบ — ยืนยันข้อมูลของตัวเองไม่ได้',
  verifier: 'ตรวจสอบและยืนยันข้อมูลของโครงการ — ไม่บันทึกงานรายวัน',
  hr: 'ดูและบันทึกข้อมูลตามโครงการที่รับผิดชอบ',
  executive: 'ดูได้ทุกโครงการรวมข้อมูลการเงิน และอนุมัติรายการได้',
  admin: 'เข้าถึงและตั้งค่าได้ทั้งหมด',
};


/**
 * The signature an admin holds on file for another user. Kept out of the main
 * form on purpose: it uploads on pick, so a half-filled form that is cancelled
 * never leaves a stale image behind.
 */
function UserSignature({ user }) {
  const t = useT();
  const toast = useToast();
  const [url, setUrl] = useState(null);
  const [has, setHas] = useState(Boolean(user?.has_signature));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!has) { setUrl(null); return undefined; }
    let live = true; let made = null;
    adminApi.userSignatureBlobUrl(user.id)
      .then((u) => { if (live) { made = u; setUrl(u); } else URL.revokeObjectURL(u); })
      .catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [user?.id, has]);

  const pick = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error(t('ลายเซ็นต้องเป็นรูปภาพ')); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error(t('รูปลายเซ็นใหญ่เกิน 2 MB')); return; }
    setBusy(true);
    try { await adminApi.uploadUserSignature(user.id, f); setHas(true); toast.success(t('บันทึกลายเซ็นแล้ว')); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true);
    try { await adminApi.clearUserSignature(user.id); setHas(false); toast.success(t('ลบลายเซ็นแล้ว')); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{t('ลายเซ็นของผู้ใช้รายนี้')}</label>
      <p className="mb-2 text-xs text-slate-400">
        {t('ใช้พิมพ์บนหนังสือที่ผู้ใช้รายนี้อนุมัติ · การเปลี่ยนแปลงถูกบันทึกในประวัติระบบว่าผู้ดูแลคนใดเป็นผู้ตั้งให้')}
      </p>
      {has ? (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
          {url
            ? <img src={url} alt={t('ลายเซ็น')} className="h-14 w-auto object-contain" />
            : <span className="text-xs text-slate-400">{t('กำลังโหลด…')}</span>}
          <div className="flex gap-3">
            <label className={`cursor-pointer text-sm font-medium text-blue-600 hover:underline ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              {t('เปลี่ยนรูป')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
            </label>
            <button type="button" onClick={clear} disabled={busy} className="text-sm text-red-500 hover:underline disabled:opacity-50">ลบลายเซ็น</button>
          </div>
        </div>
      ) : (
        <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-5 hover:border-slate-300 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Icon name="signature" className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-600">{busy ? 'กำลังอัปโหลด…' : 'คลิกเพื่ออัปโหลดลายเซ็นให้ผู้ใช้รายนี้'}</span>
          <span className="text-xs text-slate-400">PNG/JPG · สูงสุด 2 MB</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
        </label>
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(user);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'hr');
  const [loginMethod, setLoginMethod] = useState(user?.login_method || 'email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null); // { email, password } → credential hand-off panel
  // สิทธิ์ used to be a separate settings menu with its own "pick a user" list.
  // It belongs to the person being edited, so it lives here as a second tab and
  // saves on the same button.
  const [tab, setTab] = useState('info'); // info | perms
  const permsRef = useRef(null);
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
        // after the account: a role change re-baselines permissions server-side,
        // so these overrides must be written on top of the NEW role, not the old
        await permsRef.current?.save(user.id);
        onSaved();
      } else {
        const res = await adminApi.createUser({
          fullName, email, role, loginMethod,
          password: isGoogle ? undefined : password,
        });
        // one click, two calls: the account has to exist before permissions can
        // hang off it, but the admin shouldn't have to come back for a second pass
        await permsRef.current?.save(res?.data?.id);
        // hand off the credentials for a NEW email account (admin must relay them)
        if (!isGoogle) setCreated({ email: email.trim(), password });
        else onSaved();
      }
    } catch (err) {
      setError(err.message);
      setTab('info');
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
        <div className="mb-4 flex gap-2 border-b border-slate-200 pb-2">
          {[['info', 'ข้อมูลผู้ใช้'], ['perms', 'สิทธิ์การใช้งาน']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                tab === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Both panels stay mounted: the permissions editor holds unsaved edits,
            and unmounting it on a tab switch would throw them away silently. */}
        <div className={tab === 'perms' ? 'hidden' : ''}>
        <form id="user-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('ชื่อ-นามสกุล')} <span className="text-red-500">*</span></label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('อีเมล')} <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            {isGoogle && <p className="mt-1 text-xs text-slate-400">{t('ต้องเป็นอีเมล Google (Gmail/Workspace) ที่จะใช้ Sign in with Google')}</p>}
          </div>

          {/* login method — how this account signs in */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('วิธีเข้าสู่ระบบ')} <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setLoginMethod('email')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${loginMethod === 'email' ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {t('อีเมล')}
              </button>
              <button type="button" onClick={() => setLoginMethod('google')}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${loginMethod === 'google' ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                Google
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {isGoogle ? t('บัญชีนี้จะเข้าได้เฉพาะปุ่ม “Sign in with Google” เท่านั้น') : t('บัญชีนี้จะเข้าด้วยการกรอกอีเมล (ไม่ใช้ Google)')}
            </p>
          </div>

          {/* password only for email accounts */}
          {!isGoogle && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {editing ? t('รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)') : <>{t('รหัสผ่าน')} <span className="text-red-500">*</span></>}
              </label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? t('ไม่เปลี่ยน') : t('อย่างน้อย 6 ตัวอักษร')} className={field} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{t('บทบาท')} <span className="text-red-500">*</span></label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r] || r)}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">{t(ROLE_HINT[role] || '')}</p>
          </div>

          {/* Signature — admins can put one on file for someone else, which the
              client asked for so an executive can be onboarded ready to sign.
              Only on EDIT: the account has to exist before a file can hang off
              it. Uploading takes effect immediately (it is not part of this
              form's save) and is recorded in the audit log with both names. */}
          {editing && <UserSignature user={user} />}

          {error && <div ref={errRef} className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        </form>
        </div>

        <div className={tab === 'perms' ? '' : 'hidden'}>
          <UserPermissions ref={permsRef} userId={user?.id || null} role={role} />
        </div>
    </Modal>
  );
}

export default function UsersTab() {
  const t = useT();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [busyKey, setBusyKey] = useState(null); // `${action}:${id}` of the row action in flight
  const rowBusy = (u) => Boolean(busyKey && busyKey.endsWith(`:${u.id}`));

  const load = () => { setLoading(true); return adminApi.listUsers().then((r) => setUsers(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    if (u.is_active) {
      const ok = await confirm({ title: t('ปิดใช้งานผู้ใช้'), message: `ปิดใช้งาน "${u.full_name}"?\nผู้ใช้จะเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง`, confirmLabel: t('ปิดใช้งาน') });
      if (!ok) return;
    }
    setBusyKey(`toggle:${u.id}`);
    try {
      await adminApi.updateUser(u.id, { isActive: !u.is_active });
      toast.success(u.is_active ? t('ปิดใช้งานผู้ใช้แล้ว') : t('เปิดใช้งานผู้ใช้แล้ว'));
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyKey(null); }
  };

  const removeUser = async (u) => {
    const ok = await confirm({ title: t('ลบผู้ใช้'), message: `ลบผู้ใช้ "${u.full_name}" (${u.email})?\nเอกสารที่เขาเคยสร้าง/อนุมัติจะยังอยู่ แต่จะไม่แสดงชื่อผู้ใช้นี้ · ลบแล้วกู้คืนไม่ได้`, confirmLabel: t('ลบผู้ใช้') });
    if (!ok) return;
    setBusyKey(`del:${u.id}`);
    try {
      await adminApi.deleteUser(u.id);
      toast.success(t('ลบผู้ใช้แล้ว'));
      await load();
    } catch (e) { toast.error(e.message); setBusyKey(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditUser(null)} className="btn-primary"><Icon name="plus" className="h-4 w-4" /> {t('เพิ่มผู้ใช้')}</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="card !p-0 overflow-x-auto">
        <table className="tbl min-w-[720px]">
          <thead>
            <tr className="tbl-head">
              <th className="tbl-th">{t('ชื่อ')}</th>
              <th className="tbl-th">{t('อีเมล')}</th>
              <th className="tbl-th">{t('เข้าระบบด้วย')}</th>
              <th className="tbl-th">{t('บทบาท')}</th>
              <th className="tbl-th">{t('สถานะ')}</th>
              <th className="tbl-th">{t('สังกัดโครงการ')}</th>
              <th className="tbl-th">{t('ลายเซ็น')}</th>
              <th className="tbl-th text-right">{t('จัดการ')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">{t('กำลังโหลด…')}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">{t('ยังไม่มีผู้ใช้ — กด “เพิ่มผู้ใช้” เพื่อเริ่ม')}</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="tbl-row">
                <td className="tbl-td font-medium text-slate-800">{u.full_name}</td>
                <td className="tbl-td text-slate-600">{u.email}</td>
                <td className="tbl-td">
                  <span className={`chip ${u.login_method === 'google' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                    {u.login_method === 'google' ? 'Google' : t('อีเมล')}
                  </span>
                </td>
                <td className="tbl-td">
                  <span className={`chip ${ROLE_CHIP[u.role]}`}>{t(ROLE_LABELS[u.role] || u.role)}</span>
                </td>
                <td className="tbl-td">
                  <span className={`chip ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? t('ใช้งาน') : t('ปิดใช้งาน', null, 'status')}
                  </span>
                </td>
                {/* which projects this person is scoped to. Empty = no restriction,
                    which is worth saying in words — a blank cell reads like missing
                    data rather than "sees everything". */}
                <td className="tbl-td">
                  {(u.projects || []).length === 0 ? (
                    <span className="text-xs text-slate-400">{t('ทุกโครงการ')}</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {u.projects.map((p) => (
                        <span key={p.id} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: p.color || '#64748b' }}>{p.code}</span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="tbl-td">
                  {u.has_signature
                    ? <span className="chip bg-emerald-50 text-emerald-700">{t('มีแล้ว')}</span>
                    : <span className="text-xs text-slate-400">{t('ยังไม่มี')}</span>}
                </td>
                <td className="tbl-td text-right whitespace-nowrap">
                  <button onClick={() => setEditUser(u)} disabled={rowBusy(u)} className="text-blue-600 hover:underline text-sm mr-3 disabled:opacity-50">{t('แก้ไข')}</button>
                  <button onClick={() => toggleActive(u)} disabled={rowBusy(u)} className="text-slate-500 hover:underline text-sm mr-3 disabled:opacity-50">
                    <BusyLabel busy={busyKey === `toggle:${u.id}`} busyText={t('กำลังบันทึก…')}>
                      {u.is_active ? t('ปิดใช้งาน') : t('เปิดใช้งาน')}
                    </BusyLabel>
                  </button>
                  {/* can't delete your own account */}
                  {u.id !== profile?.id && (
                    <button onClick={() => removeUser(u)} disabled={rowBusy(u)} className="text-sm text-red-500 hover:underline disabled:opacity-50">
                      <BusyLabel busy={busyKey === `del:${u.id}`} busyText={t('กำลังลบ…')}>{t('ลบ')}</BusyLabel>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser !== undefined && (
        <UserModal user={editUser} onClose={() => setEditUser(undefined)} onSaved={() => { setEditUser(undefined); toast.success(t('บันทึกผู้ใช้แล้ว')); load(); }} />
      )}
    </div>
  );
}
