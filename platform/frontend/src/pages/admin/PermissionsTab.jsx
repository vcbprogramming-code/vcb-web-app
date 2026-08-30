import { useEffect, useState } from 'react';
import { adminApi, ROLE_LABELS } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

/**
 * Action-level permissions editor (backlog round 2 #3). Pick a user, then toggle
 * each module/action. A toggle writes an explicit override; the effective value
 * (role default OR override) is what the checkbox shows. Admins get everything
 * and can't be edited.
 */
export default function PermissionsTab() {
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [effective, setEffective] = useState({}); // { module: { action: bool } }
  const [role, setRole] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([adminApi.listUsers(), adminApi.permissionCatalog()])
      .then(([u, c]) => { setUsers(u.data); setCatalog(c.data); })
      .catch((e) => setError(e.message));
  }, []);

  const selectUser = (id) => {
    setSelectedId(id);
    setSaved(false);
    setError(null);
    if (!id) { setEffective({}); setRole(null); return; }
    adminApi.getUserPermissions(id)
      .then((r) => { setEffective(r.data.effective || {}); setRole(r.data.role); })
      .catch((e) => setError(e.message));
  };

  const toggle = (module, action) => {
    setSaved(false);
    setEffective((prev) => ({
      ...prev,
      [module]: { ...(prev[module] || {}), [action]: !(prev[module]?.[action]) },
    }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // send the whole effective map as the override set (explicit + resolved)
      await adminApi.saveUserPermissions(selectedId, effective);
      setSaved(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const isAdmin = role === 'admin';

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">เลือกผู้ใช้</label>
        <select value={selectedId} onChange={(e) => selectUser(e.target.value)} className="field">
          <option value="">— เลือกผู้ใช้ —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.email}) · {ROLE_LABELS[u.role] || u.role}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {selectedId && isAdmin && (
        <div className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3">
          ผู้ดูแลระบบมีสิทธิ์ทุกอย่างโดยอัตโนมัติ — ไม่ต้องตั้งค่าสิทธิ์
        </div>
      )}

      {selectedId && !isAdmin && (
        <>
          <p className="text-xs text-slate-400">
            ติ๊กเพื่อให้สิทธิ์ · เอาติ๊กออกเพื่อห้าม (ค่าเริ่มต้นมาจากบทบาทของผู้ใช้ กดเพื่อปรับเฉพาะคนนี้)
          </p>
          <div className="space-y-4">
            {catalog.map((mod) => (
              <div key={mod.module} className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 border-b border-slate-200">{mod.label}</div>
                <div className="divide-y divide-slate-100">
                  {mod.actions.map((a) => {
                    const on = Boolean(effective[mod.module]?.[a.key]);
                    return (
                      <label key={a.key} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50">
                        <span className="text-sm text-slate-700">{a.label}</span>
                        <button
                          type="button"
                          onClick={() => toggle(mod.module, a.key)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-brand' : 'bg-slate-300'}`}
                          aria-pressed={on}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'กำลังบันทึก…' : 'บันทึกสิทธิ์'}</button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                <Icon name="check" className="h-4 w-4" /> บันทึกแล้ว
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
