import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';

/**
 * What one user is allowed to do, and which documents they can see.
 *
 * This used to be its own settings page with a "pick a user" dropdown on top —
 * so adding someone meant filling the user form, saving, walking to another menu
 * and finding them again. It now lives inside the user modal, where the person
 * being edited is already known, and saves together with the rest of the form.
 *
 * The parent owns the save button: it calls save(id) through the ref, passing the
 * id so a user created moments earlier can be given permissions in the same click.
 * Nothing is written when the admin never opened this tab and changed nothing.
 */
const UserPermissions = forwardRef(function UserPermissions({ userId, role }, ref) {
  const [catalog, setCatalog] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [effective, setEffective] = useState({});
  const [defaults, setDefaults] = useState({});
  const [projects, setProjects] = useState([]);
  const [docCodes, setDocCodes] = useState([]);
  const [visProjects, setVisProjects] = useState([]); // allowed project ids ([] = all)
  const [visCodes, setVisCodes] = useState([]);       // allowed doc codes ([] = all)
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = role === 'admin';

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      adminApi.permissionCatalog(),
      adminApi.listProjects(),
      adminApi.listDocCodeApprovers(),
      userId ? adminApi.getUserPermissions(userId) : Promise.resolve(null),
      userId ? adminApi.getUserVisibility(userId).catch(() => ({ data: {} })) : Promise.resolve(null),
    ])
      .then(([cat, proj, codes, perm, vis]) => {
        if (!live) return;
        setCatalog(cat.data || []);
        setRoleDefaults(cat.roleDefaults || {});
        setProjects(proj.data || []);
        setDocCodes(codes.data || []);
        if (perm) {
          setEffective(perm.data.effective || {});
          setDefaults(perm.data.defaults || {});
        }
        if (vis) {
          setVisProjects(vis.data.projectIds || []);
          setVisCodes(vis.data.docCodes || []);
        }
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [userId]);

  // A new user has no saved permissions yet, and changing the role on an existing
  // one re-baselines them server-side — either way the baseline shown has to be
  // the picked role's, not the one loaded a moment ago.
  useEffect(() => {
    if (loading || !role || !roleDefaults[role]) return;
    if (userId && !dirty) return; // existing user, untouched: keep what was saved
    if (!userId) {
      setEffective(roleDefaults[role]);
      setDefaults(roleDefaults[role]);
    }
  }, [role, roleDefaults, userId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    dirty: () => dirty,
    save: async (id) => {
      if (!dirty || !id) return;
      if (role !== 'admin') await adminApi.saveUserPermissions(id, effective);
      await adminApi.saveUserVisibility(id, visProjects, visCodes);
    },
  }), [dirty, effective, visProjects, visCodes, role]);

  const toggle = (module, action) => {
    setDirty(true);
    setEffective((prev) => ({ ...prev, [module]: { ...(prev[module] || {}), [action]: !(prev[module]?.[action]) } }));
  };
  const resetOne = (module, action) => {
    setDirty(true);
    setEffective((prev) => ({ ...prev, [module]: { ...(prev[module] || {}), [action]: Boolean(defaults[module]?.[action]) } }));
  };
  const toggleVisProject = (pid) => {
    setDirty(true);
    setVisProjects((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  };
  const toggleVisCode = (code) => {
    setDirty(true);
    setVisCodes((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6" label="กำลังโหลดสิทธิ์…" /></div>;
  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ผู้ดูแลระบบมีสิทธิ์ทุกอย่างโดยอัตโนมัติ — ไม่ต้องตั้งค่าสิทธิ์
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            เปิดสวิตช์เพื่อให้สิทธิ์ · ปิดเพื่อห้าม · ค่าเริ่มต้นมาจาก<b>บทบาท</b>ของผู้ใช้ — รายการที่ปรับต่างจากบทบาทจะมีป้าย{' '}
            <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">แก้เฉพาะคนนี้</span>
          </p>
          <div className="space-y-4">
            {catalog.map((mod) => (
              <div key={mod.module} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700">{mod.label}</div>
                <div className="divide-y divide-slate-100">
                  {mod.actions.map((a) => {
                    const on = Boolean(effective[mod.module]?.[a.key]);
                    const def = Boolean(defaults[mod.module]?.[a.key]);
                    const overridden = on !== def;
                    return (
                      <div key={a.key} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                        <span className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          {a.label}
                          {overridden && (
                            <>
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">แก้เฉพาะคนนี้</span>
                              <button type="button" onClick={() => resetOne(mod.module, a.key)} className="text-[11px] text-slate-400 hover:text-brand hover:underline">
                                คืนค่าเริ่มต้น ({def ? 'อนุญาต' : 'ห้าม'})
                              </button>
                            </>
                          )}
                        </span>
                        <button type="button" onClick={() => toggle(mod.module, a.key)} aria-pressed={on}
                          aria-label={`${a.label} — ${on ? 'อนุญาต' : 'ห้าม'}`}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? 'bg-brand' : 'bg-slate-300'}`}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* per-user document visibility (#8) — applies to admins too? no: an admin
          sees everything by design, so the scope would be a lie on screen */}
      {!isAdmin && (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700">
            การมองเห็นเอกสาร (E-Memo)
          </div>
          <div className="space-y-4 p-4">
            <p className="text-xs text-slate-400">
              เลือกโครงการ/ประเภทที่ผู้ใช้คนนี้มองเห็นได้ — <b>ถ้าไม่เลือกเลย = เห็นทุกเอกสาร</b> ·
              ถ้าเลือกบางอัน จะเห็นเฉพาะเอกสารที่ตรงกับที่เลือกเท่านั้น
            </p>
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">
                โครงการที่เห็นได้ {visProjects.length === 0 && <span className="text-emerald-600">(ทุกโครงการ)</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {projects.map((p) => (
                  <button key={p.id} type="button" onClick={() => toggleVisProject(p.id)} className={chip(visProjects.includes(p.id))}>
                    {p.code}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">
                ประเภท/รหัสที่เห็นได้ {visCodes.length === 0 && <span className="text-emerald-600">(ทุกประเภท)</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {docCodes.map((c) => (
                  <button key={c.code} type="button" onClick={() => toggleVisCode(c.code)} className={chip(visCodes.includes(c.code))} title={c.department || ''}>
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
            {(visProjects.length > 0 || visCodes.length > 0) && (
              <button type="button" onClick={() => { setDirty(true); setVisProjects([]); setVisCodes([]); }}
                className="text-sm text-slate-500 hover:text-slate-800">
                ล้าง (เห็นทุกเอกสาร)
              </button>
            )}
          </div>
        </div>
      )}

      {dirty && (
        <p className="inline-flex items-center gap-1 text-xs text-amber-600">
          <Icon name="clock" className="h-3.5 w-3.5" /> การเปลี่ยนแปลงจะถูกบันทึกเมื่อกดปุ่มบันทึกด้านล่าง
        </p>
      )}
    </div>
  );
});

export default UserPermissions;
